"use server";

import { revalidatePath } from "next/cache";
import { pagePastTheEnd } from "@/lib/book-notes";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/reading-log-input";
import { noteSchema } from "@/lib/validation";
import { addQuote } from "@/lib/actions/quotes";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";

/**
 * The add form of a book's Notes & quotes card, which adds either: a quote
 * when its `kind` is "quote", otherwise a note.
 */
export async function addNoteOrQuote(prev: ActionState, formData: FormData): Promise<ActionState> {
  return formData.get("kind") === "quote" ? addQuote(prev, formData) : addNote(prev, formData);
}

/** Add a note of the reader's own to a book (the form carries the bookId). */
export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();

  const bookId = formData.get("bookId");
  if (!idSchema.safeParse(bookId).success) return { error: "Book not found" };
  const book = await prisma.book.findFirst({
    where: { id: bookId as string, userId },
    select: { id: true, pageCount: true },
  });
  if (!book) return { error: "Book not found" };

  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const pageError = pagePastTheEnd(data.page, book.pageCount);
  if (pageError) return { error: pageError };

  await prisma.bookNote.create({
    data: {
      bookId: book.id,
      text: data.text,
      page: data.page || null, // 0 = no page
      chapter: data.chapter ?? null,
    },
  });

  revalidatePath(`/books/${book.id}`);
  return { success: true };
}

/** Edit a note (ownership checked through the book). */
export async function updateNote(
  noteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  // Bound on the client, so not runtime-typed: an object here would reach
  // the `where` as a filter.
  if (!idSchema.safeParse(noteId).success) return { error: "Note not found" };

  const existing = await prisma.bookNote.findFirst({
    where: { id: noteId, book: { userId } },
    select: { bookId: true, book: { select: { pageCount: true } } },
  });
  if (!existing) return { error: "Note not found" };

  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const pageError = pagePastTheEnd(data.page, existing.book.pageCount);
  if (pageError) return { error: pageError };

  await prisma.bookNote.update({
    where: { id: noteId },
    data: {
      text: data.text,
      page: data.page || null,
      ...(data.chapter !== undefined && { chapter: data.chapter }),
    },
  });

  revalidatePath(`/books/${existing.bookId}`);
  return { success: true };
}

/** Delete a note (ownership checked through the book). */
export async function deleteNote(noteId: string): Promise<void> {
  const userId = await requireUserId();
  if (!idSchema.safeParse(noteId).success) return;

  const existing = await prisma.bookNote.findFirst({
    where: { id: noteId, book: { userId } },
    select: { bookId: true },
  });
  if (!existing) return;

  await prisma.bookNote.delete({ where: { id: noteId } });
  revalidatePath(`/books/${existing.bookId}`);
}
