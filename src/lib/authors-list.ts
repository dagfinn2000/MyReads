import { BookOwnership, ReadingStatus } from "@/lib/enums";
import { authorSortKey, type SortOptions } from "@/lib/library-sort";
import { isDoneInSeries, nextInSeries, seriesKey } from "@/lib/series";
import { foldForSearch } from "@/lib/utils";

/**
 * The Authors page: every author in the library with how much of them the
 * reader has read, what they made of it, and what of theirs is still
 * waiting. Authors are told apart exactly as the library's author filter
 * does (a book's `authors` entry, trimmed), so each card's link finds the
 * same books the card counts.
 */

export interface AuthorBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  status: ReadingStatus;
  ownership: BookOwnership;
  /** 1–10 in half-star units, or null. */
  rating: number | null;
  timesRead: number;
  pageCount: number | null;
  dateFinished: Date | null;
  seriesName: string | null;
  seriesNumber: number | null;
  upNextRank: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Where a book stands for its author's card. */
export type AuthorBookState = "read" | "reading" | "stopped" | "waiting";

export function authorBookState(b: Pick<AuthorBook, "status" | "timesRead">): AuthorBookState {
  if (b.status === ReadingStatus.READING) return "reading";
  if (b.status === ReadingStatus.READ || b.timesRead > 0) return "read";
  if (b.status === ReadingStatus.DNF) return "stopped";
  return "waiting";
}

export interface AuthorEntry<B extends AuthorBook = AuthorBook> {
  name: string;
  /** The order the card shows them in: read (in the order they were
   *  finished), being read, put down, then still to read. */
  books: B[];
  read: number;
  reading: number;
  stopped: number;
  /** Want to Read, on the shelf or wished for. */
  waiting: number;
  /** Mean of the rated books, 1–10, or null with none rated. */
  averageRating: number | null;
  rated: number;
  /** Pages of the books read, each counted once. */
  pagesRead: number;
  firstFinished: Date | null;
  lastFinished: Date | null;
  /** The book being read, if any (the one touched last). */
  current: B | null;
  /** What to read of theirs next: the reader's own Up next first, then the
   *  next number of a series of theirs, then the book that has waited
   *  longest. A book you have beats one on the wishlist. */
  next: B | null;
  /** The latest the reader did anything with them: for "Lately". */
  lastActivity: number;
}

/** Order of a card's covers: the reading story, start to finish. */
const STATE_ORDER: Record<AuthorBookState, number> = {
  read: 0,
  reading: 1,
  stopped: 2,
  waiting: 3,
};

function byStory(a: AuthorBook, b: AuthorBook): number {
  const sa = authorBookState(a);
  const sb = authorBookState(b);
  if (sa !== sb) return STATE_ORDER[sa] - STATE_ORDER[sb];
  if (sa === "read") {
    // Undated reads go first: read "some time before".
    const fa = a.dateFinished?.getTime() ?? -Infinity;
    const fb = b.dateFinished?.getTime() ?? -Infinity;
    if (fa !== fb) return fa - fb;
  }
  if (sa === "waiting") {
    const ua = a.upNextRank ?? Infinity;
    const ub = b.upNextRank ?? Infinity;
    if (ua !== ub) return ua - ub;
  }
  return a.createdAt.getTime() - b.createdAt.getTime() || a.title.localeCompare(b.title);
}

/** Owned or borrowed: a copy to hand. */
function onHand(b: AuthorBook): boolean {
  return b.ownership === BookOwnership.OWNED || b.ownership === BookOwnership.BORROWED;
}

/** What to read of an author's next (see AuthorEntry.next). */
export function nextByAuthor<B extends AuthorBook>(books: B[]): B | null {
  const waiting = books.filter(
    (b) => authorBookState(b) === "waiting" && b.ownership !== BookOwnership.GIVEN_AWAY,
  );
  if (waiting.length === 0) return null;
  const ranked = waiting
    .filter((b) => b.upNextRank !== null)
    .sort((a, b) => a.upNextRank! - b.upNextRank!);
  if (ranked[0]) return ranked[0];

  // The next number of each of their series, by the shared series rule:
  // a waiting #3 isn't next while #2 is unread.
  const series = new Map<string, B[]>();
  for (const b of books) {
    if (!b.seriesName?.trim()) continue;
    const key = seriesKey(b.seriesName);
    series.set(key, [...(series.get(key) ?? []), b]);
  }
  const seriesNext = new Set<B>();
  for (const list of series.values()) {
    const n = nextInSeries(list);
    if (n && authorBookState(n) === "waiting") seriesNext.add(n);
  }
  // A later number of a series that has a next of its own waits its turn.
  const blocked = (b: B) =>
    b.seriesName?.trim() &&
    b.seriesNumber !== null &&
    !seriesNext.has(b) &&
    nextInSeries(series.get(seriesKey(b.seriesName)) ?? []) !== null;

  const candidates = waiting.filter((b) => !blocked(b));
  const pool = candidates.length > 0 ? candidates : waiting;
  return (
    [...pool].sort(
      (a, b) =>
        Number(onHand(b)) - Number(onHand(a)) ||
        Number(seriesNext.has(b)) - Number(seriesNext.has(a)) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )[0] ?? null
  );
}

/** Every author in `books`, unsorted. A book with two authors counts for
 *  both; books with no author are left out. */
