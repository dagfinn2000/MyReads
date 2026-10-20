import { prisma } from "@/lib/prisma";
import { parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";
import type { Preferences } from "@/lib/preferences";

/**
 * Which of the reader's books each challenge's slice holds, by challenge
 * id. Each slice goes through the library's own filters (resolveBookWhere),
 * so a challenge and its "See the books" link always agree, and stays
 * within the reader's books.
 */
export async function challengeMatches(
  userId: string,
  challenges: { id: string; query: string }[],
  prefs: Pick<Preferences, "searchAlsoIn" | "timeZone">,
): Promise<Map<string, Set<string>>> {
  const entries = await Promise.all(
    challenges.map(async (c) => {
      const filters = parseFilters(Object.fromEntries(new URLSearchParams(c.query)));
      const where = await resolveBookWhere(userId, filters, prefs);
      const rows = await prisma.book.findMany({ where, select: { id: true } });
      return [c.id, new Set(rows.map((r) => r.id))] as const;
    }),
  );
  return new Map(entries);
}
