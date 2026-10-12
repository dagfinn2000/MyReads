"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BULK_CHUNK, chunk } from "@/lib/bulk";
import { prisma } from "@/lib/prisma";
import { canonicalViewQueryFromString } from "@/lib/saved-views";
import { shelfNameSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";

/**
 * Create a custom shelf. If the form carries a `bookId`, the book is put on
 * the new shelf immediately — that's the "new shelf" input on the book
 * detail page; the library page creates empty shelves.
 */
export async function createShelf(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = shelfNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const name = parsed.data;

  // Case-insensitive: "Favourites" and "favourites" side by side is never
  // what anyone meant.
  const existing = await prisma.shelf.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { name: true },
  });
  if (existing) return { error: `You already have a shelf called "${existing.name}"` };

  const bookId = formData.get("bookId");
  await prisma.shelf.create({
    data: {
      userId,
      name,
      // connect is safe even from a form-supplied id: the book must also
      // belong to this user or the connect simply fails.
      ...(typeof bookId === "string" && bookId
        ? { books: { connect: { id: bookId, userId } } }
        : {}),
    },
  });

  revalidatePath("/books");
  if (bookId) revalidatePath(`/books/${bookId}`);
  return { success: true };
}

export interface ShelfRenameResult {
  error?: string;
  /** True when the name belonged to another shelf and the two became one. */
  merged?: boolean;
  /** The shelf that has the name now: this one, or the one it merged into. */
  shelfId?: string;
  name?: string;
  /** After a merge, how many books the merged shelf holds. */
  count?: number;
}

/**
 * Rename a shelf. A name another of the reader's shelves already has (in
 * any case) merges the two: the books join that shelf, this one goes, and
 * saved views that filtered on it follow the books. Changing only the case
 * of a shelf's own name just renames it.
 */
export async function renameShelf(shelfId: string, name: string): Promise<ShelfRenameResult> {
  const userId = await requireUserId();
  if (!z.string().min(1).max(64).safeParse(shelfId).success) return { error: "Shelf not found" };

  const parsed = shelfNameSchema.safeParse(name);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const newName = parsed.data;

  const source = await prisma.shelf.findFirst({
    where: { id: shelfId, userId },
    select: { id: true, name: true },
  });
  if (!source) return { error: "Shelf not found" };
  if (newName === source.name) return { shelfId: source.id, name: source.name };

  const target = await prisma.shelf.findFirst({
    where: { userId, id: { not: source.id }, name: { equals: newName, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!target) {
    try {
      await prisma.shelf.update({ where: { id: source.id, userId }, data: { name: newName } });
    } catch (err) {
      // Another tab made a shelf with this name a moment ago.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { error: `You already have a shelf called "${newName}"` };
      }
      throw err;
    }
    revalidatePath("/books");
    revalidatePath("/account");
    return { shelfId: source.id, name: newName };
  }

  const count = await prisma.$transaction(
    async (tx) => {
      const moving = await tx.book.findMany({
        where: { userId, shelves: { some: { id: source.id } } },
        select: { id: true },
      });
      const already = await tx.book.findMany({
        where: { userId, shelves: { some: { id: target.id } } },
        select: { id: true },
      });
      // Books on both shelves are already where they need to be.
      const onTarget = new Set(already.map((b) => b.id));
      const toConnect = moving.map((b) => b.id).filter((id) => !onTarget.has(id));
      for (const part of chunk(toConnect, BULK_CHUNK)) {
        await tx.shelf.update({
          where: { id: target.id },
          data: { books: { connect: part.map((id) => ({ id })) } },
        });
      }

      await tx.shelf.delete({ where: { id: source.id } });

      // Saved views that opened this shelf open the merged one instead.
      const views = await tx.savedView.findMany({
        where: { userId, query: { contains: `shelfId=${source.id}` } },
        select: { id: true, query: true },
      });
      for (const view of views) {
        const params = new URLSearchParams(view.query);
        if (params.get("shelfId") !== source.id) continue;
        params.set("shelfId", target.id);
        await tx.savedView.update({
          where: { id: view.id },
          data: { query: canonicalViewQueryFromString(params.toString()) },
        });
      }

      return tx.book.count({ where: { userId, shelves: { some: { id: target.id } } } });
    },
    { timeout: 60_000 },
  );

  revalidatePath("/books");
  revalidatePath("/account");
  return { merged: true, shelfId: target.id, name: target.name, count };
}

/** Delete a shelf. Books on it are untouched — only the grouping goes. */
export async function deleteShelf(shelfId: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.shelf.deleteMany({ where: { id: shelfId, userId } });
  revalidatePath("/books");
}

/** Put a book on / take it off a shelf (ownership-checked on both sides). */
export async function toggleBookShelf(
  bookId: string,
  shelfId: string,
  member: boolean,
): Promise<void> {
  const userId = await requireUserId();

  const [book, shelf] = await Promise.all([
    prisma.book.findFirst({ where: { id: bookId, userId }, select: { id: true } }),
    prisma.shelf.findFirst({ where: { id: shelfId, userId }, select: { id: true } }),
  ]);
  if (!book || !shelf) return;

  await prisma.book.update({
    where: { id: bookId },
    data: {
      shelves: member ? { connect: { id: shelfId } } : { disconnect: { id: shelfId } },
    },
  });

  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
}
