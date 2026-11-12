import type { Prisma } from "@prisma/client";
import { BUILT_IN_MOODS, type CustomMood } from "@/lib/moods";

/**
 * Takes moods the reader no longer has off their books: a key that is
 * neither a built-in mood nor one of `custom`. Run whenever the list of the
 * reader's own moods is saved, so removing one empties it from every book
 * at once, as removing a status or a field does.
 */
export async function forgetLostMoods(
  db: Prisma.TransactionClient,
  userId: string,
  custom: readonly CustomMood[],
): Promise<void> {
  const known = [...BUILT_IN_MOODS, ...custom].map((m) => m.key);
  await db.$executeRaw`
    UPDATE "Book"
    SET "moods" = ARRAY(SELECT m FROM unnest("moods") AS m WHERE m = ANY(${known}::text[]))
    WHERE "userId" = ${userId} AND NOT ("moods" <@ ${known}::text[])`;
}
