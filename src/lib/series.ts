import { ReadingStatus } from "@prisma/client";

/**
 * Which book of a series comes next. Shared by the library's series
 * headings and Pick for me, so "next #4" and the pick never disagree.
 */

export interface SeriesMember {
  seriesNumber: number | null;
  status: ReadingStatus;
  /** Finished passes before the current one (see reading-state.ts). */
  timesRead: number;
}

/** Series names compared the way the series filter does: case-insensitive,
 *  ignoring stray spaces. */
export function seriesKey(name: string): string {
  return name.normalize("NFC").trim().toLowerCase();
}

/** Read at least once, or put down for good. Either way, not what's next. */
export function isDoneInSeries(b: Pick<SeriesMember, "status" | "timesRead">): boolean {
  return b.status === ReadingStatus.READ || b.status === ReadingStatus.DNF || b.timesRead > 0;
}

/**
 * The next book in one series: the lowest-numbered one not done yet, whether
 * it's being read or waiting on Want to Read. A number counts as done when
 * any copy of it is done (two editions of #1, one read). Books without a
 * number are never "next". Null when every numbered book is done.
 */
export function nextInSeries<T extends SeriesMember>(books: T[]): T | null {
  const done = new Set(
    books.filter((b) => b.seriesNumber !== null && isDoneInSeries(b)).map((b) => b.seriesNumber),
  );
  let next: T | null = null;
  for (const b of books) {
    if (b.seriesNumber === null || done.has(b.seriesNumber) || isDoneInSeries(b)) continue;
    if (next === null || b.seriesNumber < next.seriesNumber!) next = b;
  }
  return next;
}

/**
 * Whether `book` may be picked when only the next book in a series counts:
 * true unless an earlier number in the same series isn't done yet. `series`
 * is every book of its series (it may include `book` itself).
 */
export function isNextInSeries<T extends SeriesMember>(book: T, series: T[]): boolean {
  if (book.seriesNumber === null || isDoneInSeries(book)) return true;
  const next = nextInSeries([...series, book]);
  return next === null || next.seriesNumber! >= book.seriesNumber;
}
