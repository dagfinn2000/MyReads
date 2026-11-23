import { dayKey, keyToUtcDate, shiftDayKey, zoneOffset } from "@/lib/dates";
import { MONTHS_LONG } from "@/lib/display";
import { GoalUnit } from "@/lib/enums";
import { goalPace, describePace, monthEnd, unitWord, yearClock } from "@/lib/goals";
import { progressIn, type GoalRuleLike } from "@/lib/goal-progress";
import { heatmapLevel, heatmapThresholds, type HeatmapUnit } from "@/lib/heatmap";
import type { Preferences } from "@/lib/preferences";
import { readingStreaks } from "@/lib/progress";
import { pageToPercent, progressFigure, unitFor, type UnitBook } from "@/lib/progress-units";
import { minutesInWindow } from "@/lib/reading-time";
import { countWindow, tally, type BookDayPages, type CountBook, type CountRules, type Pass } from "@/lib/stats-count";
import type { DayWindow } from "@/lib/stats-period";

/**
 * The monthly email (Preferences › Monthly email): on the morning of the
 * 1st, a summary of the month before, sent to the address the reader gave.
 * Off until they turn it on, and only on a server with email set up
 * (lib/mail.ts). This file is the pure half: when one is due, and what it
 * says. The server's half (lib/monthly-email-run.ts) loads the reading and
 * sends it; lib/monthly-email-html.ts draws it.
 */

/** The hour of the 1st it goes out, in the reader's zone. */
export const MONTHLY_EMAIL_HOUR = 8;

/** The days into a month it still goes, when the server was down (or the
 *  mail server failing) on the 1st. */
export const MONTHLY_EMAIL_DAYS = 7;

/** "2026-10": a month, as the email and User.lastMonthlyEmail name it. */
export type MonthKey = string;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The month before `month`. */
export function previousMonth(month: MonthKey): MonthKey {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** The month after `month`. */
export function nextMonth(month: MonthKey): MonthKey {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** The month's first and last days. */
export function monthWindow(month: MonthKey): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: monthEnd(y, m) };
}

/** "October". */
export function monthName(month: MonthKey): string {
  return MONTHS_LONG[Number(month.slice(5, 7)) - 1];
}

/** "October 2026". */
export function monthTitle(month: MonthKey): string {
  return `${monthName(month)} ${month.slice(0, 4)}`;
}

/** The month that ended last, in the reader's zone: the one a test or a
 *  preview shows unless another is asked for. */
export function lastMonth(now: Date, timeZone: string): MonthKey {
  return previousMonth(dayKey(now, timeZone).slice(0, 7));
}

/**
 * Whether the email is due at `now`, and for which month: the month just
 * ended, from 08:00 on the 1st in the reader's zone until the end of the
 * 7th, unless that month (or a later one) has gone already. The month is
 * what to record once it's sent.
 */
export function monthlyEmailDue(lastSent: string | null, now: Date, timeZone: string): MonthKey | null {
  const today = dayKey(now, timeZone);
  const day = Number(today.slice(8, 10));
  if (day > MONTHLY_EMAIL_DAYS) return null;
  if (day === 1) {
    const wall = new Date(now.getTime() + zoneOffset(now.getTime(), timeZone));
    if (wall.getUTCHours() < MONTHLY_EMAIL_HOUR) return null;
  }
  const month = previousMonth(today.slice(0, 7));
  if (lastSent !== null && isMonthKey(lastSent) && lastSent >= month) return null;
  return month;
}

/** When the next one goes, for the setting: `day` is the 1st it comes on
 *  (null: within the next few minutes), `month` the one it's about. */
export function nextMonthlyEmail(
  lastSent: string | null,
  now: Date,
  timeZone: string,
): { day: string | null; month: MonthKey } {
  const due = monthlyEmailDue(lastSent, now, timeZone);
  if (due) return { day: null, month: due };
  const today = dayKey(now, timeZone);
  const thisMonth = today.slice(0, 7);
  // Before 08:00 on the 1st, today's is still to come.
  const sentLast = lastSent !== null && isMonthKey(lastSent) && lastSent >= previousMonth(thisMonth);
  if (today.endsWith("-01") && !sentLast) return { day: today, month: previousMonth(thisMonth) };
  return { day: `${nextMonth(thisMonth)}-01`, month: thisMonth };
}

// ---------------------------------------------------------------------------
// What it says

/** A book as the email shows it. */
export interface EmailBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}

export interface MonthFinish extends EmailBook {
  /** The day it was finished, in the reader's zone. */
  day: string;
  /** 0–10, as stored; null when unrated. */
  rating: number | null;
  isReread: boolean;
  /** Days from starting to finishing, when both are known. */
  days: number | null;
  pageCount: number | null;
}

export interface MonthNumbers {
  books: number;
  pages: number;
  /** From the reading timer. */
  minutes: number;
  readingDays: number;
}

