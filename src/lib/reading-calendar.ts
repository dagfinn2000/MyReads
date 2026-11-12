import { keyToUtcDate, shiftDayKey } from "@/lib/dates";
import type { StatsAudiobooks, WeekStart } from "@/lib/preferences";
import type { BookDayPages } from "@/lib/stats-count";
import type { DayMinutes } from "@/lib/stats-query";

/**
 * The reading calendar on Stats (components/reading-heatmap.tsx): every day
 * you read, how much, and in which books, worked out once on the server and
 * sent to the browser whole, so switching years, pages and time, or opening
 * a day needs no trip back.
 *
 * A reading day is a day with pages logged or minutes timed, the rule the
 * "days you read" goal uses (goalReadingDays), so the calendar, its streaks
 * and that goal never disagree.
 */

/** One book's reading on a day: its place in CalendarData.books, the pages
 *  logged and the minutes timed. */
export type CalendarBookDay = [book: number, pages: number, minutes: number];

/**
 * One reading day: the pages as Stats counts them (without audiobooks
 * unless What counts counts them fully), the minutes timed, and each book,
 * most pages first. A tuple rather than an object because a reader with
 * years of log has thousands of these, and the page carries every one: the
 * names would be most of the bytes.
 */
export type CalendarDay = [pages: number, minutes: number, books: CalendarBookDay[]];

export interface CalendarBook {
  id: string;
  title: string;
  /** The first author, for the line under the title. */
  author: string | null;
  coverUrl: string | null;
}

export interface CalendarData {
  /** Reading days only, by day key ("2026-05-12"). */
  days: Record<string, CalendarDay>;
  /** The books the days point at. */
  books: CalendarBook[];
  /** The days the daily goal was met, when there is one. */
  goalDays: string[];
  /** Whether anything was ever timed (the Time view needs it). */
  timed: boolean;
}

/** Puts the log together by day. Audiobooks follow What counts: left out
 *  altogether, or kept as reading days without their pages. */
export function buildCalendar({
  logDays,
  dayMinutes,
  books,
  statsAudiobooks,
  goalDays,
}: {
  logDays: readonly BookDayPages[];
  dayMinutes: readonly DayMinutes[];
  books: readonly { id: string; title: string; authors: string[]; coverUrl: string | null; format: string }[];
  statsAudiobooks: StatsAudiobooks;
  goalDays?: ReadonlySet<string> | null;
}): CalendarData {
  const byId = new Map(books.map((b) => [b.id, b]));
  const out = statsAudiobooks === "out";
  const audioPages = statsAudiobooks === "full";
  const used = new Map<string, number>();
  const shown: CalendarBook[] = [];
  const days: Record<string, CalendarDay> = {};
  // Per day, each book's entry by its place in `shown`.
  const entries = new Map<string, Map<number, CalendarBookDay>>();

  const entry = (day: string, bookId: string): CalendarBookDay | null => {
    const book = byId.get(bookId);
    if (!book) return null;
    let index = used.get(bookId);
    if (index === undefined) {
      index = shown.length;
      used.set(bookId, index);
      shown.push({
        id: book.id,
        title: book.title,
        author: book.authors[0] ?? null,
        coverUrl: book.coverUrl,
      });
    }
    days[day] ??= [0, 0, []];
    let perBook = entries.get(day);
    if (!perBook) entries.set(day, (perBook = new Map()));
    let e = perBook.get(index);
    if (!e) {
      e = [index, 0, 0];
      perBook.set(index, e);
      days[day][2].push(e);
    }
    return e;
  };

  for (const r of logDays) {
    if (r.pages <= 0) continue;
    const audiobook = byId.get(r.bookId)?.format === "AUDIOBOOK";
    if (audiobook && out) continue;
    const e = entry(r.day, r.bookId);
    if (!e) continue;
    e[1] += r.pages;
    if (!audiobook || audioPages) days[r.day][0] += r.pages;
  }
  for (const m of dayMinutes) {
    if (m.minutes <= 0 || (m.audiobook && out)) continue;
    const e = entry(m.day, m.bookId);
    if (!e) continue;
    e[2] += m.minutes;
    days[m.day][1] += m.minutes;
  }
  for (const d of Object.values(days)) d[2].sort((a, b) => b[1] - a[1] || b[2] - a[2]);

  return {
    days,
    books: shown,
    goalDays: goalDays ? [...goalDays].sort() : [],
    timed: dayMinutes.some((m) => m.minutes > 0 && !(m.audiobook && out)),
  };
}

/** What the calendar shows: the last twelve months, or one year. */
export type CalendarWindow = "recent" | number;

