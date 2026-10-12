import { authorSortKey, titleSortKey, type SortOptions } from "@/lib/library-sort";
import { QUOTE_ORDERS, type Preferences, type QuoteOrder } from "@/lib/preferences";

/**
 * Ordering, grouping and URL state for the quotes page. Pure functions over
 * a minimal quote shape, so the client toolbar can build links with them and
 * the orders are unit-testable without a database.
 */

/** The fields the orders read; the page's key query satisfies this. */
export interface OrderableQuote {
  id: string;
  bookId: string;
  page: number | null;
  createdAt: Date;
  book: { title: string; authors: string[] };
}

/** The quotes page's state, as it appears in the URL. */
export interface QuotesParams {
  q: string;
  order: QuoteOrder;
  /** Group by book. */
  group: boolean;
  /** Pins a shuffle, so a re-render or Show more keeps the same order. */
  seed: number | null;
  tag: string;
  shelfId: string;
  limit: number;
}

export interface QuoteGroup<T> {
  bookId: string;
  quotes: T[];
}

/** Quotes rendered per page load, and the ceiling Show more can reach. The
 *  same numbers as the library. */
export const QUOTES_PAGE_SIZE = 200;
export const QUOTES_MAX = 2000;

const SEED_MAX = 2147483647;

/** A URL parameter as a string. Null bytes are dropped: Postgres refuses
 *  them in text. */
function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.replace(/\0/g, "") : "";
}

/** Reads the page state out of searchParams. Order and grouping fall back
 *  to the reader's saved choice, so the plain nav link opens the order they
 *  picked last. */
export function parseQuotesParams(
  sp: Record<string, string | string[] | undefined>,
  prefs: Pick<Preferences, "quotesOrder" | "quotesGroupByBook">,
): QuotesParams {
  const order = param(sp.order);
  const group = param(sp.group);
  const seedText = param(sp.seed);
  const seed = /^\d{1,10}$/.test(seedText) ? Number(seedText) : 0;
  const tag = param(sp.tag).trim();
  const shelfId = param(sp.shelfId);
  return {
    q: param(sp.q).trim(),
    order: (QUOTE_ORDERS as readonly string[]).includes(order)
      ? (order as QuoteOrder)
      : prefs.quotesOrder,
    group: group === "book" ? true : group === "none" ? false : prefs.quotesGroupByBook,
    seed: seed >= 1 && seed <= SEED_MAX ? seed : null,
    tag: tag.length <= 200 ? tag : "",
    shelfId: /^[a-z0-9]{1,40}$/i.test(shelfId) ? shelfId : "",
    limit: Math.min(
      Math.max(parseInt(param(sp.limit), 10) || QUOTES_PAGE_SIZE, QUOTES_PAGE_SIZE),
      QUOTES_MAX,
    ),
  };
}

/** The URL for a page state. Order and grouping are always written, so the
 *  saved choice only fills in on param-less visits; the seed only rides
 *  along with a shuffle, and one From filter at a time (a shelf wins). */
export function quotesHref(
  p: Partial<QuotesParams> & Pick<QuotesParams, "order" | "group">,
): string {
  const params = new URLSearchParams();
  if (p.q) params.set("q", p.q);
  if (p.shelfId) params.set("shelfId", p.shelfId);
  else if (p.tag) params.set("tag", p.tag);
  params.set("order", p.order);
  params.set("group", p.group ? "book" : "none");
  if (p.order === "shuffle" && p.seed) params.set("seed", String(p.seed));
  if (p.limit && p.limit > QUOTES_PAGE_SIZE) params.set("limit", String(p.limit));
  return `/quotes?${params}`;
}

/** A fresh shuffle seed, 1 to 2147483647. */
export function newSeed(): number {
  return Math.floor(Math.random() * (SEED_MAX - 1)) + 1;
}

/** A 32-bit hash of `key` mixed with `seed` (FNV-1a, then murmur3's
 *  finalizer to spread the bits). */
function seededHash(seed: number, key: string): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A shuffle that a seed pins down. Each item's place comes from a hash of
 * its own key and the seed, so the result never depends on the order items
 * arrive in, and deleting one quote leaves the others where they were
 * instead of reshuffling the lot.
 */
export function seededShuffle<T>(items: readonly T[], seed: number, keyOf: (item: T) => string): T[] {
  return items
    .map((item) => {
      const key = keyOf(item);
      return { item, key, rank: seededHash(seed, key) };
    })
    .sort((a, b) => a.rank - b.rank || compareIds(a.key, b.key))
    .map((x) => x.item);
}

