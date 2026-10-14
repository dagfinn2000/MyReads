import fs from "node:fs/promises";
import path from "node:path";
import { BookFormat, BookOwnership, GoalUnit, Prisma, ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { coverFilePath, coversDir } from "@/lib/covers";
import { sniffImageKind } from "@/lib/image-type";
import { buildSearchText, foldForSearch } from "@/lib/utils";
import { isAllowedCoverUrl, shelfNameSchema } from "@/lib/validation";
import { cleanLibraryViewPatch } from "@/lib/library-view";
import { cleanPreferencesPatch } from "@/lib/preferences";
import {
  MAX_SAVED_VIEWS,
  SAVED_VIEW_NAME_MAX,
  canonicalViewQueryFromString,
} from "@/lib/saved-views";
import { parseThemeSetting, serializeThemeSetting } from "@/lib/themes";

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
 *
 * Account settings (theme, library view, Preferences) are filled in only
 * where this account hasn't set them: a restore onto a fresh account brings
 * the old setup back, and one onto a live account never undoes choices
 * made since. Saved views merge by name like shelves.
 */

/**
 * Shelf names, taken the way the shelf form takes them (trimmed, 1 to 50
 * characters) one by one, so a name that won't do is dropped on its own
 * rather than taking the book's other shelves with it.
 */
const shelfNames = z
  .array(z.unknown())
  .catch([])
  .transform((names) =>
    names.flatMap((name) => {
      const parsed = shelfNameSchema.safeParse(name);
      return parsed.success ? [parsed.data] : [];
    }),
  );

/** Shelves are matched by name in any case, as the shelf form matches them:
 *  a backup's "favourites" is the "Favourites" shelf already here. */
const shelfKey = (name: string) => name.toLowerCase();

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
  /** Additive: older exports have no notes on past reads. */
  note: z.string().trim().max(2000).nullable().optional().catch(null),
  createdAt: dateField,
});

/** Lending records are additive too (exports without them parse to []). */
const importedLoanSchema = z.object({
  borrower: z.string().trim().min(1).max(100),
  lentAt: dateField,
  returnedAt: dateField,
  note: z.string().trim().max(500).nullable().optional(),
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
  // Same rule as the book form; a bad value drops the cover, not the book.
  coverUrl: z.string().max(2000).refine(isAllowedCoverUrl).nullable().optional().catch(null),
  pageCount: z.number().int().min(1).max(100000).nullable().optional().catch(null),
  /** Additive: an audiobook's running time in minutes. */
  lengthMinutes: z.number().int().min(1).max(60000).nullable().optional().catch(null),
  publishedDate: z.string().trim().max(20).nullable().optional(),
  // Split at commas: the library's tag filter lists tags comma-separated,
  // so "science, fiction" from an older backup becomes two tags.
  tags: z
    .array(z.string().trim().toLowerCase().max(50))
    .catch([])
    .transform((tags) => tags.flatMap((t) => t.split(",").map((s) => s.trim())).filter(Boolean)),
  format: z.nativeEnum(BookFormat).catch(BookFormat.PHYSICAL),
  /** Legacy field, still written by exports for older instances to read. */
  owned: z.boolean().nullable().optional().catch(null),
  /** Present in exports from this version onward. */
  ownership: z.nativeEnum(BookOwnership).nullable().optional().catch(null),
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
  shelves: shelfNames,
  quotes: z.array(importedQuoteSchema).catch([]),
  reads: z.array(importedReadSchema).catch([]),
  progress: z.array(importedProgressSchema).catch([]),
  loans: z.array(importedLoanSchema).catch([]),
  createdAt: dateField,
});

const goalSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  target: z.number().int().min(1).max(1_000_000),
  // Additive: goals from older exports count re-reads.
  countRereads: z.boolean().catch(true),
});

/** Shelf or saved-view names in a preference, as exported. */
const nameList = z.array(z.string().max(100)).max(500).optional().catch([]);

