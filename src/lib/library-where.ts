import { Prisma } from "@prisma/client";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { calendarDay } from "@/lib/dates";
import { overdueCutoff } from "@/lib/loans";
import {
  buildBookWhere,
  finishedYearRanges,
  type LibraryFilters,
  type WhereContext,
} from "@/lib/library-filters";
import type { Preferences } from "@/lib/preferences";
import { foldForSearch, searchWords } from "@/lib/utils";
import { parseFieldFilter, resolveFieldFilter, type BookField } from "@/lib/book-fields";

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
  prefs: Pick<Preferences, "searchAlsoIn" | "timeZone"> & Partial<Pick<Preferences, "customFields">>,
): Promise<Prisma.BookWhereInput> {
  const fields = prefs.customFields ?? [];
  const [search, finishedEdgeIds] = await Promise.all([
    searchContext(userId, filters.q, prefs.searchAlsoIn),
    finishedNearNewYear(userId, filters.finished, prefs.timeZone),
  ]);
  return buildBookWhere(userId, filters, {
    ...search,
    finishedEdgeIds,
    overdueBefore: overdueCutoff(new Date(), prefs.timeZone),
    searchFields: fields.some((f) => f.type === "text" || f.type === "choice"),
    fieldWhere: fieldFilterWhere(filters.field, fields),
  });
}

/**
 * The library's filter on one of the reader's own fields, as a `where` on
 * the book's values (Book.fields). Undefined when there is none, or it
 * doesn't fit the field (lib/book-fields.ts resolveFieldFilter), so a
 * filter on a field since removed filters nothing.
 */
export function fieldFilterWhere(
  filter: string,
  fields: readonly BookField[],
): Prisma.BookWhereInput | undefined {
  const parsed = parseFieldFilter(filter);
  const r = parsed && resolveFieldFilter(parsed, fields);
  if (!r) return undefined;
  const path = [r.field.id];
  switch (r.op) {
    // A book stores only the values it has, never a JSON null.
    case "any":
      return { fields: { path, not: Prisma.AnyNull } };
    case "none":
      return { fields: { path, equals: Prisma.DbNull } };
    case "is":
      return { fields: { path, equals: r.value } };
    case "range":
      // Dates are stored "YYYY-MM-DD", which sort as they read.
      return {
        AND: [
          ...(r.min !== null ? [{ fields: { path, gte: r.min } }] : []),
          ...(r.max !== null ? [{ fields: { path, lte: r.max } }] : []),
        ],
      };
  }
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
