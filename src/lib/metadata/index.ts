import { searchOpenLibrary, getOpenLibraryDetails } from "./openlibrary";
import {
  searchGoogleBooks,
  getGoogleBooksDetails,
  googleBooksEnabled,
} from "./googlebooks";
import type { BookDetails, BookMetadata } from "./types";

export type { BookDetails, BookMetadata };

/**
 * Searches for book metadata. Open Library is the primary source; Google
 * Books (if configured) fills in only when Open Library returns nothing —
 * typically very new or region-specific titles.
 */
export async function searchBooks(query: string): Promise<BookMetadata[]> {
  const fromOl = await searchOpenLibrary(query);
  if (fromOl.length > 0) return fromOl;
  return searchGoogleBooks(query);
}

/**
 * Fetches the "expensive" fields (description, subjects) for a selected
 * search result, merging Open Library work details with an optional Google
 * Books enrichment pass. Google's descriptions and page counts are often
 * better than Open Library's, so when both exist Google wins for those
 * fields while tags are combined.
 */
export async function getBookDetails(params: {
  openLibraryId?: string | null;
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
}): Promise<BookDetails> {
  const [ol, gb] = await Promise.all([
    params.openLibraryId
      ? getOpenLibraryDetails(params.openLibraryId)
      : Promise.resolve(null),
    googleBooksEnabled()
      ? getGoogleBooksDetails(params)
      : Promise.resolve(null),
  ]);

  const tags = [...new Set([...(gb?.tags ?? []), ...(ol?.tags ?? [])])].slice(0, 6);

  return {
    description: gb?.description ?? ol?.description ?? null,
    pageCount: gb?.pageCount ?? ol?.pageCount ?? null,
    tags,
    coverUrl: gb?.coverUrl ?? ol?.coverUrl ?? null,
  };
}
