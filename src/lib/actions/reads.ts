"use server";

import { revalidatePath } from "next/cache";
import { ReadingStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pastReadSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/books";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/** Keep Book.timesRead = archived passes + the current one when finished. */
async function syncTimesRead(bookId: string): Promise<void> {
  const [pastReads, book] = await Promise.all([
    prisma.read.count({ where: { bookId } }),
    prisma.book.findUnique({ where: { id: bookId }, select: { status: true } }),
  ]);
  if (!book) return;
  await prisma.book.update({
    where: { id: bookId },
    data: {
      timesRead: pastReads + (book.status === ReadingStatus.READ ? 1 : 0),
    },
  });
}

function revalidateBook(bookId: string) {
  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/stats");
}

/**
 * Start a re-read: archive the current finished pass (dates + what you rated
 * it that time) into the Read table, then flip the book back to Currently
 * Reading starting today. The overall rating on the book stays yours to keep
 * or change.
 */
export async function readAgain(bookId: string): Promise<void> {
  const userId = await requireUserId();

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } });
  if (!book || book.status !== ReadingStatus.READ) return;

  await prisma.read.create({
    data: {
      bookId,
      dateStarted: book.dateStarted,
      dateFinished: book.dateFinished,
      rating: book.rating,
    },
  });
  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: ReadingStatus.READING,
      dateStarted: new Date(),
      dateFinished: null,
      currentPage: null,
      // timesRead is unchanged: the pass moved from "current" to "archived".
    },
  });

  revalidateBook(bookId);
}

/** Record a read from before the app (the form carries the bookId). */
export async function addPastRead(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const bookId = formData.get("bookId");
  if (typeof bookId !== "string" || !bookId) return { error: "Book not found" };
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { id: true },
  });
  if (!book) return { error: "Book not found" };

  const parsed = pastReadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  await prisma.read.create({
    data: {
      bookId,
      dateStarted: data.dateStarted ?? null,
      dateFinished: data.dateFinished ?? null,
      rating: data.rating || null, // 0 = unrated
    },
  });
  await syncTimesRead(bookId);

  revalidateBook(bookId);
  return { success: true };
}

/** Edit a past read (ownership checked through the book). */
export async function updatePastRead(
  readId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const existing = await prisma.read.findFirst({
    where: { id: readId, book: { userId } },
    select: { bookId: true },
  });
  if (!existing) return { error: "Read not found" };

  const parsed = pastReadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  await prisma.read.update({
    where: { id: readId },
    data: {
      dateStarted: data.dateStarted ?? null,
      dateFinished: data.dateFinished ?? null,
      rating: data.rating || null,
    },
  });

  revalidateBook(existing.bookId);
  return { success: true };
}

/** Delete a past read (ownership checked through the book). */
export async function deletePastRead(readId: string): Promise<void> {
  const userId = await requireUserId();

  const existing = await prisma.read.findFirst({
    where: { id: readId, book: { userId } },
    select: { bookId: true },
  });
  if (!existing) return;

  await prisma.read.delete({ where: { id: readId } });
  await syncTimesRead(existing.bookId);

  revalidateBook(existing.bookId);
}
