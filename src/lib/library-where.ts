import { ReadingStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calendarDay } from "@/lib/dates";
import {
  buildBookWhere,
  finishedYearRanges,
  type LibraryFilters,
  type WhereContext,
} from "@/lib/library-filters";
import type { Preferences } from "@/lib/preferences";
import { foldForSearch, searchWords } from "@/lib/utils";

/**
 * The Prisma `where` for a library view, for every place that has to agree
 * on what "the books on screen" means: the library page, Pick for me and
 * bulk edit's "every matching book". Async because some filters need a
 * query of their own first; this is the one place those run, always scoped
 * to `userId`, and only when the filters on screen need them.
 */
export async function resolveBookWhere(
  userId: string,
  filters: LibraryFilters,
  prefs: Pick<Preferences, "searchAlsoIn" | "timeZone">,
): Promise<Prisma.BookWhereInput> {
  const [search, finishedEdgeIds] = await Promise.all([
    searchContext(userId, filters.q, prefs.searchAlsoIn),
    finishedNearNewYear(userId, filters.finished, prefs.timeZone),
  ]);
  return buildBookWhere(userId, filters, { ...search, finishedEdgeIds });
}

/**
 * Tags, for a reader who added them to search. Folded and matched here
 * rather than in SQL: Postgres's lower() follows the database's locale,
 * which may leave "ÉMILE" capitalised, while the typed words are folded by
 * foldForSearch. They turn into tag names, few however big the library.
 * Reviews need nothing ahead: each is stored folded (reviewSearchText).
 */
async function searchContext(
  userId: string,
  q: string,
  searchIn: Preferences["searchAlsoIn"],
): Promise<WhereContext> {
  const ctx: WhereContext = { searchIn };
  const words = searchWords(q);
  if (words.length === 0 || !searchIn.includes("tags")) return ctx;

  const tagRows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT unnest("tags") AS tag FROM "Book" WHERE "userId" = ${userId}`;
  const tags = tagRows.map((r) => ({ tag: r.tag, folded: foldForSearch(r.tag) }));
  ctx.tagsByTerm = words.map((w) => tags.filter((t) => t.folded.includes(w)).map((t) => t.tag));
  return ctx;
}

/**
 * For "Finished in": the books finished in `year` in the hours around New
 * Year, where only the reader's time zone says which year it was. Read the
 * way Stats reads them (calendarDay): a date typed into a field is that day
 * everywhere, a "finished now" stamp falls on the reader's own day.
 */
async function finishedNearNewYear(
  userId: string,
  year: string,
  timeZone: string,
): Promise<string[]> {
  if (!year) return [];
  const near = { OR: finishedYearRanges(Number(year)).edges.map((r) => ({ dateFinished: r })) };
  const [books, reads] = await Promise.all([
    prisma.book.findMany({
      where: { userId, status: ReadingStatus.READ, ...near },
      select: { id: true, dateFinished: true },
    }),
    prisma.read.findMany({
      where: { book: { userId }, ...near },
      select: { bookId: true, dateFinished: true },
    }),
  ]);
  const inYear = (d: Date | null) => !!d && calendarDay(d, timeZone).startsWith(`${year}-`);
  return [
    ...new Set([
      ...books.filter((b) => inYear(b.dateFinished)).map((b) => b.id),
      ...reads.filter((r) => inYear(r.dateFinished)).map((r) => r.bookId),
    ]),
  ];
}
