"use server";

import { revalidatePath } from "next/cache";
import { ReadingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { calendarDay, dayKey } from "@/lib/dates";
import { formatDate } from "@/lib/display";
import { parsePreferences, serverTimeZone, type Preferences } from "@/lib/preferences";
import { currentPassEntries } from "@/lib/progress";
import { formatPosition, pastTheEnd, unitFor } from "@/lib/progress-units";
import {
  anchorMoment,
  describeDay,
  editEntrySchema,
  idSchema,
  lastLogged,
  loggedWhen,
  logPageSchema,
  moveTargetSchema,
  passAround,
  placeInLog,
  resolveLogDay,
  subjectDay,
  undoMoveSchema,
  type EntryEditResult,
  type LogPageResult,
  type MoveResult,
  type UndoMove,
} from "@/lib/reading-log";
import { settleReadingState } from "@/lib/reading-state";

/**
 * The reading log outside the reading form: quick logging for any day,
 * fixing and deleting entries, and Finished / Stopped from Now reading. The
 * rules for where an entry may go live in lib/reading-log.ts; the form's
 * own logging is logProgress in actions/books.ts.
 *
 * Every message is written in the book's unit (page, percent or time), as
 * the reader's preferences say at the time.
 */

/** Oldest first; page breaks same-instant ties, so a pass's page-0 anchor
 *  sorts before its first real entry (same order as stats). */
const LOG_ORDER = [{ date: "asc" as const }, { page: "asc" as const }];
const LOG_FIELDS = { id: true, page: true, date: true } as const;

function revalidateReading(bookId: string) {
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/books");
  revalidatePath("/reading");
  revalidatePath("/stats");
}

/** The reader's preferences with the zone filled in (the same rule as
 *  getPreferences, read straight from the row). */
async function readerPrefs(userId: string): Promise<Preferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = parsePreferences(user?.preferences);
  return { ...prefs, timeZone: prefs.timeZone || serverTimeZone() };
}

const NOT_READING = "Only books you're reading can log pages. Set this one to Currently Reading first.";
const FUTURE = "That day hasn't happened yet.";
const CHANGED = "This book has changed since. Open it to set its status.";

/**
 * Log where you are in a book you're reading, for today or an earlier day.
 * The newest entry moves the book's page with it (writing the pass's page-0
 * anchor first if the pass has none, as the reading form does); an earlier
 * day's entry slots in between the entries around it and leaves the page
 * alone.
 */
