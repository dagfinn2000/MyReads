"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { shelfNameSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/books";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

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

  const existing = await prisma.shelf.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (existing) return { error: "You already have a shelf with that name" };

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
