import { isbnVariants, normalizeIsbn } from "@/lib/isbn";
import { searchOpenLibrary, getOpenLibraryDetails } from "./openlibrary";
import {
  searchGoogleBooks,
  getGoogleBooksDetails,
  googleBooksEnabled,
} from "./googlebooks";
import { searchNb, getNbCoverByIsbn } from "./nb";
import type { BookDetails, BookMetadata, CoverCandidate } from "./types";

export type { BookDetails, BookMetadata, CoverCandidate };

/** Same-edition key: the ISBN-13 form when one exists, so an ISBN-10 from
 *  one source matches its ISBN-13 twin from another. */
function editionKey(isbn: string): string {
  return isbnVariants(isbn).find((v) => v.length === 13) ?? normalizeIsbn(isbn);
}

/**
 * Searches every metadata source in parallel and returns all their results:
 * Open Library first, then Google Books (when configured), then the
 * National Library of Norway. No single catalog knows every edition — nb.no
 * is often the only one with the Norwegian printing — so the sources are
 * shown side by side rather than as fallbacks for each other. Rows that
 * resolve to the same edition (same ISBN, in either form) appear once, from
 * the highest-priority source; that also keeps a barcode scan resolving to
 * exactly one row, which is what lets the scan flow auto-pick it.
 */
export async function searchBooks(query: string): Promise<BookMetadata[]> {
  const [fromOl, fromGb, fromNb] = await Promise.all([
    searchOpenLibrary(query).catch(() => []),
    searchGoogleBooks(query).catch(() => []),
    searchNb(query).catch(() => []),
  ]);

  const seen = new Set<string>();
  const results: BookMetadata[] = [];
  for (const r of [...fromOl, ...fromGb, ...fromNb]) {
    if (r.isbn) {
      const key = editionKey(r.isbn);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    results.push(r);
  }
  return results;
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
  // Search hits are interleaved round-robin so every source keeps a fair
  // share of the capped grid — appended list-by-list, Open Library and
  // Google would fill all twelve slots before a single nb.no cover showed.
  const searchLists = [olSearch, gbSearch, nbSearch];
  const longest = Math.max(...searchLists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of searchLists) {
      const r = list[i];
      if (r?.coverUrl) candidates.push({ url: r.coverUrl, source: r.source });
    }
  }

  // Dedupe by URL, cap the grid at a screenful.
  const seen = new Set<string>();
  return candidates
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
    .slice(0, 12);
}
