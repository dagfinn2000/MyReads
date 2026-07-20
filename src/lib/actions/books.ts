"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bookSchema, readingSchema } from "@/lib/validation";
import { cacheCoverImage, deleteCachedCover } from "@/lib/covers";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";
import { currentPassEntries } from "@/lib/progress";
import { buildSearchText } from "@/lib/utils";

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
    select: { coverUrl: true },
  });
  if (!existing) return { error: "Book not found" };

  const parsed = bookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const newCover = data.coverUrl ?? null;

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

  // Only after the update lands: clean up the replaced cached file (doing
  // it earlier would leave the row pointing at a deleted image if the
  // update failed) and pull a new remote cover into the cache.
  if (existing.coverUrl !== newCover) {
    await deleteCachedCover(existing.coverUrl);
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
    select: {
      status: true,
      currentPage: true,
      pageCount: true,
      _count: { select: { reads: true } },
    },
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
  const timesRead =
    existing._count.reads + (data.status === ReadingStatus.READ ? 1 : 0);

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

  await logProgress(bookId, existing, {
    status: data.status,
    currentPage,
    dateStarted: data.dateStarted ?? null,
    dateFinished,
  });

  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/stats");
  return { success: true };
}

/**
 * The automatic reading log: every change to `currentPage` becomes a dated
 * ProgressEntry, and finishing a tracked book closes the log at the last
 * page. Consumers (sparkline, pace, heatmap) count pages as the delta
 * between *consecutive* entries, so the first entry of a reading pass is
 * preceded by a page-0 anchor at the pass start — "page 74" logged into a
 * fresh book credits 74 pages, while a lone entry with no predecessor (like
 * the anchors the upgrade migration seeds from mid-read books) credits none.
 * Re-read passes get their anchor from readAgain (see lib/actions/reads.ts).
 */
async function logProgress(
  bookId: string,
  prev: { status: ReadingStatus; currentPage: number | null; pageCount: number | null },
  next: {
    status: ReadingStatus;
    currentPage: number | null;
    dateStarted: Date | null;
    dateFinished: Date | null;
  },
): Promise<void> {
  const now = new Date();

  // The latest entry of the current pass. A personal log is small, so
  // fetching it whole and slicing beats encoding the pass rule in SQL.
  const all = await prisma.progressEntry.findMany({
    where: { bookId },
    orderBy: [{ date: "asc" }, { page: "asc" }],
    select: { page: true, date: true },
  });
  const pass = currentPassEntries(all, next.dateStarted);
  const last = pass[pass.length - 1] ?? null;

  if (next.currentPage != null && next.currentPage !== prev.currentPage) {
    const entries: { bookId: string; page: number; date: Date }[] = [];
    if (!last) {
      entries.push({ bookId, page: 0, date: next.dateStarted ?? now });
    }
    entries.push({ bookId, page: next.currentPage, date: now });
    await prisma.progressEntry.createMany({ data: entries });
    return;
  }

  // Finishing a tracked book: close the log at the final page. An untracked
  // pass (no entries) logs nothing — marking a book Read weeks after the
  // fact shouldn't credit every page of it to one day.
  if (
    next.status === ReadingStatus.READ &&
    prev.status !== ReadingStatus.READ &&
    prev.pageCount != null &&
    last != null &&
    last.page < prev.pageCount
  ) {
    await prisma.progressEntry.create({
      data: { bookId, page: prev.pageCount, date: next.dateFinished ?? now },
    });
  }
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
