import { searchOpenLibrary, getOpenLibraryDetails } from "./openlibrary";
import {
  searchGoogleBooks,
  getGoogleBooksDetails,
  googleBooksEnabled,
} from "./googlebooks";
import { searchNb, getNbCoverByIsbn } from "./nb";
import type { BookDetails, BookMetadata, CoverCandidate } from "./types";

export type { BookDetails, BookMetadata, CoverCandidate };

/**
 * Searches for book metadata. Open Library is the primary source; Google
 * Books (if configured) fills in when Open Library returns nothing, and the
 * National Library of Norway is the final fallback — typically the only one
 * that knows Norwegian editions.
 */
export async function searchBooks(query: string): Promise<BookMetadata[]> {
  const fromOl = await searchOpenLibrary(query);
  if (fromOl.length > 0) return fromOl;
  const fromGb = await searchGoogleBooks(query);
  if (fromGb.length > 0) return fromGb;
  return searchNb(query);
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

/** Open Library's cover-by-ISBN endpoint 404s (rather than serving a
 *  placeholder) with default=false, so a HEAD request tells us if it exists. */
async function olIsbnCover(isbn: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

/**
 * Gathers candidate cover images from every source for the cover picker.
 * ISBN lookups are exact (the right edition); title searches cast a wider
 * net. All sources are queried in parallel and failures are simply dropped.
 */
export async function getCoverCandidates(params: {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
}): Promise<CoverCandidate[]> {
  const { isbn, title, author } = params;
  const titleQuery = title
    ? `${title}${author ? ` ${author}` : ""}`.trim()
    : null;

  const [olByIsbn, nbByIsbn, gbDetails, olSearch, gbSearch, nbSearch] =
    await Promise.all([
      isbn ? olIsbnCover(isbn) : Promise.resolve(null),
      isbn ? getNbCoverByIsbn(isbn).catch(() => null) : Promise.resolve(null),
      googleBooksEnabled() && (isbn || title)
        ? getGoogleBooksDetails(params).catch(() => null)
        : Promise.resolve(null),
      titleQuery ? searchOpenLibrary(titleQuery, 6).catch(() => []) : [],
      titleQuery && googleBooksEnabled()
        ? searchGoogleBooks(titleQuery, 6).catch(() => [])
        : [],
      titleQuery ? searchNb(titleQuery, 6).catch(() => []) : [],
    ]);

  const candidates: CoverCandidate[] = [];
  // Exact-edition (ISBN) hits first — most likely to be the copy you own.
  if (olByIsbn) candidates.push({ url: olByIsbn, source: "openlibrary" });
  if (nbByIsbn) candidates.push({ url: nbByIsbn, source: "nb" });
  if (gbDetails?.coverUrl)
    candidates.push({ url: gbDetails.coverUrl, source: "googlebooks" });
  for (const list of [olSearch, gbSearch, nbSearch]) {
    for (const r of list) {
      if (r.coverUrl) candidates.push({ url: r.coverUrl, source: r.source });
    }
  }

  // Dedupe by URL, cap the grid at a screenful.
  const seen = new Set<string>();
  return candidates
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
    .slice(0, 12);
}
