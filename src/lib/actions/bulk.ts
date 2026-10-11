"use server";

import { revalidatePath } from "next/cache";
import { ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { settleReadingState } from "@/lib/reading-state";

const bulkSchema = z.object({
  bookIds: z.array(z.string()).min(1).max(500),
  status: z.nativeEnum(ReadingStatus).optional(),
  addShelfId: z.string().optional(),
  removeShelfId: z.string().optional(),
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
 * and/or put them on or take them off a shelf. Every id is filtered through
 * an ownership check first, so ids smuggled into the request for other
 * users' rows are silently dropped rather than acted on.
 */
export async function bulkUpdateBooks(
  input: z.infer<typeof bulkSchema>,
): Promise<BulkResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const userId = session.user.id;

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };
  const { bookIds, status, addShelfId, removeShelfId, addTags } = parsed.data;

  if (!status && !addShelfId && !removeShelfId && !addTags?.length) {
    return { error: "Nothing to apply" };
  }

  const owned = await prisma.book.findMany({
    where: { id: { in: bookIds }, userId },
    select: {
      id: true,
      tags: true,
      status: true,
      dateStarted: true,
      dateFinished: true,
      currentPage: true,
      _count: { select: { reads: true } },
    },
  });
  if (owned.length === 0) return { error: "No matching books" };
  const ownedIds = owned.map((b) => b.id);

  // The shelf is resolved before the transaction so an unknown shelf id is
  // rejected without having written anything.
  let shelf: { id: string; books: { id: string }[] } | null = null;
  if (addShelfId) {
    shelf = await prisma.shelf.findFirst({
      where: { id: addShelfId, userId },
      select: { id: true, books: { select: { id: true } } },
    });
    if (!shelf) return { error: "Shelf not found" };
  }
  let removeFrom: { id: string } | null = null;
  if (removeShelfId) {
    removeFrom = await prisma.shelf.findFirst({
      where: { id: removeShelfId, userId },
      select: { id: true },
    });
    if (!removeFrom) return { error: "Shelf not found" };
  }

  // One unit of work. Applying a status, then tags, then a shelf as three
  // independent writes meant a failure partway through left some of the
  // selection changed and some not — while still reporting the whole batch
  // as updated. "Apply to 20 books" should either happen or not.
  await prisma.$transaction(async (tx) => {
    if (status) {
      // Per book, through the same rules as the reading card: moving a book
      // to Read dates it and counts the read, moving it off Read uncounts
      // it. A bare updateMany of the status left both behind, so bulk-read
      // books were missing from the yearly stats and goal. Books already
      // in the target status are left alone.
      for (const b of owned) {
        if (b.status === status) continue;
        const next = settleReadingState(
          b.status,
          {
            status,
            dateStarted: b.dateStarted,
            dateFinished: b.dateFinished,
            currentPage: b.currentPage,
          },
          b._count.reads,
        );
        await tx.book.update({ where: { id: b.id }, data: next });
      }
    }

    if (addTags?.length) {
      // Per-row updates so existing tags are merged without duplicates —
      // updateMany's `push` would blindly append. Personal-library scale.
      const changed = owned
        .map((b) => ({ b, merged: [...new Set([...b.tags, ...addTags])] }))
        .filter(({ b, merged }) => merged.length !== b.tags.length);
      for (const { b, merged } of changed) {
        await tx.book.update({ where: { id: b.id }, data: { tags: merged } });
      }
    }

    if (shelf) {
      const already = new Set(shelf.books.map((b) => b.id));
      const toConnect = ownedIds.filter((id) => !already.has(id));
      if (toConnect.length) {
        await tx.shelf.update({
          where: { id: shelf.id },
          data: { books: { connect: toConnect.map((id) => ({ id })) } },
        });
      }
    }

    if (removeFrom) {
      // Disconnecting a book that isn't on the shelf is a no-op.
      await tx.shelf.update({
        where: { id: removeFrom.id },
        data: { books: { disconnect: ownedIds.map((id) => ({ id })) } },
      });
    }
  });

  revalidatePath("/books");
  return { count: ownedIds.length };
}
