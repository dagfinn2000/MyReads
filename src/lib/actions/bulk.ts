"use server";

import { revalidatePath } from "next/cache";
import { ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const bulkSchema = z.object({
  bookIds: z.array(z.string()).min(1).max(500),
  status: z.nativeEnum(ReadingStatus).optional(),
  addShelfId: z.string().optional(),
  addTags: z
    .array(z.string().trim().toLowerCase().max(50))
    .max(20)
    .optional(),
});

export interface BulkResult {
  count?: number;
  error?: string;
}

/**
 * Apply changes to many books at once: set reading status, append tags,
 * and/or put them on a shelf. Every id is filtered through an ownership
 * check first, so ids smuggled into the request for other users' rows are
 * silently dropped rather than acted on.
 */
export async function bulkUpdateBooks(
  input: z.infer<typeof bulkSchema>,
): Promise<BulkResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const userId = session.user.id;

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };
  const { bookIds, status, addShelfId, addTags } = parsed.data;

  if (!status && !addShelfId && !addTags?.length) {
    return { error: "Nothing to apply" };
  }

  const owned = await prisma.book.findMany({
    where: { id: { in: bookIds }, userId },
    select: { id: true, tags: true },
  });
  if (owned.length === 0) return { error: "No matching books" };
  const ownedIds = owned.map((b) => b.id);

  if (status) {
    await prisma.book.updateMany({
      where: { id: { in: ownedIds } },
      data: { status },
    });
  }

  if (addTags?.length) {
    // Per-row updates so existing tags are merged without duplicates —
    // updateMany's `push` would blindly append. Personal-library scale.
    const updates = owned
      .map((b) => ({ b, merged: [...new Set([...b.tags, ...addTags])] }))
      .filter(({ b, merged }) => merged.length !== b.tags.length)
      .map(({ b, merged }) =>
        prisma.book.update({ where: { id: b.id }, data: { tags: merged } }),
      );
    if (updates.length) await prisma.$transaction(updates);
  }

  if (addShelfId) {
    const shelf = await prisma.shelf.findFirst({
      where: { id: addShelfId, userId },
      select: { id: true, books: { select: { id: true } } },
    });
    if (!shelf) return { error: "Shelf not found" };
    const already = new Set(shelf.books.map((b) => b.id));
    const toConnect = ownedIds.filter((id) => !already.has(id));
    if (toConnect.length) {
      await prisma.shelf.update({
        where: { id: shelf.id },
        data: { books: { connect: toConnect.map((id) => ({ id })) } },
      });
    }
  }

  revalidatePath("/books");
  return { count: ownedIds.length };
}
