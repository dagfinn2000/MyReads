import { BookFormat } from "@prisma/client";
import type { AudiobookUnit, EbookUnit, QuickLogSteps } from "@/lib/preferences";

/**
 * Reading positions in a book's own unit. A position is always stored as a
 * page (Book.currentPage, ProgressEntry.page), so stats, goals and the
 * reading calendar never need to know about units. An ebook can be shown and
 * entered in percent, and an audiobook in time listened; both convert
 * through the page count (and, for time, the audiobook's length).
 */

export type ProgressUnit = "page" | "percent" | "time";

export interface UnitInfo {
  /** The unit in use. */
  unit: ProgressUnit;
  /** The unit Preferences asked for. Differs from `unit` while the book
   *  lacks what that unit needs. */
  wanted: ProgressUnit;
  pageCount: number | null;
  lengthMinutes: number | null;
  /** Why the wanted unit isn't in use yet. */
  fallback: null | "noPageCount" | "noLength";
}

export interface UnitBook {
  format: BookFormat;
  pageCount: number | null;
  lengthMinutes: number | null;
}

/** Which unit a book's progress is shown and entered in. Physical books are
 *  always pages; percent needs a page count, time needs that and the
 *  audiobook's length. */
export function unitFor(
  book: UnitBook,
  prefs: { ebookUnit: EbookUnit; audiobookUnit: AudiobookUnit },
): UnitInfo {
  const wanted: ProgressUnit =
    book.format === BookFormat.EBOOK
      ? prefs.ebookUnit
      : book.format === BookFormat.AUDIOBOOK
        ? prefs.audiobookUnit
        : "page";
  const pageCount = book.pageCount || null;
  const lengthMinutes = book.format === BookFormat.AUDIOBOOK ? book.lengthMinutes || null : null;
  const base = { wanted, pageCount, lengthMinutes };
  if (wanted !== "page" && !pageCount) return { ...base, unit: "page", fallback: "noPageCount" };
  if (wanted === "time" && !lengthMinutes) return { ...base, unit: "page", fallback: "noLength" };
  return { ...base, unit: wanted, fallback: null };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * A fraction of the book as a page. Anything above nothing is at least
 * page 1 (so 1% of a short book still logs), and anything short of the
 * whole book stays short of the last page (so 99% never asks "Mark as
 * Read?").
 */
function fractionToPage(fraction: number, pageCount: number): number {
  if (fraction <= 0) return 0;
  if (fraction >= 1) return pageCount;
  return clamp(Math.round(fraction * pageCount), 1, Math.max(pageCount - 1, 1));
}

/** The other way: never "100" before the last page, never "0" after page 0. */
function pageToFraction(page: number, pageCount: number, scale: number): number {
  if (page >= pageCount) return scale;
  if (page <= 0) return 0;
  return clamp(Math.round((page / pageCount) * scale), 1, Math.max(scale - 1, 1));
}

export function percentToPage(percent: number, pageCount: number): number {
  return fractionToPage(percent / 100, pageCount);
}

export function pageToPercent(page: number, pageCount: number): number {
  return pageToFraction(page, pageCount, 100);
}

export function minutesToPage(minutes: number, lengthMinutes: number, pageCount: number): number {
  return fractionToPage(minutes / lengthMinutes, pageCount);
}

export function pageToMinutes(page: number, pageCount: number, lengthMinutes: number): number {
  return pageToFraction(page, pageCount, lengthMinutes);
}

/**
 * Time typed by a listener, in minutes, or null when it isn't a time.
 * "5:12" and "5:12:30" are clock style; "5.12" and "5,12" also work, so a
 * phone's decimal keypad is enough, but only with two minute digits: "5.5"
 * would otherwise mean 5:05 to us and five and a half hours to the reader.
 * "5h 12m", "5h", "45m", "45 min" and a bare "312" (minutes) work too.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,4}):([0-5]?\d)(?::([0-5]\d))?$/.exec(s))) {
    return Number(m[1]) * 60 + Number(m[2]) + Math.round(Number(m[3] ?? 0) / 60);
  }
  if ((m = /^(\d{1,4})[.,]([0-5]\d)$/.exec(s))) {
    return Number(m[1]) * 60 + Number(m[2]);
  }
  if ((m = /^(\d{1,4})\s*h(?:ours?|rs?)?(?:\s*([0-5]?\d)\s*m(?:in(?:ute)?s?)?)?$/.exec(s))) {
    return Number(m[1]) * 60 + Number(m[2] ?? 0);
  }
  if ((m = /^(\d{1,6})\s*m(?:in(?:ute)?s?)?$/.exec(s)) || (m = /^(\d{1,6})$/.exec(s))) {
    return Number(m[1]);
  }
  return null;
}

/** 312 → "5:12", 5 → "0:05". */
export function formatDuration(minutes: number): string {
  const m = Math.max(Math.round(minutes), 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** An audiobook's length for reading: "16 h 10 min", "45 min", "3 h". */
export function formatLength(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** A page as a value in the book's unit (a page, a percent, minutes). */
export function pageToUnit(page: number, info: UnitInfo): number {
  if (info.unit === "percent") return pageToPercent(page, info.pageCount!);
  if (info.unit === "time") return pageToMinutes(page, info.pageCount!, info.lengthMinutes!);
  return page;
}

/** A value in the book's unit as a page. */
export function unitToPage(value: number, info: UnitInfo): number {
  if (info.unit === "percent") return percentToPage(value, info.pageCount!);
  if (info.unit === "time") return minutesToPage(value, info.lengthMinutes!, info.pageCount!);
  return value;
}

/** A value in the book's unit as an input box shows it. */
export function unitText(value: number, info: UnitInfo): string {
  return info.unit === "time" ? formatDuration(value) : String(value);
}

/** A stored page as the box shows it; empty for no page. */
export function positionText(page: number | null, info: UnitInfo): string {
  return page == null ? "" : unitText(pageToUnit(page, info), info);
}

/** The largest value the box takes, or null when there's no end known. */
export function unitMax(info: UnitInfo): number | null {
  if (info.unit === "percent") return 100;
  if (info.unit === "time") return info.lengthMinutes;
  return info.pageCount;
}

/** The refusal for a page past the last one, shared with the server. */
export function pastTheEnd(page: number, pageCount: number): string {
  return `Page ${page} is past the end of the book (${pageCount} pages).`;
}

export type ParsedPosition = { value: number; page: number } | { error: string };

/**
 * What's typed in a progress box: the value in the book's unit and the page
 * it is saved as, or why it can't be saved. Null when the box is empty.
 */
export function parseUnitText(text: string, info: UnitInfo): ParsedPosition | null {
  const s = text.trim();
  if (!s) return null;
  if (info.unit === "time") {
    const minutes = parseDuration(s);
    if (minutes === null) return { error: "Use hours and minutes, like 5:12." };
    if (minutes > info.lengthMinutes!) {
      return { error: `That's past the end (${formatDuration(info.lengthMinutes!)}).` };
    }
    return { value: minutes, page: unitToPage(minutes, info) };
  }
  if (info.unit === "percent") {
    const m = /^(\d{1,3})\s*%?$/.exec(s);
    if (!m || Number(m[1]) > 100) return { error: "Type a percent from 0 to 100." };
    const value = Number(m[1]);
    return { value, page: unitToPage(value, info) };
  }
  if (!/^\d{1,6}$/.test(s)) return { error: "Type a whole page number." };
  const page = Number(s);
  if (info.pageCount != null && page > info.pageCount) return { error: pastTheEnd(page, info.pageCount) };
  return { value: page, page };
}

/**
 * What a box holding a stored page saves: that page itself while the box
 * still shows it unchanged, else what's typed. Percent and time don't
 * convert back exactly (page 175 of 412 shows as 42%, and 42% is page 173),
 * so re-sending the shown text would move the page without anyone typing.
 */
export function parseBoxText(text: string, info: UnitInfo, stored: number | null): ParsedPosition | null {
  if (stored != null && text === positionText(stored, info)) {
    return { value: pageToUnit(stored, info), page: stored };
  }
  return parseUnitText(text, info);
}

/** A value in the book's unit in running text: "page 212", "42%", "5:11". */
export function formatUnitValue(value: number, info: UnitInfo, opts?: { capital?: boolean }): string {
  if (info.unit === "percent") return `${value}%`;
  if (info.unit === "time") return formatDuration(value);
  return `${opts?.capital ? "Page" : "page"} ${value}`;
}

/** A position in running text: "page 212", "42%", "5:12". `capital` gives
 *  "Page 212" for the start of a line. */
export function formatPosition(page: number, info: UnitInfo, opts?: { capital?: boolean }): string {
  return formatUnitValue(pageToUnit(page, info), info, opts);
}

/** The line under a progress bar: "212 of 412 · 51%", "51%",
 *  "5:12 of 11:40 · 45%", or "Page 212" when the page count is unknown. */
export function progressFigure(page: number, info: UnitInfo): string {
  if (info.pageCount == null) return `Page ${page}`;
  const pct = pageToPercent(page, info.pageCount);
  if (info.unit === "percent") return `${pct}%`;
  if (info.unit === "time") {
    const len = info.lengthMinutes!;
    return `${formatDuration(pageToMinutes(page, info.pageCount, len))} of ${formatDuration(len)} · ${pct}%`;
  }
  return `${page} of ${info.pageCount} · ${pct}%`;
}

export interface LogStep {
  /** In the book's unit: pages, percentage points or minutes. */
  amount: number;
  label: string;
  ariaLabel: string;
}

/** The step buttons next to the progress box, in the book's own unit.
 *  "+5%" is 5% of the book whatever the unit, so it needs a page count;
 *  without one the buttons are +10 and +25. */
export function stepsFor(choice: QuickLogSteps, info: UnitInfo): LogStep[] {
  if (choice === "5pct" && info.pageCount) {
    const amount =
      info.unit === "percent"
        ? 5
        : info.unit === "time"
          ? Math.max(Math.round(info.lengthMinutes! * 0.05), 1)
          : Math.max(Math.round(info.pageCount * 0.05), 1);
    return [{ amount, label: "+5%", ariaLabel: "Add 5% of the book" }];
  }
  const amounts = choice === "5-10" ? [5, 10] : [10, 25];
  return amounts.map((n) =>
    info.unit === "percent"
      ? { amount: n, label: `+${n}%`, ariaLabel: `Add ${n} percent` }
      : info.unit === "time"
        ? { amount: n, label: `+${n} min`, ariaLabel: `Add ${n} minutes` }
        : { amount: n, label: `+${n}`, ariaLabel: `Add ${n} pages` },
  );
}

/** The box's text after a step button: the step added to what's typed, or
 *  to the current position when nothing valid is, and kept within the
 *  book. */
export function addStep(text: string, step: number, currentPage: number | null, info: UnitInfo): string {
  const typed = parseUnitText(text, info);
  const base =
    typed && "value" in typed ? typed.value : currentPage != null ? pageToUnit(currentPage, info) : 0;
  const max = unitMax(info);
  return unitText(Math.min(base + step, max ?? 100_000), info);
}

/** A setting that can't apply to this book yet, split around the words
 *  that link to its Edit page. */
export function fallbackHint(info: UnitInfo): { before: string; after: string } | null {
  if (info.fallback === "noLength") {
    return {
      before: "Tracking by page for now. Add the audiobook's length on the ",
      after: " to track by time.",
    };
  }
  if (info.fallback === "noPageCount") {
    return info.wanted === "time"
      ? {
          before: "Tracking by page for now. Add a page count (the print edition's is fine) on the ",
          after: " to track by time.",
        }
      : { before: "Tracking by page for now. Add a page count on the ", after: " to track by percent." };
  }
  return null;
}
