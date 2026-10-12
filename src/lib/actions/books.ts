"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bookSchema, readingSchema } from "@/lib/validation";
import { deleteCachedCover } from "@/lib/covers";
import { localizeCoverAfterResponse } from "@/lib/cover-localize";
import { getPreferences } from "@/lib/current-user";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";
import { currentPassEntries } from "@/lib/progress";
import { anchorMoment } from "@/lib/reading-log";
import { settleReadingState } from "@/lib/reading-state";
import { buildSearchText } from "@/lib/utils";
import { AFTER_ADD } from "@/lib/preferences";

const statusField = z.nativeEnum(ReadingStatus).catch(ReadingStatus.WANT_TO_READ);

/** Create a book from the add form (manual or import-prefilled). */
export async function createBook(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const fields = Object.fromEntries(formData);
  const parsed = bookSchema.safeParse(fields);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  // The shelf's own fields: Finished, Don't remember and Rating for Read;
  // Started and Current page for Currently Reading. Same checks as the
  // reading card (no dates in the future, none backwards).
  const status = statusField.parse(formData.get("status"));
  const readingParsed = readingSchema.safeParse({ ...fields, status });
  if (!readingParsed.success) {
    return { error: readingParsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const r = readingParsed.data;
  const prefs = await getPreferences();
  // Which submit button was pressed; a form without one follows Preferences.
  const afterAdd = z.enum(AFTER_ADD).catch(prefs.afterAdd).parse(formData.get("afterAdd"));

  // Adding a book straight onto Read or Currently Reading gets the same
  // dates and read count as moving it there from the reading card. Without a
  // date, Read means today unless the reader said they don't remember (or
  // chose undated finishes in Preferences).
  const now = new Date();
  const reading = settleReadingState(
    null,
    {
      status,
      dateStarted: status === ReadingStatus.READING ? (r.dateStarted ?? null) : null,
      dateFinished:
        status === ReadingStatus.READ && !r.finishedUnknown ? (r.dateFinished ?? null) : null,
      currentPage: r.currentPage ?? null,
    },
    0,
    now,
    { undatedFinish: r.finishedUnknown || prefs.addedAsReadFinished === "undated" },
  );

  const data = parsed.data;
  // Same rule as the reading card: a page past the end is a typo.
  if (reading.currentPage != null && data.pageCount != null && reading.currentPage > data.pageCount) {
    return {
      error: `Page ${reading.currentPage} is past the end of the book (${data.pageCount} pages)`,
    };
  }

  const book = await prisma.book.create({
    data: {
      userId,
      title: data.title,
      authors: data.authors,
      isbn: data.isbn ?? null,
      description: data.description ?? null,
      coverUrl: data.coverUrl ?? null,
      pageCount: data.pageCount ?? null,
      // Only an audiobook has a running time; any other format saves none.
      lengthMinutes: data.format === BookFormat.AUDIOBOOK ? (data.lengthMinutes ?? null) : null,
      publishedDate: data.publishedDate ?? null,
      tags: data.tags,
      seriesName: data.seriesName ?? null,
      seriesNumber: data.seriesNumber ?? null,
      format: data.format,
      ownership: data.ownership,
      openLibraryId: data.openLibraryId ?? null,
      status: reading.status,
      rating: r.rating || null, // 0 = unrated
      dateStarted: reading.dateStarted,
      dateFinished: reading.dateFinished,
      timesRead: reading.timesRead,
      currentPage: reading.currentPage,
      searchText: buildSearchText(data.title, data.authors, data.seriesName),
      // A book added mid-read starts its log at the page given: one entry
      // and no page-0 anchor before it, so no day is credited with the pages
      // read before the book was added (see logProgress). Dated no earlier
      // than the start, so it stays inside the current pass.
      ...(reading.currentPage && {
        progress: {
          create: {
            page: reading.currentPage,
            date: reading.dateStarted && reading.dateStarted > now ? reading.dateStarted : now,
          },
        },
      }),
    },
  });

  localizeCoverAfterResponse(book.id, book.coverUrl);

  revalidatePath("/books");
  revalidatePath("/stats");
  if (afterAdd === "another") {
    return { success: true, added: { id: book.id, title: book.title } };
  }
  redirect(afterAdd === "library" ? "/books" : `/books/${book.id}`);
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
      lengthMinutes: data.format === BookFormat.AUDIOBOOK ? (data.lengthMinutes ?? null) : null,
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
      dateFinished: data.finishedUnknown ? null : (data.dateFinished ?? null),
      currentPage: data.currentPage ?? null,
    },
    existing._count.reads,
    new Date(),
    { undatedFinish: data.finishedUnknown },
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
      entries.push({ bookId, page: 0, date: anchorMoment(next.dateStarted, now) });
    }
    entries.push({ bookId, page: next.currentPage, date: now });
    await db.progressEntry.createMany({ data: entries });
    return;
  }

  // Finishing a tracked book: close the log at the final page. An untracked
  // pass (no entries) logs nothing — marking a book Read weeks after the
  // fact shouldn't credit every page of it to one day. Nor does an undated
  // finish: there is no day to credit the last pages to.
  if (
    next.status === ReadingStatus.READ &&
    next.dateFinished != null &&
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
