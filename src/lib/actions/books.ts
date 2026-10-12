"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bookSchema, readingSchema } from "@/lib/validation";
import { cacheCoverImage, deleteCachedCover } from "@/lib/covers";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";
import { currentPassEntries } from "@/lib/progress";
import { settleReadingState } from "@/lib/reading-state";
import { buildSearchText } from "@/lib/utils";

const statusField = z.nativeEnum(ReadingStatus).catch(ReadingStatus.WANT_TO_READ);

/**
 * If the book was saved with a remote cover URL, pull it into the local
 * cache and point the row at the cached copy. Best-effort: on failure the
 * remote URL stays and the UI still works.
 *
 * Runs via `after()` — the download can take seconds on a slow image host,
 * and the save response shouldn't wait for it. The page renders the remote
 * URL until the cached copy lands; every book page after that gets the
 * local file.
 *
 * One delayed retry: Open Library covers redirect to archive.org, which
 * extracts them from zip archives on demand — a cold request can take 10s+
 * or fail outright while the very next one is instant. Now that no user is
 * waiting, retrying is free and rescues most of those covers.
 */
function localizeCoverAfterResponse(bookId: string, coverUrl: string | null) {
  if (!coverUrl || !/^https?:\/\//.test(coverUrl)) return;
  after(async () => {
    let localUrl = await cacheCoverImage(coverUrl, bookId);
    if (!localUrl) {
      await new Promise((r) => setTimeout(r, 10_000));
      localUrl = await cacheCoverImage(coverUrl, bookId);
    }
    if (localUrl) {
      // Only if the book still has the cover this download was for. A save
      // in the meantime may have picked another one, and this older
      // download finishing late must not overwrite it.
      const { count } = await prisma.book.updateMany({
        where: { id: bookId, coverUrl },
        data: { coverUrl: localUrl },
      });
      if (count === 0) await deleteCachedCover(localUrl);
    }
  });
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
  // Adding a book straight onto Read or Currently Reading gets the same
  // dates and read count as moving it there from the reading card.
  const reading = settleReadingState(
    null,
    {
      status: statusField.parse(formData.get("status")),
      dateStarted: null,
      dateFinished: null,
      currentPage: null,
    },
    0,
  );

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
      ownership: data.ownership,
      openLibraryId: data.openLibraryId ?? null,
      status: reading.status,
      dateStarted: reading.dateStarted,
      dateFinished: reading.dateFinished,
      timesRead: reading.timesRead,
      searchText: buildSearchText(data.title, data.authors, data.seriesName),
    },
  });

  localizeCoverAfterResponse(book.id, book.coverUrl);

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
      ownership: data.ownership,
      // Submitted by the form and validated by bookSchema, but previously
      // dropped here — the only field of the schema the update ignored.
      openLibraryId: data.openLibraryId ?? null,
      searchText: buildSearchText(data.title, data.authors, data.seriesName),
    },
  });

  // Only after the update lands: clean up the replaced cached file (doing
  // it earlier would leave the row pointing at a deleted image if the
  // update failed) and pull a new remote cover into the cache.
  if (existing.coverUrl !== newCover) {
    await deleteCachedCover(existing.coverUrl);
    localizeCoverAfterResponse(bookId, newCover);
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

  // Fills in "finished today" / "started today" when the dates were left
  // empty, derives timesRead, and drops the page once the book is finished
  // or reshelved. Shared with createBook and bulk edit.
  const { dateStarted, dateFinished, timesRead, currentPage } = settleReadingState(
    existing.status,
    {
      status: data.status,
      dateStarted: data.dateStarted ?? null,
      dateFinished: data.dateFinished ?? null,
      currentPage: data.currentPage ?? null,
    },
    existing._count.reads,
  );

  // A page past the end is a typo, and the reading log would keep it: every
  // page between the last entry and it would be credited to today.
  if (currentPage != null && existing.pageCount != null && currentPage > existing.pageCount) {
    return { error: `Page ${currentPage} is past the end of the book (${existing.pageCount} pages)` };
  }

  // The book update and its automatic reading-log entries land together —
  // a page-0 anchor without the page change it anchors (or vice versa)
  // would corrupt the pass bookkeeping.
  await prisma.$transaction(async (tx) => {
    await tx.book.update({
      where: { id: bookId },
      data: {
        status: data.status,
        rating: data.rating || null, // 0 = cleared
        review: data.review ?? null,
        dateStarted,
        dateFinished,
        timesRead,
        currentPage,
      },
    });

    await logProgress(tx, bookId, existing, {
      status: data.status,
      currentPage,
      dateStarted,
      dateFinished,
    });
  });

  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/stats");
  return {
    success: true,
    finished: existing.status !== ReadingStatus.READ && data.status === ReadingStatus.READ,
  };
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
  db: Prisma.TransactionClient,
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
  const all = await db.progressEntry.findMany({
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
    await db.progressEntry.createMany({ data: entries });
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
    await db.progressEntry.create({
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
