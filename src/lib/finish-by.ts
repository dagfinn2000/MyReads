import { ReadingStatus } from "@/lib/enums";
import { calendarDay, dayKey, keyToUtcDate } from "@/lib/dates";
import { formatShortDay, type FormatPrefs } from "@/lib/display";
import type { UnitInfo } from "@/lib/progress-units";

/**
 * "Finish by": a day the reader means to have a book read by (a book club,
 * a library's due date). While the book is to read or being read it says
 * how much a day it takes from today, and whether the reader's pace gets
 * there. A finished or put-down book has no such day: finishing or
 * stopping clears it.
 */

const DAY_MS = 86_400_000;

export interface FinishByBook {
  status: ReadingStatus;
  finishBy: Date | null;
  pageCount: number | null;
  currentPage: number | null;
}

/** Statuses a finish-by day means anything for. */
export function keepsFinishBy(status: ReadingStatus): boolean {
  return status === ReadingStatus.WANT_TO_READ || status === ReadingStatus.READING;
}

export type FinishByState =
  | {
      kind: "ahead";
      /** "YYYY-MM-DD", in the reader's zone. */
      due: string;
      /** Days to read in, today and the day itself included. */
      days: number;
      pagesLeft: number | null;
      /** Pages a day it takes from today, or null without a page count. */
      perDay: number | null;
      /** Whether the reader's pace gets there: null without a pace (or for
       *  a book not started). */
      onTrack: boolean | null;
      /** Being read, rather than still to start. */
      started: boolean;
    }
  | { kind: "today"; due: string; pagesLeft: number | null }
  | { kind: "late"; due: string; daysLate: number }
  | { kind: "done"; due: string };

/**
 * Where a book stands against its finish-by day. `pace` is pages a day
 * (lib/pace.ts pagesPerDay), for a book being read. Null when the book has
 * no day, or isn't to read or being read.
 */
export function finishByState(
  book: FinishByBook,
  pace: number | null,
  now: Date,
  timeZone?: string,
): FinishByState | null {
  if (!book.finishBy || !keepsFinishBy(book.status)) return null;
  const today = dayKey(now, timeZone);
  // The day reads the way it's shown, so the words and the date agree.
  const due = calendarDay(book.finishBy, timeZone);
  const until = Math.round((keyToUtcDate(due).getTime() - keyToUtcDate(today).getTime()) / DAY_MS);
  const pagesLeft = book.pageCount ? Math.max(book.pageCount - (book.currentPage ?? 0), 0) : null;
  if (pagesLeft === 0 && book.status === ReadingStatus.READING) return { kind: "done", due };
  if (until < 0) return { kind: "late", due, daysLate: -until };
  if (until === 0) return { kind: "today", due, pagesLeft };
  const days = until + 1;
  const perDay = pagesLeft === null ? null : pagesLeft / days;
  const onTrack =
    book.status !== ReadingStatus.READING || pace === null || perDay === null
      ? null
      : pace >= perDay;
  return {
    kind: "ahead",
    due,
    days,
    pagesLeft,
    perDay,
    onTrack,
    started: book.status === ReadingStatus.READING,
  };
}

/** An amount a day in the book's unit, rounded up so it's enough: "32
 *  pages a day", "6% a day", "48 min a day". */
export function perDayText(perDay: number, info: UnitInfo): string {
  if (info.unit === "percent" && info.pageCount) {
    return `${Math.max(Math.ceil((perDay / info.pageCount) * 100), 1)}% a day`;
  }
  if (info.unit === "time" && info.pageCount && info.lengthMinutes) {
    const minutes = Math.max(Math.ceil((perDay / info.pageCount) * info.lengthMinutes), 1);
    if (minutes < 60) return `${minutes} min a day`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} h${m ? ` ${m} min` : ""} a day`;
  }
  const pages = Math.max(Math.ceil(perDay), 1);
  return `${pages} ${pages === 1 ? "page" : "pages"} a day`;
}

/** What's left in the book's unit: "40 pages", "12%", "1 h 5 min". */
function leftText(pages: number, info: UnitInfo): string {
  if (info.unit === "percent" && info.pageCount) {
    return `${Math.max(Math.ceil((pages / info.pageCount) * 100), 1)}%`;
  }
  if (info.unit === "time" && info.pageCount && info.lengthMinutes) {
    const minutes = Math.max(Math.ceil((pages / info.pageCount) * info.lengthMinutes), 1);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} h${m ? ` ${m} min` : ""}`;
  }
  return `${pages} ${pages === 1 ? "page" : "pages"}`;
}

