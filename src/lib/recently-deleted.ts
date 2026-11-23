import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chunk } from "@/lib/bulk";
import { deleteCachedCovers } from "@/lib/covers";
import type { ServerJob } from "@/lib/server-jobs";

/**
 * Recently deleted: a deleted book waits here for BIN_DAYS days, with
 * everything that went with it, so it can be put back as it was. The book
 * itself is really deleted (every query on books stays as it is); what's
 * kept is a copy of its row and of each row that cascaded with it, in a
 * DeletedBook entry under the book's own id. Putting it back writes those
 * rows again, ids and all, so links to the book keep working.
 *
 * Its cached cover stays on disk while the entry does (lib/covers.ts counts
 * entries as using their covers), and goes with the entry for good.
 */

export const BIN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The book and the rows that go with it, as saved in DeletedBook.data. */
interface BookCopy {
  v: 1;
  book: Record<string, unknown>;
  shelfIds: string[];
  reads: Record<string, unknown>[];
  progress: Record<string, unknown>[];
  loans: Record<string, unknown>[];
  quotes: Record<string, unknown>[];
  notes: Record<string, unknown>[];
}

const COPY_INCLUDE = {
  shelves: { select: { id: true } },
  reads: true,
  progress: true,
  loans: true,
  quotes: true,
  notes: true,
} satisfies Prisma.BookInclude;

type BookWithRows = Prisma.BookGetPayload<{ include: typeof COPY_INCLUDE }>;

/** Plain JSON: dates become ISO strings. */
function plain<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function copyOf(b: BookWithRows): BookCopy {
  const { shelves, reads, progress, loans, quotes, notes, ...book } = b;
  return {
    v: 1,
    book: plain(book),
    shelfIds: shelves.map((s) => s.id),
    reads: reads.map(plain),
    progress: progress.map(plain),
    loans: loans.map(plain),
    quotes: quotes.map(plain),
    notes: notes.map(plain),
  };
}

/** When an entry goes for good. */
export function binExpiry(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + BIN_DAYS * DAY_MS);
}

/** Entries deleted before this have had their time. */
export function binCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - BIN_DAYS * DAY_MS);
}

/**
 * Moves the reader's books with these ids into Recently deleted: each is
 * copied into an entry and deleted, in one transaction per chunk, so a book
 * is never both gone and missing from the bin. Returns how many went. Ids
 * that aren't the reader's are skipped. Covers stay on disk.
 */
export async function binBooks(userId: string, ids: readonly string[]): Promise<number> {
  let moved = 0;
  const run = async (db: Prisma.TransactionClient) => {
    for (const part of chunk([...new Set(ids)], 200)) {
      const books = await db.book.findMany({
        where: { id: { in: part }, userId },
        include: COPY_INCLUDE,
      });
      if (books.length === 0) continue;
      const found = books.map((b) => b.id);
      // An entry under the same id can only be a stale one (a book put back
      // replaces its entry), so the newer copy wins.
      await db.deletedBook.deleteMany({ where: { id: { in: found } } });
      await db.deletedBook.createMany({
        data: books.map((b) => ({
          id: b.id,
          userId,
          title: b.title,
          authors: b.authors,
          coverUrl: b.coverUrl,
          data: copyOf(b) as unknown as Prisma.InputJsonValue,
        })),
      });
      await db.book.deleteMany({ where: { id: { in: found }, userId } });
      moved += books.length;
    }
  };
  await prisma.$transaction(run, { timeout: 120_000, maxWait: 10_000 });
  return moved;
}

/** Only the columns the table has now: a copy made before a column was
 *  dropped still goes back. */
function columns(row: Record<string, unknown>, known: Record<string, string>, drop: string[]) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!Object.hasOwn(known, key) || drop.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

export type RestoreResult = { restored: number; error?: string };

/**
 * Puts the reader's entries with these ids back in the library, as they
 * were when deleted, and removes the entries. Shelves deleted since are
 * left out. A book whose id is somehow in the library already stays in the
 * bin.
 */