export async function logPage(
  bookId: string,
  input: { page: number; day: string },
): Promise<LogPageResult> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };
  const parsed = logPageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { page, day } = parsed.data;

  const book = await prisma.book.findFirst({
    where: { id: id.data, userId },
    select: {
      status: true,
      pageCount: true,
      dateStarted: true,
      format: true,
      lengthMinutes: true,
    },
  });
  if (!book) return { error: "Book not found" };
  if (book.status !== ReadingStatus.READING) return { error: NOT_READING };
  if (book.pageCount != null && page > book.pageCount) {
    return { error: pastTheEnd(page, book.pageCount) };
  }

  const prefs = await readerPrefs(userId);
  const tz = prefs.timeZone;
  const info = unitFor(book, prefs);
  const pos = (p: number) => formatPosition(p, info);
  const now = new Date();
  const today = dayKey(now, tz);
  const resolved = resolveLogDay(day, now, tz);
  if ("error" in resolved) return { error: FUTURE };
  const { key, at } = resolved;
  if (book.dateStarted && key < calendarDay(book.dateStarted, tz)) {
    return {
      error: `You started this book on ${formatDate(book.dateStarted, prefs)}. Pick that day or later.`,
    };
  }

  const result = await prisma.$transaction(async (tx): Promise<LogPageResult> => {
    const all = await tx.progressEntry.findMany({
      where: { bookId: id.data },
      orderBy: LOG_ORDER,
      select: LOG_FIELDS,
    });
    const pass = currentPassEntries(all, book.dateStarted);
    const previous = pass.length > 0 ? (all[all.indexOf(pass[0]) - 1] ?? null) : null;
    const placement = placeInLog(pass, { page, date: at }, { timeZone: tz, previous });

    if (!placement.ok) {
      const n = placement.neighbour;
      const when = loggedWhen(calendarDay(n.date, tz), today, prefs.dateFormat);
      const subject = subjectDay(key, today, prefs.dateFormat);
      if (placement.reason === "beforeStart") {
        return { error: `That's before this read started (${formatDate(n.date, prefs)}).` };
      }
      return {
        error:
          placement.reason === "below"
            ? `${subject} can't be before ${pos(n.page)}, which you logged ${when}. If that entry is wrong, fix it with its pencil.`
            : `${subject} can't be past ${pos(n.page)}, which you logged ${when}. Log it for a later day, or fix that entry.`,
      };
    }

    if (placement.moveAnchor) {
      await tx.progressEntry.update({ where: { id: placement.moveAnchor.id }, data: { date: at } });
    }
    const logged = `Logged ${pos(page)} for ${describeDay(key, today, prefs.dateFormat)}.`;

    if (placement.after) {
      // An earlier day, between two entries: one more point in the log. The
      // book's page is still the newest entry's.
      await tx.progressEntry.create({ data: { bookId: id.data, page, date: at } });
      return { ok: true, message: logged, page, lastPage: false };
    }

    // The newest entry. Compared with the log rather than Book.currentPage,
    // which can disagree with it (an entry deleted before deleting resynced
    // the page): logging the page the bar already shows still has to reach
    // the log, or that day's pages are never credited.
    const lastPage = book.pageCount != null && page === book.pageCount;
    await tx.book.update({ where: { id: id.data }, data: { currentPage: page } });
    if (lastLogged(pass)?.page === page) {
      return { ok: true, message: `Already at ${pos(page)}.`, page, lastPage };
    }
    const entries = [];
    if (pass.length === 0) {
      entries.push({ bookId: id.data, page: 0, date: anchorMoment(book.dateStarted, at) });
    }
    entries.push({ bookId: id.data, page, date: at });
    await tx.progressEntry.createMany({ data: entries });
    return { ok: true, message: logged, page, lastPage };
  });

  if (!("error" in result)) revalidateReading(id.data);
  return result;
}

/**
 * Fix a log entry's page or day. It has to stay within its own pass and fit
 * between the entries around it; the book's page follows when the entry is
 * the newest of the current read.
 */
export async function updateProgressEntry(
  entryId: string,
  input: { page: number; day: string },
): Promise<EntryEditResult> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(entryId);
  if (!id.success) return { error: "Entry not found" };
  const parsed = editEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { page, day } = parsed.data;

  const entry = await prisma.progressEntry.findFirst({
    where: { id: id.data, book: { userId } },
    select: {
      id: true,
      page: true,
      date: true,
      bookId: true,
      book: {
        select: {
          status: true,
          pageCount: true,
          dateStarted: true,
          format: true,
          lengthMinutes: true,
        },
      },
    },
  });
  if (!entry) return { error: "Entry not found" };
  // The page-0 anchor marks where a read starts; moving it would hand one
  // read's pages to another. The log doesn't offer it.
  if (entry.page === 0) return { error: "The start of a read can't be changed." };
  const { book } = entry;
  if (book.pageCount != null && page > book.pageCount) {
    return { error: pastTheEnd(page, book.pageCount) };
  }

  const prefs = await readerPrefs(userId);
  const tz = prefs.timeZone;
  const info = unitFor(book, prefs);
  const pos = (p: number) => formatPosition(p, info);
  const now = new Date();
  const today = dayKey(now, tz);
  // Same day: keep the entry's own moment, so a page fix doesn't reorder it.
  let at = entry.date;
  if (day !== calendarDay(entry.date, tz)) {
    const resolved = resolveLogDay(day, now, tz);
    if ("error" in resolved) return { error: FUTURE };
    at = resolved.at;
  }

  const result = await prisma.$transaction(async (tx): Promise<EntryEditResult> => {
    const all = await tx.progressEntry.findMany({
      where: { bookId: entry.bookId },
      orderBy: LOG_ORDER,
      select: LOG_FIELDS,
    });
    const around = passAround(all, entry.id);
    if (!around) return { error: "Entry not found" };
    if (around.nextAnchor && at.getTime() >= around.nextAnchor.date.getTime()) {
      return {
        error: `That's after you started reading it again (${formatDate(around.nextAnchor.date, prefs)}).`,
      };
    }
    const placement = placeInLog(
      around.pass,
      { page, date: at },
      { timeZone: tz, skipId: entry.id, previous: around.previous },
    );
    if (!placement.ok) {
      if (placement.reason === "beforeStart") {
        return { error: `That's before this read started (${formatDate(placement.neighbour.date, prefs)}).` };
      }
      const lo = pos(placement.before?.page ?? 0);
      const hi = placement.after?.page ?? book.pageCount;
      return {
        error:
          hi == null
            ? `That entry can't be below ${lo}, to fit the days around it.`
            : `That entry has to stay between ${lo} and ${pos(hi)}, to fit the days around it.`,
      };
    }

    if (placement.moveAnchor) {
      await tx.progressEntry.update({ where: { id: placement.moveAnchor.id }, data: { date: at } });
    }
    await tx.progressEntry.update({ where: { id: entry.id }, data: { page, date: at } });

    // The book's page follows the newest entry of the read in progress.
    if (
      around.isCurrent &&
      (book.status === ReadingStatus.READING || book.status === ReadingStatus.DNF)
    ) {
      const fresh = await tx.progressEntry.findMany({
        where: { bookId: entry.bookId },
        orderBy: LOG_ORDER,
        select: LOG_FIELDS,
      });
      const pass = currentPassEntries(fresh, book.dateStarted);
      await tx.book.update({
        where: { id: entry.bookId },
        data: { currentPage: lastLogged(pass)?.page ?? null },
      });
    }
    return { message: `Fixed: ${pos(page)} for ${describeDay(calendarDay(at, tz), today, prefs.dateFormat)}.` };
  });

  if (!result.error) revalidateReading(entry.bookId);
  return result;
}

