"use server";

import { revalidatePath } from "next/cache";
import { BookOwnership } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loanSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";

/**
 * Lending: where your copy went.
 *
 * A book is "lent out" while it has a loan with no `returnedAt`. Returning
 * one keeps the row, so the book page can show who has borrowed it over the
 * years rather than only the current state.
 *
 * Ownership is unaffected: a lent book is still yours. That is why lending
 * lives here and not in the ownership enum — the two answer different
 * questions ("is this mine?" vs "is it on my shelf right now?").
 */

/** Lend the book out. Refuses if it's already out — two open loans would make
 *  "who has it?" unanswerable — and unless the copy is yours to lend (the
 *  card hides the button for the rest). */
export async function lendBook(
  bookId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { id: true, ownership: true },
  });
  if (!book) return { error: "Book not found" };
  if (book.ownership !== BookOwnership.OWNED) {
    return { error: "Only a copy you own can be lent out." };
  }

  const parsed = loanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const alreadyOut = await prisma.loan.findFirst({
    where: { bookId, returnedAt: null },
    select: { borrower: true },
  });
  if (alreadyOut) {
    return { error: `Already lent to ${alreadyOut.borrower} — mark it returned first.` };
  }

  await prisma.loan.create({
    data: {
      bookId,
      borrower: data.borrower,
      lentAt: data.lentAt ?? new Date(),
      note: data.note ?? null,
    },
  });

  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
  return { success: true };
}

/** Mark the open loan returned (ownership checked through the book). */
export async function returnLoan(loanId: string): Promise<void> {
  const userId = await requireUserId();

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, book: { userId } },
    select: { bookId: true, returnedAt: true },
  });
  if (!loan || loan.returnedAt) return;

  await prisma.loan.update({
    where: { id: loanId },
    data: { returnedAt: new Date() },
  });

  revalidatePath("/books");
  revalidatePath(`/books/${loan.bookId}`);
}

/** Delete a loan record entirely — for fixing a mistaken entry, where
 *  "returned" would leave a lie in the history. */
export async function deleteLoan(loanId: string): Promise<void> {
  const userId = await requireUserId();

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, book: { userId } },
    select: { bookId: true },
  });
  if (!loan) return;

  await prisma.loan.delete({ where: { id: loanId } });

  revalidatePath("/books");
  revalidatePath(`/books/${loan.bookId}`);
}