export function buildAuthorList<B extends AuthorBook>(books: B[]): AuthorEntry<B>[] {
  const groups = new Map<string, B[]>();
  for (const b of books) {
    // A name listed twice on one book counts once.
    for (const raw of new Set(b.authors.map((a) => a.trim()))) {
      if (!raw) continue;
      const list = groups.get(raw);
      if (list) list.push(b);
      else groups.set(raw, [b]);
    }
  }

  return [...groups.entries()].map(([name, list]) => {
    const ordered = [...list].sort(byStory);
    let read = 0;
    let reading = 0;
    let stopped = 0;
    let waiting = 0;
    let ratingSum = 0;
    let rated = 0;
    let pagesRead = 0;
    let first: Date | null = null;
    let last: Date | null = null;
    let current: B | null = null;
    let lastActivity = 0;
    for (const b of ordered) {
      const state = authorBookState(b);
      if (state === "read") read++;
      else if (state === "reading") reading++;
      else if (state === "stopped") stopped++;
      else waiting++;
      if (state === "reading" && (!current || b.updatedAt > current.updatedAt)) current = b;
      if (b.rating !== null && b.rating > 0) {
        ratingSum += b.rating;
        rated++;
      }
      if (isDoneInSeries(b) && b.status !== ReadingStatus.DNF) pagesRead += b.pageCount ?? 0;
      if (b.dateFinished) {
        if (!first || b.dateFinished < first) first = b.dateFinished;
        if (!last || b.dateFinished > last) last = b.dateFinished;
      }
      const touched =
        state === "reading" ? b.updatedAt.getTime() : (b.dateFinished?.getTime() ?? 0);
      if (touched > lastActivity) lastActivity = touched;
    }
    return {
      name,
      books: ordered,
      read,
      reading,
      stopped,
      waiting,
      averageRating: rated > 0 ? ratingSum / rated : null,
      rated,
      pagesRead,
      firstFinished: first,
      lastFinished: last,
      current,
      next: nextByAuthor(ordered),
      lastActivity,
    };
  });
}

export const AUTHOR_SORTS = ["most", "name", "rating", "recent"] as const;
export type AuthorSort = (typeof AUTHOR_SORTS)[number];

export const AUTHOR_SORT_LABELS: Record<AuthorSort, string> = {
  most: "Most read",
  name: "A to Z",
  rating: "Best rated",
  recent: "Lately",
};

export const AUTHOR_SHOW = ["all", "waiting", "unread"] as const;
export type AuthorShow = (typeof AUTHOR_SHOW)[number];

export const AUTHOR_SHOW_LABELS: Record<AuthorShow, string> = {
  all: "All",
  waiting: "Books waiting",
  unread: "Not read yet",
};

function pickParam<T extends string>(
  options: readonly T[],
  raw: string | string[] | undefined,
  fallback: T,
): T {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (options as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

export function parseAuthorSort(raw: string | string[] | undefined): AuthorSort {
  return pickParam(AUTHOR_SORTS, raw, "most");
}

export function parseAuthorShow(raw: string | string[] | undefined): AuthorShow {
  return pickParam(AUTHOR_SHOW, raw, "all");
}

/** Whether an author belongs under a tab. "Books waiting" is anyone with a
 *  book still to read (or being read); "Not read yet", anyone none of
 *  whose books has been finished. */
export function inAuthorTab(a: AuthorEntry, show: AuthorShow): boolean {
  if (show === "waiting") return a.waiting > 0 || a.reading > 0;
  if (show === "unread") return a.read === 0;
  return true;
}

/** Authors whose name has every word of `query` in it, accents and case
 *  aside ("le guin" finds Ursula K. Le Guin). */
export function matchesAuthorQuery(name: string, query: string): boolean {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const folded = foldForSearch(name);
  return words.every((w) => folded.includes(w));
}

/**
 * The authors a tab shows, in the chosen order. Ties go to the name, filed
 * the library's way (surname first, unless the reader sorts names as
 * written). "Best rated" puts authors with no rated book last, and among
 * equal averages the one rated more often first.
 */
export function sortAuthors<B extends AuthorBook>(
  list: AuthorEntry<B>[],
  sort: AuthorSort,
  opts: SortOptions = {},
): AuthorEntry<B>[] {
  const collator = new Intl.Collator(opts.alphabet);
  const keys = new Map(list.map((a) => [a, authorSortKey(a.name, opts)]));
  const byName = (a: AuthorEntry<B>, b: AuthorEntry<B>) =>
    collator.compare(keys.get(a)!, keys.get(b)!);
  const compare: Record<AuthorSort, (a: AuthorEntry<B>, b: AuthorEntry<B>) => number> = {
    most: (a, b) =>
      b.read - a.read || b.books.length - a.books.length || byName(a, b),
    name: byName,
    rating: (a, b) =>
      (b.averageRating ?? -1) - (a.averageRating ?? -1) || b.rated - a.rated || byName(a, b),
    recent: (a, b) => b.lastActivity - a.lastActivity || byName(a, b),
  };
  return [...list].sort(compare[sort]);
}

/** The id of an author's card on the Authors page, for links from the
 *  library's author headings: "/authors#author-ursula-k-le-guin-1x2y3z".
 *  Built like seriesAnchor: a readable slug and a hash of the exact name,
 *  so names made only of symbols, or differing only in case, never share
 *  an id. */
export function authorAnchor(name: string): string {
  const trimmed = name.trim();
  const slug = foldForSearch(trimmed)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  let hash = 0x811c9dc5;
  for (const ch of trimmed) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `author-${slug ? `${slug}-` : ""}${hash.toString(36)}`;
}

/** How many authors the page draws at first; "Show all" draws the rest. A
 *  big library can have a thousand, each with a row of covers. */
export const AUTHORS_PAGE_SIZE = 60;
