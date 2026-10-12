/**
 * Sorting and grouping for the library page. Pure functions over a minimal
 * book shape, kept out of the page component so the shelf-filing rules —
 * surname sorting, series blocks — are unit-testable.
 */

import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { calendarDay } from "@/lib/dates";
import { FORMAT_LABELS, OWNERSHIP_LABELS, STATUS_LABELS } from "@/lib/display";
import type { RatingStyle } from "@/lib/preferences";
import { nextInSeries, seriesKey, type SeriesMember } from "@/lib/series";

/** The fields the sorts read; the page's Prisma select satisfies this
 *  structurally. */
export interface SortableBook {
  title: string;
  authors: string[];
  rating: number | null;
  seriesName: string | null;
  seriesNumber: number | null;
  dateFinished: Date | null;
  dateStarted: Date | null;
  pageCount: number | null;
  /** As the catalogue gave it: "1999", "2003-07", "c. 1950". */
  publishedDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The fields the groupings read on top of those. */
export interface GroupableBook extends SortableBook {
  status: ReadingStatus;
  format: BookFormat;
  ownership: BookOwnership;
  tags: string[];
  /** The shelves the book is on. Only needed to group by shelf. */
  shelves?: { id: string; name: string }[];
}

export interface BookGroup<T> {
  /** Stable and unique among the groups, for React keys. */
  key: string;
  title: string;
  books: T[];
  /** Replaces the plain count next to the title ("5 books · 3 read"). */
  detail?: string;
  /** A warning after it ("#3 missing"). */
  note?: string;
}

/** The reader's sorting rules (Preferences). Everything optional: leaving
 *  them out sorts the way MyReads always has. */
export interface SortOptions {
  /** File "The Hobbit" under H. */
  ignoreArticles?: boolean;
  /** "surname" files Le Guin under L; "as-written" sorts names as typed. */
  authorOrder?: "surname" | "as-written";
  /** Locale whose alphabet decides letter order — "nb" puts Æ, Ø, Å after
   *  Z. Default: the runtime's own. */
  alphabet?: string;
  /** Which year a finish falls in (group by year finished). */
  timeZone?: string;
  /** How rating sections are worded (group by rating). */
  ratingStyle?: RatingStyle;
  /** Shelf ids in the reader's order (group by shelf); the rest by name. */
  shelfOrder?: readonly string[];
}

/** Leading articles skipped by `ignoreArticles`: English always (most
 *  libraries hold English titles whatever the alphabet), plus those of the
 *  chosen alphabet's language. */
const ARTICLES: Record<string, string[]> = {
  en: ["the", "a", "an"],
  nb: ["den", "det", "de", "en", "et", "ei"],
  da: ["den", "det", "de", "en", "et"],
  sv: ["den", "det", "de", "en", "ett"],
  de: ["der", "die", "das", "ein", "eine"],
};

/** A title as the shelf files it: "The Hobbit" → "Hobbit". A lone article
 *  ("It", "A") is a whole title and stays. */
export function titleSortKey(title: string, opts: SortOptions = {}): string {
  const trimmed = title.trim();
  if (!opts.ignoreArticles) return trimmed;
  const articles = new Set([...ARTICLES.en, ...(ARTICLES[opts.alphabet ?? ""] ?? [])]);
  const match = /^(\S+)\s+(.+)$/.exec(trimmed);
  if (match && articles.has(match[1].toLowerCase())) return match[2];
  return trimmed;
}

/** Surname particles that travel with the last name: "Le Guin" sorts under
 *  L, "van der Berg" under V. (Anglo-American shelving convention — Dutch
 *  libraries would file "van" under the bare surname instead.) */
const SURNAME_PARTICLES = new Set([
  "da", "de", "del", "della", "den", "der", "di", "du", "la", "le",
  "mac", "mc", "st", "st.", "ten", "ter", "van", "von",
]);

/** Name suffixes that never lead a sort key. */
const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);

