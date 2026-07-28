import fs from "node:fs/promises";
import path from "node:path";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { coversDir } from "@/lib/covers";
import { buildSearchText } from "@/lib/utils";

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

/** Past reads are additive too (exports without them parse to []). */
const importedReadSchema = z.object({
  dateStarted: dateField,
  dateFinished: dateField,
  rating: z.number().int().min(1).max(10).nullable().optional().catch(null),
  createdAt: dateField,
});

/** Reading-log entries are additive too; an entry without a usable date is
 *  meaningless (every consumer is time-based) and gets dropped. */
const importedProgressSchema = z.object({
  page: z.number().int().min(0).max(100000),
  date: dateField,
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
  reads: z.array(importedReadSchema).catch([]),
  progress: z.array(importedProgressSchema).catch([]),
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
  readsRestored: number;
  progressRestored: number;
  /** Set when the restore stopped early. Everything counted above did land —
   *  a restore is resumable by re-running it, since books already present are
   *  skipped — but the caller must not present the run as complete. */
  incomplete?: { after: number; reason: string };
}

/** How many book creates are in flight at once. Each book is a single nested
 *  write (book + its quotes, reads and progress), so per-book atomicity is
 *  already guaranteed by the database; this only bounds how many of those
 *  round-trips overlap. Sequential made a 1000-book restore 1000 waits long;
 *  unbounded would open 1000 connections. */
const IMPORT_CONCURRENCY = 10;

/**
 * Runs `worker` over `items`, at most `limit` at a time, preserving order in
 * the returned results and stopping at the first failure.
 *
 * "Stopping" has to be done deliberately. Letting the rejection propagate out
 * of `Promise.all` returns while the other runners are still pulling items and
 * writing — so the caller reads its progress counters mid-flight and reports a
 * total lower than what actually reached the database, which is exactly the
 * number a user is told to trust when re-running an interrupted restore. A
 * second runner failing afterwards would also surface as an unhandled
 * rejection, since nothing is awaiting it any more.
 *
 * So: the first error is captured, remaining runners stop claiming new work,
 * everything already in flight is allowed to settle, and only then is the
 * error rethrown.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failure: unknown = null;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      if (failure !== null) return;
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        failure ??= err;
        return;
      }
    }
  });

  await Promise.all(runners); // always settles: runners swallow their own error
  if (failure !== null) throw failure;
  return results;
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
  // Missing shelves in one statement, then read back to learn their ids —
  // two round-trips instead of one per shelf.
  const missingShelves = [...wantedShelves].filter((n) => !shelfIdByName.has(n));
  let shelvesCreated = 0;
  if (missingShelves.length > 0) {
    const created = await prisma.shelf.createMany({
      data: missingShelves.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });
    shelvesCreated = created.count;
    const refreshed = await prisma.shelf.findMany({
      where: { userId, name: { in: missingShelves } },
      select: { id: true, name: true },
    });
    for (const s of refreshed) shelfIdByName.set(s.name, s.id);
  }

  // Reading goals: upsert per year, concurrently — they're independent.
  await mapWithConcurrency(data.readingGoals, IMPORT_CONCURRENCY, (goal) =>
    prisma.readingGoal.upsert({
      where: { userId_year: { userId, year: goal.year } },
      create: { userId, year: goal.year, target: goal.target },
      update: { target: goal.target },
    }),
  );

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

  let booksSkipped = 0;
  let booksInvalid = 0;

  // Pass 1 — decide, sequentially. Duplicate detection folds each accepted
  // book back into the lookup sets, so a payload containing the same book
  // twice keeps skipping the second copy. That ordering dependency is why
  // the decisions stay serial; only the slow database work below is
  // parallelised.
  const accepted: { b: z.infer<typeof importedBookSchema>; isbn: string | null }[] = [];
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
    if (isbn) existingIsbns.add(isbn);
    existingTitleAuthor.add(key);
    accepted.push({ b, isbn });
  }

  let booksCreated = 0;
  let coversRestored = 0;
  let quotesRestored = 0;
  let readsRestored = 0;
  let progressRestored = 0;
  let incomplete: ImportSummary["incomplete"];

  // Pass 2 — write, with bounded concurrency. Each book is one nested create,
  // so a book and its quotes/reads/progress can never land half-written.
  const createOne = async ({ b, isbn }: (typeof accepted)[number]) => {
    const cover = await resolveCoverUrl(b.coverUrl, getCoverFile);

    // Read history. Older exports have no `reads` — materialize the history
    // that timesRead implies as undated past reads (the finished pass itself
    // lives on the Book row), exactly like the migration backfill. Either
    // way timesRead ends up consistent with the restored rows.
    const isRead = b.status === ReadingStatus.READ;
    const pastReads: { dateStarted: Date | null; dateFinished: Date | null; rating: number | null; createdAt: Date | null }[] =
      b.reads.length > 0
        ? b.reads.map((r) => ({
            dateStarted: r.dateStarted,
            dateFinished: r.dateFinished,
            rating: r.rating ?? null,
            createdAt: r.createdAt,
          }))
        : Array.from(
            { length: Math.max(b.timesRead - (isRead ? 1 : 0), 0) },
            () => ({ dateStarted: null, dateFinished: null, rating: null, createdAt: null }),
          );
    const timesRead = pastReads.length + (isRead ? 1 : 0);

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
        timesRead,
        currentPage: b.currentPage ?? null,
        searchText: buildSearchText(b.title, b.authors, b.seriesName),
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
        reads: {
          create: pastReads.map((r) => ({
            dateStarted: r.dateStarted,
            dateFinished: r.dateFinished,
            rating: r.rating,
            ...(r.createdAt && { createdAt: r.createdAt }),
          })),
        },
        progress: {
          create: b.progress
            .filter((e) => e.date != null)
            .map((e) => ({ page: e.page, date: e.date! })),
        },
      },
    });

    // Counted only after the write lands, so the summary never claims a book
    // the database rejected.
    if (cover.restored) coversRestored++;
    booksCreated++;
    quotesRestored += b.quotes.length;
    readsRestored += pastReads.length;
    progressRestored += b.progress.filter((e) => e.date != null).length;
  };

  try {
    await mapWithConcurrency(accepted, IMPORT_CONCURRENCY, createOne);
  } catch (err) {
    // A restore is not one transaction — wrapping thousands of nested writes
    // in a single long-running transaction trades this failure mode for a
    // worse one. Instead the books written so far stay written, and the run
    // says so. Re-running the same backup finishes the job: everything
    // already restored is detected as a duplicate and skipped.
    incomplete = {
      after: booksCreated,
      reason: err instanceof Error ? err.message : "unknown error",
    };
  }

  return {
    booksCreated,
    booksSkipped,
    booksInvalid,
    shelvesCreated,
    goalsRestored: data.readingGoals.length,
    coversRestored,
    quotesRestored,
    readsRestored,
    progressRestored,
    ...(incomplete && { incomplete }),
  };
}
