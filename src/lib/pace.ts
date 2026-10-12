import { ReadingStatus } from "@prisma/client";
import { calendarDay, dayKey, keyToUtcDate, shiftDayKey } from "@/lib/dates";
import { formatDate, type FormatPrefs } from "@/lib/display";
import type { PaceFrom } from "@/lib/preferences";
import type { UnitInfo } from "@/lib/progress-units";

/**
 * Reading pace and the finish forecast, from a book's current pass (its
 * page-0 anchor first, then every logged position, sorted by date).
 *
 * "The whole read" divides what the pass gained by how long it has run, as
 * the reading card always did. "The last 7 (or 14) days" counts only what
 * was read in those days, in the reader's zone, so a two-week break stops
 * dragging the forecast out once it has passed. A read younger than the
 * window is divided by its own age.
 */

export const DAY_MS = 86_400_000;

const WINDOW_DAYS = { "7d": 7, "14d": 14 } as const;

type Point = { page: number; date: Date };

/** "34" for double digits, "3.5" below — pace never shows as "0". */
export function paceLabel(pace: number): string {
  if (pace >= 10) return String(Math.round(pace));
  return String(Math.max(Math.round(pace * 10) / 10, 0.1));
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcDate(toKey).getTime() - keyToUtcDate(fromKey).getTime()) / DAY_MS);
}

/** Days the pass has run, first entry to last, floored to one. */
function spanDays(pass: Point[]): number {
  const span = pass[pass.length - 1].date.getTime() - pass[0].date.getTime();
  return Math.max(span / DAY_MS, 1);
}

/**
 * Pages a day. Null with fewer than two entries, or for the whole read when
 * nothing was gained. A window can be 0: nothing read in it.
 */
export function pagesPerDay(
  pass: Point[],
  from: PaceFrom,
  now: Date,
  timeZone?: string,
): number | null {
  if (pass.length < 2) return null;
  if (from === "read") {
    const gained = pass[pass.length - 1].page - pass[0].page;
    return gained > 0 ? gained / spanDays(pass) : null;
  }

  const n = WINDOW_DAYS[from];
  const today = dayKey(now, timeZone);
  const start = shiftDayKey(today, -(n - 1));
  // Same crediting as the reading calendar (lib/progress.ts): each increase
  // counts on the later entry's day, decreases count nothing.
  let gained = 0;
  for (let i = 1; i < pass.length; i++) {
    const delta = pass[i].page - pass[i - 1].page;
    if (delta > 0 && dayKey(pass[i].date, timeZone) >= start) gained += delta;
  }
  const firstDay = calendarDay(pass[0].date, timeZone);
  const days = firstDay > start ? Math.max(daysBetween(firstDay, today) + 1, 1) : n;
  return gained / days;
}

export interface Forecast {
  /** Whole days still to go. */
  daysLeft: number;
  finish: Date;
  /** More than a year out: say so rather than give a date. */
  overAYear: boolean;
}

/**
 * When the book will be finished at this pace. The whole-read pace counts
 * from the last entry, as before; a recent-days pace from now, since it
 * already knows about the days since. Null without a page count, a pace, or
 * pages left.
 */
export function forecast(
  lastPage: number,
  pageCount: number | null,
  pace: number | null,
  from: PaceFrom,
  lastDate: Date,
  now: Date,
): Forecast | null {
  if (!pageCount || pace == null || pace <= 0) return null;
  const remaining = pageCount - lastPage;
  if (remaining <= 0) return null;
  const days = remaining / pace;
  const base = from === "read" ? lastDate : now;
  return {
    daysLeft: Math.ceil(days),
    finish: new Date(base.getTime() + days * DAY_MS),
    overAYear: days > 366,
  };
}

/** A pace in the book's unit: "about 34 pages a day", "about 6% a day",
 *  "about 48 min a day", "about 1 h 12 min a day". */
export function paceAmount(pace: number, info: UnitInfo): string {
  if (info.unit === "percent") {
    return `about ${paceLabel((pace / info.pageCount!) * 100)}% a day`;
  }
  if (info.unit === "time") {
    const minutes = Math.max(Math.round((pace / info.pageCount!) * info.lengthMinutes!), 1);
    if (minutes < 60) return `about ${minutes} min a day`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `about ${h} h${m ? ` ${m} min` : ""} a day`;
  }
  const label = paceLabel(pace);
  return `about ${label} ${label === "1" ? "page" : "pages"} a day`;
}

function windowSuffix(from: PaceFrom): string {
  return from === "read" ? "" : `, last ${WINDOW_DAYS[from]} days`;
}

function nothingRead(from: Exclude<PaceFrom, "read">): string {
  return `No reading in the last ${WINDOW_DAYS[from]} days`;
}

interface PaceInput {
  pass: Point[];
  info: UnitInfo;
  from: PaceFrom;
  now: Date;
  prefs: FormatPrefs;
}

/**
 * The line under the reading card's sparkline. While reading: the pace and
 * when it puts the finish. Once read: the pace over the whole read, whatever
 * the setting, since a finished read has no "recent days".
 */
export function chartPaceText({
  status,
  pass,
  info,
  from,
  now,
  prefs,
}: PaceInput & { status: ReadingStatus }): string | null {
  if (status === ReadingStatus.READ) {
    const pace = pagesPerDay(pass, "read", now, prefs.timeZone);
    if (!pace) return null;
    const days = Math.max(Math.round(spanDays(pass)), 1);
    return `${paceAmount(pace, info)} over ${days} ${days === 1 ? "day" : "days"}`;
  }
  if (status !== ReadingStatus.READING) return null;

  const pace = pagesPerDay(pass, from, now, prefs.timeZone);
  if (pace === null) return null;
  if (pace === 0 && from !== "read") return nothingRead(from);
  const last = pass[pass.length - 1];
  const f = forecast(last.page, info.pageCount, pace, from, last.date, now);
  let text = `${paceAmount(pace, info)}${windowSuffix(from)}`;
  if (f) {
    text += f.overAYear
      ? " · more than a year to go at this pace"
      : ` · on pace to finish ${formatDate(f.finish, prefs)}`;
  }
  return text;
}

/** The pace line on a Now reading row: "about 18 pages a day, last 7 days ·
 *  11 days left". */
export function nowReadingPaceText({ pass, info, from, now, prefs }: PaceInput): string {
  const pace = pagesPerDay(pass, from, now, prefs.timeZone);
  if (pace === null) return "No pace yet. Log a page or two.";
  if (pace === 0 && from !== "read") return nothingRead(from);
  const last = pass[pass.length - 1];
  const f = forecast(last.page, info.pageCount, pace, from, last.date, now);
  let text = `${paceAmount(pace, info)}${windowSuffix(from)}`;
  if (f) {
    text += f.overAYear
      ? " · over a year left"
      : ` · ${f.daysLeft} ${f.daysLeft === 1 ? "day" : "days"} left`;
  }
  return text;
}
