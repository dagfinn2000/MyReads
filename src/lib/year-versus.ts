import { keyToUtcDate } from "@/lib/dates";
import { countWindow, inWindow, tally, type CountBook, type CountRules, type Pass } from "@/lib/stats-count";
import type { DayWindow } from "@/lib/stats-period";

/**
 * "This year against last" on Stats: this year so far beside last year up
 * to the same day, by the same rules as the cards above (lib/stats-count.ts),
 * and both years' books, day by day, for the chart.
 */

export interface YearSide {
  year: number;
  books: number;
  pages: number;
  /** Days with pages or time logged. */
  days: number;
  /** Minutes timed, or null when the reader never times. */
  minutes: number | null;
  /** Average rating (out of 10) of the books finished, or null. */
  rating: number | null;
}

export interface YearVersus {
  /** The day both sides run to: "YYYY-MM-DD" this year, and the same day
   *  last year (28 February for a 29th). */
  today: string;
  lastYearDay: string;
  now: YearSide;
  then: YearSide;
  /** Last year's whole-year books, for "on course for …". */
  thenFullYear: number;
  /** Books finished by each day of the year (index 0 is 1 January), this
   *  year up to today and last year to its end. */
  nowByDay: number[];
  thenByDay: number[];
}

/** The same day a year earlier; 29 February becomes the 28th. */
export function sameDayLastYear(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Days from 1 January to `day`, 1 January being 0. */
export function dayOfYear(day: string): number {
  const start = keyToUtcDate(`${day.slice(0, 4)}-01-01`).getTime();
  return Math.round((keyToUtcDate(day).getTime() - start) / 86_400_000);
}

function daysInYear(year: number): number {
  return dayOfYear(`${year}-12-31`) + 1;
}

/** Books finished on each day of the window's year, added up as it goes. */
function cumulativeBooks<B extends CountBook>(
  passes: Pass<B>[],
  year: number,
  through: string,
  rules: Pick<CountRules, "statsPagesRead">,
): number[] {
  const window = { from: `${year}-01-01`, to: through };
  const perDay = new Array<number>(dayOfYear(through) + 1).fill(0);
  for (const c of countWindow(passes, window, rules)) {
    if (c.books > 0 && c.pass.day) perDay[dayOfYear(c.pass.day)] += c.books;
  }
  let sum = 0;
  return perDay.map((n) => (sum += n));
}

function side<B extends CountBook>(
  passes: Pass<B>[],
  window: DayWindow,
  rules: Pick<CountRules, "statsPagesRead">,
  readingDays: ReadonlySet<string>,
  minutesByDay: ReadonlyMap<string, number> | null,
): Omit<YearSide, "year"> {
  const counted = countWindow(passes, window, rules);
  const totals = tally(counted);
  const ratings = counted.flatMap((c) =>
    c.books > 0 && c.pass.kind === "finished" && c.pass.rating != null ? [c.pass.rating] : [],
  );
  let days = 0;
  for (const d of readingDays) if (inWindow(d, window)) days++;
  let minutes: number | null = null;
  if (minutesByDay) {
    minutes = 0;
    for (const [d, m] of minutesByDay) if (inWindow(d, window)) minutes += m;
  }
  return {
    books: totals.books,
    pages: totals.pages,
    days,
    minutes,
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
  };
}

/**
 * This year to `today` against last year to the same day. `readingDays`
 * holds every day with reading logged (pages or time); `minutesByDay` the
 * timer's minutes by day, or null for a reader who never times. Null when
 * last year has nothing to compare with.
 */
export function yearVersus<B extends CountBook>(
  passes: Pass<B>[],
  today: string,
  rules: Pick<CountRules, "statsPagesRead">,
  readingDays: ReadonlySet<string>,
  minutesByDay: ReadonlyMap<string, number> | null,
): YearVersus | null {
  const year = Number(today.slice(0, 4));
  const lastYearDay = sameDayLastYear(today);
  const lastYearEnd = `${year - 1}-12-31`;
  const thenFull = side(passes, { from: `${year - 1}-01-01`, to: lastYearEnd }, rules, readingDays, minutesByDay);
  if (thenFull.books === 0 && thenFull.pages === 0 && thenFull.days === 0) return null;
  return {
    today,
    lastYearDay,
    now: { year, ...side(passes, { from: `${year}-01-01`, to: today }, rules, readingDays, minutesByDay) },
    then: {
      year: year - 1,
      ...side(passes, { from: `${year - 1}-01-01`, to: lastYearDay }, rules, readingDays, minutesByDay),
    },
    thenFullYear: thenFull.books,
    nowByDay: cumulativeBooks(passes, year, today, rules),
    thenByDay: cumulativeBooks(passes, year - 1, lastYearEnd, rules),
  };
}

/**
 * Where this year is heading, at its pace so far: books by 31 December.
 * Null in the first fortnight, when a pace says little.
 */
export function onCourseFor(v: YearVersus): number | null {
  const elapsed = dayOfYear(v.today) + 1;
  if (elapsed < 14) return null;
  return Math.round((v.now.books / elapsed) * daysInYear(v.now.year));
}

/** A change from last year in words: "+3", "−2", "same". */
export function changeText(now: number, then: number, fmt: (n: number) => string): string {
  const d = now - then;
  if (d === 0) return "same";
  return d > 0 ? `+${fmt(d)}` : `−${fmt(-d)}`;
}
