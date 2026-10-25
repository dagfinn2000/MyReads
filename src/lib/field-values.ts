import { Prisma } from "@prisma/client";
import { chunk } from "@/lib/bulk";
import {
  cleanFieldValues,
  fieldSearchText,
  type BookField,
  type FieldValues,
} from "@/lib/book-fields";

/** What a book's values write to its row: no values is SQL null, so "has
 *  no value" stays a plain IS NULL for the filters. */
export function fieldColumns(
  values: FieldValues,
  fields: readonly BookField[],
): { fields: Prisma.InputJsonObject | typeof Prisma.DbNull; fieldSearchText: string } {
  return {
    fields: Object.keys(values).length > 0 ? values : Prisma.DbNull,
    fieldSearchText: fieldSearchText(values, fields),
  };
}

function sameValues(a: FieldValues, stored: unknown): boolean {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return false;
  const b = stored as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => b[k] === a[k]);
}

/**
 * Lets go of values the reader's fields no longer take: a field removed,
 * or an option taken away from a choice. Run whenever the fields are saved
 * or restored. Reads only the books that have values at all, and writes
 * only those that change.
 */
export async function forgetLostFieldValues(
  db: Prisma.TransactionClient,
  userId: string,
  fields: readonly BookField[],
): Promise<void> {
  const books = await db.book.findMany({
    where: { userId, NOT: { fields: { equals: Prisma.DbNull } } },
    select: { id: true, fields: true },
  });
  const changed = books.flatMap((b) => {
    const values = cleanFieldValues(b.fields, fields);
    return sameValues(values, b.fields) ? [] : [{ id: b.id, values }];
  });
  for (const part of chunk(changed, 200)) {
    await Promise.all(
      part.map(({ id, values }) =>
        db.book.update({ where: { id }, data: fieldColumns(values, fields) }),
      ),
    );
  }
}
