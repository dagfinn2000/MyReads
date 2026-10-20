"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { BookOwnership } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { getPreferences } from "@/lib/current-user";
import { calendarDay } from "@/lib/dates";
import { overdueCutoff } from "@/lib/loans";
import { OVERDUE_SNOOZE_COOKIE, OVERDUE_SNOOZE_DAYS } from "@/lib/overdue-query";
import { idSchema } from "@/lib/reading-log-input";
import { loanDueSchema, loanSchema } from "@/lib/validation";
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
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };

  const book = await prisma.book.findFirst({
    where: { id: id.data, userId },
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
  // Lent "now" (the date left empty): the due day can be today, not before.
  if (!data.lentAt && data.dueAt) {
    const prefs = await getPreferences();
    if (data.dueAt < overdueCutoff(new Date(), prefs.timeZone)) {
      return { error: "It can't be due back before you lent it." };
    }
  }

  const alreadyOut = await prisma.loan.findFirst({
    where: { bookId: book.id, returnedAt: null },
    select: { borrower: true },
  });
  if (alreadyOut) {
    return { error: `Already lent to ${alreadyOut.borrower} — mark it returned first.` };
  }

  await prisma.loan.create({
    data: {
      bookId: book.id,
      borrower: data.borrower,
      lentAt: data.lentAt ?? new Date(),
      dueAt: data.dueAt ?? null,
      note: data.note ?? null,
    },
  });

  revalidatePath("/books");
  revalidatePath(`/books/${book.id}`);
  return { success: true };
}

/**
 * Change when an open loan is due back, or clear it with "". Returns an
 * error the card can show, or nothing when it saved.
 */
export async function setLoanDue(loanId: string, value: string): Promise<string | undefined> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(loanId);
  const due = loanDueSchema.safeParse(value);
  if (!id.success) return "Loan not found";
  if (!due.success) return "That isn't a date.";

  const loan = await prisma.loan.findFirst({
    where: { id: id.data, book: { userId } },
    select: { bookId: true, lentAt: true, returnedAt: true },
  });
  if (!loan || loan.returnedAt) return "Loan not found";
  // Compared by calendar day: lentAt may be a moment ("lent now", on the
  // reader's clock), the due date is a day saved as midnight UTC.
  const { timeZone } = await getPreferences();
  if (due.data && calendarDay(due.data) < calendarDay(loan.lentAt, timeZone)) {
    return "It can't be due back before you lent it.";
  }

  await prisma.loan.update({ where: { id: id.data }, data: { dueAt: due.data } });

  revalidatePath("/books");
  revalidatePath("/reading");
  revalidatePath(`/books/${loan.bookId}`);
}

/** Mark the open loan returned (ownership checked through the book). */
export async function returnLoan(loanId: string): Promise<void> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(loanId);
  if (!id.success) return;

  const loan = await prisma.loan.findFirst({
    where: { id: id.data, book: { userId } },
    select: { bookId: true, returnedAt: true },
  });
  if (!loan || loan.returnedAt) return;

  await prisma.loan.update({
    where: { id: id.data },
    data: { returnedAt: new Date() },
  });

  revalidatePath("/books");
  revalidatePath("/reading");
  revalidatePath(`/books/${loan.bookId}`);
}

/** Delete a loan record entirely — for fixing a mistaken entry, where
 *  "returned" would leave a lie in the history. */
export async function deleteLoan(loanId: string): Promise<void> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(loanId);
  if (!id.success) return;

  const loan = await prisma.loan.findFirst({
    where: { id: id.data, book: { userId } },
    select: { bookId: true },
  });
  if (!loan) return;

  await prisma.loan.delete({ where: { id: id.data } });

  revalidatePath("/books");
  revalidatePath(`/books/${loan.bookId}`);
}

/**
 * "Not now" on the overdue reminder: hides it in this browser for a few
 * days. Setting a cookie in a Server Action re-renders the page, so the
 * reminder goes in the same round trip.
 */
export async function snoozeOverdueReminder(): Promise<void> {
  const userId = await requireUserId();
  (await cookies()).set(OVERDUE_SNOOZE_COOKIE, userId, {
    maxAge: OVERDUE_SNOOZE_DAYS * 86_400,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
}
