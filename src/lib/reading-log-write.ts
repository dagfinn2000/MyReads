import { Prisma } from "@prisma/client";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { calendarDay, dayKey, shiftDayKey } from "@/lib/dates";
import { formatDate } from "@/lib/display";
import { parsePreferences, serverTimeZone, type Preferences } from "@/lib/preferences";
import { currentPassEntries } from "@/lib/progress";
import { formatLength, formatPosition, pastTheEnd, unitFor } from "@/lib/progress-units";
import {
  anchorMoment,
  describeDay,
  lastLogged,
  loggedWhen,
  placeInLog,
  positionTexts,
  resolveLogDay,
  type LogPageResult,
  type MoveResult,
} from "@/lib/reading-log";
import { idSchema, logPageSchema, moveMinutesSchema, moveTargetSchema } from "@/lib/reading-log-input";
import { settleReadingState } from "@/lib/reading-state";

/**
 * Logging a page and Finished / Stopped, for a reader given by id: the
 * work behind the logPage and moveFromReading actions
 * (lib/actions/progress.ts), and behind logs a browser saved while it was
 * offline and sends later (lib/reading-sync.ts). Not a "use server" file,
 * so none of this can be called from a browser with someone else's id.
 *
 * A log sent later says when it was made (`at`): its entry goes at that
 * moment, and "today" is that moment's day, so a page logged on the train
 * last night is last night's reading.
 */

/** Oldest first; page breaks same-instant ties, so a pass's page-0 anchor
 *  sorts before its first real entry (same order as stats). */
export const LOG_ORDER = [{ date: "asc" as const }, { page: "asc" as const }];
export const LOG_FIELDS = { id: true, page: true, date: true } as const;

/** "Logged page 212 for today." with the time read, when there was one:
 *  "Logged page 212 for today (35 min)." */
function loggedMessage(typed: string, day: string, minutes: number | undefined): string {
  return `Logged ${typed} for ${day}${minutes ? ` (${formatLength(minutes)})` : ""}.`;
}

/** The reader's preferences with the zone filled in (the same rule as
 *  getPreferences, read straight from the row). */
export async function readerPrefs(userId: string): Promise<Preferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = parsePreferences(user?.preferences);
  return { ...prefs, timeZone: prefs.timeZone || serverTimeZone() };
}

const NOT_READING = "Only books you're reading can log pages. Set this one to Currently Reading first.";
export const FUTURE = "That day hasn't happened yet.";
export const CHANGED = "This book has changed since. Open it to set its status.";

export function beforeStarted(dateStarted: Date, prefs: Preferences): string {
  return `You started this book on ${formatDate(dateStarted, prefs)}. Pick that day or later.`;
}

/** When a log sent later was made: never later than now, whatever the
 *  device's clock said. */
function madeAt(at: Date | undefined, now: Date): Date {
  return at && at.getTime() < now.getTime() ? at : now;
}

