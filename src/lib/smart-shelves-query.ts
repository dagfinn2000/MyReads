import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { smartShelfWhere } from "@/lib/library-where";
import type { Preferences } from "@/lib/preferences";

type WherePrefs = Pick<Preferences, "searchAlsoIn" | "timeZone"> &
  Partial<Pick<Preferences, "customFields">>;

type SmartShelfRow = { id: string; name: string; rules: string };

/** How many books each smart shelf holds, by id: what its chip shows. */
export async function smartShelfCounts(
  userId: string,
  shelves: SmartShelfRow[],
  prefs: WherePrefs,
): Promise<Map<string, number>> {
  const counts = await Promise.all(
    shelves.map(async (s) => [
      s.id,
      await prisma.book.count({ where: await smartShelfWhere(userId, s.rules, prefs) }),
    ] as const),
  );
  return new Map(counts);
}

/** The smart shelves a book is on, in the order given. */
export async function smartShelvesHolding(
  userId: string,
  bookId: string,
  shelves: SmartShelfRow[],
  prefs: WherePrefs,
): Promise<SmartShelfRow[]> {
  const held = await Promise.all(
    shelves.map(async (s) => {
      const where = await smartShelfWhere(userId, s.rules, prefs);
      return (await prisma.book.count({ where: { AND: [where, { id: bookId }] } })) > 0;
    }),
  );
  return shelves.filter((_, i) => held[i]);
}

/**
 * For Group by shelf: the smart shelves each book on screen is on, by book
 * id. `where` is the view on screen, so each shelf only lists those.
 */
export async function smartShelvesOfBooks(
  userId: string,
  where: Prisma.BookWhereInput,
  shelves: SmartShelfRow[],
  prefs: WherePrefs,
): Promise<Map<string, { id: string; name: string }[]>> {
  const members = await Promise.all(
    shelves.map(async (s) =>
      prisma.book.findMany({
        where: { AND: [where, await smartShelfWhere(userId, s.rules, prefs)] },
        select: { id: true },
      }),
    ),
  );
  const out = new Map<string, { id: string; name: string }[]>();
  shelves.forEach((s, i) => {
    for (const b of members[i]) out.set(b.id, [...(out.get(b.id) ?? []), { id: s.id, name: s.name }]);
  });
  return out;
}
