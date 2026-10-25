import type { Prisma } from "@prisma/client";
import type { CustomStatus } from "@/lib/statuses";

/**
 * Lets go of statuses the reader no longer has: a book whose statusKey
 * names a status that is gone, or one now built on another status than the
 * book's, goes back to its plain built-in status. Run whenever the list of
 * the reader's own statuses is saved or restored.
 */
export async function forgetLostStatuses(
  db: Prisma.TransactionClient,
  userId: string,
  statuses: readonly CustomStatus[],
): Promise<void> {
  await db.book.updateMany({
    where: {
      userId,
      statusKey: { not: null },
      // OR of nothing matches nothing, so with no statuses left every key goes.
      NOT: { OR: statuses.map((c) => ({ statusKey: c.key, status: c.base })) },
    },
    data: { statusKey: null },
  });
}
