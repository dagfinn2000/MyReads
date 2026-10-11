import { prisma } from "@/lib/prisma";
import { serverTimeZone } from "@/lib/preferences";

/**
 * Pages read per calendar day, computed in the database.
 *
 * Same result as `dailyPageTotals` in lib/progress.ts — deltas between
 * consecutive entries of each book, increases only — but returning one row
 * per reading day instead of every ProgressEntry ever written. The stats page
 * needs the totals, not the log; loading a decade of entries to bucket them
 * in memory was the single largest query on the page.
 *
 * Two details that make this equivalent rather than merely similar:
 *
 *  - The window is ordered by (date, page), matching the JS sort exactly, so
 *    a pass-start anchor and the first real entry of that pass tie-break the
 *    same way.
 *
 *  - Days are bucketed in the *reader's* timezone, not the database's.
 *    `date` is `timestamp without time zone` holding a UTC instant, while
 *    `dayKey()` formats in the zone it is given. The naive `date_trunc`
 *    would file late-night reading under the wrong day and quietly change
 *    both the heatmap and the all-time longest streak. The zone is passed in
 *    so the two agree.
 *
 * No date filter: the heatmap shows twelve months, but `readingStreaks`
 * derives the longest-ever run from these same keys. Bounding the query to a
 * year would turn an all-time statistic into a rolling one without anything
 * visibly breaking.
 */
export async function dailyPageTotalsForUser(
  userId: string,
  /** The reader's zone (Preferences); default the server's. */
  timeZone: string = serverTimeZone(),
): Promise<Map<string, number>> {

  const rows = await prisma.$queryRaw<{ day: string; pages: number }[]>`
    SELECT
      to_char(
        (t."date" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone},
        'YYYY-MM-DD'
      ) AS day,
      SUM(t.delta)::int AS pages
    FROM (
      SELECT
        pe."date",
        pe."page" - LAG(pe."page") OVER (
          PARTITION BY pe."bookId"
          ORDER BY pe."date" ASC, pe."page" ASC
        ) AS delta
      FROM "ProgressEntry" pe
      JOIN "Book" b ON b."id" = pe."bookId"
      WHERE b."userId" = ${userId}
    ) t
    WHERE t.delta > 0
    GROUP BY 1
  `;

  return new Map(rows.map((r) => [r.day, r.pages]));
}