function isDuplicate(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export interface WriteOptions {
  /** When the reader did it, for one sent later; now when left out. */
  at?: Date;
}

/**
 * Log where the reader is in a book they're reading, for today or an
 * earlier day. The newest entry moves the book's page with it (writing the
 * pass's page-0 anchor first if the pass has none, as the reading form
 * does); an earlier day's entry slots in between the entries around it and
 * leaves the page alone. `minutes`, from the reading timer or typed in, is
 * saved with the entry: the time it took to get there.
 *
 * With a `clientId` the entry is written once: the same log sent again
 * finds it and says it's logged.
 */
export async function logPageAs(
  userId: string,
  bookId: string,
  /** `value` is the position as typed, in the book's unit, for the message. */
  input: unknown,
  { at: sentAt }: WriteOptions = {},
): Promise<LogPageResult> {
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };
  const parsed = logPageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { page, day, value, minutes, clientId } = parsed.data;

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

  const prefs = await readerPrefs(userId);
  const tz = prefs.timeZone;
  const info = unitFor(book, prefs);
  const [typed] = positionTexts(info, { page, value });
  const now = new Date();
  const today = dayKey(now, tz);

  // Already written: the first send got through, only its answer didn't.
  const done = async (): Promise<LogPageResult | null> => {
    if (!clientId) return null;
    const entry = await prisma.progressEntry.findUnique({
      where: { bookId_clientId: { bookId: id.data, clientId } },
      select: { date: true, minutes: true },
    });
    if (!entry) return null;
    const when = describeDay(calendarDay(entry.date, tz), today, prefs.dateFormat);
    return { ok: true, message: loggedMessage(typed, when, entry.minutes ?? undefined), page, lastPage: false };
  };
  const sent = await done();
  if (sent) return sent;

  if (book.status !== ReadingStatus.READING) return { error: NOT_READING };
  if (book.pageCount != null && page > book.pageCount) {
    return { error: pastTheEnd(page, book.pageCount) };
  }

  const made = madeAt(sentAt, now);
  const resolved = resolveLogDay(day, made, tz);
  if ("error" in resolved) return { error: FUTURE };
  const { key, at } = resolved;
  if (book.dateStarted && key < calendarDay(book.dateStarted, tz)) {
    return { error: beforeStarted(book.dateStarted, prefs) };
  }

  let result: LogPageResult;
  try {
    result = await prisma.$transaction(async (tx): Promise<LogPageResult> => {
      const all = await tx.progressEntry.findMany({
        where: { bookId: id.data },
        orderBy: LOG_ORDER,
        select: LOG_FIELDS,
      });
      const pass = currentPassEntries(all, book.dateStarted, tz);
      const previous = pass.length > 0 ? (all[all.indexOf(pass[0]) - 1] ?? null) : null;
      const placement = placeInLog(pass, { page, date: at }, { timeZone: tz, previous });

      if (!placement.ok) {
        const n = placement.neighbour;
        if (placement.reason === "beforeStart") {
          return { error: `That's before this read started (${formatDate(n.date, prefs)}).` };
        }
        const when = loggedWhen(calendarDay(n.date, tz), today, prefs.dateFormat);
        const [mine, theirs] = positionTexts(info, { page, value, capital: true }, { page: n.page });
        const subject = `${mine} for ${describeDay(key, today, prefs.dateFormat)}`;
        return {
          error:
            placement.reason === "below"
              ? `${subject} is before ${theirs}, which you logged ${when}. If that entry is wrong, fix it with its pencil.`
              : `${subject} is past ${theirs}, which you logged ${when}. Log it for a later day, or fix that entry.`,
        };
      }

      if (placement.moveAnchor) {
        await tx.progressEntry.update({ where: { id: placement.moveAnchor.id }, data: { date: at } });
      }
      const logged = loggedMessage(typed, describeDay(key, today, prefs.dateFormat), minutes);

      if (placement.after) {
        // An earlier day, between two entries: one more point in the log. The
        // book's page is still the newest entry's.
        await tx.progressEntry.create({ data: { bookId: id.data, page, date: at, minutes, clientId } });
        return { ok: true, message: logged, page, lastPage: false };
      }

      // The newest entry. Compared with the log rather than Book.currentPage,
      // which can disagree with it (an entry deleted before deleting resynced
      // the page): logging the page the bar already shows still has to reach
      // the log, or that day's pages are never credited.
      const lastPage = book.pageCount != null && page === book.pageCount;
      await tx.book.update({ where: { id: id.data }, data: { currentPage: page } });
      // Time read without getting further (a chapter read again, say) still
      // goes in, as an entry on the same page: it credits no pages, only the
      // time, and on the day it was read.
      if (lastLogged(pass)?.page === page && !minutes) {
        return { ok: true, message: `Already at ${typed}.`, page, lastPage };
      }
      const entries = [];
      if (pass.length === 0) {
        entries.push({ bookId: id.data, page: 0, date: anchorMoment(book.dateStarted, at) });
      }
      entries.push({ bookId: id.data, page, date: at, minutes, clientId });
      await tx.progressEntry.createMany({ data: entries });
      return { ok: true, message: logged, page, lastPage };
    });
  } catch (err) {
    // The same log sent twice at once (two tabs): the other one wrote it.
    if (isDuplicate(err)) {
      const other = await done();
      if (other) return other;
    }
    throw err;
  }
  return result;
}

