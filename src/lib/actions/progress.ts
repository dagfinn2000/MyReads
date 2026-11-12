"use server";

import { revalidatePath } from "next/cache";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { calendarDay, dayKey } from "@/lib/dates";
import { formatDate } from "@/lib/display";
import { currentPassEntries } from "@/lib/progress";
import { pastTheEnd, unitFor } from "@/lib/progress-units";
import {
  describeDay,
  lastLogged,
  passAround,
  placeInLog,
  positionTexts,
  resolveLogDay,
  type EntryEditResult,
  type LogPageResult,
  type MoveResult,
} from "@/lib/reading-log";
import { editEntrySchema, idSchema, undoMoveSchema, type UndoMove } from "@/lib/reading-log-input";
import {
  CHANGED,
  FUTURE,
  LOG_FIELDS,
  LOG_ORDER,
  beforeStarted,
  logPageAs,
  moveFromReadingAs,
  readerPrefs,
} from "@/lib/reading-log-write";

/**
 * The reading log outside the reading form: quick logging for any day,
 * fixing and deleting entries, and Finished / Stopped from Now reading. The
 * rules for where an entry may go live in lib/reading-log.ts; the form's
 * own logging is logProgress in actions/books.ts.
 *
 * Every message is written in the book's unit (page, percent or time), as
 * the reader's preferences say at the time.
 */

function revalidateReading(bookId: string) {
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/books");
  revalidatePath("/reading");
  revalidatePath("/stats");
}

/**
 * Log where you are in a book you're reading, for today or an earlier day
 * (logPageAs in lib/reading-log-write.ts has the rules). `clientId` is the
 * browser's id for this log, so a log sent again after the connection
 * dropped mid-way is written once (lib/outbox.ts).
 */
export async function logPage(
  bookId: string,
  /** `value` is the position as typed, in the book's unit, for the message. */
  input: { page: number; day: string; value?: number; minutes?: number; clientId?: string },
): Promise<LogPageResult> {
  const userId = await requireUserId();
  const result = await logPageAs(userId, bookId, input);
  if (!("error" in result)) revalidateReading(bookId);
  return result;
}

/**
 * Fix a log entry's page or day. It has to stay within its own pass and fit
 * between the entries around it; the book's page follows when the entry is
 * the newest of the current read.
 */
export async function updateProgressEntry(
  entryId: string,
  /** `value` is the position as typed, in the book's unit, for the message.
   *  `minutes` left out keeps the entry's time; null clears it. */
  input: { page: number; day: string; value?: number; minutes?: number | null },
): Promise<EntryEditResult> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(entryId);
  if (!id.success) return { error: "Entry not found" };
  const parsed = editEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { page, day, value, minutes } = parsed.data;

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
  const now = new Date();
  const today = dayKey(now, tz);
  // Same day: keep the entry's own moment, so a page fix doesn't reorder it.
  let at = entry.date;
  const moved = day !== calendarDay(entry.date, tz);
  if (moved) {
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
    // Without a page-0 anchor the read starts on its Started day, and an
    // entry moved before that would drop out of it, taking the book's page
    // with it (placeInLog only knows the anchor).
    if (
      moved &&
      around.isCurrent &&
      around.pass[0]?.page !== 0 &&
      book.dateStarted &&
      day < calendarDay(book.dateStarted, tz) &&
      currentPassEntries(all, book.dateStarted, tz).some((e) => e.id === entry.id)
    ) {
      return { error: beforeStarted(book.dateStarted, prefs) };
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
      const hi = placement.after?.page ?? book.pageCount;
      // Read against what was typed, so 42% isn't "between 42% and 49%".
      const [, lo, top] = positionTexts(
        info,
        { page, value },
        { page: placement.before?.page ?? 0 },
        ...(hi == null ? [] : [{ page: hi }]),
      );
      return {
        error:
          hi == null
            ? `That entry can't be below ${lo}, to fit the days around it.`
            : `That entry has to stay between ${lo} and ${top}, to fit the days around it.`,
      };
    }

    if (placement.moveAnchor) {
      await tx.progressEntry.update({ where: { id: placement.moveAnchor.id }, data: { date: at } });
    }
    await tx.progressEntry.update({
      where: { id: entry.id },
      data: { page, date: at, ...(minutes !== undefined && { minutes }) },
    });

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
      const pass = currentPassEntries(fresh, book.dateStarted, tz);
      await tx.book.update({
        where: { id: entry.bookId },
        data: { currentPage: lastLogged(pass)?.page ?? null },
      });
    }
    const [typed] = positionTexts(info, { page, value });
    return { message: `Fixed: ${typed} for ${describeDay(calendarDay(at, tz), today, prefs.dateFormat)}.` };
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
  const tz = (await readerPrefs(userId)).timeZone;

  await prisma.$transaction(async (tx) => {
    const all = await tx.progressEntry.findMany({
      where: { bookId: existing.bookId },
      orderBy: LOG_ORDER,
      select: LOG_FIELDS,
    });
    const pass = currentPassEntries(all, existing.book.dateStarted, tz);
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
 * Finished or Stopped, from Now reading (moveFromReadingAs in
 * lib/reading-log-write.ts). `timed` is the reading timer's minutes, if it
 * was going.
 */
export async function moveFromReading(
  bookId: string,
  to: "READ" | "DNF",
  timed?: number,
): Promise<MoveResult> {
  const userId = await requireUserId();
  const result = await moveFromReadingAs(userId, bookId, to, timed);
  // "Already there" only answers a move sent later, with its moment.
  if ("already" in result) return { error: "This book isn't in Currently Reading any more." };
  if (!("error" in result)) revalidateReading(bookId);
  return result;
}

/**
 * Undo Finished or Stopped: back to Currently Reading as it was. Worked out
 * from the book itself, not the client: only while the book is still where
 * the move put it (for Read, finished at that same moment), and the only
 * entry touched is the closing one that move wrote.
 *
 * Time read is never thrown away. A closing entry that carried the timer's
 * minutes stays as time on the page the book was at, the way Stopped keeps
 * it. A read with no page logged yet has nowhere to keep it, so the
 * minutes come back for the reading timer to hold until the next log.
 */
export async function undoMoveFromReading(
  bookId: string,
  undo: UndoMove,
): Promise<{ error?: string; minutes?: number }> {
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
  const tz = (await readerPrefs(userId)).timeZone;

  const minutes = await prisma.$transaction(async (tx) => {
    let currentPage = book.currentPage;
    let returned: number | undefined;
    if (from === "READ") {
      const all = await tx.progressEntry.findMany({
        where: { bookId: id.data },
        orderBy: LOG_ORDER,
        select: { ...LOG_FIELDS, minutes: true },
      });
      let pass = currentPassEntries(all, book.dateStarted, tz);
      const last = pass.at(-1);
      // The closing entry Finished wrote: the last page, at the finish moment.
      if (
        last &&
        last.page > 0 &&
        last.page === book.pageCount &&
        last.date.getTime() === book.dateFinished!.getTime()
      ) {
        pass = pass.slice(0, -1);
        const before = lastLogged(pass);
        if (last.minutes && before) {
          // Its time stays, on the page before it: time read without
          // getting further, which credits no pages.
          await tx.progressEntry.update({ where: { id: last.id }, data: { page: before.page } });
          pass.push({ ...last, page: before.page });
        } else {
          await tx.progressEntry.delete({ where: { id: last.id } });
          returned = last.minutes ?? undefined;
        }
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
    return returned;
  });

  revalidateReading(id.data);
  return minutes ? { minutes } : {};
}