export interface MonthGoalLine {
  /** "November goal", "2026 goal". */
  label: string;
  done: number;
  target: number;
  unit: GoalUnit;
  met: boolean;
  /** "3 books ahead of schedule." Empty for a month's own goal. */
  pace: string;
}

export interface MonthSummary extends MonthNumbers {
  month: MonthKey;
  /** Who it's for: the name on their bookplate, else their username. */
  name: string;
  /** The month before, to compare with. */
  before: MonthNumbers;
  /** Most days in a row with reading, within the month. */
  longestRun: number;
  /** The day with the most reading. */
  biggestDay: { day: string; amount: number; unit: HeatmapUnit } | null;
  /** Finished in the month, first finished first. */
  finishes: MonthFinish[];
  /** The best rated of them, when two or more were finished and one has a
   *  rating; shown first and large. */
  favourite: MonthFinish | null;
  /** Books stopped in the month. */
  putDown: EmailBook[];
  /** Every day of the month, shaded 0–4 as the reading calendar would. */
  calendar: { day: string; level: number }[];
  calendarUnit: HeatmapUnit;
  /** Books started and books added to the library in the month. */
  started: number;
  added: number;
  goals: MonthGoalLine[];
  /** What the reader is in the middle of now, up to three. */
  reading: { book: EmailBook; percent: number | null; figure: string | null }[];
  /** A quote saved in the month. */
  quote: { text: string; book: EmailBook } | null;
}

/** Nothing read at all: no books, pages, time or reading days. */
export function quietMonth(s: MonthNumbers): boolean {
  return s.books === 0 && s.pages === 0 && s.minutes === 0 && s.readingDays === 0;
}

/** The book fields a summary needs from each pass. */
export interface SummaryBook extends CountBook, EmailBook {
  pageCount: number | null;
}

export interface MonthSummaryInput<B extends SummaryBook> {
  month: MonthKey;
  name: string;
  prefs: Pick<
    Preferences,
    | "statsPagesRead"
    | "statsStoppedBooks"
    | "statsAudiobooks"
    | "heatmapScale"
    | "ebookUnit"
    | "audiobookUnit"
  >;
  /** Every pass through every book (buildPasses), the rules applied. */
  passes: Pass<B>[];
  /** Pages per book per day (lib/stats-query.ts). */
  logDays: readonly BookDayPages[];
  /** Timer minutes per day, audiobooks already left out when the stats
   *  leave them out. */
  minutesByDay: ReadonlyMap<string, number>;
  /** Days with any reading, as a reading-days goal counts them. */
  readingDays: ReadonlySet<string>;
  /** The goals of the month's year. */
  goals: (GoalRuleLike & { span: "YEAR" | "MONTH" })[];
  /** Books being read now, the most lately read first. */
  reading: (EmailBook & UnitBook & { currentPage: number | null })[];
  /** Quotes saved in the month, newest first. */
  quotes: { text: string; book: EmailBook }[];
  started: number;
  added: number;
}

function numbersIn<B extends SummaryBook>(
  input: MonthSummaryInput<B>,
  window: DayWindow & { from: string; to: string },
): MonthNumbers {
  const counted = tally(countWindow(input.passes, window, input.prefs));
  let readingDays = 0;
  for (const d of input.readingDays) if (d >= window.from && d <= window.to) readingDays++;
  return {
    books: counted.books,
    pages: counted.pages,
    minutes: minutesInWindow(input.minutesByDay, window).minutes,
    readingDays,
  };
}

function emailBook(b: EmailBook): EmailBook {
  return { id: b.id, title: b.title, authors: b.authors, coverUrl: b.coverUrl };
}

/** The longest quote the email shows whole; longer ones are cut at a word. */
export const QUOTE_MAX = 320;