/** A book's quotes in page order, the way its book page lists them: page
 *  ascending with unpaged ones last, then oldest first. */
export function comparePageOrder(
  a: Pick<OrderableQuote, "id" | "page" | "createdAt">,
  b: Pick<OrderableQuote, "id" | "page" | "createdAt">,
): number {
  if (a.page !== b.page) {
    if (a.page === null) return 1;
    if (b.page === null) return -1;
    return a.page - b.page;
  }
  return a.createdAt.getTime() - b.createdAt.getTime() || compareIds(a.id, b.id);
}

function newestFirst(a: OrderableQuote, b: OrderableQuote): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || compareIds(b.id, a.id);
}

function oldestFirst(a: OrderableQuote, b: OrderableQuote): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || compareIds(a.id, b.id);
}

/**
 * Quotes bucketed by book, each book's quotes in page order. The books
 * follow the chosen order: newest puts the book with the newest quote
 * first, oldest the one with the oldest quote, "book" goes by title with
 * the reader's sorting rules, and shuffle by the seed.
 */
export function groupQuotes<T extends OrderableQuote>(
  quotes: readonly T[],
  order: QuoteOrder,
  opts: { seed: number; sort: SortOptions },
): QuoteGroup<T>[] {
  const byBook = new Map<string, T[]>();
  for (const q of quotes) {
    const list = byBook.get(q.bookId);
    if (list) list.push(q);
    else byBook.set(q.bookId, [q]);
  }
  const groups = [...byBook].map(([bookId, list]) => ({
    bookId,
    quotes: list.sort(comparePageOrder),
  }));

  if (order === "shuffle") return seededShuffle(groups, opts.seed, (g) => g.bookId);

  if (order === "book") {
    const compare = new Intl.Collator(opts.sort.alphabet).compare;
    const keys = new Map(
      groups.map((g) => {
        const book = g.quotes[0].book;
        return [
          g.bookId,
          {
            title: titleSortKey(book.title, opts.sort),
            author: book.authors[0] ? authorSortKey(book.authors[0], opts.sort) : "",
          },
        ];
      }),
    );
    return groups.sort((a, b) => {
      const ka = keys.get(a.bookId)!;
      const kb = keys.get(b.bookId)!;
      return (
        compare(ka.title, kb.title) ||
        compare(ka.author, kb.author) ||
        compareIds(a.bookId, b.bookId)
      );
    });
  }

  // newest / oldest: by each book's newest or oldest quote.
  const newest = order === "newest";
  const dir = newest ? -1 : 1;
  const times = new Map(
    groups.map((g) => [
      g.bookId,
      g.quotes
        .map((q) => q.createdAt.getTime())
        .reduce((x, y) => (newest ? Math.max(x, y) : Math.min(x, y))),
    ]),
  );
  return groups.sort(
    (a, b) =>
      dir * (times.get(a.bookId)! - times.get(b.bookId)!) || compareIds(a.bookId, b.bookId),
  );
}

/** The quotes in the chosen order, ungrouped. "By book" is the grouped list
 *  without its headings. */
export function orderQuotes<T extends OrderableQuote>(
  quotes: readonly T[],
  order: QuoteOrder,
  opts: { seed: number; sort: SortOptions },
): T[] {
  switch (order) {
    case "oldest":
      return [...quotes].sort(oldestFirst);
    case "book":
      return groupQuotes(quotes, "book", opts).flatMap((g) => g.quotes);
    case "shuffle":
      return seededShuffle(quotes, opts.seed, (q) => q.id);
    default:
      return [...quotes].sort(newestFirst);
  }
}

/** Fill groups in order until the budget runs out. Each keeps its real size
 *  in `total`, so a group cut short still says how many quotes it holds. */
export function sliceQuoteGroups<T>(
  groups: QuoteGroup<T>[],
  limit: number,
): (QuoteGroup<T> & { total: number })[] {
  let budget = limit;
  const out: (QuoteGroup<T> & { total: number })[] = [];
  for (const g of groups) {
    if (budget <= 0) break;
    out.push({ bookId: g.bookId, quotes: g.quotes.slice(0, budget), total: g.quotes.length });
    budget -= g.quotes.length;
  }
  return out;
}
