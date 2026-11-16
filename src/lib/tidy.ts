import { BookFormat, ReadingStatus } from "@/lib/enums";
import { isbnVariants, looksLikeIsbn } from "@/lib/isbn";
import { foldForSearch } from "@/lib/utils";

/**
 * Tidy up (/books/tidy): books that could use a little care. Missing covers,
 * page counts and authors; reads with no finish date; books still on
 * Currently Reading that haven't been touched for a while; and books that
 * look like the same book twice.
 *
 * Each thing to tidy has a key ("cover:<id>", "dup:<id>+<id>") the reader
 * can leave alone (Preferences.tidySkipped), after which it stops showing.
 * A group of duplicates is keyed by all its books, so a third copy turning
 * up brings the group back.
 */

export interface TidyBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isbn: string | null;
  openLibraryId: string | null;
  pageCount: number | null;
  format: BookFormat;
  status: ReadingStatus;
  dateStarted: Date | null;
  dateFinished: Date | null;
  createdAt: Date;
  seriesName: string | null;
  seriesNumber: number | null;
  /** The newest reading-log entry, for a book being read. */
  lastLogged: Date | null;
}

/** The kinds of things to tidy, in the order the page shows them. */
export const TIDY_KINDS = ["dup", "stale", "cover", "pages", "author", "date"] as const;
export type TidyKind = (typeof TIDY_KINDS)[number];

/** A book still on Currently Reading this many days after it was last
 *  started or logged is asked about. */
export const STALE_DAYS = 60;

/** Keys a reader can leave: a kind, then one id or several joined by "+". */
const KEY = /^(dup|stale|cover|pages|author|date):[A-Za-z0-9_-]{1,64}(\+[A-Za-z0-9_-]{1,64}){0,19}$/;

/** At most this many keys are kept; the oldest go first. */
export const MAX_TIDY_SKIPS = 2000;

export function isTidyKey(value: unknown): value is string {
  return typeof value === "string" && value.length <= 1400 && KEY.test(value);
}

/** The keys left alone: known shapes only, each once, newest kept. A Set,
 *  not includes: a restored backup can carry any number. */
export function parseTidySkips(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) if (isTidyKey(v)) seen.add(v);
  return [...seen].slice(-MAX_TIDY_SKIPS);
}

export interface StaleBook<B extends TidyBook = TidyBook> {
  book: B;
  /** Days since it was last started or logged. */
  days: number;
}

export interface TidyReport<B extends TidyBook = TidyBook> {
  dup: { key: string; books: B[] }[];
  stale: StaleBook<B>[];
  cover: B[];
  pages: B[];
  author: B[];
  date: B[];
  /** Books in `cover` or `pages` the catalogues can be asked about: they
   *  have an ISBN or an Open Library id to find the very edition by. */
  lookable: string[];
  /** How many were left alone, all kinds together. */
  skipped: number;
}

/** A title as two copies of a book share it: folded, without a subtitle,
 *  a leading article or punctuation. "The Hobbit: or There and Back
 *  Again" and "Hobbit" are the same. */
export function titleKey(title: string): string {
  const main = foldForSearch(title).split(/\s*[:(\[]\s*|\s+[-–—]\s+/)[0] ?? "";
  return main
    .replace(/^(the|a|an|der|die|das|le|la|les|el|den|det)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** The first author's surname, folded: "J. R. R. Tolkien" and "J.R.R.
 *  Tolkien" are the same writer. */
function surnameKey(authors: string[]): string {
  const first = foldForSearch(authors[0] ?? "").trim();
  return first.split(/[\s.]+/).filter(Boolean).at(-1) ?? "";
}

/** The ISBN-13 form of an ISBN (or the ISBN itself when it has none). */
function isbnKey(isbn: string): string {
  const variants = isbnVariants(isbn);
  return variants.find((v) => v.length === 13) ?? variants[0];
}

/**
 * Groups of books that look like one book twice: the same ISBN, or the
 * same title by the same writer. Two volumes of one series with the same
 * title but different numbers aren't the same book.
 */
export function duplicateGroups<B extends TidyBook>(books: B[]): B[][] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const join = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const b of books) parent.set(b.id, b.id);

  const firstBy = new Map<string, B>();
  const link = (key: string, b: B) => {
    const first = firstBy.get(key);
    if (!first) firstBy.set(key, b);
    else if (!(first.seriesNumber != null && b.seriesNumber != null && first.seriesNumber !== b.seriesNumber)) {
      join(first.id, b.id);
    }
  };
  for (const b of books) {
    if (b.isbn && looksLikeIsbn(b.isbn)) link(`isbn:${isbnKey(b.isbn)}`, b);
    const title = titleKey(b.title);
    const surname = surnameKey(b.authors);
    if (title && surname) link(`title:${title}|${surname}`, b);
  }

  const groups = new Map<string, B[]>();
  for (const b of books) {
    const root = find(b.id);
    groups.set(root, [...(groups.get(root) ?? []), b]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
}

export function dupKey(group: TidyBook[]): string {
  return `dup:${group
    .map((b) => b.id)
    .sort()
    .join("+")}`;
}

const DAY_MS = 86_400_000;

/** Everything there is to tidy, less what the reader left alone. */
export function tidyReport<B extends TidyBook>(books: B[], skipped: readonly string[], now: Date): TidyReport<B> {
  const skip = new Set(skipped);
  let left = 0;
  const keep = (key: string) => {
    if (!skip.has(key)) return true;
    left++;
    return false;
  };
  const each = (kind: TidyKind, test: (b: B) => boolean) =>
    books.filter((b) => test(b) && keep(`${kind}:${b.id}`));

  const dup = duplicateGroups(books)
    .map((g) => ({ key: dupKey(g), books: g }))
    .filter((g) => keep(g.key));

  const stale = books
    .filter((b) => b.status === ReadingStatus.READING)
    .map((b) => {
      // Started, else added (a book put on Currently Reading undated).
      const last = Math.max((b.dateStarted ?? b.createdAt).getTime(), b.lastLogged?.getTime() ?? 0);
      return { book: b, days: Math.floor((now.getTime() - last) / DAY_MS) };
    })
    .filter((s) => s.days >= STALE_DAYS && keep(`stale:${s.book.id}`))
    .sort((a, b) => b.days - a.days);

  const cover = each("cover", (b) => !b.coverUrl);
  // An audiobook goes by its running time, so it needs no page count.
  const pages = each("pages", (b) => b.pageCount == null && b.format !== BookFormat.AUDIOBOOK);
  const author = each("author", (b) => b.authors.every((a) => !a.trim()));
  const date = each("date", (b) => b.status === ReadingStatus.READ && !b.dateFinished);

  const lookable = [...new Set([...cover, ...pages].filter((b) => b.isbn || b.openLibraryId).map((b) => b.id))];
  return { dup, stale, cover, pages, author, date, lookable, skipped: left };
}