const exportPayloadSchema = z.object({
  format: z.literal("myreads-export"),
  version: z.literal(1),
  shelves: z
    .array(z.unknown())
    .catch([])
    .transform((list) => shelfNames.parse(list.map((s) => (s as { name?: unknown } | null)?.name))),
  /** Goals counted in books. */
  readingGoals: z.array(goalSchema).catch([]),
  /** Goals counted in pages. Additive, and kept apart so an older MyReads
   *  doesn't read them as book counts. */
  pageGoals: z.array(goalSchema).catch([]),
  /** Additive, like everything after `books` was in version 1. */
  settings: z
    .object({
      theme: z.string().max(100).nullable().catch(null),
      libraryView: z.unknown(),
      preferences: z.unknown(),
      defaultViewName: z.string().max(SAVED_VIEW_NAME_MAX).nullable().catch(null),
      // Shelf and saved-view preferences, by name (see restoreSettings).
      shelfOrderNames: nameList,
      hiddenShelfNames: nameList,
      savedViewOrderNames: nameList,
    })
    .nullable()
    .optional()
    .catch(null),
  savedViews: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(SAVED_VIEW_NAME_MAX),
        query: z.string().max(4000),
        /** The shelf the query's `shelfId` named, since the id doesn't
         *  survive a move. Additive: older backups don't have it. */
        shelfName: z.string().trim().min(1).max(50).optional().catch(undefined),
      }),
    )
    .catch([]),
  books: z.array(z.unknown()),
});

export interface ImportSummary {
  booksCreated: number;
  booksSkipped: number;
  booksInvalid: number;
  shelvesCreated: number;
  goalsRestored: number;
  savedViewsRestored: number;
  /** True when the backup's theme, library view or preferences were applied
   *  (only ever to an account that had none). */
  settingsRestored: boolean;
  coversRestored: number;
  quotesRestored: number;
  readsRestored: number;
  progressRestored: number;
  loansRestored: number;
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

/**
 * Ownership from a backup, whichever era it came from.
 *
 * Exports written before the ownership states existed carry only
 * `owned: boolean`, and that boolean meant exactly two things: true = on my
 * shelf, false = on the wishlist. Reading it that way keeps an old backup
 * restoring to what it said, and never invents BORROWED or GIVEN_AWAY for a
 * library that had no way to express them.
 */
function resolveOwnership(b: {
  ownership?: BookOwnership | null;
  owned?: boolean | null;
}): BookOwnership {
  if (b.ownership) return b.ownership;
  if (b.owned === false) return BookOwnership.WISHLIST;
  return BookOwnership.OWNED;
}

/** Reads a cover image bundled with the backup (zip imports supply this). */
export type CoverFileReader = (filename: string) => Promise<Uint8Array | null>;

/** Only names the cover cache itself produces get written back — and only
 *  extensions /api/covers actually serves. Keeps a hand-crafted backup from
 *  planting arbitrary files in the cache directory; the bytes must also be
 *  an image, the same check /api/covers/upload makes. */
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
  const target = coverFilePath(filename);
  try {
    await fs.access(target);
    return { url: coverUrl, restored: false }; // same instance — file survived
  } catch {
    // fall through to the backup
  }

