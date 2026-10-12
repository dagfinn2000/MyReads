import type { Prisma } from "@prisma/client";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { isbnVariants, looksLikeIsbn, normalizeIsbn } from "@/lib/isbn";
import type { SearchField } from "@/lib/preferences";
import { searchTerms } from "@/lib/utils";

/**
 * The library view's filter state, as it appears in the URL. Every value is
 * one string, lists included (comma-joined): the page flattens its params to
 * strings for Pick for me and bulk edit, so a repeated ?tag=a&tag=b would
 * lose all but one.
 */
export interface LibraryFilters {
  /** The status tab: one ReadingStatus, or "all". */
  shelf: string;
  shelfId: string;
  q: string;
  /** One author, exactly as written on the book (the book page links here). */
  author: string;
  /** Tags to include, comma-joined: books with any of them, or with all of
   *  them when tagMatch is "all". */
  tag: string;
  /** "all" or "" (any). Only ever "all" alongside some tags. */
  tagMatch: string;
  /** Tags to leave out, comma-joined. */
  notTag: string;
  format: string;
  owned: string;
  /** Lowest rating, 1–10, or "unrated". */
  minRating: string;
  /** A year ("2024"): books finished then, re-reads included. */
  finished: string;
  /** One of MISSING_FILTERS: books lacking that detail. */
  missing: string;
  series: string;
}

/** A URL parameter as a string. Null bytes are dropped: Postgres refuses
 *  them in text, so `?tag=%00` used to crash the page. */
function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.replace(/\0/g, "") : "";
}

/** The `owned` param's values. "lent" is not an ownership state at all (a
 *  lent book is still owned), so it is handled separately below. */
const OWNED_FILTERS = ["all", "owned", "wishlist", "borrowed", "given_away", "lent"] as const;

/** Filter value -> ownership state. */
const OWNERSHIP_FILTERS: Partial<Record<string, BookOwnership>> = {
  owned: BookOwnership.OWNED,
  wishlist: BookOwnership.WISHLIST,
  borrowed: BookOwnership.BORROWED,
  given_away: BookOwnership.GIVEN_AWAY,
};

/** The details the "Missing" filter can look for. */
export const MISSING_FILTERS = ["cover", "pages", "isbn", "tags"] as const;
export type MissingFilter = (typeof MISSING_FILTERS)[number];

export const MISSING_LABELS: Record<MissingFilter, string> = {
  cover: "Cover",
  pages: "Page count",
  isbn: "ISBN",
  tags: "Tags",
};

/** Most tags one filter list keeps; the rest of a longer list is dropped. */
export const MAX_FILTER_TAGS = 50;

/**
 * A comma-joined tag list as tags: trimmed, each once, without "all" (what
 * the old single-tag menu wrote for "no filter"). A tag with a comma in it
 * can't survive this, which is why tags can't be renamed to one.
 */
export function tagList(s: string): string[] {
  const out = new Set<string>();
  for (const raw of s.split(",")) {
    const t = raw.trim();
    if (!t || t === "all" || t.length > 100) continue;
    out.add(t);
    if (out.size >= MAX_FILTER_TAGS) break;
  }
  return [...out];
}

/** Reads the filter state out of a searchParams object, dropping anything
 *  that isn't a value the library knows. */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): LibraryFilters {
  // A tag in both lists is left out: the query should never contradict
  // itself, and "not" is the safer reading.
  const notTag = tagList(param(sp.notTag));
  const tag = tagList(param(sp.tag)).filter((t) => !notTag.includes(t));
  const owned = param(sp.owned);
  const minRating = param(sp.minRating);
  const finished = param(sp.finished);
  const missing = param(sp.missing);
  return {
    shelf: param(sp.shelf) || "all",
    shelfId: param(sp.shelfId),
    q: param(sp.q).trim(),
    author: param(sp.author).trim().slice(0, 500),
    tag: tag.join(","),
    tagMatch: tag.length > 0 && param(sp.tagMatch) === "all" ? "all" : "",
    notTag: notTag.join(","),
    format: param(sp.format),
    owned: (OWNED_FILTERS as readonly string[]).includes(owned) ? owned : "all",
    minRating: minRating === "unrated" || /^([1-9]|10)$/.test(minRating) ? minRating : "",
    // From the year 1000 on: Date.UTC reads 0–99 as 1900–1999.
    finished: /^[1-9]\d{3}$/.test(finished) ? finished : "",
    missing: (MISSING_FILTERS as readonly string[]).includes(missing) ? missing : "",
    series: param(sp.series),
  };
}

/** Hours either side of New Year in which only the reader's time zone can
 *  say which year a finish belongs to (zones run from UTC−12 to UTC+14). */
const ZONE_SLACK_MS = 15 * 60 * 60 * 1000;

/**
 * Finish dates for a "Finished in" year: `sure` is certainly that year in
 * every time zone; dates in the two `edges` around New Year need the
 * reader's zone, so resolveBookWhere checks them one by one.
 */
