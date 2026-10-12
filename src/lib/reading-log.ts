import { z } from "zod";
import { calendarDay, dayKey, endOfZonedDay, keyToUtcDate, shiftDayKey } from "@/lib/dates";
import { formatDayKey, formatShortDay } from "@/lib/display";
import type { DateFormat } from "@/lib/preferences";
import { formatPosition, formatUnitValue, unitToPage, type UnitInfo } from "@/lib/progress-units";

/**
 * The rules for logging a page on any day and fixing a log entry, shared by
 * the progress actions (lib/actions/progress.ts) and the quick-log row.
 * Pure on purpose: client components import it, so nothing here may touch
 * the database.
 *
 * The log's rules, in brief. A reading pass starts at a page-0 anchor and
 * its positions only go up, because stats credit each increase to the day
 * of the later entry (lib/progress.ts). So a new or fixed entry has to fit
 * between its neighbours: not below the entry before it, not past the entry
 * after it, and not before the pass started. Equal pages are fine (they
 * credit nothing). Only the immediate neighbours are checked, which on an
 * increasing log is the same as checking every entry, and still lets older
 * logs that already contain a downward correction take new entries.
 */

export const MAX_PAGE = 100_000;

/** A record id from the client. Anything else is "not found", never a
 *  database error. */
export const idSchema = z.string().min(1).max(64);

