import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { calendarDay, dayKey, keyToUtcDate } from "@/lib/dates";
import type { DateFormat, NumberFormat } from "@/lib/preferences";

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  WANT_TO_READ: "Want to Read",
  READING: "Currently Reading",
  READ: "Read",
  DNF: "Did Not Finish",
};

export const FORMAT_LABELS: Record<BookFormat, string> = {
  PHYSICAL: "Physical",
  EBOOK: "Ebook",
  AUDIOBOOK: "Audiobook",
};

export const OWNERSHIP_LABELS: Record<BookOwnership, string> = {
  OWNED: "Owned",
  WISHLIST: "Wishlist",
  BORROWED: "Borrowed",
  GIVEN_AWAY: "No longer have it",
};

/** Shorter form for the badge on a book page, where "Owned" is the boring
 *  default and only the other three are worth calling out. */
export const OWNERSHIP_BADGE_LABELS: Record<BookOwnership, string> = {
  OWNED: "Owned",
  WISHLIST: "Wishlist",
  BORROWED: "Borrowed",
  GIVEN_AWAY: "Given away",
};

/** Badge tint per reading status (light + dark variants). */
export const STATUS_BADGE_CLASS: Record<ReadingStatus, string> = {
  WANT_TO_READ:
    "status-badge bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border-transparent",
  READING:
    "status-badge bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent",
  READ: "status-badge bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-transparent",
  DNF: "status-badge bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-transparent",
};

/** What a date or number formatter needs from Preferences. Optional
 *  throughout: leaving it out gives the original "12 May 2024" and "1,234",
 *  with moments read in the server's zone. */
export interface FormatPrefs {
  dateFormat?: DateFormat;
  numberFormat?: NumberFormat;
  timeZone?: string;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** A "YYYY-MM-DD" key in the chosen date style. */
export function formatDayKey(key: string, format: DateFormat = "d-mmm-y"): string {
  const [y, m, d] = key.split("-");
  const day = String(Number(d));
  const month = MONTHS_SHORT[Number(m) - 1];
  switch (format) {
    case "mmm-d-y":
      return `${month} ${day}, ${y}`;
    case "dd.mm.y":
      return `${d}.${m}.${y}`;
    case "dd/mm/y":
      return `${d}/${m}/${y}`;
    case "mm/dd/y":
      return `${m}/${d}/${y}`;
    case "iso":
      return key;
    default:
      return `${day} ${month} ${y}`;
  }
}

/** "12 May 2024" (or the chosen style), or empty string. See calendarDay
 *  for which day a stored date counts as. */
export function formatDate(d: Date | null | undefined, prefs?: FormatPrefs): string {
  if (!d) return "";
  return formatDayKey(calendarDay(d, prefs?.timeZone), prefs?.dateFormat);
}

const NUMBER_LOCALES: Record<NumberFormat, string> = {
  comma: "en-US", // 1,234
  space: "nb-NO", // 1 234
  period: "de-DE", // 1.234
};

const numberFormatters = new Map<NumberFormat, Intl.NumberFormat>();

/** "1,234" (or the chosen grouping). Whole numbers only — counts and pages. */
export function formatNumber(n: number, prefs?: FormatPrefs): string {
  const format = prefs?.numberFormat ?? "comma";
  let f = numberFormatters.get(format);
  if (!f) {
    f = new Intl.NumberFormat(NUMBER_LOCALES[format], { maximumFractionDigits: 0 });
    numberFormatters.set(format, f);
  }
  return f.format(n);
}

/** Date → value usable by <input type="date">: the same calendar day
 *  formatDate shows. */
export function toDateInputValue(d: Date | null | undefined, timeZone?: string): string {
  if (!d) return "";
  return calendarDay(d, timeZone);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Month-first date styles write "October 12", the rest "12 October". */
function monthFirst(format: DateFormat | undefined): boolean {
  return format === "mmm-d-y" || format === "mm/dd/y";
}

/** Today as a heading: "Monday 12 October", or "Monday, October 12" for the
 *  month-first date styles. The day is the reader's, in their zone. */
export function formatWeekdayDay(d: Date, prefs?: FormatPrefs): string {
  const key = dayKey(d, prefs?.timeZone);
  const [, m, day] = key.split("-").map(Number);
  const weekday = WEEKDAYS[keyToUtcDate(key).getUTCDay()];
  const month = MONTHS_LONG[m - 1];
  return monthFirst(prefs?.dateFormat) ? `${weekday}, ${month} ${day}` : `${weekday} ${day} ${month}`;
}

/** A recent day in a short menu: "Sat 10 Oct", or "Sat, Oct 10". */
export function formatShortDay(key: string, format?: DateFormat): string {
  const [, m, day] = key.split("-").map(Number);
  const weekday = WEEKDAYS[keyToUtcDate(key).getUTCDay()].slice(0, 3);
  const month = MONTHS_SHORT[m - 1];
  return monthFirst(format) ? `${weekday}, ${month} ${day}` : `${weekday} ${day} ${month}`;
}
