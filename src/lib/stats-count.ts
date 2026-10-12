import type { BookFormat, ReadingStatus } from "@prisma/client";
import { calendarDay, dayKey } from "@/lib/dates";
import { markRereads } from "@/lib/goals";
import type { Preferences } from "@/lib/preferences";
import type { DayWindow } from "@/lib/stats-period";

/**
 * What counts toward Books read, Pages read and the reading goal: the one
 * place the "What counts" preferences are applied, so the stats cards, the
 * goal and the year in review can't disagree.
 *
 * Every time through a book is a pass. Finished passes are the archived
 * reads plus the current one on a Read book; a book you stopped reading has
 * a stopped pass; anything on the go (or back on the shelf with old log
 * entries) has an open pass, which only ever adds logged pages. A pass is
 * counted in a window of days by when it ended, or, for "Pages I logged",
 * by the days its pages were logged.
 */

export type CountRules = Pick<
  Preferences,
  "statsPagesRead" | "statsStoppedBooks" | "statsAudiobooks"
>;

/** The book fields counting needs. Callers can pass more; they come back
 *  on each pass. */
export interface CountBook {
  id: string;
  status: ReadingStatus;
  format: BookFormat;
  pageCount: number | null;
  currentPage: number | null;
  dateStarted: Date | null;
  dateFinished: Date | null;
  rating: number | null;
}

/** An archived pass from the read history. */
export interface CountRead {
  bookId: string;
  dateStarted: Date | null;
  dateFinished: Date | null;
  rating: number | null;
}

/** Pages logged in one book on one day (see lib/stats-query.ts). */
export interface BookDayPages {
  bookId: string;
  /** "2026-05-12", in the reader's zone. */
  day: string;
  pages: number;
  /** Logged in the book's current pass, on or after its start, rather than
   *  in an earlier one. */
  current: boolean;
}

export interface StatsInputs<B extends CountBook = CountBook> {
  books: B[];
  /** Oldest first. */
  reads: CountRead[];
  logDays: BookDayPages[];
  /** The latest log entry of each book you stopped reading, which dates the
   *  stop when no date was given. */
  lastLogDates: ReadonlyMap<string, Date>;
}

export interface DayPages {
  day: string;
  pages: number;
}

export interface Pass<B extends CountBook = CountBook> {
  book: B;
  kind: "finished" | "stopped" | "open";
  /** When the pass ended: the finish date, or when a stopped book was put
   *  down. Null when that isn't known; such a pass counts in all time only. */
  date: Date | null;
  /** `date` as a day key in the reader's zone. */
  day: string | null;
  dateStarted: Date | null;
  /** The book had been finished before this pass. */
  isReread: boolean;
  rating: number | null;
  /** Counts toward Books read when it ends. */
  countsAsBook: boolean;
  /** Pages it adds when it ends: the whole book, or where a stopped book
   *  was put down. */
  wholePages: number;
  /** Pages logged during this pass, by day. */
  logged: DayPages[];
}

/** A pass counted in a window: what it adds there. */
export interface Counted<B extends CountBook = CountBook> {
  pass: Pass<B>;
  isReread: boolean;
  books: number;
  pages: number;
}

interface Draft {
  kind: Pass["kind"];
  date: Date | null;
  day: string | null;
  dateStarted: Date | null;
  startDay: string | null;
  rating: number | null;
  isReread: boolean;
  logged: DayPages[];
}