  if (getCoverFile && SAFE_COVER_FILENAME.test(filename)) {
    try {
      const data = await getCoverFile(filename);
      if (data && sniffImageKind(data)) {
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
  // Keyed by shelfKey; where names differ only in case, the first wins.
  const shelfIdByName = new Map<string, string>();
  for (const s of existingShelves) {
    if (!shelfIdByName.has(shelfKey(s.name))) shelfIdByName.set(shelfKey(s.name), s.id);
  }
  const wantedShelves = new Map<string, string>();
  const want = (name: string) => {
    if (!wantedShelves.has(shelfKey(name))) wantedShelves.set(shelfKey(name), name);
  };
  data.shelves.forEach(want);
  for (const raw of data.books) {
    shelfNames.parse((raw as { shelves?: unknown } | null)?.shelves).forEach(want);
  }
  // Missing shelves in one statement, then read back to learn their ids —
  // two round-trips instead of one per shelf.
  const missingShelves = [...wantedShelves]
    .filter(([key]) => !shelfIdByName.has(key))
    .map(([, name]) => name);
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
    for (const s of refreshed) shelfIdByName.set(shelfKey(s.name), s.id);
  }

  // Reading goals: upsert per year, concurrently — they're independent.
  const goals = [
    ...data.readingGoals.map((g) => ({ ...g, unit: GoalUnit.BOOKS })),
    ...data.pageGoals.map((g) => ({ ...g, unit: GoalUnit.PAGES })),
  ];
  await mapWithConcurrency(goals, IMPORT_CONCURRENCY, (goal) =>
    prisma.readingGoal.upsert({
      where: { userId_year: { userId, year: goal.year } },
      create: {
        userId,
        year: goal.year,
        target: goal.target,
        unit: goal.unit,
        countRereads: goal.countRereads,
      },
      update: { target: goal.target, unit: goal.unit, countRereads: goal.countRereads },
    }),
  );

  // Saved views: add the ones whose names are new here, up to the cap.
  // Queries are rebuilt the same way saving one does, so a hand-edited
  // backup can't store parameters the library doesn't know. A view kept to
  // one shelf is pointed at that shelf here, found by name; when there's no
  // such shelf (or an older backup gave only an id from elsewhere), the
  // shelf is dropped rather than left naming one that matches nothing.
  const ownShelfIds = new Set(shelfIdByName.values());
  const restoredQuery = (view: { query: string; shelfName?: string }) => {
    const params = new URLSearchParams(view.query);
    const oldId = params.get("shelfId");
    if (oldId) {
      const id = view.shelfName
        ? shelfIdByName.get(shelfKey(view.shelfName))
        : ownShelfIds.has(oldId)
          ? oldId
          : undefined;
      if (id) params.set("shelfId", id);
      else params.delete("shelfId");
    }
    return canonicalViewQueryFromString(params.toString());
  };
  const existingViewCount = await prisma.savedView.count({ where: { userId } });
  const viewsCreated = await prisma.savedView.createMany({
    data: data.savedViews
      .slice(0, Math.max(0, MAX_SAVED_VIEWS - existingViewCount))
      .map((v) => ({ userId, name: v.name, query: restoredQuery(v) })),
    skipDuplicates: true,
  });

  const settingsRestored = data.settings ? await restoreSettings(userId, data.settings) : false;

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

  // Pass 1 — decide, sequentially. A book already in the library (same
  // ISBN, or same title and first author) is skipped, so a restore can be
  // re-run. Within the file itself only a true repeat is skipped: the same
  // ISBN, or with no ISBN the same title, author and format. Two editions
  // of one book (a hardback and its audiobook) both come back, as the
  // library had them. Each accepted book is folded into `seen` as the file
  // is walked; that ordering dependency is why the decisions stay serial;
  // only the slow database work below is parallelised.
  const seen = new Set<string>();
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
    const repeat = isbn ? `isbn|${isbn}` : `${key}|${b.format}`;
    if ((isbn && existingIsbns.has(isbn)) || existingTitleAuthor.has(key) || seen.has(repeat)) {
      booksSkipped++;
      continue;
    }
    seen.add(repeat);
    accepted.push({ b, isbn });
  }

  let booksCreated = 0;
  let coversRestored = 0;
  let quotesRestored = 0;
  let readsRestored = 0;
  let progressRestored = 0;
  let loansRestored = 0;
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
    const pastReads: {
      dateStarted: Date | null;
      dateFinished: Date | null;
      rating: number | null;
      note: string | null;
      createdAt: Date | null;
    }[] =
      b.reads.length > 0
        ? b.reads.map((r) => ({
            dateStarted: r.dateStarted,
            dateFinished: r.dateFinished,
            rating: r.rating ?? null,
            note: r.note || null,
            createdAt: r.createdAt,
          }))
        : Array.from(
            { length: Math.max(b.timesRead - (isRead ? 1 : 0), 0) },
            () => ({ dateStarted: null, dateFinished: null, rating: null, note: null, createdAt: null }),
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
        lengthMinutes: b.lengthMinutes ?? null,
        publishedDate: b.publishedDate ?? null,
        tags: [...new Set(b.tags)],
        format: b.format,
        ownership: resolveOwnership(b),
        seriesName: b.seriesName ?? null,
        seriesNumber: b.seriesNumber ?? null,
        openLibraryId: b.openLibraryId ?? null,
        status: b.status,
        rating: b.rating ?? null,
        review: b.review ?? null,
        reviewSearchText: foldForSearch(b.review ?? ""),
        dateStarted: b.dateStarted,
        dateFinished: b.dateFinished,
        timesRead,
        currentPage: b.currentPage ?? null,
        searchText: buildSearchText(b.title, b.authors, b.seriesName),
        // Preserve "date added" ordering from the original library.
        ...(b.createdAt && { createdAt: b.createdAt }),
        shelves: {
          connect: [
            ...new Set(
              b.shelves
                .map((name) => shelfIdByName.get(shelfKey(name)))
                .filter((id): id is string => !!id),
            ),
          ].map((id) => ({ id })),
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
            note: r.note,
            ...(r.createdAt && { createdAt: r.createdAt }),
          })),
        },
        progress: {
          create: b.progress
            .filter((e) => e.date != null)
            .map((e) => ({ page: e.page, date: e.date! })),
        },
        loans: {
          // An undated loan cannot be reasoned about (how long has it been
          // out?), so lentAt falls back to the record's creation date and
          // finally to now rather than dropping the borrower entirely.
          create: b.loans.map((l) => ({
            borrower: l.borrower,
            lentAt: l.lentAt ?? l.createdAt ?? new Date(),
            returnedAt: l.returnedAt,
            note: l.note ?? null,
            ...(l.createdAt && { createdAt: l.createdAt }),
          })),
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
    loansRestored += b.loans.length;
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
    goalsRestored: goals.length,
    savedViewsRestored: viewsCreated.count,
    settingsRestored,
    coversRestored,
    quotesRestored,
    readsRestored,
    progressRestored,
    loansRestored,
    ...(incomplete && { incomplete }),
  };
}

