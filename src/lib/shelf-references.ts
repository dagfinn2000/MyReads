import type { Prisma } from "@prisma/client";

/**
 * What points at a shelf by its id, so renaming one into another (a merge)
 * or deleting it can take them along: challenges counting its books, and
 * smart shelves whose rules keep to it. `contains` finds the candidates;
 * each is then read properly, since an id can also start a longer one.
 */

/** Challenges whose books are the ones on `shelfId`. */
export async function challengesOnShelf(
  tx: Prisma.TransactionClient,
  userId: string,
  shelfId: string,
): Promise<{ id: string; query: string }[]> {
  const found = await tx.challenge.findMany({
    where: { userId, query: { contains: `shelfId=${shelfId}` } },
    select: { id: true, query: true },
  });
  return found.filter((c) => new URLSearchParams(c.query).get("shelfId") === shelfId);
}

/** Smart shelves whose rules keep to the books on `shelfId`. */
export async function smartShelvesOnShelf(
  tx: Prisma.TransactionClient,
  userId: string,
  shelfId: string,
): Promise<{ id: string; rules: string }[]> {
  const found = await tx.smartShelf.findMany({
    where: { userId, rules: { contains: `shelfId=${shelfId}` } },
    select: { id: true, rules: true },
  });
  return found.filter((s) => new URLSearchParams(s.rules).get("shelfId") === shelfId);
}
