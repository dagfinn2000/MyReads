import { ReadingStatus } from "@/lib/enums";
import { isDoneInSeries, nextInSeries, seriesKey, type SeriesMember } from "@/lib/series";

export interface UpNextBook extends SeriesMember {
  seriesName: string | null;
}

/**
 * The Want to Read books for the "Up next" strip on Now reading, at most
 * `limit`. The next book of a series already under way comes first, then
 * the rest in the order given (newest first). A numbered book that isn't
 * its series' next one (an earlier number is still unread, or another copy
 * of the same number is read) is left out.
 *
 * Books being read count as under way here: while you're reading #2, #3 is
 * what comes next. That's the one difference from the series rule in
 * lib/series.ts, which treats a book being read as the next one itself.
 */
export function upNext<T extends UpNextBook>(
  wantToRead: T[],
  /** Every book in the library with a series name. */
  seriesBooks: UpNextBook[],
  limit: number,
): T[] {
  const bySeries = new Map<string, UpNextBook[]>();
  for (const b of seriesBooks) {
    if (!b.seriesName) continue;
    const key = seriesKey(b.seriesName);
    const member = b.status === ReadingStatus.READING ? { ...b, status: ReadingStatus.READ } : b;
    const list = bySeries.get(key);
    if (list) list.push(member);
    else bySeries.set(key, [member]);
  }

  const underway: T[] = [];
  const rest: T[] = [];
  for (const book of wantToRead) {
    if (book.seriesName == null || book.seriesNumber === null) {
      rest.push(book);
      continue;
    }
    const series = bySeries.get(seriesKey(book.seriesName)) ?? [];
    if (nextInSeries([...series, book])?.seriesNumber !== book.seriesNumber) continue;
    if (series.some(isDoneInSeries)) underway.push(book);
    else rest.push(book);
  }
  return [...underway, ...rest].slice(0, limit);
}

/**
 * Up next with the reader's own list: their picks first, in the order they
 * put them in (whatever the series say: a pick is a decision), then
 * suggestions from upNext() to fill the strip up to `limit`. Every pick is
 * shown even past the limit.
 */
export function upNextWithPicks<T extends UpNextBook & { upNextRank: number | null; title: string }>(
  wantToRead: T[],
  seriesBooks: UpNextBook[],
  limit: number,
): { picks: T[]; suggested: T[] } {
  const picks = wantToRead
    .filter((b) => b.upNextRank !== null)
    .sort((a, b) => a.upNextRank! - b.upNextRank! || a.title.localeCompare(b.title));
  const rest = wantToRead.filter((b) => b.upNextRank === null);
  return { picks, suggested: upNext(rest, seriesBooks, Math.max(limit - picks.length, 0)) };
}