/**
 * "Ursula K. Le Guin" → "le guin ursula k." — authors sort the way a
 * bookshelf files them: by surname (particles included), then given names,
 * suffixes last. Single-word names (Homer) are their own key.
 */
export function authorSortKey(name: string, opts: SortOptions = {}): string {
  if (opts.authorOrder === "as-written") return name.trim().toLowerCase();
  const words = name.trim().toLowerCase().split(/\s+/);
  const suffixes: string[] = [];
  while (words.length > 1 && NAME_SUFFIXES.has(words[words.length - 1])) {
    suffixes.unshift(words.pop()!);
  }
  let start = words.length - 1;
  while (start > 0 && SURNAME_PARTICLES.has(words[start - 1])) start--;
  return [...words.slice(start), ...words.slice(0, start), ...suffixes].join(" ");
}

/** String comparison for the chosen alphabet. Intl.Collator rather than
 *  localeCompare so one collator serves a whole sort. */
function comparer(opts: SortOptions): (a: string, b: string) => number {
  return new Intl.Collator(opts.alphabet).compare;
}

/** The year in a published date: the first run of four digits, so
 *  "2003-07" is 2003 and "c. 1999" is 1999. Null when there is none. */
export function publishedYear(s: string | null | undefined): number | null {
  const m = /\d{4}/.exec(s ?? "");
  return m ? Number(m[0]) : null;
}

/** Shelf order within one author: series entries stay together (a series
 *  sorts as a block by its name, standalones slot in by title), ordered by
 *  series number inside the block — Mistborn #1 right before Mistborn #2. */