/** "Fri 21 Nov", with the year when it isn't this one. */
export function finishByDay(due: string, now: Date, prefs: FormatPrefs): string {
  const thisYear = dayKey(now, prefs.timeZone).slice(0, 4);
  return formatShortDay(due, prefs.dateFormat, due.slice(0, 4) !== thisYear);
}

/** How a finish-by line looks: calm, done or on track, at risk, or past. */
export type FinishByTone = "calm" | "good" | "warn" | "late";

export interface FinishByLine {
  /** "Finish by Fri 21 Nov" or "Due back …" for a borrowed copy. */
  label: string;
  /** What it takes: "32 pages a day, and your pace gets there". */
  detail: string;
  tone: FinishByTone;
}

/**
 * The words for a finish-by day. `dueBack` words it as a borrowed copy's
 * due date. `started` is false for a book still to read: it says what a
 * day it takes from a start today.
 */
export function finishByLine(
  state: FinishByState,
  info: UnitInfo,
  now: Date,
  prefs: FormatPrefs,
  dueBack = false,
): FinishByLine {
  const day = finishByDay(state.due, now, prefs);
  const label = dueBack ? `Due back ${day}` : `Finish by ${day}`;
  switch (state.kind) {
    case "done":
      return { label, detail: "You're at the end. Mark it finished.", tone: "good" };
    case "late":
      return {
        label,
        detail: `${state.daysLate === 1 ? "A day" : `${state.daysLate} days`} past it.`,
        tone: "late",
      };
    case "today":
      return {
        label: dueBack ? "Due back today" : "Finish by today",
        detail: state.pagesLeft ? `${leftText(state.pagesLeft, info)} to go.` : "That's today.",
        tone: "warn",
      };
    case "ahead": {
      const inDays = `${state.days} ${state.days === 1 ? "day" : "days"}`;
      if (state.perDay === null) return { label, detail: `${inDays} to go, today included.`, tone: "calm" };
      const amount = perDayText(state.perDay, info);
      if (state.onTrack === true) {
        return { label, detail: `${amount} gets you there, and your pace does.`, tone: "good" };
      }
      if (state.onTrack === false) {
        return { label, detail: `${amount} gets you there: more than your pace.`, tone: "warn" };
      }
      return {
        label,
        detail: state.started ? `${amount} gets you there.` : `${amount} if you start today.`,
        tone: "calm",
      };
    }
  }
}

/** Books still to read whose day is this close (or past) are pointed out
 *  on Now reading, and get a badge in the library. */
export const FINISH_BY_SOON_DAYS = 14;

/** Whether a book's finish-by day is close enough to point out. */
export function finishBySoon(state: FinishByState | null): boolean {
  if (!state) return false;
  return state.kind !== "ahead" || state.days <= FINISH_BY_SOON_DAYS;
}

/** A library card's finish-by badge: the day, or that it's past. Only for
 *  a book whose day is near (finishBySoon). */
export type FinishSoon = { day: string; late: boolean };

export function finishSoonBadge(
  book: FinishByBook,
  now: Date,
  prefs: FormatPrefs,
): FinishSoon | undefined {
  const state = finishByState(book, null, now, prefs.timeZone);
  if (!state || state.kind === "done" || !finishBySoon(state)) return undefined;
  return { day: finishByDay(state.due, now, prefs), late: state.kind === "late" };
}