export async function restoreBooks(userId: string, ids: readonly string[]): Promise<RestoreResult> {
  const entries = await prisma.deletedBook.findMany({
    where: { id: { in: [...new Set(ids)] }, userId },
  });
  if (entries.length === 0) return { restored: 0, error: "Those books aren’t in Recently deleted any more." };

  const shelves = new Set(
    (await prisma.shelf.findMany({ where: { userId }, select: { id: true } })).map((s) => s.id),
  );
  const taken = new Set(
    (
      await prisma.book.findMany({
        where: { id: { in: entries.map((e) => e.id) } },
        select: { id: true },
      })
    ).map((b) => b.id),
  );

  let restored = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const entry of entries) {
        if (taken.has(entry.id)) continue;
        const copy = entry.data as unknown as BookCopy;
        if (!copy || copy.v !== 1 || !copy.book) continue;
        const book = columns(copy.book, Prisma.BookScalarFieldEnum, ["userId"]);
        if (book.fields === null) delete book.fields;
        const rows = (list: Record<string, unknown>[] | undefined, known: Record<string, string>) =>
          (list ?? []).map((r) => columns(r, known, ["bookId"]));
        await tx.book.create({
          data: {
            ...(book as Omit<Prisma.BookUncheckedCreateInput, "userId">),
            id: entry.id,
            userId,
            shelves: {
              connect: (copy.shelfIds ?? []).filter((id) => shelves.has(id)).map((id) => ({ id })),
            },
            reads: { createMany: { data: rows(copy.reads, Prisma.ReadScalarFieldEnum) as never } },
            progress: {
              createMany: { data: rows(copy.progress, Prisma.ProgressEntryScalarFieldEnum) as never },
            },
            loans: { createMany: { data: rows(copy.loans, Prisma.LoanScalarFieldEnum) as never } },
            quotes: { createMany: { data: rows(copy.quotes, Prisma.QuoteScalarFieldEnum) as never } },
            notes: { createMany: { data: rows(copy.notes, Prisma.BookNoteScalarFieldEnum) as never } },
          },
        });
        await tx.deletedBook.delete({ where: { id: entry.id } });
        restored++;
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  if (restored === 0) return { restored, error: "That book is already in your library." };
  return { restored };
}

/**
 * Deletes entries for good, with their covers where nothing else uses
 * them: the reader's entries with these ids, or with no ids every entry of
 * theirs. Returns how many went.
 */
export async function forgetBooks(userId: string, ids?: readonly string[]): Promise<number> {
  const where: Prisma.DeletedBookWhereInput = ids ? { userId, id: { in: [...ids] } } : { userId };
  return forgetWhere(where);
}

/** Every entry, of every reader, whose 30 days are up. */
export async function forgetExpired(now: Date = new Date()): Promise<number> {
  return forgetWhere({ deletedAt: { lt: binCutoff(now) } });
}

async function forgetWhere(where: Prisma.DeletedBookWhereInput): Promise<number> {
  const doomed = await prisma.deletedBook.findMany({ where, select: { id: true, coverUrl: true } });
  if (doomed.length === 0) return 0;
  for (const part of chunk(doomed.map((d) => d.id), 1000)) {
    await prisma.deletedBook.deleteMany({ where: { id: { in: part } } });
  }
  await deleteCachedCovers(doomed.map((d) => d.coverUrl));
  return doomed.length;
}

/** The server's hourly sweep: entries whose 30 days are up go for good,
 *  covers and all. */
export function recentlyDeletedJob(): ServerJob {
  return {
    name: "recently deleted",
    everyMinutes: 60,
    async run(now) {
      const gone = await forgetExpired(now);
      if (gone > 0) console.log(`[myreads] recently deleted: ${gone} book(s) past ${BIN_DAYS} days deleted for good`);
    },
  };
}