function seriesShelfOrder(
  a: SortableBook,
  b: SortableBook,
  opts: SortOptions,
  compare: (a: string, b: string) => number,
): number {
  return (
    compare(
      titleSortKey(a.seriesName ?? a.title, opts),
      titleSortKey(b.seriesName ?? b.title, opts),
    ) ||
    (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
    compare(titleSortKey(a.title, opts), titleSortKey(b.title, opts))
  );
}

/** Each sort's value for one book; null is "no value", which always sorts
 *  last. A rating, page count or date of 0 means not filled in. */
const SORT_VALUES: Record<string, (b: SortableBook, opts: SortOptions) => string | number | null> = {
  createdAt: (b) => b.createdAt.getTime(),
  title: (b, opts) => titleSortKey(b.title, opts),
  rating: (b) => b.rating || null,
  dateFinished: (b) => b.dateFinished?.getTime() ?? null,
  dateStarted: (b) => b.dateStarted?.getTime() ?? null,
  pageCount: (b) => b.pageCount || null,
  published: (b) => publishedYear(b.publishedDate),
  updatedAt: (b) => b.updatedAt.getTime(),
};

/** In-memory sort — a personal library is small enough that sorting after
 *  the filtered fetch is simpler than fighting Prisma over array columns
 *  (author sort) and nulls-last semantics.
 *
 *  Books without a value (unrated, unfinished, no page count) come last
 *  whichever way round, and ties go by author, then title, A to Z. */
export function sortBooks<T extends SortableBook>(
  books: T[],
  sort: string,
  dir: string,
  opts: SortOptions = {},
): T[] {
  const mul = dir === "asc" ? 1 : -1;
  const compare = comparer(opts);
  // Each key worked out once per book, not once per comparison.
  const author = new Map(
    books.map((b) => [b, b.authors[0] ? authorSortKey(b.authors[0], opts) : null]),
  );
  /** Nulls last, else `cmp` (already signed). */
  const nullsLast = <V>(a: V | null, b: V | null, cmp: (a: V, b: V) => number) =>
    a === null ? (b === null ? 0 : 1) : b === null ? -1 : cmp(a, b);

  // Author sort: `dir` flips the author order only; within an author, books
  // keep shelf order (series grouped, in series order) in both directions.
  if (sort === "author") {
    return [...books].sort(
      (a, b) =>
        nullsLast(author.get(a)!, author.get(b)!, (x, y) => mul * compare(x, y)) ||
        seriesShelfOrder(a, b, opts, compare),
    );
  }

  const valueOf = Object.hasOwn(SORT_VALUES, sort) ? SORT_VALUES[sort] : SORT_VALUES.createdAt;
  const value = new Map(books.map((b) => [b, valueOf(b, opts)]));
  const title = new Map(books.map((b) => [b, titleSortKey(b.title, opts)]));
  const byValue = (x: string | number, y: string | number) =>
    mul *
    (typeof x === "string" && typeof y === "string" ? compare(x, y) : (x as number) - (y as number));
  return [...books].sort(
    (a, b) =>
      nullsLast(value.get(a)!, value.get(b)!, byValue) ||
      nullsLast(author.get(a)!, author.get(b)!, compare) ||
      compare(title.get(a)!, title.get(b)!),
  );
}

/** A stored rating (1–10) the way the reader sees it: "4½ stars", "9/10". */
export function ratingLabel(value: number, style: RatingStyle = "half"): string {
  if (style === "ten" || style === "off") return `${value}/10`;
  const whole = Math.floor(value / 2);
  const stars = `${whole || ""}${value % 2 ? "½" : ""}`;
  return `${stars} ${value <= 2 ? "star" : "stars"}`;
}

/** Status sections in reading order: what's on the go first. */
const STATUS_ORDER: ReadingStatus[] = [
  ReadingStatus.READING,
  ReadingStatus.WANT_TO_READ,
  ReadingStatus.READ,
  ReadingStatus.DNF,
];

/** Ownership sections: the books you have, then the rest. */
const OWNERSHIP_ORDER: BookOwnership[] = [
  BookOwnership.OWNED,
  BookOwnership.BORROWED,
  BookOwnership.WISHLIST,
  BookOwnership.GIVEN_AWAY,
];

/** Books filed into sections in a fixed order, keyed `prefix:value`. Empty
 *  sections are dropped; books keep their incoming (sorted) order. */
function fixedSections<T, V extends string>(
  books: T[],
  prefix: string,
  order: readonly V[],
  valueOf: (b: T) => V,
  label: (v: V) => string,
): BookGroup<T>[] {
  return order
    .map((v) => ({
      key: `${prefix}:${v}`,
      title: label(v),
      books: books.filter((b) => valueOf(b) === v),
    }))
    .filter((g) => g.books.length > 0);
}

/** Sections for the group-by views. Books keep the order they came in
 *  (the chosen sort) inside each section, except series, which are in
 *  series order. Sections without a value ("Not in a series", "No tags")
 *  come last. Tag and shelf sections can hold the same book more than once
 *  over: a book with three tags is under each. */
export function groupBooks<T extends GroupableBook>(
  books: T[],
  group: string,
  opts: SortOptions = {},
): BookGroup<T>[] | null {
  const compare = comparer(opts);

  if (group === "author") {
    const map = new Map<string, T[]>();
    const noAuthor: T[] = [];
    for (const b of books) {
      const name = b.authors[0];
      if (name) map.set(name, [...(map.get(name) ?? []), b]);
      else noAuthor.push(b);
    }
    // Same surname-first order as the author sort, so the two views agree,
    // books without an author last in both.
    const sections: BookGroup<T>[] = [...map.entries()]
      .sort((a, b) => compare(authorSortKey(a[0], opts), authorSortKey(b[0], opts)))
      .map(([title, groupBooks]) => ({ key: `author:${title}`, title, books: groupBooks }));
    if (noAuthor.length > 0) {
      sections.push({ key: "author:none", title: "Unknown author", books: noAuthor });
    }
    return sections;
  }

  if (group === "series") {
    // Keyed like the series filter, so "Dune" and "dune " are one series.
    // The section is titled the way its first book spells it.
    const map = new Map<string, { title: string; books: T[] }>();
    const noSeries: T[] = [];
    for (const b of books) {
      if (!b.seriesName?.trim()) {
        noSeries.push(b);
        continue;
      }
      const key = seriesKey(b.seriesName);
      const entry = map.get(key) ?? { title: b.seriesName.trim(), books: [] };
      entry.books.push(b);
      map.set(key, entry);
    }
    const sections: BookGroup<T>[] = [...map.entries()]
      .sort((a, b) => compare(titleSortKey(a[1].title, opts), titleSortKey(b[1].title, opts)))
      .map(([key, { title, books: groupBooks }]) => ({
        key: `series:${key}`,
        title,
        books: [...groupBooks].sort(
          (a, b) =>
            (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
            compare(titleSortKey(a.title, opts), titleSortKey(b.title, opts)),
        ),
      }));
    if (noSeries.length > 0) {
      sections.push({ key: "series:none", title: "Not in a series", books: noSeries });
    }
    return sections;
  }

  if (group === "yearFinished") {
    // A Read book's current finish, by the calendar day Stats would count
    // it on. Re-reads finished earlier stay with the latest pass.
    const years = new Map<string, T[]>();
    const undated: T[] = [];
    const unfinished: T[] = [];
    for (const b of books) {
      if (b.status !== ReadingStatus.READ) unfinished.push(b);
      else if (!b.dateFinished) undated.push(b);
      else {
        const year = calendarDay(b.dateFinished, opts.timeZone).slice(0, 4);
        years.set(year, [...(years.get(year) ?? []), b]);
      }
    }
    const sections: BookGroup<T>[] = [...years.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, groupBooks]) => ({ key: `year:${year}`, title: year, books: groupBooks }));
    if (undated.length > 0) {
      sections.push({ key: "year:undated", title: "Finished, date not known", books: undated });
    }
    if (unfinished.length > 0) {
      sections.push({ key: "year:none", title: "Not finished", books: unfinished });
    }
    return sections;
  }

  if (group === "status") {
    return fixedSections(books, "status", STATUS_ORDER, (b) => b.status, (s) => STATUS_LABELS[s]);
  }

  if (group === "format") {
    return fixedSections(
      books,
      "format",
      Object.values(BookFormat),
      (b) => b.format,
      (f) => FORMAT_LABELS[f],
    );
  }

  if (group === "ownership") {
    return fixedSections(
      books,
      "ownership",
      OWNERSHIP_ORDER,
      (b) => b.ownership,
      (o) => OWNERSHIP_LABELS[o],
    );
  }

  if (group === "tag") {
    const map = new Map<string, T[]>();
    const untagged: T[] = [];
    for (const b of books) {
      if (b.tags.length === 0) untagged.push(b);
      for (const t of new Set(b.tags)) map.set(t, [...(map.get(t) ?? []), b]);
    }
    const sections: BookGroup<T>[] = [...map.entries()]
      .sort((a, b) => compare(a[0], b[0]))
      .map(([tag, groupBooks]) => ({ key: `tag:${tag}`, title: tag, books: groupBooks }));
    if (untagged.length > 0) sections.push({ key: "tag:none", title: "No tags", books: untagged });
    return sections;
  }

  if (group === "shelf") {
    const map = new Map<string, { name: string; books: T[] }>();
    const unshelved: T[] = [];
    for (const b of books) {
      const shelves = b.shelves ?? [];
      if (shelves.length === 0) unshelved.push(b);
      for (const s of shelves) {
        const entry = map.get(s.id) ?? { name: s.name, books: [] };
        entry.books.push(b);
        map.set(s.id, entry);
      }
    }
    // The reader's own shelf order first (as on the shelf chips), then the
    // rest by name.
    const order = opts.shelfOrder ?? [];
    const rank = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? order.length : i;
    };
    const sections: BookGroup<T>[] = [...map.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || compare(a[1].name, b[1].name))
      .map(([id, { name, books: groupBooks }]) => ({
        key: `shelf:${id}`,
        title: name,
        books: groupBooks,
      }));
    if (unshelved.length > 0) {
      sections.push({ key: "shelf:none", title: "Not on a shelf", books: unshelved });
    }
    return sections;
  }

  if (group === "rating") {
    const sections: BookGroup<T>[] = [];
    for (let v = 10; v >= 1; v--) {
      const rated = books.filter((b) => b.rating === v);
      if (rated.length > 0) {
        sections.push({ key: `rating:${v}`, title: ratingLabel(v, opts.ratingStyle), books: rated });
      }
    }
    const unrated = books.filter((b) => !b.rating || b.rating < 1 || b.rating > 10);
    if (unrated.length > 0) sections.push({ key: "rating:none", title: "Unrated", books: unrated });
    return sections;
  }

  return null;
}

