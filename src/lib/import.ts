import fs from "node:fs/promises";
import path from "node:path";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { coversDir } from "@/lib/covers";

/**
 * Restore of a MyReads JSON export (the file /api/export produces).
 *
 * Semantics: merge into the current user's library. Books already present —
 * same ISBN, or same title + first author (case-insensitive) — are skipped,
 * so restoring on top of a live library is safe and restoring into a fresh
 * instance brings everything back. Cover image files are not part of the
 * export; local cover paths are kept only when the file still exists (same
 * instance), otherwise cleared.
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
}

/** A local cover path from the export is only useful if the file survived. */
async function resolveCoverUrl(coverUrl: string | null | undefined): Promise<string | null> {
  if (!coverUrl) return null;
  if (!coverUrl.startsWith("/api/covers/")) return coverUrl; // remote URL — keep
  try {
    await fs.access(path.join(coversDir(), path.basename(coverUrl)));
    return coverUrl;
  } catch {
    return null;
  }
}

export async function importLibrary(
  userId: string,
  payload: unknown,
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

    await prisma.book.create({
      data: {
        userId,
        title: b.title,
        authors: b.authors,
        isbn,
        description: b.description ?? null,
        coverUrl: await resolveCoverUrl(b.coverUrl),
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
      },
    });
    if (isbn) existingIsbns.add(isbn);
    existingTitleAuthor.add(key);
    booksCreated++;
  }

  return {
    booksCreated,
    booksSkipped,
    booksInvalid,
    shelvesCreated,
    goalsRestored: data.readingGoals.length,
  };
}