/** "2026-10-09", and a real date: 2026-02-30 isn't. */
export const dayKeySchema = z
  .string()
  .refine(
    (k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && keyToUtcDate(k).toISOString().slice(0, 10) === k,
    "Pick a day",
  );

export const dayChoiceSchema = z.union([z.literal("today"), z.literal("yesterday"), dayKeySchema]);

const pageField = z.coerce
  .number()
  .int("Log a whole page")
  .min(1, "Log at least page 1")
  .max(MAX_PAGE, "That page is too high");

/** The position as typed, in the book's unit, so messages can say it back
 *  as typed. Only ever shown; anything odd is dropped, never refused. */
const typedValue = z.number().int().min(0).max(1_000_000).optional().catch(undefined);

export const logPageSchema = z.object({
  page: pageField,
  day: dayChoiceSchema.default("today"),
  value: typedValue,
});

export const editEntrySchema = z.object({
  page: pageField,
  day: dayKeySchema,
  value: typedValue,
});

export const moveTargetSchema = z.enum(["READ", "DNF"]);

/**
 * What the client hands back to undo Finished or Stopped. It only names the
 * move; the server works out the rest from the book. `finishedAt` is the
 * finish moment the move wrote, so an undo can't land on a book finished
 * again since. `page` restores the page of a book with no reading log,
 * which a finish clears and nothing else remembers.
 */
export const undoMoveSchema = z.object({
  from: moveTargetSchema,
  finishedAt: z.string().datetime().nullable(),
  page: z.number().int().min(1).max(MAX_PAGE).nullable(),
});

export type UndoMove = z.infer<typeof undoMoveSchema>;

export type LogPageResult =
  | { error: string }
  | { ok: true; message: string; page: number; lastPage: boolean };

export interface EntryEditResult {
  error?: string;
  message?: string;
}

export type MoveResult =
  | { error: string }
  | { ok: true; finished: boolean; message: string; undo: UndoMove };

export interface LogPoint {
  id: string;
  page: number;
  date: Date;
}

/**
 * The day a quick log is for, and the moment its entry gets. Today's entry
 * is stamped now. An earlier day's entry goes at the last moment of that day
 * in the reader's zone: "where I was at the end of that day", which also
 * sorts it after anything already logged that day.
 */
export function resolveLogDay(
  choice: string,
  now: Date,
  timeZone: string,
): { key: string; at: Date } | { error: "future" } {
  const today = dayKey(now, timeZone);
  const key = choice === "today" ? today : choice === "yesterday" ? shiftDayKey(today, -1) : choice;
  if (key > today) return { error: "future" };
  return { key, at: key === today ? now : endOfZonedDay(key, timeZone) };
}

/**
 * Where a pass's page-0 anchor goes when the first entry writes it: the
 * Started date, unless the entry is earlier. A typed Started date is
 * midnight UTC, which east of UTC is still in the future on the morning of
 * that day; an anchor after its first entry would cut the entry out of the
 * pass.
 */
export function anchorMoment(dateStarted: Date | null, at: Date): Date {
  return dateStarted && dateStarted.getTime() < at.getTime() ? dateStarted : at;
}

/** The last real position in a pass (not its page-0 anchor), or null. */
export function lastLogged<T extends { page: number }>(pass: T[]): T | null {
  const last = pass[pass.length - 1];
  return last && last.page > 0 ? last : null;
}

export type Placement<T> =
  | {
      ok: true;
      before: T | null;
      after: T | null;
      /** The pass's anchor, when the entry belongs on the pass's first day
       *  but before the anchor's moment; the anchor moves back to it. */
      moveAnchor: T | null;
    }
  | {
      ok: false;
      reason: "beforeStart" | "below" | "above";
      /** The entry it clashes with (the anchor, for beforeStart). */
      neighbour: T;
      before: T | null;
      after: T | null;
    };

/**
 * Whether a position fits a pass at that moment (see the rules at the top).
 * `pass` is sorted by date then page, like the log everywhere else, and
 * `skipId` leaves out the entry being edited. A candidate on the pass's
 * first day but before its anchor's moment fits, and the anchor moves back
 * to it, unless that would pull it over `previous`, the last entry of the
 * pass before.
 */
export function placeInLog<T extends LogPoint>(
  pass: T[],
  candidate: { page: number; date: Date },
  opts: { timeZone: string; skipId?: string; previous?: T | null },
): Placement<T> {
  const list = opts.skipId ? pass.filter((e) => e.id !== opts.skipId) : pass;
  const anchor = list[0]?.page === 0 ? list[0] : null;
  const at = candidate.date.getTime();

  let moveAnchor: T | null = null;
  if (anchor && at < anchor.date.getTime()) {
    const startDay = calendarDay(anchor.date, opts.timeZone);
    const overPrevious = opts.previous != null && at <= opts.previous.date.getTime();
    if (dayKey(candidate.date, opts.timeZone) < startDay || overPrevious) {
      return { ok: false, reason: "beforeStart", neighbour: anchor, before: null, after: null };
    }
    moveAnchor = anchor;
  }

  // Entries sorting at or before the candidate form a prefix of the list.
  let before: T | null = null;
  let after: T | null = null;
  for (const e of list) {
    const t = e.date.getTime();
    if (e === moveAnchor || t < at || (t === at && e.page <= candidate.page)) before = e;
    else if (!after) after = e;
  }

  if (before && candidate.page < before.page) {
    return { ok: false, reason: "below", neighbour: before, before, after };
  }
  if (after && candidate.page > after.page) {
    return { ok: false, reason: "above", neighbour: after, before, after };
  }
  return { ok: true, before, after, moveAnchor };
}

/**
 * The pass an entry belongs to: from the latest page-0 anchor at or before
 * it up to the next anchor. `previous` is the entry just before the pass;
 * `isCurrent` is true for the latest pass, the one the book's page follows.
 */
export function passAround<T extends LogPoint>(
  entries: T[], // sorted by date, then page
  entryId: string,
): { pass: T[]; previous: T | null; nextAnchor: T | null; isCurrent: boolean } | null {
  const i = entries.findIndex((e) => e.id === entryId);
  if (i < 0) return null;
  let start = 0;
  for (let j = i; j >= 0; j--) {
    if (entries[j].page === 0) {
      start = j;
      break;
    }
  }
  let end = entries.length;
  for (let j = i + 1; j < entries.length; j++) {
    if (entries[j].page === 0) {
      end = j;
      break;
    }
  }
  const nextAnchor = entries[end] ?? null;
  return {
    pass: entries.slice(start, end),
    previous: entries[start - 1] ?? null,
    nextAnchor,
    isCurrent: nextAnchor === null,
  };
}

/**
 * Positions for one message, in the book's unit. A position given with the
 * value the reader typed reads as typed, when that value still saves as its
 * page: percent and time don't convert back exactly, and 5:11 shouldn't
 * come back as 5:12. Two different pages that would read the same (42% for
 * both page 173 and page 175) each get their page, so a message never says
 * 42% is before 42%.
 */
export function positionTexts(
  info: UnitInfo,
  ...points: { page: number; value?: number; capital?: boolean }[]
): string[] {
  const texts = points.map((p) =>
    p.value !== undefined && unitToPage(p.value, info) === p.page
      ? formatUnitValue(p.value, info, p)
      : formatPosition(p.page, info, p),
  );
  return texts.map((t, i) =>
    points.some((q, j) => texts[j].toLowerCase() === t.toLowerCase() && q.page !== points[i].page)
      ? `${t} (page ${points[i].page})`
      : t,
  );
}

/** A day in a sentence: "today", "yesterday" or "9 Oct 2026". */
export function describeDay(key: string, todayKey: string, format?: DateFormat): string {
  if (key === todayKey) return "today";
  if (key === shiftDayKey(todayKey, -1)) return "yesterday";
  return formatDayKey(key, format);
}

/** The same at the start of a sentence: "Today", "Yesterday", "9 Oct 2026". */
export function subjectDay(key: string, todayKey: string, format?: DateFormat): string {
  const day = describeDay(key, todayKey, format);
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** "which you logged today", "… yesterday", "… for 9 Oct 2026". */
export function loggedWhen(key: string, todayKey: string, format?: DateFormat): string {
  const day = describeDay(key, todayKey, format);
  return key === todayKey || key === shiftDayKey(todayKey, -1) ? day : `for ${day}`;
}

/**
 * The days the quick-log menu offers by name: Today, Yesterday and the two
 * days before, none before the read started. `more` says whether earlier
 * days are left for "Another day…".
 */
export function recentDays(
  todayKey: string,
  startKey: string | null,
  format?: DateFormat,
): { days: { value: string; label: string }[]; more: boolean } {
  const days: { value: string; label: string }[] = [];
  for (let back = 0; back < 4; back++) {
    const key = shiftDayKey(todayKey, -back);
    if (startKey && key < startKey) return { days, more: false };
    days.push({
      value: back === 0 ? "today" : back === 1 ? "yesterday" : key,
      label: back === 0 ? "Today" : back === 1 ? "Yesterday" : formatShortDay(key, format),
    });
  }
  return { days, more: !startKey || startKey < shiftDayKey(todayKey, -3) };
}
