"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pastReadSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";

/** Keep Book.timesRead = archived passes + the current one when finished.
 *  Runs on the caller's transaction client so the recount sees (and commits
 *  with) the write that made it necessary. */
async function syncTimesRead(
  db: Prisma.TransactionClient,
  bookId: string,
): Promise<void> {
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { status: true, _count: { select: { reads: true } } },
  });
  if (!book) return;
  await db.book.update({
    where: { id: bookId },
    data: {
      timesRead:
        book._count.reads + (book.status === ReadingStatus.READ ? 1 : 0),
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

  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { status: true, dateStarted: true, dateFinished: true, rating: true },
  });
  if (!book || book.status !== ReadingStatus.READ) return;

  const now = new Date();
  // One atomic unit — failing between these writes would strand the book
  // half-archived. The progress entry is the new pass's page-0 anchor at the
  // exact re-read moment: the date form field only keeps day precision, so
  // without it a re-read started on a day with already-logged entries would
  // blend into the previous pass. timesRead is unchanged throughout: the
  // pass moved from "current" to "archived".
  await prisma.$transaction([
    prisma.read.create({
      data: {
        bookId,
        dateStarted: book.dateStarted,
        dateFinished: book.dateFinished,
        rating: book.rating,
      },
    }),
    prisma.book.update({
      where: { id: bookId },
      data: {
        status: ReadingStatus.READING,
        dateStarted: now,
        dateFinished: null,
        currentPage: null,
      },
    }),
    prisma.progressEntry.create({
      data: { bookId, page: 0, date: now },
    }),
  ]);

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

  await prisma.$transaction(async (tx) => {
    await tx.read.create({
      data: {
        bookId,
        dateStarted: data.dateStarted ?? null,
        dateFinished: data.dateFinished ?? null,
        rating: data.rating || null, // 0 = unrated
      },
    });
    await syncTimesRead(tx, bookId);
  });

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

  await prisma.$transaction(async (tx) => {
    await tx.read.delete({ where: { id: readId } });
    await syncTimesRead(tx, existing.bookId);
  });

  revalidateBook(existing.bookId);
}
