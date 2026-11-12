import { Prisma } from "@prisma/client";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { calendarDay } from "@/lib/dates";
import { overdueCutoff } from "@/lib/loans";
import {
  buildBookWhere,
  finishedYearRanges,
  parseFilters,
  publishedRange,
  type LibraryFilters,
  type WhereContext,
} from "@/lib/library-filters";
import type { Preferences } from "@/lib/preferences";
import { foldForSearch, searchWords } from "@/lib/utils";
import { parseFieldFilter, resolveFieldFilter, type BookField } from "@/lib/book-fields";

type WherePrefs = Pick<Preferences, "searchAlsoIn" | "timeZone"> &
  Partial<Pick<Preferences, "customFields">>;

/**
 * The Prisma `where` for a library view, for every place that has to agree
 * on what "the books on screen" means: the library page, Pick for me and
 * bulk edit's "every matching book". Async because some filters need a
 * query of their own first; this is the one place those run, always scoped
 * to `userId`, and only when the filters on screen need them.
 *
 * A `shelfId` may name a smart shelf (lib/smart-shelves.ts): then the
 * books are the ones its rules pick, alongside whatever else is on screen,
 * just as a shelf of the reader's own narrows the tab and filters.
 */
export async function resolveBookWhere(
  userId: string,
  filters: LibraryFilters,
  prefs: WherePrefs,
): Promise<Prisma.BookWhereInput> {
  const smart = filters.shelfId
    ? await prisma.smartShelf.findFirst({
        where: { id: filters.shelfId, userId },
        select: { rules: true },
      })
    : null;
  if (!smart) return filtersWhere(userId, filters, prefs);

  const [base, rules] = await Promise.all([
    filtersWhere(userId, { ...filters, shelfId: "" }, prefs),
    smartShelfWhere(userId, smart.rules, prefs),
  ]);
  // Added to the view's own AND, so the status stays at the top, where
  // Pick for me looks for it.
  const and = base.AND === undefined ? [] : Array.isArray(base.AND) ? base.AND : [base.AND];
  return { ...base, AND: [...and, rules] };
}

/**
 * The books a smart shelf's rules pick, as a `where`. The rules are a
 * library address's filters (smartRulesQuery), so they mean exactly what
 * the library shows for them. A shelf they name is always one of the
 * reader's own: saving refuses a smart shelf there, and one that slipped
 * in matches nothing rather than leading on to further rules.
 */
export function smartShelfWhere(
  userId: string,
  rules: string,
  prefs: WherePrefs,
): Promise<Prisma.BookWhereInput> {
  return filtersWhere(userId, parseFilters(Object.fromEntries(new URLSearchParams(rules))), prefs);
}

/** resolveBookWhere for filters whose shelf, if any, is the reader's own. */
async function filtersWhere(
  userId: string,
  filters: LibraryFilters,
  prefs: WherePrefs,
): Promise<Prisma.BookWhereInput> {
  const fields = prefs.customFields ?? [];
  const [search, finishedEdgeIds, publishedIds] = await Promise.all([
    searchContext(userId, filters.q, prefs.searchAlsoIn),
    finishedNearNewYear(userId, filters.finished, prefs.timeZone),
    publishedInYears(userId, filters.published),
  ]);
  return buildBookWhere(userId, filters, {
    ...search,
    finishedEdgeIds,
    publishedIds,
    overdueBefore: overdueCutoff(new Date(), prefs.timeZone),
    searchFields: fields.some((f) => f.type === "text" || f.type === "choice"),
    fieldWhere: fieldFilterWhere(filters.field, fields),
  });
}

/**
 * For "Published": the books whose published date holds a year in the
 * range, read as the Year published sort reads it (library-sort.ts
 * publishedYear: the first four digits in a row), so "c. 1999" and
 * "2003-07" count as well as "1999".
 */
async function publishedInYears(userId: string, published: string): Promise<string[]> {
  const range = publishedRange(published);
  if (!range) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM (
      SELECT "id", substring("publishedDate" from '[0-9]{4}')::int AS year
      FROM "Book"
      WHERE "userId" = ${userId} AND "publishedDate" ~ '[0-9]{4}'
    ) b
    WHERE (${range.min}::int IS NULL OR year >= ${range.min}::int)
      AND (${range.max}::int IS NULL OR year <= ${range.max}::int)`;
  return rows.map((r) => r.id);
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