/**
 * Fills grouped sections in order until `limit` books are placed. A book in
 * two tag sections takes two places, so the budget counts entries. Sections
 * keep their real size in `total`, so a partly shown one still says how
 * many books it holds.
 */
export function sliceGroups<T>(
  groups: BookGroup<T>[],
  limit: number,
): { groups: (BookGroup<T> & { total: number })[]; shownEntries: number; totalEntries: number } {
  let budget = limit;
  let shownEntries = 0;
  let totalEntries = 0;
  const out: (BookGroup<T> & { total: number })[] = [];
  for (const g of groups) {
    totalEntries += g.books.length;
    if (budget <= 0) continue;
    const shown = g.books.slice(0, budget);
    out.push({ ...g, books: shown, total: g.books.length });
    shownEntries += shown.length;
    budget -= shown.length;
  }
  return { groups: out, shownEntries, totalEntries };
}

/** How far through one series the reader is, over every copy in the
 *  library (not just the ones on screen). */
export interface SeriesProgress {
  total: number;
  /** Read at least once. */
  read: number;
  /** Lowest number being read right now. */
  reading: number | null;
  /** What's next by the shared rule (series.ts), when nothing is being read. */
  next: number | null;
  /** Whole numbers from 1 up to the highest one with no book. */
  missing: number[];
}

