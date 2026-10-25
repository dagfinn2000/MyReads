"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { quoteKey, type LibraryBookRef } from "@/lib/kindle-clippings";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/reading-log-input";
import { kindleQuotesSchema, quoteSchema } from "@/lib/validation";
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
  if (!idSchema.safeParse(quoteId).success) return;

  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, book: { userId } },
    select: { bookId: true },
  });
  if (!existing) return;

  await prisma.quote.delete({ where: { id: quoteId } });
  revalidatePath(`/books/${existing.bookId}`);
  revalidatePath("/quotes");
}

/** The library as the Kindle import matches against it. */
export async function kindleLibrary(): Promise<LibraryBookRef[]> {
  const userId = await requireUserId();
  return prisma.book.findMany({
    where: { userId },
    select: { id: true, title: true, authors: true, format: true },
    orderBy: { title: "asc" },
  });
}

export type KindleImportResult = { added: number; already: number } | { error: string };

/** Kindle launched in November 2007: an older date is a clock gone wrong. */
const FIRST_KINDLE = Date.UTC(2007, 10, 1);

/**
 * Add highlights from a Kindle (see lib/kindle-clippings.ts) to one book as
 * quotes. Any already among the book's quotes, the same text with case and
 * spacing aside, are left out, so importing the same file again only adds
 * the new ones. Each quote is dated when it was highlighted, so Newest
 * first puts it where it belongs. A page past the end of this edition is
 * dropped rather than refused: Kindle pages follow the publisher's print
 * edition, which may not be the one in the library.
 */
export async function importKindleQuotes(
  bookId: string,
  highlights: unknown,
): Promise<KindleImportResult> {
  const userId = await requireUserId();

  // Server-action arguments are decoded from the client, so the string type
  // isn't enforced at runtime: validate before it reaches a Prisma `where`,
  // or an object like { not: "" } slips through as a filter.
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };

  const book = await prisma.book.findFirst({
    where: { id: id.data, userId },
    select: { id: true, pageCount: true },
  });
  if (!book) return { error: "Book not found" };

  const parsed = kindleQuotesSchema.safeParse(highlights);
  if (!parsed.success) return { error: "Those highlights couldn't be read" };

  const existing = await prisma.quote.findMany({ where: { bookId: id.data }, select: { text: true } });
  const seen = new Set(existing.map((q) => quoteKey(q.text)));
  const now = Date.now();
  const rows: Prisma.QuoteCreateManyInput[] = [];
  let already = 0;
  for (const h of parsed.data) {
    const key = quoteKey(h.text);
    if (seen.has(key)) {
      already++;
      continue;
    }
    seen.add(key);
    const at = h.addedAt ? new Date(h.addedAt).getTime() : NaN;
    rows.push({
      bookId: id.data,
      text: h.text,
      page: h.page && !pastTheEnd(h.page, book.pageCount) ? h.page : null,
      note: h.note,
      ...(at >= FIRST_KINDLE && at <= now && { createdAt: new Date(at) }),
    });
  }
  if (rows.length > 0) await prisma.quote.createMany({ data: rows });

  revalidatePath(`/books/${id.data}`);
  revalidatePath("/quotes");
  return { added: rows.length, already };
}
