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
export function authorSortKey(name: string): string {
  const words = name.trim().toLowerCase().split(/\s+/);
  const suffixes: string[] = [];
  while (words.length > 1 && NAME_SUFFIXES.has(words[words.length - 1])) {
    suffixes.unshift(words.pop()!);
  }
  let start = words.length - 1;
  while (start > 0 && SURNAME_PARTICLES.has(words[start - 1])) start--;
  return [...words.slice(start), ...words.slice(0, start), ...suffixes].join(" ");
}

/** Shelf order within one author: series entries stay together (a series
 *  sorts as a block by its name, standalones slot in by title), ordered by
 *  series number inside the block — Mistborn #1 right before Mistborn #2. */
function seriesShelfOrder(a: SortableBook, b: SortableBook): number {
  return (
    (a.seriesName ?? a.title).localeCompare(b.seriesName ?? b.title) ||
    (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
    a.title.localeCompare(b.title)
  );
}

/** In-memory sort — a personal library is small enough that sorting after
 *  the filtered fetch is simpler than fighting Prisma over array columns
 *  (author sort) and nulls-last semantics. */
export function sortBooks<T extends SortableBook>(
  books: T[],
  sort: string,
  dir: string,
): T[] {
  const mul = dir === "asc" ? 1 : -1;
  // Author sort: `dir` flips the author order only; within an author, books
  // keep shelf order (series grouped, in series order) in both directions.
  if (sort === "author") {
    return [...books].sort(
      (a, b) =>
        mul *
          authorSortKey(a.authors[0] ?? "").localeCompare(
            authorSortKey(b.authors[0] ?? ""),
          ) || seriesShelfOrder(a, b),
    );
  }
  const cmp: Record<string, (a: SortableBook, b: SortableBook) => number> = {
    title: (a, b) => a.title.localeCompare(b.title),
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
): BookGroup<T>[] | null {
  if (group === "author") {
    const map = new Map<string, T[]>();
    for (const b of books) {
      const key = b.authors[0] ?? "Unknown author";
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    // Same surname-first order as the author sort, so the two views agree.
    return [...map.entries()]
      .sort((a, b) => authorSortKey(a[0]).localeCompare(authorSortKey(b[0])))
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
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, groupBooks]) => ({
        title,
        books: [...groupBooks].sort(
          (a, b) =>
            (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
            a.title.localeCompare(b.title),
        ),
      }));
    if (noSeries.length > 0) sections.push({ title: "Not in a series", books: noSeries });
    return sections;
  }

  return null;
}
