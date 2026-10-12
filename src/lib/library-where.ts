import { ReadingStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calendarDay } from "@/lib/dates";
import {
  buildBookWhere,
  finishedYearRanges,
  searchTermWhere,
  type LibraryFilters,
  type WhereContext,
} from "@/lib/library-filters";
import type { Preferences } from "@/lib/preferences";
import { foldForSearch, searchTerms, searchWords } from "@/lib/utils";

/**
 * Most review matches passed as per-word id lists. Postgres takes at most
 * 32,767 values in one query; past this the search is worked out here a
 * word at a time and handed over as one list of matching books.
 */
const MAX_REVIEW_IDS = 10_000;

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
 * Tags and reviews, for a reader who added them to search. Both are folded
 * and matched here rather than in SQL: Postgres's lower() follows the
 * database's locale, which may leave "ÉMILE" capitalised, while the typed
 * words are folded by foldForSearch. Tags turn into tag names (few, however
 * big the library), reviews into the ids of the books that have one.
 */
async function searchContext(
  userId: string,
  q: string,
  searchIn: Preferences["searchAlsoIn"],
): Promise<WhereContext> {
  const ctx: WhereContext = { searchIn };
  const words = searchWords(q);
  if (words.length === 0) return ctx;
  const inTags = searchIn.includes("tags");
  const inReviews = searchIn.includes("review");
  if (!inTags && !inReviews) return ctx;

  const [tagRows, reviewRows] = await Promise.all([
    inTags
      ? prisma.$queryRaw<{ tag: string }[]>`
          SELECT DISTINCT unnest("tags") AS tag FROM "Book" WHERE "userId" = ${userId}`
      : [],
    inReviews
      ? prisma.book.findMany({
          where: { userId, review: { not: null } },
          select: { id: true, review: true },
        })
      : [],
  ]);

  if (inTags) {
    const tags = tagRows.map((r) => ({ tag: r.tag, folded: foldForSearch(r.tag) }));
    ctx.tagsByTerm = words.map((w) => tags.filter((t) => t.folded.includes(w)).map((t) => t.tag));
  }
  if (inReviews) {
    const reviews = reviewRows.map((r) => ({ id: r.id, folded: foldForSearch(r.review ?? "") }));
    ctx.reviewIdsByTerm = words.map((w) =>
      reviews.filter((r) => r.folded.includes(w)).map((r) => r.id),
    );
    const total = ctx.reviewIdsByTerm.reduce((n, ids) => n + ids.length, 0);
    if (total > MAX_REVIEW_IDS) ctx.searchIds = await matchWordByWord(userId, q, ctx);
  }
  return ctx;
}

/** The books matching every word of `q`, one query per word, for when the
 *  review matches are too many to send along (see MAX_REVIEW_IDS). */
async function matchWordByWord(userId: string, q: string, ctx: WhereContext): Promise<string[]> {
  const withoutReviews = { ...ctx, reviewIdsByTerm: undefined };
  let matched = new Set<string>();
  for (const [i, term] of searchTerms(q).entries()) {
    const rows = await prisma.book.findMany({
      where: { userId, ...searchTermWhere(term, i, withoutReviews) },
      select: { id: true },
    });
    const ids = new Set([...rows.map((r) => r.id), ...(ctx.reviewIdsByTerm?.[i] ?? [])]);
    matched = i === 0 ? ids : new Set([...matched].filter((id) => ids.has(id)));
    if (matched.size === 0) break;
  }
  return [...matched];
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
