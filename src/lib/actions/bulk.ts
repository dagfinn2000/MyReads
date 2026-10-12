"use server";

import { revalidatePath } from "next/cache";
import { BookFormat, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  BULK_CHUNK,
  BULK_MAX_MATCHING,
  bulkDeleteSchema,
  bulkSchema,
  chunk,
  retag,
  type BulkDeleteInput,
  type BulkInput,
} from "@/lib/bulk";
import { deleteCachedCovers } from "@/lib/covers";
import { getPreferences } from "@/lib/current-user";
import { parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";
import { settleReadingState } from "@/lib/reading-state";

export interface BulkResult {
  count?: number;
  error?: string;
}

/** Room for thousands of per-book writes (a status change runs each book
 *  through the reading rules); Prisma's default gives up after 5 seconds. */
const TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

/** A transaction that ran out of time becomes "timeout" (everything in it
 *  was rolled back), so the reader gets a message rather than an error
 *  page. Anything else is rethrown. */
function timedOut(err: unknown): "timeout" {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2028") {
    return "timeout";
  }
  throw err;
}

const TOO_LONG = "That took too long. Try fewer books at a time.";

/**
 * The books a bulk action applies to, as a `where` plus how many there are.
 * Either the ids picked on screen, or every book matching the library's
 * URL parameters, found through the same resolveBookWhere call the library
 * page makes, so "all that match" is exactly the books it counted. Both
 * are scoped to `userId`, so ids or a shelf from another account simply
 * match nothing.
 */
async function resolveTarget(
  userId: string,
  target: { bookIds?: string[]; matching?: Record<string, string> },
): Promise<{ where: Prisma.BookWhereInput; count: number } | { error: string }> {
  const where: Prisma.BookWhereInput = target.matching
    ? {
        // resolveBookWhere scopes to the user itself; saying it again costs
        // nothing on an action that can delete thousands of books.
        AND: [
          await resolveBookWhere(userId, parseFilters(target.matching), await getPreferences()),
          { userId },
        ],
      }
    : { id: { in: target.bookIds ?? [] }, userId };

  const count = await prisma.book.count({ where });
  if (count === 0) return { error: "No matching books" };
  if (count > BULK_MAX_MATCHING) {
    return {
      error: `That's more than ${BULK_MAX_MATCHING.toLocaleString("en-US")} books. Narrow the filters first.`,
    };
  }
  return { where, count };
}

/**
 * Apply changes to many books at once: reading status, format, ownership,
 * tags to add or remove, and/or a shelf to put them on or take them off.
 * The books are the ids picked on screen, each checked against the
 * account, or every book matching the library's filters ("Select all N
 * books that match").
 */
export async function bulkUpdateBooks(input: BulkInput): Promise<BulkResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const userId = session.user.id;

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { status, format, ownership, addShelfId, removeShelfId, addTags, removeTags } =
    parsed.data;

  if (
    !status &&
    !format &&
    !ownership &&
    !addShelfId &&
    !removeShelfId &&
    !addTags?.length &&
    !removeTags?.length
  ) {
    return { error: "Nothing to apply" };
  }

  const target = await resolveTarget(userId, parsed.data);
  if ("error" in target) return target;

  const owned = await prisma.book.findMany({
    where: target.where,
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
  // Books moved to Read with no finish date follow the "Books I add as Read
  // were finished" preference (New books): today, or no date at all.
  const undatedFinish = status
    ? (await getPreferences()).addedAsReadFinished === "undated"
    : false;

  const outcome = await prisma.$transaction(async (tx) => {
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
          new Date(),
          { undatedFinish },
        );
        await tx.book.update({ where: { id: b.id }, data: next });
      }
    }

    // Format and ownership are plain fields, so a run of books per write.
    // Books already set that way are left alone.
    if (format) {
      for (const part of chunk(ownedIds, BULK_CHUNK)) {
        await tx.book.updateMany({
          where: { id: { in: part }, userId, format: { not: format } },
          // Only an audiobook has a running time.
          data: { format, ...(format !== BookFormat.AUDIOBOOK && { lengthMinutes: null }) },
        });
      }
    }
    if (ownership) {
      for (const part of chunk(ownedIds, BULK_CHUNK)) {
        await tx.book.updateMany({
          where: { id: { in: part }, userId, ownership: { not: ownership } },
          data: { ownership },
        });
      }
    }

    if (addTags?.length || removeTags?.length) {
      // Per-row updates so existing tags are merged without duplicates —
      // updateMany's `push` would blindly append. Only books whose tags
      // change are written.
      for (const b of owned) {
        const tags = retag(b.tags, addTags ?? [], removeTags ?? []);
        if (tags) await tx.book.update({ where: { id: b.id }, data: { tags } });
      }
    }

    if (shelf) {
      const already = new Set(shelf.books.map((b) => b.id));
      const toConnect = ownedIds.filter((id) => !already.has(id));
      for (const part of chunk(toConnect, BULK_CHUNK)) {
        await tx.shelf.update({
          where: { id: shelf.id },
          data: { books: { connect: part.map((id) => ({ id })) } },
        });
      }
    }

    if (removeFrom) {
      // Disconnecting a book that isn't on the shelf is a no-op.
      for (const part of chunk(ownedIds, BULK_CHUNK)) {
        await tx.shelf.update({
          where: { id: removeFrom.id },
          data: { books: { disconnect: part.map((id) => ({ id })) } },
        });
      }
    }
  }, TRANSACTION_OPTIONS).catch(timedOut);
  if (outcome === "timeout") return { error: TOO_LONG };

  revalidatePath("/books");
  // Status, format and ownership all feed the stats page.
  revalidatePath("/stats");
  return { count: ownedIds.length };
}

/**
 * Delete many books at once, with their reading history, quotes and loans
 * (the schema cascades), then their cached covers where no other book uses
 * them. For "every book that matches", the count the confirmation showed
 * must still be the count that matches, or nothing is deleted: a book
 * added or changed in the meantime must not quietly join the delete.
 */
export async function bulkDeleteBooks(input: BulkDeleteInput): Promise<BulkResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const userId = session.user.id;

  const parsed = bulkDeleteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const target = await resolveTarget(userId, parsed.data);
  if ("error" in target) return target;

  // Checked against the rows about to go, not target.count: a book added
  // between counting and this read would otherwise join the delete.
  const doomed = await prisma.book.findMany({
    where: target.where,
    select: { id: true, coverUrl: true },
  });
  if (parsed.data.matching && doomed.length !== parsed.data.expectedCount) {
    return { error: "The books that match have changed. Check the count and try again." };
  }
  if (doomed.length === 0) return { error: "No matching books" };

  const outcome = await prisma.$transaction(async (tx) => {
    for (const part of chunk(doomed.map((b) => b.id), BULK_CHUNK)) {
      await tx.book.deleteMany({ where: { id: { in: part }, userId } });
    }
  }, TRANSACTION_OPTIONS).catch(timedOut);
  if (outcome === "timeout") return { error: TOO_LONG };

  await deleteCachedCovers(doomed.map((b) => b.coverUrl));

  revalidatePath("/books");
  revalidatePath("/stats");
  revalidatePath("/quotes");
  return { count: doomed.length };
}