export function finishedYearRanges(year: number): {
  sure: { gte: Date; lt: Date };
  edges: { gte: Date; lt: Date }[];
} {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const around = (t: number) => ({ gte: new Date(t - ZONE_SLACK_MS), lt: new Date(t + ZONE_SLACK_MS) });
  return {
    sure: { gte: new Date(start + ZONE_SLACK_MS), lt: new Date(end - ZONE_SLACK_MS) },
    edges: [around(start), around(end)],
  };
}

/** What resolveBookWhere looks up ahead for the filters that need it. All
 *  optional: without it the library searches title, author and series as
 *  it always has. */
export interface WhereContext {
  /** Where else search looks (Preferences.searchAlsoIn). */
  searchIn?: readonly SearchField[];
  /** Per search word, in searchTerms order: the reader's tags containing it. */
  tagsByTerm?: string[][];
  /** Books finished in the `finished` year close to New Year, by the
   *  reader's clock. */
  finishedEdgeIds?: string[];
}

/**
 * The ISBN a search word stands for, when it looks like (part of) one: six
 * or more digits, or a hyphenated run such as "0-261". A shorter plain
 * number is far more often a year or a title ("1984").
 */
export function isbnFragment(word: string): string | null {
  if (!/^[\dxX-]+$/.test(word)) return null;
  const digits = normalizeIsbn(word);
  if (!/^\d+X?$/.test(digits) || digits.length > 13) return null;
  return digits.length >= 6 || (word.includes("-") && digits.length >= 4) ? digits : null;
}

/** Where one search word may match: title, authors and series always, plus
 *  the fields the reader added. `i` is the word's place in searchTerms. */
export function searchTermWhere(
  term: string,
  i: number,
  ctx: WhereContext,
): Prisma.BookWhereInput {
  const or: Prisma.BookWhereInput[] = [{ searchText: { contains: term } }];
  const tags = ctx.tagsByTerm?.[i];
  if (tags?.length) or.push({ tags: { hasSome: tags } });
  const isbn = ctx.searchIn?.includes("isbn") ? isbnFragment(term) : null;
  // Insensitive: stored ISBNs can end in a lowercase x.
  if (isbn) or.push({ isbn: { contains: isbn, mode: "insensitive" } });
  if (ctx.searchIn?.includes("review")) or.push({ reviewSearchText: { contains: term } });
  return or.length === 1 ? or[0] : { OR: or };
}

/**
 * The Prisma `where` for a filter state. Pure: resolveBookWhere
 * (library-where.ts) runs the lookups some filters need and passes them in
 * `ctx`; the library page, Pick for me and bulk edit all go through it, so
 * they can never disagree about what "the current view" means.
 */
export function buildBookWhere(
  userId: string,
  filters: LibraryFilters,
  ctx: WhereContext = {},
): Prisma.BookWhereInput {
  const shelf = Object.values(ReadingStatus).find((s) => s === filters.shelf);
  const format = Object.values(BookFormat).find((f) => f === filters.format);
  // The URL keeps the `owned` param name so existing bookmarks and shared
  // links still work; its values just grew beyond owned/wishlist.
  const ownership = Object.hasOwn(OWNERSHIP_FILTERS, filters.owned)
    ? OWNERSHIP_FILTERS[filters.owned]
    : undefined;
  const minRating = parseInt(filters.minRating, 10);
  const include = tagList(filters.tag);
  const exclude = tagList(filters.notTag);
  const terms = searchTerms(filters.q);

  // Everything that can't share a top-level key. The status tab owns
  // `status` (Pick for me replaces it), so "unrated" keeps its own status
  // rule in here.
  const and: Prisma.BookWhereInput[] = [];

  if (terms.length > 0) {
    // Every word has to appear somewhere: in title, authors or series, or
    // in a field the reader added to search.
    const words = terms.map((t, i) => searchTermWhere(t, i, ctx));
    // A whole ISBN typed with spaces, or in its other 10/13-digit form,
    // isn't any one word: match it as a whole as well.
    const wholeIsbn =
      ctx.searchIn?.includes("isbn") && looksLikeIsbn(filters.q)
        ? isbnVariants(filters.q).map((v) => ({ isbn: { equals: v, mode: "insensitive" as const } }))
        : [];
    if (wholeIsbn.length > 0) and.push({ OR: [{ AND: words }, ...wholeIsbn] });
    else and.push(...words);
  }

  if (exclude.length > 0) and.push({ NOT: { tags: { hasSome: exclude } } });

  if (filters.minRating === "unrated") {
    // Want to Read books are unrated by nature; they'd bury the ones that
    // were read and never rated.
    and.push({ rating: null }, { status: { not: ReadingStatus.WANT_TO_READ } });
  }

  if (filters.missing === "cover") and.push({ OR: [{ coverUrl: null }, { coverUrl: "" }] });
  if (filters.missing === "pages") and.push({ OR: [{ pageCount: null }, { pageCount: { lte: 0 } }] });
  if (filters.missing === "isbn") and.push({ OR: [{ isbn: null }, { isbn: "" }] });
  if (filters.missing === "tags") and.push({ tags: { isEmpty: true } });

  if (filters.finished) {
    // The current pass counts once the book is Read; archived passes
    // always do. The same finishes Stats counts per year.
    const { sure } = finishedYearRanges(Number(filters.finished));
    const edgeIds = ctx.finishedEdgeIds ?? [];
    and.push({
      OR: [
        { status: ReadingStatus.READ, dateFinished: sure },
        { reads: { some: { dateFinished: sure } } },
        ...(edgeIds.length > 0 ? [{ id: { in: edgeIds } }] : []),
      ],
    });
  }

  return {
    userId,
    ...(shelf && { status: shelf }),
    ...(format && { format }),
    ...(ownership && { ownership }),
    ...(filters.owned === "lent" && { loans: { some: { returnedAt: null } } }),
    ...(minRating >= 1 && { rating: { gte: minRating } }),
    ...(include.length > 0 && {
      tags:
        include.length === 1
          ? { has: include[0] }
          : filters.tagMatch === "all"
            ? { hasEvery: include }
            : { hasSome: include },
    }),
    ...(filters.author && { authors: { has: filters.author } }),
    ...(filters.shelfId && { shelves: { some: { id: filters.shelfId } } }),
    ...(filters.series && {
      seriesName: { equals: filters.series, mode: "insensitive" as const },
    }),
    ...(and.length > 0 && { AND: and }),
  };
}

