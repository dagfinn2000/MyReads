"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { bookSchema, readingSchema } from "@/lib/validation";
import { cacheCoverImage, deleteCachedCover } from "@/lib/covers";

export interface ActionState {
  error?: string;
  success?: boolean;
}

/** All actions require a session; returns the user id or throws. */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/** Lowercased title+authors+series blob that makes case-insensitive search a
 *  single `contains` query (Prisma can't substring-search a String[] column). */
function buildSearchText(
  title: string,
  authors: string[],
  seriesName?: string | null,
): string {
  return [title, ...authors, seriesName ?? ""].join(" ").trim().toLowerCase();
}

const statusField = z.nativeEnum(ReadingStatus).catch(ReadingStatus.WANT_TO_READ);

/**
 * If the book was saved with a remote cover URL, pull it into the local
 * cache and point the row at the cached copy. Best-effort: on failure the
 * remote URL stays and the UI still works.
 */
async function localizeCover(bookId: string, coverUrl: string | null) {
  if (!coverUrl || !/^https?:\/\//.test(coverUrl)) return;
  const localUrl = await cacheCoverImage(coverUrl, bookId);
  if (localUrl) {
    await prisma.book.update({ where: { id: bookId }, data: { coverUrl: localUrl } });
  }
}

/** Create a book from the add form (manual or import-prefilled). */
export async function createBook(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = bookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const status = statusField.parse(formData.get("status"));

  const data = parsed.data;
  const book = await prisma.book.create({
    data: {
      userId,
      title: data.title,
      authors: data.authors,
      isbn: data.isbn ?? null,
      description: data.description ?? null,
      coverUrl: data.coverUrl ?? null,
      pageCount: data.pageCount ?? null,
      publishedDate: data.publishedDate ?? null,
      tags: data.tags,
      seriesName: data.seriesName ?? null,
      seriesNumber: data.seriesNumber ?? null,
      format: data.format,
      owned: data.owned,
      openLibraryId: data.openLibraryId ?? null,
      status,
      searchText: buildSearchText(data.title, data.authors, data.seriesName),
    },
  });

  await localizeCover(book.id, book.coverUrl);

  revalidatePath("/books");
  redirect(`/books/${book.id}`);
}

/** Update a book's bibliographic fields from the edit form. */
export async function updateBook(
  bookId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const existing = await prisma.book.findFirst({
    where: { id: bookId, userId },
  });
  if (!existing) return { error: "Book not found" };

  const parsed = bookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const newCover = data.coverUrl ?? null;

  // If the cover changed away from a cached file, clean the old file up.
  if (existing.coverUrl !== newCover) {
    await deleteCachedCover(existing.coverUrl);
  }

  await prisma.book.update({
    where: { id: bookId },
    data: {
      title: data.title,
      authors: data.authors,
      isbn: data.isbn ?? null,
      description: data.description ?? null,
      coverUrl: newCover,
      pageCount: data.pageCount ?? null,
      publishedDate: data.publishedDate ?? null,
      tags: data.tags,
      seriesName: data.seriesName ?? null,
      seriesNumber: data.seriesNumber ?? null,
      format: data.format,
      owned: data.owned,
      searchText: buildSearchText(data.title, data.authors, data.seriesName),
    },
  });

  if (existing.coverUrl !== newCover) {
    await localizeCover(bookId, newCover);
  }

  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
  redirect(`/books/${bookId}`);
}

/** Update personal reading data (status, rating, review, dates, re-reads). */
export async function updateReading(
  bookId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const existing = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { id: true },
  });
  if (!existing) return { error: "Book not found" };

  const parsed = readingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  // Convenience: marking a book Read fills in "finished today" if the date
  // was never set — saves a click per book.
  let dateFinished = data.dateFinished ?? null;
  if (data.status === ReadingStatus.READ && !dateFinished) {
    dateFinished = new Date();
  }

  // timesRead is derived, not submitted: archived passes in the Read table
  // plus the current one when it's finished.
  const pastReads = await prisma.read.count({ where: { bookId } });
  const timesRead = pastReads + (data.status === ReadingStatus.READ ? 1 : 0);

  // Progress only makes sense mid-book: keep it for READING and DNF
  // ("stopped at p. 218"), clear it when finished or back on the shelf.
  const keepsProgress =
    data.status === ReadingStatus.READING || data.status === ReadingStatus.DNF;
  const currentPage = keepsProgress ? data.currentPage || null : null;

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: data.status,
      rating: data.rating || null, // 0 = cleared
      review: data.review ?? null,
      dateStarted: data.dateStarted ?? null,
      dateFinished,
      timesRead,
      currentPage,
    },
  });

  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/stats");
  return { success: true };
}

/** Delete a book and its cached cover image. */
export async function deleteBook(bookId: string): Promise<void> {
  const userId = await requireUserId();

  const existing = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { coverUrl: true },
  });
  if (!existing) return;

  await prisma.book.delete({ where: { id: bookId } });
  await deleteCachedCover(existing.coverUrl);

  revalidatePath("/books");
  redirect("/books");
}
