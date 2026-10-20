import { prisma } from "@/lib/prisma";
import { orderByFirstFinish, type ChallengeBook } from "@/lib/challenges";
import { parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";
import type { Preferences } from "@/lib/preferences";

/**
 * The books that count toward each challenge, by challenge id, first
 * finished first: its slice of the library, finished in its year. Each
 * goes through the library's own filters (resolveBookWhere) with the
 * Finished filter set to the year, so a challenge and its "See the books"
 * link always agree, and it stays within the reader's books. A challenge
 * for a year that hasn't begun counts nothing yet, even a finish date
 * typed ahead.
 */
export async function challengeBooksFor(
  userId: string,
  challenges: { id: string; query: string; year: number }[],
  prefs: Pick<Preferences, "searchAlsoIn" | "timeZone">,
  currentYear: number,
): Promise<Map<string, ChallengeBook[]>> {
  const entries = await Promise.all(
    challenges.map(async (c): Promise<[string, ChallengeBook[]]> => {
      if (c.year > currentYear) return [c.id, []];
      const params = Object.fromEntries(new URLSearchParams(c.query));
      const filters = parseFilters({ ...params, finished: String(c.year) });
      const where = await resolveBookWhere(userId, filters, prefs);
      const books = await prisma.book.findMany({
        where,
        select: {
          id: true,
          title: true,
          authors: true,
          coverUrl: true,
          status: true,
          dateFinished: true,
          reads: { select: { dateFinished: true } },
        },
      });
      return [c.id, orderByFirstFinish(books, c.year, prefs.timeZone)];
    }),
  );
  return new Map(entries);
}
