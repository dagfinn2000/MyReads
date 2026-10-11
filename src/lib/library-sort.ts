/**
 * Sorting and grouping for the library page. Pure functions over a minimal
 * book shape, kept out of the page component so the shelf-filing rules —
 * surname sorting, series blocks — are unit-testable.
 */

/** The fields the sorts and groupings read; the page's Prisma select
 *  satisfies this structurally. */
export interface SortableBook {
  title: string;
  authors: string[];
  rating: number | null;
  seriesName: string | null;
  seriesNumber: number | null;
  dateFinished: Date | null;
  createdAt: Date;
}

export interface BookGroup<T> {
  title: string;
  books: T[];
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

/** In-memory sort — a personal library is small enough that sorting after
 *  the filtered fetch is simpler than fighting Prisma over array columns
 *  (author sort) and nulls-last semantics. */
export function sortBooks<T extends SortableBook>(
  books: T[],
  sort: string,
  dir: string,
  opts: SortOptions = {},
): T[] {
  const mul = dir === "asc" ? 1 : -1;
  const compare = comparer(opts);
  // Author sort: `dir` flips the author order only; within an author, books
  // keep shelf order (series grouped, in series order) in both directions.
  if (sort === "author") {
    return [...books].sort(
      (a, b) =>
        mul *
          compare(
            authorSortKey(a.authors[0] ?? "", opts),
            authorSortKey(b.authors[0] ?? "", opts),
          ) || seriesShelfOrder(a, b, opts, compare),
    );
  }
  const cmp: Record<string, (a: SortableBook, b: SortableBook) => number> = {
    title: (a, b) => compare(titleSortKey(a.title, opts), titleSortKey(b.title, opts)),
    rating: (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
    dateFinished: (a, b) =>
      (a.dateFinished?.getTime() ?? 0) - (b.dateFinished?.getTime() ?? 0),
    createdAt: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  };
  const fn = cmp[sort] ?? cmp.createdAt;
  return [...books].sort((a, b) => mul * fn(a, b));
}

/** Sections for the group-by views. Series sections order their books by
 *  series number; a trailing section collects books outside any series. */
export function groupBooks<T extends SortableBook>(
  books: T[],
  group: string,
  opts: SortOptions = {},
): BookGroup<T>[] | null {
  const compare = comparer(opts);
  if (group === "author") {
    const map = new Map<string, T[]>();
    for (const b of books) {
      const key = b.authors[0] ?? "Unknown author";
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    // Same surname-first order as the author sort, so the two views agree.
    return [...map.entries()]
      .sort((a, b) => compare(authorSortKey(a[0], opts), authorSortKey(b[0], opts)))
      .map(([title, groupBooks]) => ({ title, books: groupBooks }));
  }

  if (group === "series") {
    const map = new Map<string, T[]>();
    const noSeries: T[] = [];
    for (const b of books) {
      if (b.seriesName) map.set(b.seriesName, [...(map.get(b.seriesName) ?? []), b]);
      else noSeries.push(b);
    }
    const sections = [...map.entries()]
      .sort((a, b) => compare(titleSortKey(a[0], opts), titleSortKey(b[0], opts)))
      .map(([title, groupBooks]) => ({
        title,
        books: [...groupBooks].sort(
          (a, b) =>
            (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
            compare(titleSortKey(a.title, opts), titleSortKey(b.title, opts)),
        ),
      }));
    if (noSeries.length > 0) sections.push({ title: "Not in a series", books: noSeries });
    return sections;
  }

  return null;
}