function groupBy<T>(list: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const group = map.get(k);
    if (group) group.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * The archived pass that pages logged on `day` (before the current pass
 * began) belong to: the earliest finish on or after that day whose start
 * isn't after it, else an undated pass that could hold it (the most recent),
 * else the latest finish before it. Bounding by each pass's start keeps an
 * undated pass's pages from landing on a later dated one, where the undated
 * pass would then look unlogged and add its whole page count a second time.
 */
function archivedPassFor(archived: Draft[], day: string): Draft | null {
  const fits = archived.filter(
    (p) => (p.startDay === null || p.startDay <= day) && (p.day === null || day <= p.day),
  );
  const dated = fits
    .filter((p) => p.day !== null)
    .sort((a, b) => (a.day! < b.day! ? -1 : a.day! > b.day! ? 1 : 0));
  if (dated.length > 0) return dated[0];
  const undated = fits.filter((p) => p.day === null);
  if (undated.length > 0) return undated[undated.length - 1];
  const earlier = archived
    .filter((p) => p.day !== null && p.day < day)
    .sort((a, b) => (a.day! < b.day! ? -1 : a.day! > b.day! ? 1 : 0));
  if (earlier.length > 0) return earlier[earlier.length - 1];
  return archived[archived.length - 1] ?? null;
}

/** Every pass through every book, with the rules applied: audiobooks left
 *  out or stripped of pages, stopped books dropped or counted as books. */
export function buildPasses<B extends CountBook>(
  { books, reads, logDays, lastLogDates }: StatsInputs<B>,
  rules: CountRules,
  timeZone: string,
): Pass<B>[] {
  const readsByBook = groupBy(reads, (r) => r.bookId);
  const logByBook = groupBy(logDays, (r) => r.bookId);
  const day = (d: Date | null) => (d ? calendarDay(d, timeZone) : null);
  const passes: Pass<B>[] = [];

  for (const book of books) {
    const audiobook = book.format === "AUDIOBOOK";
    if (audiobook && rules.statsAudiobooks === "out") continue;

    const archived: Draft[] = (readsByBook.get(book.id) ?? []).map((r) => ({
      kind: "finished",
      date: r.dateFinished,
      day: day(r.dateFinished),
      dateStarted: r.dateStarted,
      startDay: day(r.dateStarted),
      // A pass without its own rating falls back to the book's rating.
      rating: r.rating ?? book.rating,
      isReread: false,
      logged: [],
    }));

    // A stopped book is dated by its finish date when one was given, else
    // by its last log entry.
    const lastLog = book.status === "DNF" ? (lastLogDates.get(book.id) ?? null) : null;
    const current: Draft = {
      kind: book.status === "READ" ? "finished" : book.status === "DNF" ? "stopped" : "open",
      date:
        book.status === "READ" || book.status === "DNF" ? (book.dateFinished ?? lastLog) : null,
      day:
        book.status === "READ" || book.status === "DNF"
          ? (day(book.dateFinished) ?? (lastLog ? dayKey(lastLog, timeZone) : null))
          : null,
      dateStarted: book.dateStarted,
      startDay: day(book.dateStarted),
      rating: book.rating,
      isReread: false,
      logged: [],
    };

    // Re-reads: dated finishes by the existing rule (an undated past read
    // is presumed to come first). The first undated archived pass is the
    // first read; any pass after an archived one is a re-read.
    const dated = [...archived, current].filter((p) => p.kind === "finished" && p.date);
    const hasUndated = archived.some((p) => !p.date);
    for (const m of markRereads(
      dated.map((p) => ({ bookId: book.id, dateFinished: p.date!, p })),
      hasUndated ? new Set([book.id]) : new Set<string>(),
    )) {
      m.p.isReread = m.isReread;
    }
    archived
      .filter((p) => !p.date)
      .forEach((p, i) => {
        p.isReread = i > 0;
      });
    if (!current.date || current.kind !== "finished") current.isReread = archived.length > 0;

    for (const row of logByBook.get(book.id) ?? []) {
      const pass = row.current ? current : (archivedPassFor(archived, row.day) ?? current);
      pass.logged.push({ day: row.day, pages: row.pages });
    }

    const noPages = audiobook && rules.statsAudiobooks === "books";
    for (const p of [...archived, current]) {
      if (p.kind === "stopped" && rules.statsStoppedBooks === "none") continue;
      let wholePages = 0;
      if (p.kind === "finished") wholePages = book.pageCount ?? 0;
      if (p.kind === "stopped") {
        const logged = p.logged.reduce((sum, l) => sum + l.pages, 0);
        wholePages = Math.min(book.currentPage ?? logged, book.pageCount ?? Infinity);
      }
      passes.push({
        book,
        kind: p.kind,
        date: p.date,
        day: p.day,
        dateStarted: p.dateStarted,
        isReread: p.isReread,
        rating: p.rating,
        countsAsBook:
          p.kind === "finished" || (p.kind === "stopped" && rules.statsStoppedBooks === "book"),
        wholePages: noPages ? 0 : wholePages,
        logged: noPages ? [] : p.logged,
      });
    }
  }
  return passes;
}

/** Whether a day falls in a window. An unknown day is in all time only. */
export function inWindow(day: string | null, window: DayWindow): boolean {
  if (day === null) return window.from === null && window.to === null;
  return (window.from === null || day >= window.from) && (window.to === null || day <= window.to);
}

/**
 * What each pass adds in a window. A pass adds a book when it ends there.
 * Pages are the whole book when it ends there, or with "Pages I logged" the
 * pages logged on days in the window, plus the whole book for a pass that
 * ends there with nothing logged (a book finished without logging still
 * adds its page count). Passes adding nothing are left out.
 */
export function countWindow<B extends CountBook>(
  passes: Pass<B>[],
  window: DayWindow,
  rules: Pick<CountRules, "statsPagesRead">,
): Counted<B>[] {
  const counted: Counted<B>[] = [];
  for (const pass of passes) {
    const endsHere = pass.kind !== "open" && inWindow(pass.day, window);
    const books = endsHere && pass.countsAsBook ? 1 : 0;
    let pages = 0;
    if (rules.statsPagesRead === "logged") {
      for (const l of pass.logged) if (inWindow(l.day, window)) pages += l.pages;
      if (endsHere && pass.logged.length === 0) pages += pass.wholePages;
    } else if (endsHere) {
      pages = pass.wholePages;
    }
    if (books > 0 || pages > 0) counted.push({ pass, isReread: pass.isReread, books, pages });
  }
  return counted;
}

/** Totals for a window's counted passes. */
export function tally(items: Counted[]): {
  books: number;
  pages: number;
  /** Finished re-reads among the books. */
  rereads: number;
  /** Stopped books counted as books. */
  putDown: number;
} {
  let books = 0;
  let pages = 0;
  let rereads = 0;
  let putDown = 0;
  for (const i of items) {
    books += i.books;
    pages += i.pages;
    if (i.books > 0 && i.pass.kind === "finished" && i.isReread) rereads++;
    if (i.books > 0 && i.pass.kind === "stopped") putDown++;
  }
  return { books, pages, rereads, putDown };
}

/** All-time Books read: books on the Read shelf (each once, however many
 *  times read), plus stopped books when they count as books. */
export function booksReadAllTime(
  books: Pick<CountBook, "status" | "format">[],
  rules: Pick<CountRules, "statsStoppedBooks" | "statsAudiobooks">,
): { books: number; putDown: number } {
  let read = 0;
  let putDown = 0;
  for (const b of books) {
    if (rules.statsAudiobooks === "out" && b.format === "AUDIOBOOK") continue;
    if (b.status === "READ") read++;
    if (b.status === "DNF" && rules.statsStoppedBooks === "book") putDown++;
  }
  return { books: read + putDown, putDown };
}

/**
 * Which rules are on, for the stat cards: a suffix for the Pages read label
 * and small notes under the numbers ("includes 2 re-reads").
 */
export function ruleNotes(
  rules: CountRules,
  counts: { rereads?: number; putDown?: number } = {},
  fmt: (n: number) => string = String,
): { pagesSuffix: string; pages: string[]; books: string[] } {
  const pages: string[] = [];
  if (rules.statsPagesRead === "finished") pages.push("whole books when finished");
  if (rules.statsStoppedBooks !== "none") pages.push("includes pages of books you stopped");
  if (rules.statsAudiobooks === "books") pages.push("no audiobook pages");
  if (rules.statsAudiobooks === "out") pages.push("audiobooks left out");

  const books: string[] = [];
  const { rereads = 0, putDown = 0 } = counts;
  if (rereads > 0) books.push(`includes ${fmt(rereads)} ${rereads === 1 ? "re-read" : "re-reads"}`);
  if (putDown > 0) books.push(`includes ${fmt(putDown)} put down`);
  if (rules.statsAudiobooks === "out") books.push("audiobooks left out");

  return {
    pagesSuffix: rules.statsPagesRead === "logged" ? " · as logged" : "",
    pages,
    books,
  };
}

/** The goal card's footnote on what a pages goal counts. */
export function goalRuleLine(rules: Pick<CountRules, "statsPagesRead">): string {
  return rules.statsPagesRead === "logged"
    ? "A pages goal counts the pages you log, plus whole books you finish without logging."
    : "A pages goal adds up the page counts of the books you finish.";
}