/**
 * Applies a backup's account settings wherever this account hasn't chosen
 * its own: the theme if none is saved, and each library-view and
 * Preferences field the account has never set. Field by field rather than
 * all or nothing, because a fresh account already has a little saved — its
 * time zone is filled in on the very first page load. Each value goes
 * through the same cleaning a save does, so nothing unknown is stored; the
 * default saved view is matched by name, since view ids are new on every
 * instance.
 */
async function restoreSettings(
  userId: string,
  settings: {
    theme: string | null;
    libraryView?: unknown;
    preferences?: unknown;
    defaultViewName: string | null;
    shelfOrderNames?: string[];
    hiddenShelfNames?: string[];
    savedViewOrderNames?: string[];
  },
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { theme: true, libraryView: true, preferences: true },
  });
  if (!user) return false;

  const asObject = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  /** The backup's fields that the stored object doesn't have yet. */
  const missing = (stored: Record<string, unknown>, backup: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(backup).filter(([k]) => !(k in stored)));

  const data: Prisma.UserUpdateInput = {};

  const theme = parseThemeSetting(settings.theme);
  if (user.theme === null && theme) data.theme = serializeThemeSetting(theme);

  const storedView = asObject(user.libraryView);
  const viewAdds = missing(storedView, cleanLibraryViewPatch(settings.libraryView));
  if (Object.keys(viewAdds).length > 0) {
    data.libraryView = { ...storedView, ...viewAdds } as Prisma.InputJsonObject;
  }

  const storedPrefs = asObject(user.preferences);
  // The backup's own ids point at shelves and views on the old instance;
  // they come back through the names exported beside them.
  const {
    defaultViewId: _oldViewId,
    shelfOrder: _oldShelfOrder,
    hiddenShelves: _oldHiddenShelves,
    savedViewOrder: _oldViewOrder,
    ...backupPrefs
  } = cleanPreferencesPatch(settings.preferences);
  const prefAdds: Record<string, unknown> = missing(storedPrefs, backupPrefs);

  const [shelves, views] = await Promise.all([
    prisma.shelf.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.savedView.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  const shelfIds = new Map(shelves.map((s) => [shelfKey(s.name), s.id]));
  const viewIds = new Map(views.map((v) => [v.name, v.id]));
  const idsOf = (
    names: string[] | undefined,
    ids: Map<string, string>,
    key: (name: string) => string = (name) => name,
  ) => (names ?? []).flatMap((name) => ids.get(key(name)) ?? []);
  const byName: [string, string[]][] = [
    ["shelfOrder", idsOf(settings.shelfOrderNames, shelfIds, shelfKey)],
    ["hiddenShelves", idsOf(settings.hiddenShelfNames, shelfIds, shelfKey)],
    ["savedViewOrder", idsOf(settings.savedViewOrderNames, viewIds)],
  ];
  for (const [key, ids] of byName) {
    if (ids.length > 0 && !(key in storedPrefs)) prefAdds[key] = ids;
  }
  if (settings.defaultViewName && !("defaultViewId" in storedPrefs)) {
    const id = viewIds.get(settings.defaultViewName);
    if (id) prefAdds.defaultViewId = id;
  }
  if (Object.keys(prefAdds).length > 0) {
    data.preferences = { ...storedPrefs, ...prefAdds } as Prisma.InputJsonObject;
  }

  if (Object.keys(data).length === 0) return false;
  await prisma.user.update({ where: { id: userId }, data });
  return true;
}