/**
 * Finished or Stopped, from Now reading: the same status change as picking
 * Read or Did Not Finish on the reading card, with the same dates, page and
 * read count (settleReadingState). Finishing a tracked read closes its log
 * at the last page, as the reading form does (logProgress in
 * actions/books.ts); Finished means the moment it was pressed.
 *
 * `minutes` is the reading timer's time, if it was going: it goes with the
 * closing entry, or with an entry at the page the book stopped on. A read
 * with no log keeps no time, since there's no log to put it in.
 *
 * One sent later (`at`) that finds the book already where it was going
 * (moved on another device, or the first send got through) has nothing
 * left to do, and says so. One for a read that started after it was
 * pressed is refused: it was meant for an earlier read.
 */
export async function moveFromReadingAs(
  userId: string,
  bookId: string,
  to: unknown,
  timed: unknown,
  { at: sentAt }: WriteOptions = {},
): Promise<MoveResult | { ok: true; already: true; message: string }> {
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };
  const target = moveTargetSchema.safeParse(to);
  if (!target.success) return { error: "Invalid input" };
  const minutesParsed = moveMinutesSchema.safeParse(timed);
  if (!minutesParsed.success) return { error: minutesParsed.error.issues[0]?.message ?? "Invalid input" };
  const minutes = minutesParsed.data;

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
  const finishing = target.data === "READ";
  if (sentAt && book.status === ReadingStatus[target.data]) {
    return {
      ok: true,
      already: true,
      message: `${book.title} is already in ${finishing ? "Read" : "Did Not Finish"}.`,
    };
  }
  if (book.status !== ReadingStatus.READING) {
    return { error: "This book isn't in Currently Reading any more." };
  }
  const now = madeAt(sentAt, new Date());
  if (sentAt && book.dateStarted && book.dateStarted.getTime() > now.getTime()) return { error: CHANGED };

  const next = settleReadingState(
    ReadingStatus.READING,
    {
      status: finishing ? ReadingStatus.READ : ReadingStatus.DNF,
      dateStarted: book.dateStarted,
      dateFinished: finishing ? null : book.dateFinished,
      currentPage: book.currentPage,
    },
    book._count.reads,
    now,
  );
  const prefs = await readerPrefs(userId);

  await prisma.$transaction(async (tx) => {
    await tx.book.update({
      where: { id: id.data },
      data: {
        status: next.status,
        // A status of the reader's own was one kind of Currently Reading.
        statusKey: null,
        dateStarted: next.dateStarted,
        dateFinished: next.dateFinished,
        timesRead: next.timesRead,
        currentPage: next.currentPage,
      },
    });
    // An untracked read (no entries) logs nothing, as in logProgress.
    if ((finishing && book.pageCount != null) || minutes) {
      const all = await tx.progressEntry.findMany({
        where: { bookId: id.data },
        orderBy: LOG_ORDER,
        select: LOG_FIELDS,
      });
      const pass = currentPassEntries(all, book.dateStarted, prefs.timeZone);
      const last = pass.at(-1);
      const stoppedAt = lastLogged(pass);
      if (finishing && book.pageCount != null && last && (last.page < book.pageCount || minutes)) {
        await tx.progressEntry.create({
          data: { bookId: id.data, page: book.pageCount, date: next.dateFinished!, minutes },
        });
      } else if (minutes && stoppedAt) {
        // The time on the page the book stopped on (never on a page-0
        // anchor, which would start a new read).
        await tx.progressEntry.create({
          data: {
            bookId: id.data,
            page: stoppedAt.page,
            date: finishing ? next.dateFinished! : now,
            minutes,
          },
        });
      }
    }
  });

  const info = unitFor(book, prefs);
  const today = dayKey(new Date(), prefs.timeZone);
  const finishedDay = finishing ? calendarDay(next.dateFinished!, prefs.timeZone) : today;
  const finishedWhen = describeDay(finishedDay, today, prefs.dateFormat);
  return {
    ok: true,
    finished: finishing,
    message: finishing
      ? `${book.title} moved to Read. Finished ${finishedDay >= shiftDayKey(today, -1) ? finishedWhen : `on ${finishedWhen}`}.`
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