export interface WindowRange {
  /** First and last day of the window. */
  from: string;
  to: string;
  /** The window's last day that has happened: `to`, or today. */
  last: string;
}

export function windowRange(window: CalendarWindow, today: string): WindowRange {
  if (window === "recent") return { from: shiftDayKey(today, -364), to: today, last: today };
  const from = `${window}-01-01`;
  const to = `${window}-12-31`;
  return { from, to, last: to < today ? to : today };
}

/** The years a reader can pick: this one, and every earlier year with
 *  reading in it, newest first. */
export function calendarYears(days: Iterable<string>, today: string): number[] {
  const years = new Set([Number(today.slice(0, 4))]);
  for (const key of days) if (key <= today) years.add(Number(key.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

/**
 * The calendar's columns: whole weeks, each of seven day keys from the
 * reader's first weekday, from the week holding `from` to the week holding
 * `to`. Days of those weeks outside the window are left in; the calendar
 * draws them blank.
 */
export function calendarWeeks(range: WindowRange, weekStart: WeekStart): string[][] {
  const first = weekStart === "sunday" ? 0 : 1;
  let cursor = range.from;
  while (keyToUtcDate(cursor).getUTCDay() !== first) cursor = shiftDayKey(cursor, -1);
  const weeks: string[][] = [];
  while (cursor <= range.to) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = shiftDayKey(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Where each month's name goes: over the column holding its first day.
 * When the window starts partway through a month, that month is named over
 * the first column too, if there's room before the next name.
 */
export function monthColumns(weeks: string[][], range: WindowRange): (number | null)[] {
  const labels: (number | null)[] = weeks.map((week) => {
    const first = week.find((k) => k >= range.from && k <= range.to && k.endsWith("-01"));
    return first ? Number(first.slice(5, 7)) - 1 : null;
  });
  if (labels[0] === null && !labels.slice(1, 3).some((l) => l !== null)) {
    labels[0] = Number(range.from.slice(5, 7)) - 1;
  }
  return labels;
}

/** A run of reading days in a row. */
export interface Run {
  from: string;
  to: string;
  days: number;
}

/** Every run of days in a row, oldest first. */
export function streakRuns(days: Iterable<string>): Run[] {
  const runs: Run[] = [];
  let run: Run | null = null;
  for (const key of [...new Set(days)].sort()) {
    if (run && key === shiftDayKey(run.to, 1)) {
      run.to = key;
      run.days++;
    } else {
      run = { from: key, to: key, days: 1 };
      runs.push(run);
    }
  }
  return runs;
}

/** The days from `from` to `to`, both counted. */
export function daysBetween(from: string, to: string): number {
  return Math.round((keyToUtcDate(to).getTime() - keyToUtcDate(from).getTime()) / 86_400_000) + 1;
}

/** The longest run, the latest of equals; null without any. */
export function longestRun(runs: readonly Run[]): Run | null {
  let best: Run | null = null;
  for (const r of runs) if (!best || r.days >= best.days) best = r;
  return best;
}

/** The runs as they fall inside a window: cut at its edges. */
export function runsIn(runs: readonly Run[], range: WindowRange): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (r.to < range.from || r.from > range.last) continue;
    const from = r.from < range.from ? range.from : r.from;
    const to = r.to > range.last ? range.last : r.to;
    out.push({ from, to, days: daysBetween(from, to) });
  }
  return out;
}

/**
 * The streak going on now. Today counts once something is logged, but a
 * today with nothing yet doesn't end yesterday's streak — the day isn't
 * over (the rule readingStreaks in lib/progress.ts uses). `waiting` says the
 * streak needs today's reading to go on.
 */
export function currentRun(
  runs: readonly Run[],
  today: string,
): (Run & { waiting: boolean }) | null {
  const last = runs[runs.length - 1];
  if (!last) return null;
  if (last.to === today) return { ...last, waiting: false };
  if (last.to === shiftDayKey(today, -1)) return { ...last, waiting: true };
  return null;
}

/** The year most of a run falls in. */
export function runYear(run: Run): number {
  const start = Number(run.from.slice(0, 4));
  const end = Number(run.to.slice(0, 4));
  if (start === end) return end;
  const inEnd = daysBetween(`${end}-01-01`, run.to);
  return inEnd * 2 >= run.days ? end : end - 1;
}

/** Every day key of a run. */
export function runDays(run: Run): string[] {
  const out: string[] = [];
  for (let k = run.from; k <= run.to; k = shiftDayKey(k, 1)) out.push(k);
  return out;
}
