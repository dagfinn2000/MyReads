import fs from "node:fs/promises";
import path from "node:path";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { coversDir } from "@/lib/covers";

/**
 * Restore of a MyReads export — either the `library.json` from a zip backup
 * (with `getCoverFile` supplying the bundled cover images) or a legacy plain
 * JSON export.
 *
 * Semantics: merge into the current user's library. Books already present —
 * same ISBN, or same title + first author (case-insensitive) — are skipped,
 * so restoring on top of a live library is safe and restoring into a fresh
 * instance brings everything back. A book's local cover path is kept when
 * the file already exists (same instance) or can be restored from the
 * backup, otherwise cleared.
 */

const dateField = z
  .string()
  .nullable()
  .optional()
  .transform((s) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  });

/** Quotes are additive (version-1 exports without them parse to []). */
const importedQuoteSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  page: z.number().int().min(0).max(100000).nullable().optional().catch(null),
  note: z.string().trim().max(2000).nullable().optional(),
  createdAt: dateField,
});

const importedBookSchema = z.object({
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim().max(200)).catch([]),
  isbn: z.string().trim().max(20).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  coverUrl: z.string().max(2000).nullable().optional(),
  pageCount: z.number().int().min(1).max(100000).nullable().optional().catch(null),
  publishedDate: z.string().trim().max(20).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().max(50)).catch([]),
  format: z.nativeEnum(BookFormat).catch(BookFormat.PHYSICAL),
  owned: z.boolean().catch(true),
  seriesName: z.string().trim().max(200).nullable().optional(),
  seriesNumber: z.number().min(0).max(10000).nullable().optional().catch(null),
  openLibraryId: z.string().trim().max(50).nullable().optional(),
  status: z.nativeEnum(ReadingStatus).catch(ReadingStatus.WANT_TO_READ),
  rating: z.number().int().min(1).max(10).nullable().optional().catch(null),
  review: z.string().max(20000).nullable().optional(),
  dateStarted: dateField,
  dateFinished: dateField,
  timesRead: z.number().int().min(0).max(1000).catch(0),
  currentPage: z.number().int().min(0).max(100000).nullable().optional().catch(null),
  shelves: z.array(z.string().trim().min(1).max(50)).catch([]),
  quotes: z.array(importedQuoteSchema).catch([]),
  createdAt: dateField,
});

const exportPayloadSchema = z.object({
  format: z.literal("myreads-export"),
  version: z.literal(1),
  shelves: z.array(z.object({ name: z.string().trim().min(1).max(50) })).catch([]),
  readingGoals: z
    .array(z.object({ year: z.number().int().min(1900).max(2200), target: z.number().int().min(1).max(10000) }))
    .catch([]),
  books: z.array(z.unknown()),
});

export interface ImportSummary {
  booksCreated: number;
  booksSkipped: number;
  booksInvalid: number;
  shelvesCreated: number;
  goalsRestored: number;
  coversRestored: number;
  quotesRestored: number;
}

/** Reads a cover image bundled with the backup (zip imports supply this). */
export type CoverFileReader = (filename: string) => Promise<Uint8Array | null>;

/** Only names the cover cache itself produces get written back — and only
 *  extensions /api/covers actually serves. Keeps a hand-crafted backup from
 *  planting arbitrary files in the cache directory. */
const SAFE_COVER_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|png|gif|webp)$/;

/**
 * A local cover path from the export is kept if the file already exists on
 * this instance, or can be written back from the backup; otherwise cleared.
 * Returns the resolved URL and whether a file was restored from the backup.
 */
async function resolveCoverUrl(
  coverUrl: string | null | undefined,
  getCoverFile: CoverFileReader | undefined,
): Promise<{ url: string | null; restored: boolean }> {
  if (!coverUrl) return { url: null, restored: false };
  if (!coverUrl.startsWith("/api/covers/")) return { url: coverUrl, restored: false }; // remote URL — keep

  const filename = path.basename(coverUrl);
  const target = path.join(coversDir(), filename);
  try {
    await fs.access(target);
    return { url: coverUrl, restored: false }; // same instance — file survived
  } catch {
    // fall through to the backup
  }

  if (getCoverFile && SAFE_COVER_FILENAME.test(filename)) {
    try {
      const data = await getCoverFile(filename);
      if (data) {
        await fs.mkdir(coversDir(), { recursive: true });
        await fs.writeFile(target, data);
        return { url: coverUrl, restored: true };
      }
    } catch {
      // unreadable zip entry / disk error — treat as missing
    }
  }
  return { url: null, restored: false };
}

