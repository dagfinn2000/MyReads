import type { Prisma } from "@prisma/client";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { searchTerms } from "@/lib/utils";

/** The library view's filter state, as it appears in the URL. */
export interface LibraryFilters {
  shelf: string;
  shelfId: string;
  q: string;
  tag: string;
  format: string;
  owned: string;
  minRating: string;
  series: string;
}

/** A URL parameter as a string. Null bytes are dropped: Postgres refuses
 *  them in text, so `?tag=%00` used to crash the page. */
function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.replace(/\0/g, "") : "";
}

/** Filter value -> ownership state. "lent" is not an ownership state at all
 *  (a lent book is still owned), so it is handled separately below. */
const OWNERSHIP_FILTERS: Record<string, BookOwnership | undefined> = {
  owned: BookOwnership.OWNED,
  wishlist: BookOwnership.WISHLIST,
  borrowed: BookOwnership.BORROWED,
  given_away: BookOwnership.GIVEN_AWAY,
};

/** Reads the filter state out of a searchParams object. */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): LibraryFilters {
  return {
    shelf: param(sp.shelf) || "all",
    shelfId: param(sp.shelfId),
    q: param(sp.q).trim(),
    tag: param(sp.tag),
    format: param(sp.format),
    owned: param(sp.owned) || "all",
    minRating: param(sp.minRating),
    series: param(sp.series),
  };
}

/**
 * The Prisma `where` for a filter state. Shared by the library page and the
 * "Pick for me" action so the two can never disagree about what "the current
 * view" means — the pick has to respect exactly the filters on screen.
 */
export function buildBookWhere(
  userId: string,
  filters: LibraryFilters,
): Prisma.BookWhereInput {
  const shelf = Object.values(ReadingStatus).find((s) => s === filters.shelf);
  const format = Object.values(BookFormat).find((f) => f === filters.format);
  // The URL keeps the `owned` param name so existing bookmarks and shared
  // links still work; its values just grew beyond owned/wishlist.
  const ownership = OWNERSHIP_FILTERS[filters.owned];
  const minRating = parseInt(filters.minRating, 10);
  const terms = searchTerms(filters.q);

  return {
    userId,
    ...(shelf && { status: shelf }),
    ...(format && { format }),
    ...(ownership && { ownership }),
    ...(filters.owned === "lent" && { loans: { some: { returnedAt: null } } }),
    ...(minRating >= 1 && { rating: { gte: minRating } }),
    ...(filters.tag && filters.tag !== "all" && { tags: { has: filters.tag } }),
    ...(filters.shelfId && { shelves: { some: { id: filters.shelfId } } }),
    ...(filters.series && {
      seriesName: { equals: filters.series, mode: "insensitive" as const },
    }),
    // Every word has to appear somewhere in title, authors or series.
    ...(terms.length > 0 && {
      AND: terms.map((t) => ({ searchText: { contains: t } })),
    }),
  };
}