/**
 * Delete a progress log entry (ownership checked through the book). Deleting
 * the newest entry of the read in progress moves the book's page back to the
 * entry before it, so the bar keeps matching the log.
 */
export async function deleteProgressEntry(entryId: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(entryId);
  if (!id.success) return { error: "Entry not found" };

  const existing = await prisma.progressEntry.findFirst({
    where: { id: id.data, book: { userId } },
    select: { id: true, page: true, bookId: true, book: { select: { status: true, dateStarted: true } } },
  });
  if (!existing) return { error: "Entry not found" };
  // Without its anchor a read would run on into the one before it.
  if (existing.page === 0) return { error: "The start of a read can't be deleted." };

  await prisma.$transaction(async (tx) => {
    const all = await tx.progressEntry.findMany({
      where: { bookId: existing.bookId },
      orderBy: LOG_ORDER,
      select: LOG_FIELDS,
    });
    const pass = currentPassEntries(all, existing.book.dateStarted);
    await tx.progressEntry.delete({ where: { id: existing.id } });
    const { status } = existing.book;
    if (
      pass[pass.length - 1]?.id === existing.id &&
      (status === ReadingStatus.READING || status === ReadingStatus.DNF)
    ) {
      await tx.book.update({
        where: { id: existing.bookId },
        data: { currentPage: lastLogged(pass.slice(0, -1))?.page ?? null },
      });
    }
  });

  revalidateReading(existing.bookId);
  return {};
}

/**
 * Finished or Stopped, from Now reading: the same status change as picking
 * Read or Did Not Finish on the reading card, with the same dates, page and
 * read count (settleReadingState). Finishing a tracked read closes its log
 * at the last page, as the reading form does (logProgress in
 * actions/books.ts); Finished always means today.
 */
