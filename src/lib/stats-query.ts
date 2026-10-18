import type { Prisma } from "@prisma/client";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import type { BookDayPages, StatsInputs } from "@/lib/stats-count";

/** The book fields the stats page and the year in review use. */
export const statsBookSelect = {
  id: true,
  title: true,
  authors: true,
  coverUrl: true,
  pageCount: true,
  tags: true,
  format: true,
  status: true,
  rating: true,
  dateStarted: true,
  dateFinished: true,
  currentPage: true,
} as const satisfies Prisma.BookSelect;

export type StatsBook = Prisma.BookGetPayload<{ select: typeof statsBookSelect }>;

/**
 * Pages logged per book per day, computed in the database, and whether each
 * day's pages belong to the book's current reading pass. Summed per day
 * (dayPageTotals below) they are the reading calendar's totals.
 *
 * The pages for a day are the rises between consecutive entries of a book,
 * the rule `dailyPageTotals` in lib/progress.ts applies in memory (the book
 * page still uses it; stats-query.db.test.ts checks the two agree). Three
 * details keep them equal rather than merely similar:
 *
 *  - The window is ordered by (date, page), matching the JS sort exactly, so
 *    a pass-start anchor and the first real entry of that pass tie-break the
 *    same way.
 *
 *  - Days are bucketed in the *reader's* time zone, not the database's.
 *    `date` is `timestamp without time zone` holding a UTC instant; a naive
 *    `date_trunc` would file late-night reading under the wrong day and
 *    quietly change the calendar and the longest streak.
 *
 *  - There is no date filter. The calendar shows twelve months, but the
 *    longest streak is all time, and every delta needs the entry before it.
 *
 * The current pass starts at the latest page-0 anchor, else on the book's
 * start date (that calendar day in the reader's zone, or later), else at
 * the first entry: the rule currentPassEntries in lib/progress.ts uses.
 * Earlier pages belong to archived passes, which is what keeps a re-read's
 * pages off the pass before it.
 */
export async function bookDayPageTotalsForUser(
  userId: string,
  /** The reader's zone (Preferences). */
  timeZone: string,
): Promise<BookDayPages[]> {
  const rows = await prisma.$queryRaw<
    { bookId: string; day: string; current: boolean; pages: number }[]
  >`
    SELECT
      t."bookId",
      to_char(
        (t."date" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone},
        'YYYY-MM-DD'
      ) AS day,
      (CASE
        WHEN t."anchor" IS NOT NULL THEN t."date" >= t."anchor"
        WHEN t."dateStarted" IS NULL THEN true
        ELSE t."date" >= t."dateStarted"
          OR to_char((t."date" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') >= t."startDay"
      END) AS "current",
      SUM(t.delta)::int AS pages
    FROM (
      SELECT
        pe."bookId",
        pe."date",
        pe."page" - LAG(pe."page") OVER (
          PARTITION BY pe."bookId"
          ORDER BY pe."date" ASC, pe."page" ASC
        ) AS delta,
        MAX(pe."date") FILTER (WHERE pe."page" = 0) OVER (PARTITION BY pe."bookId") AS "anchor",
        b."dateStarted",
        -- calendarDay: a typed date (midnight UTC) is that day anywhere.
        CASE
          WHEN b."dateStarted" = date_trunc('day', b."dateStarted")
            THEN to_char(b."dateStarted", 'YYYY-MM-DD')
          ELSE to_char((b."dateStarted" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')
        END AS "startDay"
      FROM "ProgressEntry" pe
      JOIN "Book" b ON b."id" = pe."bookId"
      WHERE b."userId" = ${userId}
    ) t
    WHERE t.delta > 0
    GROUP BY 1, 2, 3
  `;
  return rows.map((r) => ({ bookId: r.bookId, day: r.day, pages: r.pages, current: r.current }));
}

/**
 * Pages read per calendar day, for the reading calendar and the year in
 * review: the log by book and day, summed across books. The stats pages
 * already load that log, so the totals cost no second query.
 */
export function dayPageTotals(logDays: readonly BookDayPages[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of logDays) totals.set(r.day, (totals.get(r.day) ?? 0) + r.pages);
  return totals;
}

/** Everything lib/stats-count.ts needs for one reader, scoped to them. */
export async function loadStatsInputs(
  userId: string,
  timeZone: string,
): Promise<StatsInputs<StatsBook>> {
  const [books, reads, logDays, lastLogs] = await Promise.all([
    prisma.book.findMany({ where: { userId }, select: statsBookSelect }),
    // Archived passes from the read history: re-reads and pre-app reads.
    prisma.read.findMany({
      where: { book: { userId } },
      select: { bookId: true, dateStarted: true, dateFinished: true, rating: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    bookDayPageTotalsForUser(userId, timeZone),
    prisma.progressEntry.groupBy({
      by: ["bookId"],
      where: { book: { userId, status: ReadingStatus.DNF } },
      _max: { date: true },
    }),
  ]);

  const lastLogDates = new Map<string, Date>();
  for (const row of lastLogs) {
    if (row._max.date) lastLogDates.set(row.bookId, row._max.date);
  }
  return { books, reads, logDays, lastLogDates };
}
