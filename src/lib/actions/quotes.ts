"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { quoteSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";

/** Same rule as the reading card: a page past the end is a typo, and the
 *  quote would sort after every other. */
function pastTheEnd(page: number | null | undefined, pageCount: number | null): string | null {
  return page && pageCount != null && page > pageCount
    ? `Page ${page} is past the end of the book (${pageCount} pages)`
    : null;
}

/** Add a quote/highlight to a book (the form carries the bookId). */
export async function addQuote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const bookId = formData.get("bookId");
  if (typeof bookId !== "string" || !bookId) return { error: "Book not found" };
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { id: true, pageCount: true },
  });
  if (!book) return { error: "Book not found" };

  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const pageError = pastTheEnd(data.page, book.pageCount);
  if (pageError) return { error: pageError };

  await prisma.quote.create({
    data: {
      bookId,
      text: data.text,
      page: data.page || null, // 0 = no page reference
      note: data.note ?? null,
    },
  });

  revalidatePath(`/books/${bookId}`);
  revalidatePath("/quotes");
  return { success: true };
}

/** Edit an existing quote (ownership checked through the book). */
export async function updateQuote(
  quoteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, book: { userId } },
    select: { bookId: true, book: { select: { pageCount: true } } },
  });
  if (!existing) return { error: "Quote not found" };

  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const pageError = pastTheEnd(data.page, existing.book.pageCount);
  if (pageError) return { error: pageError };

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      text: data.text,
      page: data.page || null,
      note: data.note ?? null,
    },
  });

  revalidatePath(`/books/${existing.bookId}`);
  revalidatePath("/quotes");
  return { success: true };
}

/** Delete a quote (ownership checked through the book). */
export async function deleteQuote(quoteId: string): Promise<void> {
  const userId = await requireUserId();

  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, book: { userId } },
    select: { bookId: true },
  });
  if (!existing) return;

  await prisma.quote.delete({ where: { id: quoteId } });
  revalidatePath(`/books/${existing.bookId}`);
  revalidatePath("/quotes");
}
