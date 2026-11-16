import type { ReadingStatus } from "@/lib/enums";
import { authorAnchor } from "@/lib/authors-list";
import { NAV_LINKS } from "@/lib/nav";
import { NAV_ITEMS } from "@/lib/preferences";
import { seriesKey } from "@/lib/series";
import { seriesAnchor } from "@/lib/series-list";
import { foldForSearch, searchWords } from "@/lib/utils";

/**
 * Quick find (Ctrl+K or ⌘K, components/quick-find.tsx): one box that finds
 * a book, an author, a series, a shelf or a page by a few letters of its
 * name, and opens it. The server (app/api/quick-find) looks up what
 * matches; the rules for what comes first, and where each one opens, are
 * here.
 */

/** The window event that opens (or closes) quick find. */
export const QUICK_FIND_EVENT = "myreads-quick-find";

/** How many of each kind the list shows. */
export const QUICK_FIND_LIMITS = { books: 6, authors: 3, series: 3, shelves: 3, pages: 4 } as const;

/** The longest query worth looking up. */
export const QUICK_FIND_MAX_QUERY = 100;

export interface QuickBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  status: ReadingStatus;
  statusKey: string | null;
  seriesName: string | null;
  seriesNumber: number | null;
}

export interface QuickNamed {
  name: string;
  /** How many of the reader's books are theirs, or in it. */
  count: number;
}

export interface QuickShelf {
  id: string;
  name: string;
  /** A smart shelf, picked by its rules rather than by hand. */
  smart: boolean;
}

export interface QuickFindResult {
  books: QuickBook[];
  authors: QuickNamed[];
  series: QuickNamed[];
  shelves: QuickShelf[];
}

export const EMPTY_RESULT: QuickFindResult = { books: [], authors: [], series: [], shelves: [] };

/**
 * How well a name answers the query: 4 when it is the query, 3 when it
 * starts with it, 2 when each word starts a word of the name, 1 when each
 * word is somewhere in it, 0 when one isn't. Case and accents aside.
 */
export function matchScore(name: string, q: string): number {
  const words = searchWords(q);
  if (words.length === 0) return 0;
  const folded = foldForSearch(name).trim();
  if (!words.every((w) => folded.includes(w))) return 0;
  const phrase = words.join(" ");
  const plain = folded.replace(/\s+/g, " ");
  if (plain === phrase) return 4;
  if (plain.startsWith(phrase)) return 3;
  const nameWords = folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.every((w) => nameWords.some((n) => n.startsWith(w)))) return 2;
  return 1;
}

/** Statuses in the order a tie puts them: what's being read first. */
const STATUS_ORDER: Record<string, number> = { READING: 0, WANT_TO_READ: 1, READ: 2, DNF: 3 };

/**
 * The books that answer the query, best first: a title that matches beats
 * an author or series that does, the closer match first; then the book
 * being read, then the one wanted, then the one most lately touched.
 * Books the server found by their search text but whose title, authors
 * and series don't hold every word (a word split across them) still
 * count, after the rest.
 */
export function rankBooks<B extends QuickBook & { updatedAt: Date }>(books: B[], q: string): B[] {
  const scored = books.map((b) => {
    const title = matchScore(b.title, q);
    const by = Math.max(0, ...b.authors.map((a) => matchScore(a, q)), b.seriesName ? matchScore(b.seriesName, q) : 0);
    return { b, score: title ? 10 + title : by };
  });
  return scored
    .sort(
      (x, y) =>
        y.score - x.score ||
        (STATUS_ORDER[x.b.status] ?? 9) - (STATUS_ORDER[y.b.status] ?? 9) ||
        y.b.updatedAt.getTime() - x.b.updatedAt.getTime(),
    )
    .map((s) => s.b);
}

/** Names that answer the query, with how often each comes up, best match
 *  first, then the most books, then by name. One name per spelling, case
 *  and spacing aside; the spelling seen most often is the one shown. */
