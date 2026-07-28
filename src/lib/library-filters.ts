import type { Prisma } from "@prisma/client";
import { BookFormat, ReadingStatus } from "@prisma/client";

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

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

/** Reads the filter state out of a searchParams object. */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): LibraryFilters {
  return {
    shelf: param(sp.shelf) || "all",
    shelfId: param(sp.shelfId),
    q: param(sp.q),
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
  const minRating = parseInt(filters.minRating, 10);

  return {
    userId,
    ...(shelf && { status: shelf }),
    ...(format && { format }),
    ...(filters.owned === "owned" && { owned: true }),
    ...(filters.owned === "wishlist" && { owned: false }),
    ...(minRating >= 1 && { rating: { gte: minRating } }),
    ...(filters.tag && filters.tag !== "all" && { tags: { has: filters.tag } }),
    ...(filters.shelfId && { shelves: { some: { id: filters.shelfId } } }),
    ...(filters.series && {
      seriesName: { equals: filters.series, mode: "insensitive" as const },
    }),
    ...(filters.q && { searchText: { contains: filters.q.toLowerCase() } }),
  };
}
