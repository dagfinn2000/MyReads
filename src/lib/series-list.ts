import { ReadingStatus } from "@/lib/enums";
import { seriesProgress, type SeriesProgress } from "@/lib/library-sort";
import { isDoneInSeries, nextInSeries, seriesKey, type SeriesMember } from "@/lib/series";

/**
 * The Series page: every series in the library with how far through it the
 * reader is, the gaps in its numbers, and the book that comes next. Built
 * on the same rules as the library's series headings (library-sort.ts) and
 * Pick for me (series.ts), so the three always agree on "next".
 */

export interface SeriesBook extends SeriesMember {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  seriesName: string | null;
  /** When it was last finished, or null. */
  dateFinished: Date | null;
  updatedAt: Date;
}

export type SeriesState = "underway" | "unstarted" | "finished";

/** The id of a series' card on the Series page, for links from the library
 *  and book pages: "/series#series-the-expanse". */
export function seriesAnchor(name: string): string {
  return `series-${seriesKey(name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}`;
}

export const SERIES_SHOW = ["all", "underway", "unstarted", "finished"] as const;
export type SeriesShow = (typeof SERIES_SHOW)[number];

export const SERIES_SHOW_LABELS: Record<SeriesShow, string> = {
  all: "All",
  underway: "Under way",
  unstarted: "Not started",
  finished: "Finished",
};

/** One place in a series as the page draws it: a book, or a number the
 *  library has no book for. */
export type SeriesSlot<B> =
  | { kind: "book"; book: B; next: boolean }
  | { kind: "gap"; number: number };

export interface SeriesEntry<B extends SeriesBook = SeriesBook> {
  key: string;
  /** As most of its books spell it. */
  name: string;
  /** First authors, most books first. */
  authors: string[];
  /** In series order: numbered books first, then the rest by title. */
  books: B[];
  progress: SeriesProgress;
  state: SeriesState;
  /** What to read next by the shared rule: the lowest unread number. */
  next: B | null;
  /** Books and the gaps between them, in order. Gaps after the highest
   *  number aren't known, so they never show. */
  slots: SeriesSlot<B>[];
  /** The latest the reader did anything with it: for ordering. */
  lastActivity: number;
}

function mostCommon(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/** Series order: by number, unnumbered books last by title. */
function bySeriesOrder(a: SeriesBook, b: SeriesBook): number {
  if (a.seriesNumber !== null && b.seriesNumber !== null && a.seriesNumber !== b.seriesNumber) {
    return a.seriesNumber - b.seriesNumber;
  }
  if (a.seriesNumber === null && b.seriesNumber !== null) return 1;
  if (a.seriesNumber !== null && b.seriesNumber === null) return -1;
  return a.title.localeCompare(b.title);
}

/** Finished when every book of it in the library is read (or put down for
 *  good); under way once any is read or being read; otherwise not started.
 *  A number the library has no book for doesn't hold "finished" back: the
 *  reader may well have read it somewhere else. */
export function seriesState(books: SeriesMember[]): SeriesState {
  if (books.length > 0 && books.every(isDoneInSeries)) return "finished";
  return books.some((b) => isDoneInSeries(b) || b.status === ReadingStatus.READING)
    ? "underway"
    : "unstarted";
}

/** Every series in `books` (books without a series name are skipped). */
export function buildSeriesList<B extends SeriesBook>(books: B[]): SeriesEntry<B>[] {
  const groups = new Map<string, B[]>();
  for (const b of books) {
    if (!b.seriesName?.trim()) continue;
    const key = seriesKey(b.seriesName);
    const list = groups.get(key);
    if (list) list.push(b);
    else groups.set(key, [b]);
  }

  return [...groups.entries()].map(([key, list]) => {
    const ordered = [...list].sort(bySeriesOrder);
    const progress = seriesProgress(ordered);
    const next = nextInSeries(ordered);
    const gaps = new Set(progress.missing);
    const slots: SeriesSlot<B>[] = [];
    let gapFrom = 1;
    const pushGapsBelow = (n: number) => {
      for (; gapFrom < n; gapFrom++) if (gaps.has(gapFrom)) slots.push({ kind: "gap", number: gapFrom });
    };
    for (const b of ordered) {
      if (b.seriesNumber !== null) pushGapsBelow(Math.ceil(b.seriesNumber));
      // Like the library's headings: while one is being read, that's the
      // one to show, not a "next" beside it.
      slots.push({ kind: "book", book: b, next: b === next && progress.reading === null });
    }
    const lastActivity = Math.max(
      0,
      ...ordered.map((b) =>
        b.status === ReadingStatus.READING
          ? b.updatedAt.getTime()
          : (b.dateFinished?.getTime() ?? 0),
      ),
    );
    return {
      key,
      name: mostCommon(ordered.map((b) => b.seriesName!.trim()))[0],
      authors: mostCommon(ordered.flatMap((b) => (b.authors[0] ? [b.authors[0]] : []))),
      books: ordered,
      progress,
      state: seriesState(ordered),
      next,
      slots,
      lastActivity,
    };
  });
}

/**
 * The series a tab shows, in the order it shows them: series under way
 * first, the most recently read first; then those not started and those
 * finished, by name.
 */
export function showSeries<B extends SeriesBook>(
  list: SeriesEntry<B>[],
  show: SeriesShow,
  compare: (a: string, b: string) => number = (a, b) => a.localeCompare(b),
): SeriesEntry<B>[] {
  const rank: Record<SeriesState, number> = { underway: 0, unstarted: 1, finished: 2 };
  return list
    .filter((s) => show === "all" || s.state === show)
    .sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        (a.state === "underway" ? b.lastActivity - a.lastActivity : 0) ||
        compare(a.name, b.name),
    );
}

/** The tab in the address, or All. */
export function parseSeriesShow(raw: string | string[] | undefined): SeriesShow {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (SERIES_SHOW as readonly string[]).includes(value ?? "") ? (value as SeriesShow) : "all";
}
