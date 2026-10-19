import { prisma } from "@/lib/prisma";
import { nearbyMonthDays, type DayEvent, type DayQuote } from "@/lib/on-this-day";

/**
 * The candidates for "On this day" (lib/on-this-day.ts): finishes and starts
 * of current and past reads, and quotes, whose stored date is within a day
 * of today's date in any year. That cut is rough, so a library of thousands
 * sends back a handful; onThisDay() then keeps the ones that fall on today
 * in the reader's zone.
 */
export async function onThisDayCandidates(
  userId: string,
  todayKey: string,
): Promise<{ events: DayEvent[]; quotes: DayQuote[] }> {
  const days = nearbyMonthDays(todayKey);
  const [events, quotes] = await Promise.all([
    prisma.$queryRaw<DayEvent[]>`
      SELECT 'finished' AS kind, b."id" AS "bookId", b."title", b."dateFinished" AS date
      FROM "Book" b
      WHERE b."userId" = ${userId} AND b."status" = 'READ' AND b."dateFinished" IS NOT NULL
        AND to_char(b."dateFinished", 'MM-DD') = ANY(${days})
      UNION ALL
      SELECT 'started', b."id", b."title", b."dateStarted"
      FROM "Book" b
      WHERE b."userId" = ${userId} AND b."status" <> 'WANT_TO_READ' AND b."dateStarted" IS NOT NULL
        AND to_char(b."dateStarted", 'MM-DD') = ANY(${days})
      UNION ALL
      SELECT 'finished', b."id", b."title", r."dateFinished"
      FROM "Read" r JOIN "Book" b ON b."id" = r."bookId"
      WHERE b."userId" = ${userId} AND r."dateFinished" IS NOT NULL
        AND to_char(r."dateFinished", 'MM-DD') = ANY(${days})
      UNION ALL
      SELECT 'started', b."id", b."title", r."dateStarted"
      FROM "Read" r JOIN "Book" b ON b."id" = r."bookId"
      WHERE b."userId" = ${userId} AND r."dateStarted" IS NOT NULL
        AND to_char(r."dateStarted", 'MM-DD') = ANY(${days})
    `,
    prisma.$queryRaw<DayQuote[]>`
      SELECT q."id", q."bookId", b."title", q."text", q."createdAt" AS date
      FROM "Quote" q JOIN "Book" b ON b."id" = q."bookId"
      WHERE b."userId" = ${userId} AND to_char(q."createdAt", 'MM-DD') = ANY(${days})
      ORDER BY q."createdAt" DESC
      LIMIT 100
    `,
  ]);
  return { events, quotes };
}