function collectNames(names: string[], q: string, keyOf: (s: string) => string, limit: number): QuickNamed[] {
  const byKey = new Map<string, { spellings: Map<string, number>; count: number; score: number }>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = keyOf(name);
    let entry = byKey.get(key);
    if (!entry) {
      const score = matchScore(name, q);
      if (!score) continue;
      entry = { spellings: new Map(), count: 0, score };
      byKey.set(key, entry);
    }
    entry.count++;
    entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
  }
  return [...byKey.values()]
    .map((e) => ({
      name: [...e.spellings].sort((a, b) => b[1] - a[1])[0][0],
      count: e.count,
      score: e.score,
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, count }) => ({ name, count }));
}

/** The authors that answer the query (the Authors page goes by the exact
 *  name; a book naming one twice counts once). */
export function collectAuthors(books: { authors: string[] }[], q: string): QuickNamed[] {
  return collectNames(
    books.flatMap((b) => [...new Set(b.authors.map((a) => a.trim()))]),
    q,
    (s) => s,
    QUICK_FIND_LIMITS.authors,
  );
}

/** The series that answer the query, one per series as the Series page
 *  groups them (lib/series.ts seriesKey). */
export function collectSeries(books: { seriesName: string | null }[], q: string): QuickNamed[] {
  return collectNames(
    books.flatMap((b) => (b.seriesName ? [b.seriesName] : [])),
    q,
    seriesKey,
    QUICK_FIND_LIMITS.series,
  );
}

/** The shelves, of both kinds, that answer the query, best match first. */
export function matchShelves(shelves: QuickShelf[], q: string): QuickShelf[] {
  return shelves
    .map((s) => ({ s, score: matchScore(s.name, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
    .slice(0, QUICK_FIND_LIMITS.shelves)
    .map((x) => x.s);
}

export interface QuickPage {
  key: string;
  label: string;
  href: string;
  /** Other words it goes by. */
  aka: string[];
}

/** Every page quick find can open: the top-bar pages (a hidden one too),
 *  Preferences, and this year's review. */
export function quickPages(year: number): QuickPage[] {
  const aka: Partial<Record<string, string[]>> = {
    library: ["books", "shelves"],
    reading: ["current", "progress", "log"],
    add: ["new book", "scan"],
    check: ["do i own this", "isbn", "barcode"],
    stats: ["statistics", "goal", "challenges"],
    room: ["reading room", "house", "avatar"],
  };
  return [
    ...NAV_ITEMS.map((item) => ({
      key: item,
      label: NAV_LINKS[item].title,
      href: NAV_LINKS[item].href,
      aka: aka[item] ?? [],
    })),
    { key: "account", label: "Preferences", href: "/account", aka: ["account", "settings", "theme", "backup"] },
    { key: "year", label: `${year} in review`, href: `/stats/year/${year}`, aka: ["year in review", "wrapped"] },
  ];
}

/** The pages that answer the query, best match first. */
export function matchPages(pages: QuickPage[], q: string): QuickPage[] {
  return pages
    .map((p) => ({ p, score: Math.max(matchScore(p.label, q), ...p.aka.map((a) => matchScore(a, q) - 0.5)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, QUICK_FIND_LIMITS.pages)
    .map((x) => x.p);
}

/** Where each kind of find opens. */
export const quickHref = {
  book: (id: string) => `/books/${encodeURIComponent(id)}`,
  author: (name: string) => `/authors?q=${encodeURIComponent(name)}#${authorAnchor(name)}`,
  series: (name: string) => `/series#${seriesAnchor(name)}`,
  shelf: (id: string) => `/books?shelfId=${encodeURIComponent(id)}`,
  search: (q: string) => `/books?q=${encodeURIComponent(q.trim())}`,
};

/** The query from the address: trimmed, cut short, or "" for anything
 *  else. */
export function parseQuickQuery(raw: string | null): string {
  return (raw ?? "").trim().slice(0, QUICK_FIND_MAX_QUERY);
}