/** Gaps are only looked for this far: a typo'd #9000 shouldn't list them all. */
const MAX_SERIES_NUMBER = 10_000;

export function seriesProgress(books: SeriesMember[]): SeriesProgress {
  const read = books.filter((b) => b.status === ReadingStatus.READ || b.timesRead > 0).length;
  const reading = books
    .filter((b) => b.status === ReadingStatus.READING && b.seriesNumber !== null)
    .reduce<number | null>((low, b) => (low === null || b.seriesNumber! < low ? b.seriesNumber! : low), null);
  const next = reading === null ? (nextInSeries(books)?.seriesNumber ?? null) : null;

  // Only whole numbers fill a gap: #1.5 is a novella between #1 and #2,
  // not either of them. A #0 prequel never makes #1 look missing.
  const numbers = books.map((b) => b.seriesNumber).filter((n): n is number => n !== null);
  const have = new Set(numbers.filter((n) => Number.isInteger(n)));
  const highest = Math.min(Math.max(0, ...numbers), MAX_SERIES_NUMBER);
  const missing: number[] = [];
  for (let n = 1; n < highest; n++) if (!have.has(n)) missing.push(n);

  return { total: books.length, read, reading, next, missing };
}

/**
 * A series heading's detail and note: "5 books · 3 read · next #4" (or
 * "2 of 5 books" when the filters on screen show only some), and
 * "#3 missing" when a number is skipped.
 */
export function seriesHeading(p: SeriesProgress, shown: number): { detail: string; note?: string } {
  const books = `${p.total} book${p.total === 1 ? "" : "s"}`;
  const bits = [shown < p.total ? `${shown} of ${books}` : books];
  if (p.total > 0 && p.read === p.total) bits.push("all read");
  else {
    bits.push(`${p.read} read`);
    if (p.reading !== null) bits.push(`reading #${p.reading}`);
    else if (p.next !== null) bits.push(`next #${p.next}`);
  }
  if (p.missing.length === 0) return { detail: bits.join(" · ") };
  const listed = p.missing.slice(0, 5).map((n) => `#${n}`).join(", ");
  const more = p.missing.length - 5;
  return {
    detail: bits.join(" · "),
    note: more > 0 ? `${listed} and ${more} more missing` : `${listed} missing`,
  };
}