/** One removable chip under the filter bar: what it says, and the change
 *  that removes it. */
export interface FilterChip {
  id: string;
  label: string;
  clear: Partial<LibraryFilters>;
}

/** How a missing detail reads inside a chip ("Missing: page count"). */
const MISSING_CHIP_LABELS: Record<MissingFilter, string> = {
  cover: "cover",
  pages: "page count",
  isbn: "ISBN",
  tags: "tags",
};

/**
 * The active filters that have no control of their own on the bar, as
 * chips: author, each tag in or out, finished year, rating, missing detail
 * and series. `ratingLabel` words a minimum rating in the reader's style.
 */
export function activeFilterChips(
  filters: LibraryFilters,
  ratingLabel: (minRating: string) => string,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.author) {
    chips.push({ id: "author", label: `Author: ${filters.author}`, clear: { author: "" } });
  }
  const include = tagList(filters.tag);
  for (const t of include) {
    const rest = include.filter((x) => x !== t);
    chips.push({
      id: `tag:${t}`,
      label: `Tag: ${t}`,
      clear: { tag: rest.join(","), tagMatch: rest.length > 0 ? filters.tagMatch : "" },
    });
  }
  const exclude = tagList(filters.notTag);
  for (const t of exclude) {
    chips.push({
      id: `notTag:${t}`,
      label: `Not tagged: ${t}`,
      clear: { notTag: exclude.filter((x) => x !== t).join(",") },
    });
  }
  if (filters.finished) {
    chips.push({ id: "finished", label: `Finished in ${filters.finished}`, clear: { finished: "" } });
  }
  if (filters.minRating) {
    chips.push({
      id: "minRating",
      label: filters.minRating === "unrated" ? "Unrated" : `Rating: ${ratingLabel(filters.minRating)}`,
      clear: { minRating: "" },
    });
  }
  if ((MISSING_FILTERS as readonly string[]).includes(filters.missing)) {
    chips.push({
      id: "missing",
      label: `Missing: ${MISSING_CHIP_LABELS[filters.missing as MissingFilter]}`,
      clear: { missing: "" },
    });
  }
  if (filters.series) {
    chips.push({ id: "series", label: `Series: ${filters.series}`, clear: { series: "" } });
  }
  return chips;
}

/** Tags picked in and out in the tag filter. */
export interface TagSelection {
  include: string[];
  exclude: string[];
}

/** One tag set to in, not or off. A tag is never in both lists: ticking it
 *  clears its "not", and the other way round. */
export function setTagState(
  sel: TagSelection,
  tag: string,
  state: "in" | "not" | "off",
): TagSelection {
  const include = sel.include.filter((t) => t !== tag);
  const exclude = sel.exclude.filter((t) => t !== tag);
  if (state === "in") include.push(tag);
  if (state === "not") exclude.push(tag);
  return { include, exclude };
}

const SEARCH_FIELD_WORDS: Record<SearchField, string> = {
  tags: "tags",
  isbn: "ISBN",
  review: "review",
};

/** The search box's placeholder, naming what it searches. */
export function searchPlaceholder(fields: readonly SearchField[]): string {
  const words = [
    "title",
    "author",
    ...(["tags", "isbn", "review"] as const)
      .filter((f) => fields.includes(f))
      .map((f) => SEARCH_FIELD_WORDS[f]),
  ];
  return `Search ${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}…`;
}