function shortQuote(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= QUOTE_MAX) return flat;
  const cut = flat.slice(0, QUOTE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), QUOTE_MAX - 40)).trimEnd()}…`;
}

/** Everything the email says about one month, from the reader's own
 *  numbers, counted by the same rules as Stats. */
export function summarizeMonth<B extends SummaryBook>(input: MonthSummaryInput<B>): MonthSummary {
  const { month, prefs } = input;
  const window = monthWindow(month);
  const numbers = numbersIn(input, window);
  const before = numbersIn(input, monthWindow(previousMonth(month)));

  const counted = countWindow(input.passes, window, input.prefs);
  const finishes: MonthFinish[] = counted
    .filter((i) => i.books > 0 && i.pass.kind === "finished")
    .map((i) => {
      const p = i.pass;
      const started = p.dateStarted;
      const days =
        started && p.date && started <= p.date
          ? Math.max(1, Math.round((p.date.getTime() - started.getTime()) / 86_400_000))
          : null;
      return {
        ...emailBook(p.book),
        day: p.day!,
        rating: p.rating,
        isReread: i.isReread,
        days,
        pageCount: p.book.pageCount,
      };
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  // The favourite: the best rating, the later finish on a tie.
  let favourite: MonthFinish | null = null;
  if (finishes.length >= 2) {
    for (const f of finishes) {
      if (f.rating == null) continue;
      if (!favourite || f.rating >= favourite.rating!) favourite = f;
    }
  }

  const putDown = input.passes
    .filter((p) => p.kind === "stopped" && p.day !== null && p.day >= window.from && p.day <= window.to)
    .map((p) => emailBook(p.book));

  // The calendar: pages per day, or timer minutes when the month has no
  // pages logged at all (an audiobook month).
  const pagesByDay = new Map<string, number>();
  for (const r of input.logDays) pagesByDay.set(r.day, (pagesByDay.get(r.day) ?? 0) + r.pages);
  const monthPages = [...pagesByDay].filter(([d]) => d >= window.from && d <= window.to);
  const unit: HeatmapUnit =
    monthPages.some(([, p]) => p > 0) ||
    ![...input.minutesByDay].some(([d, m]) => d >= window.from && d <= window.to && m > 0)
      ? "pages"
      : "minutes";
  const byDay = unit === "pages" ? pagesByDay : input.minutesByDay;
  const thresholds = heatmapThresholds(prefs.heatmapScale, byDay.values(), unit);
  const calendar: MonthSummary["calendar"] = [];
  for (let d = window.from; d <= window.to; d = shiftDayKey(d, 1)) {
    const amount = byDay.get(d) ?? 0;
    // A day read without pages or time to shade it by (minutes on a pages
    // calendar) still shows as read.
    const level = heatmapLevel(amount, thresholds) || (input.readingDays.has(d) ? 1 : 0);
    calendar.push({ day: d, level });
  }

  let biggestDay: MonthSummary["biggestDay"] = null;
  for (const [day, amount] of byDay) {
    if (day < window.from || day > window.to || amount <= 0) continue;
    if (!biggestDay || amount > biggestDay.amount) biggestDay = { day, amount, unit };
  }

  const monthDays = new Set([...input.readingDays].filter((d) => d >= window.from && d <= window.to));
  const { longest } = readingStreaks(monthDays, keyToUtcDate(window.to), "UTC");

  // Goals: the month's own, then the year's as it stood at the month's end.
  const year = Number(month.slice(0, 4));
  const goalContext = { passes: input.passes, rules: input.prefs as CountRules, readingDays: input.readingDays };
  const goals: MonthGoalLine[] = [];
  const monthGoal = input.goals.find((g) => g.span === "MONTH");
  if (monthGoal) {
    const done = progressIn(monthGoal, window.from, window.to, goalContext);
    const days = Number(window.to.slice(8, 10));
    const target = monthGoal.unit === GoalUnit.DAYS ? Math.min(monthGoal.target, days) : monthGoal.target;
    goals.push({
      label: `${monthName(month)} goal`,
      done,
      target,
      unit: monthGoal.unit,
      met: done >= target,
      pace: "",
    });
  }
  const yearGoal = input.goals.find((g) => g.span === "YEAR");
  if (yearGoal) {
    const done = progressIn(yearGoal, `${year}-01-01`, window.to, goalContext);
    // As the year stood that evening: the month's last day is over.
    const clock = yearClock(shiftDayKey(window.to, 1), year);
    const pace = goalPace(done, yearGoal.target, yearGoal.unit, clock);
    goals.push({
      label: `${year} goal`,
      done,
      target: yearGoal.target,
      unit: yearGoal.unit,
      met: done >= yearGoal.target,
      pace: describePace(pace, yearGoal.unit),
    });
  }

  const reading = input.reading.slice(0, 3).map((b) => {
    const info = unitFor(b, prefs);
    const page = b.currentPage ?? 0;
    return {
      book: emailBook(b),
      percent: info.pageCount ? pageToPercent(page, info.pageCount) : null,
      figure: page > 0 ? progressFigure(page, info) : null,
    };
  });

  const quote = input.quotes[0] ? { text: shortQuote(input.quotes[0].text), book: emailBook(input.quotes[0].book) } : null;

  return {
    month,
    name: input.name,
    ...numbers,
    before,
    longestRun: longest,
    biggestDay,
    finishes,
    favourite,
    putDown,
    calendar,
    calendarUnit: unit,
    started: input.started,
    added: input.added,
    goals,
    reading,
    quote,
  };
}

/** "3 books", "1 reading day": a goal's amount in words. */
export function goalAmount(n: number, unit: GoalUnit, fmt: (n: number) => string = String): string {
  return unit === GoalUnit.DAYS ? `${fmt(n)} reading ${n === 1 ? "day" : "days"}` : `${fmt(n)} ${unitWord(unit, n)}`;
}