export async function moveFromReading(bookId: string, to: "READ" | "DNF"): Promise<MoveResult> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };
  const target = moveTargetSchema.safeParse(to);
  if (!target.success) return { error: "Invalid input" };

  const book = await prisma.book.findFirst({
    where: { id: id.data, userId },
    select: {
      title: true,
      status: true,
      currentPage: true,
      pageCount: true,
      dateStarted: true,
      dateFinished: true,
      format: true,
      lengthMinutes: true,
      _count: { select: { reads: true } },
    },
  });
  if (!book) return { error: "Book not found" };
  if (book.status !== ReadingStatus.READING) {
    return { error: "This book isn't in Currently Reading any more." };
  }

  const finishing = target.data === "READ";
  const next = settleReadingState(
    ReadingStatus.READING,
    {
      status: finishing ? ReadingStatus.READ : ReadingStatus.DNF,
      dateStarted: book.dateStarted,
      dateFinished: finishing ? null : book.dateFinished,
      currentPage: book.currentPage,
    },
    book._count.reads,
  );

  await prisma.$transaction(async (tx) => {
    await tx.book.update({
      where: { id: id.data },
      data: {
        status: next.status,
        dateStarted: next.dateStarted,
        dateFinished: next.dateFinished,
        timesRead: next.timesRead,
        currentPage: next.currentPage,
      },
    });
    // An untracked read (no entries) logs nothing, as in logProgress.
    if (finishing && book.pageCount != null) {
      const all = await tx.progressEntry.findMany({
        where: { bookId: id.data },
        orderBy: LOG_ORDER,
        select: LOG_FIELDS,
      });
      const last = currentPassEntries(all, book.dateStarted).at(-1);
      if (last && last.page < book.pageCount) {
        await tx.progressEntry.create({
          data: { bookId: id.data, page: book.pageCount, date: next.dateFinished! },
        });
      }
    }
  });

  revalidateReading(id.data);
  const prefs = await readerPrefs(userId);
  const info = unitFor(book, prefs);
  return {
    ok: true,
    finished: finishing,
    message: finishing
      ? `${book.title} moved to Read. Finished today.`
      : next.currentPage != null
        ? `${book.title} moved to Did Not Finish at ${formatPosition(next.currentPage, info)}.`
        : `${book.title} moved to Did Not Finish.`,
    undo: {
      from: target.data,
      finishedAt: finishing ? next.dateFinished!.toISOString() : null,
      page: book.currentPage || null,
    },
  };
}

/**
 * Undo Finished or Stopped: back to Currently Reading as it was. Worked out
 * from the book itself, not the client: only while the book is still where
 * the move put it (for Read, finished at that same moment), and the only
 * entry removed is the closing one that move wrote.
 */
export async function undoMoveFromReading(
  bookId: string,
  undo: UndoMove,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };
  const parsed = undoMoveSchema.safeParse(undo);
  if (!parsed.success) return { error: "Invalid input" };
  const { from, finishedAt, page } = parsed.data;

  const book = await prisma.book.findFirst({
    where: { id: id.data, userId },
    select: {
      status: true,
      currentPage: true,
      pageCount: true,
      dateStarted: true,
      dateFinished: true,
      _count: { select: { reads: true } },
    },
  });
  if (!book) return { error: "Book not found" };
  if (book.status !== ReadingStatus[from]) return { error: CHANGED };
  if (from === "READ" && (!book.dateFinished || book.dateFinished.toISOString() !== finishedAt)) {
    return { error: CHANGED };
  }

  await prisma.$transaction(async (tx) => {
    let currentPage = book.currentPage;
    if (from === "READ") {
      const all = await tx.progressEntry.findMany({
        where: { bookId: id.data },
        orderBy: LOG_ORDER,
        select: LOG_FIELDS,
      });
      let pass = currentPassEntries(all, book.dateStarted);
      const last = pass.at(-1);
      // The closing entry Finished wrote: the last page, at the finish moment.
      if (
        last &&
        last.page > 0 &&
        last.page === book.pageCount &&
        last.date.getTime() === book.dateFinished!.getTime()
      ) {
        await tx.progressEntry.delete({ where: { id: last.id } });
        pass = pass.slice(0, -1);
      }
      // A tracked read goes back to its newest entry. An untracked one has
      // only the page it had, which Finished cleared; it can't be past the
      // end, so it is no more than the reading form would accept.
      const fallback = page != null && (book.pageCount == null || page <= book.pageCount) ? page : null;
      currentPage = lastLogged(pass)?.page ?? fallback;
    }
    await tx.book.update({
      where: { id: id.data },
      data: {
        status: ReadingStatus.READING,
        dateFinished: from === "READ" ? null : book.dateFinished,
        currentPage,
        timesRead: book._count.reads,
      },
    });
  });

  revalidateReading(id.data);
  return {};
}
