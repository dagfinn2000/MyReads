import { ReadingStatus } from "@/lib/enums";
import { calendarDay, dayKey, keyToUtcDate, shiftDayKey } from "@/lib/dates";

/**
 * The to-read pile on Stats: how many books wait on Want to Read, how the
 * pile grew or shrank over the last twelve months, how long the books have
 * waited, and how long the pile would last at the reader's pace.
 *
 * A book is on the pile from the day it was added until the day it was
 * started (or finished, when it never had a start date). A book added
 * already started or read was never on it.
 */

export interface PileBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  status: ReadingStatus;
  createdAt: Date;
  dateStarted: Date | null;
  dateFinished: Date | null;
}

/** How long books have waited: these many days or more, by bucket. */
export const PILE_AGES = [
  { label: "Under a month", from: 0 },
  { label: "1–6 months", from: 30 },
  { label: "6–12 months", from: 182 },
  { label: "1–2 years", from: 365 },
  { label: "Over 2 years", from: 730 },
] as const;

export interface PileSummary {
  /** Books on Want to Read now. */
  size: number;
  /** The pile at the end of each of the last twelve months, oldest first,
   *  and now: thirteen points. `month` is "YYYY-MM". */
  monthly: { month: string; size: number }[];
  /** Books that went on the pile in the last twelve months, and that came
   *  off it (were started). */
  added: number;
  started: number;
  /** How many have waited how long, in PILE_AGES order. */
  ages: number[];
  /** The books that have waited longest, longest first. */
  oldest: PileBook[];
  /** Days since the median book on the pile was added. */
  medianDays: number | null;
}

const DAY_MS = 86_400_000;

/** The day a book went on the pile and the day it came off (null while
 *  still on it), or null for a book that was never on it. */
function pileSpan(b: PileBook, timeZone?: string): { on: string; off: string | null } | null {
  // Added is a moment; started and finished are days typed in (or stamped).
  const on = dayKey(b.createdAt, timeZone);
  if (b.status === ReadingStatus.WANT_TO_READ) return { on, off: null };
  const left = b.dateStarted ?? b.dateFinished;
  if (!left) return null;
  const off = calendarDay(left, timeZone);
  return off > on ? { on, off } : null;
}

/** The last day of the month a day key falls in. */
function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return shiftDayKey(next, -1);
}

/** "YYYY-MM", `back` months before `month`. */
function monthBefore(month: string, back: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) - back;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function pileSummary(books: PileBook[], now: Date, timeZone?: string, oldestCount = 3): PileSummary {
  const today = dayKey(now, timeZone);
  const yearAgo = shiftDayKey(today, -365);
  const spans = books.flatMap((b) => {
    const span = pileSpan(b, timeZone);
    return span ? [{ b, ...span }] : [];
  });
  const sizeOn = (day: string) =>
    spans.filter((s) => s.on <= day && (s.off === null || s.off > day)).length;

  const thisMonth = today.slice(0, 7);
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = monthBefore(thisMonth, 12 - i);
    return { month, size: sizeOn(monthEnd(month)) };
  });
  monthly.push({ month: thisMonth, size: sizeOn(today) });

  const waiting = spans
    .filter((s) => s.off === null)
    .sort((a, b) => a.b.createdAt.getTime() - b.b.createdAt.getTime());
  const todayMs = keyToUtcDate(today).getTime();
  const waited = waiting.map((s) => Math.max(0, Math.round((todayMs - keyToUtcDate(s.on).getTime()) / DAY_MS)));
  const ages = PILE_AGES.map((age, i) => {
    const to = PILE_AGES[i + 1]?.from ?? Infinity;
    return waited.filter((d) => d >= age.from && d < to).length;
  });
  const sorted = [...waited].sort((a, b) => a - b);

  return {
    size: waiting.length,
    monthly,
    added: spans.filter((s) => s.on > yearAgo && s.on <= today).length,
    started: spans.filter((s) => s.off !== null && s.off > yearAgo && s.off <= today).length,
    ages,
    oldest: waiting.slice(0, oldestCount).map((s) => s.b),
    medianDays: sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null,
  };
}

/**
 * How long the pile lasts at `perYear` books a year, in words: "about 4
 * months", "about a year and a half", "about 6 years". Null without a pace.
 */
export function pileLastsText(size: number, perYear: number): string | null {
  if (size === 0 || perYear <= 0) return null;
  const months = Math.round((size / perYear) * 12);
  if (months <= 1) return "about a month";
  if (months < 12) return `about ${months} months`;
  if (months < 18) return "about a year";
  if (months < 24) return "about a year and a half";
  const years = Math.round(months / 12);
  return `about ${years} years`;
}

/** "Waiting since Mar 2021"-style month and year of a day key. */
export function sinceMonth(createdAt: Date, timeZone?: string): string {
  const day = dayKey(createdAt, timeZone);
  const date = keyToUtcDate(day);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}
