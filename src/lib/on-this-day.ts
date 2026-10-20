import { calendarDay, dayKey, keyToUtcDate } from "@/lib/dates";

/**
 * "On this day" on Now reading: books finished or started on today's date
 * in an earlier year, and a quote saved on it. And the note on a book being
 * read that hasn't been logged for a while. Pure, so the page and the tests
 * share it; lib/on-this-day-query.ts finds the candidates.
 */

export interface DayEvent {
  kind: "finished" | "started";
  bookId: string;
  title: string;
  date: Date;
}

export interface DayQuote {
  id: string;
  bookId: string;
  title: string;
  text: string;
  date: Date;
}

export interface OnThisDayLine {
  kind: DayEvent["kind"];
  bookId: string;
  title: string;
  years: number;
}

export interface OnThisDay {
  lines: OnThisDayLine[];
  quote: (Omit<DayQuote, "date"> & { years: number }) | null;
}

/** How many of the book lines show. */
export const ON_THIS_DAY_LINES = 3;

/** Whole years back from today to `key`, if it's today's date in an earlier
 *  year; null otherwise. */
function yearsBack(key: string, todayKey: string): number | null {
  if (key.slice(5) !== todayKey.slice(5)) return null;
  const years = Number(todayKey.slice(0, 4)) - Number(key.slice(0, 4));
  return years > 0 ? years : null;
}

/**
 * What happened on today's date in earlier years: the most recent first,
 * a finish before a start, a few at most; and one quote, the most recently
 * saved. Typed-in dates mean their calendar day and stamps fall in the
 * reader's zone, as everywhere else (lib/dates.ts calendarDay).
 */
export function onThisDay(
  events: readonly DayEvent[],
  quotes: readonly DayQuote[],
  todayKey: string,
  timeZone: string,
): OnThisDay {
  const seen = new Set<string>();
  const lines: OnThisDayLine[] = [];
  for (const e of events) {
    const years = yearsBack(calendarDay(e.date, timeZone), todayKey);
    if (years === null) continue;
    const key = `${e.kind}|${e.bookId}|${years}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ kind: e.kind, bookId: e.bookId, title: e.title, years });
  }
  lines.sort(
    (a, b) =>
      a.years - b.years ||
      (a.kind === b.kind ? 0 : a.kind === "finished" ? -1 : 1) ||
      a.title.localeCompare(b.title),
  );

  let quote: OnThisDay["quote"] = null;
  for (const q of quotes) {
    const years = yearsBack(dayKey(q.date, timeZone), todayKey);
    if (years === null) continue;
    if (!quote || years < quote.years || (years === quote.years && q.id < quote.id)) {
      quote = { id: q.id, bookId: q.bookId, title: q.title, text: q.text, years };
    }
  }
  return { lines: lines.slice(0, ON_THIS_DAY_LINES), quote };
}

/** "A year ago today", "3 years ago today". */
export function yearsAgoToday(years: number): string {
  return years === 1 ? "A year ago today" : `${years} years ago today`;
}

/** The days around today, as "MM-DD", that a stored date could fall on
 *  today in some zone: the query's first, rough cut. */
export function nearbyMonthDays(todayKey: string): string[] {
  const today = keyToUtcDate(todayKey);
  const days = [-1, 0, 1].map((shift) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + shift);
    return d.toISOString().slice(5, 10);
  });
  // A date stored at UTC 02-29 has no matching month-day in a non-leap
  // year, so when today brushes the end of February this rough cut would
  // drop it. Add 02-29 then; onThisDay() still keeps only what truly falls
  // on today in the reader's zone.
  if ((days.includes("02-28") || days.includes("03-01")) && !days.includes("02-29")) {
    days.push("02-29");
  }
  return days;
}

/** After this many days without a log, a book being read says so. */
export const QUIET_DAYS = 14;

/**
 * "Last read 3 weeks ago" for a book being read with nothing logged for
 * two weeks or more, counted in calendar days in the reader's zone; null
 * while it's fresher than that.
 */
export function lastReadText(last: Date | null, now: Date, timeZone: string): string | null {
  if (!last) return null;
  const days = Math.round(
    (keyToUtcDate(dayKey(now, timeZone)).getTime() - keyToUtcDate(calendarDay(last, timeZone)).getTime()) /
      86_400_000,
  );
  if (days < QUIET_DAYS) return null;
  if (days < 60) return `Last read ${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `Last read ${Math.round(days / 30.44)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "Last read over a year ago" : `Last read over ${years} years ago`;
}