export async function importLibrary(
  userId: string,
  payload: unknown,
  getCoverFile?: CoverFileReader,
): Promise<ImportSummary | { error: string }> {
  const parsed = exportPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Not a MyReads export file (or an unsupported version)." };
  }
  const data = parsed.data;

  // Shelves: create the missing ones, map every name to an id.
  const existingShelves = await prisma.shelf.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const shelfIdByName = new Map(existingShelves.map((s) => [s.name, s.id]));
  const wantedShelves = new Set<string>(data.shelves.map((s) => s.name));
  for (const raw of data.books) {
    const shelves = (raw as { shelves?: unknown })?.shelves;
    if (Array.isArray(shelves)) {
      for (const name of shelves) if (typeof name === "string") wantedShelves.add(name);
    }
  }
  let shelvesCreated = 0;
  for (const name of wantedShelves) {
    if (!shelfIdByName.has(name)) {
      const shelf = await prisma.shelf.create({ data: { userId, name } });
      shelfIdByName.set(name, shelf.id);
      shelvesCreated++;
    }
  }

  // Reading goals: upsert per year.
  for (const goal of data.readingGoals) {
    await prisma.readingGoal.upsert({
      where: { userId_year: { userId, year: goal.year } },
      create: { userId, year: goal.year, target: goal.target },
      update: { target: goal.target },
    });
  }

  // Existing books, for duplicate detection.
  const existing = await prisma.book.findMany({
    where: { userId },
    select: { title: true, authors: true, isbn: true },
  });
  const existingIsbns = new Set(existing.map((b) => b.isbn).filter(Boolean));
  const existingTitleAuthor = new Set(
    existing.map(
      (b) => `${b.title.toLowerCase()}|${(b.authors[0] ?? "").toLowerCase()}`,
    ),
  );

  let booksCreated = 0;
  let booksSkipped = 0;
  let booksInvalid = 0;
  let coversRestored = 0;
  let quotesRestored = 0;

  for (const raw of data.books) {
    const parsedBook = importedBookSchema.safeParse(raw);
    if (!parsedBook.success) {
      booksInvalid++;
      continue;
    }
    const b = parsedBook.data;
    const isbn = b.isbn?.replace(/[\s-]/g, "") || null;
    const key = `${b.title.toLowerCase()}|${(b.authors[0] ?? "").toLowerCase()}`;
    if ((isbn && existingIsbns.has(isbn)) || existingTitleAuthor.has(key)) {
      booksSkipped++;
      continue;
    }

    const cover = await resolveCoverUrl(b.coverUrl, getCoverFile);
    if (cover.restored) coversRestored++;

    await prisma.book.create({
      data: {
        userId,
        title: b.title,
        authors: b.authors,
        isbn,
        description: b.description ?? null,
        coverUrl: cover.url,
        pageCount: b.pageCount ?? null,
        publishedDate: b.publishedDate ?? null,
        tags: [...new Set(b.tags)],
        format: b.format,
        owned: b.owned,
        seriesName: b.seriesName ?? null,
        seriesNumber: b.seriesNumber ?? null,
        openLibraryId: b.openLibraryId ?? null,
        status: b.status,
        rating: b.rating ?? null,
        review: b.review ?? null,
        dateStarted: b.dateStarted,
        dateFinished: b.dateFinished,
        timesRead: b.timesRead,
        currentPage: b.currentPage ?? null,
        searchText: [b.title, ...b.authors, b.seriesName ?? ""]
          .join(" ")
          .trim()
          .toLowerCase(),
        // Preserve "date added" ordering from the original library.
        ...(b.createdAt && { createdAt: b.createdAt }),
        shelves: {
          connect: b.shelves
            .map((name) => shelfIdByName.get(name))
            .filter((id): id is string => !!id)
            .map((id) => ({ id })),
        },
        quotes: {
          create: b.quotes.map((q) => ({
            text: q.text,
            page: q.page ?? null,
            note: q.note ?? null,
            ...(q.createdAt && { createdAt: q.createdAt }),
          })),
        },
      },
    });
    if (isbn) existingIsbns.add(isbn);
    existingTitleAuthor.add(key);
    booksCreated++;
    quotesRestored += b.quotes.length;
  }

  return {
    booksCreated,
    booksSkipped,
    booksInvalid,
    shelvesCreated,
    goalsRestored: data.readingGoals.length,
    coversRestored,
    quotesRestored,
  };
}
