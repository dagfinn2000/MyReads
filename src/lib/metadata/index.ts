import { isbnVariants, normalizeIsbn } from "@/lib/isbn";
import {
  searchOpenLibrary,
  getOpenLibraryDetails,
  getOpenLibraryEdition,
} from "./openlibrary";
import {
  searchGoogleBooks,
  getGoogleBooksDetails,
  googleBooksEnabled,
} from "./googlebooks";
import { searchNb, getNbCoverByIsbn } from "./nb";
import type { BookDetails, BookMetadata, CoverCandidate } from "./types";
import type { Catalogue } from "@/lib/preferences";

export type { BookDetails, BookMetadata, CoverCandidate };

/** Thrown by searchBooks when not one catalogue answered, so callers can say
 *  "couldn't reach the catalogues" instead of "no results". */
export class CataloguesUnreachableError extends Error {
  constructor() {
    super("Couldn't reach the book catalogues");
    this.name = "CataloguesUnreachableError";
  }
}

/** Every catalogue, in the default priority order. Callers pass the
 *  reader's own list (Preferences) to switch some off or reorder them. */
const ALL_CATALOGUES: readonly Catalogue[] = ["openlibrary", "google", "nb"];

/** The catalogues worth asking: the chosen ones, minus Google Books when
 *  this server has no key for it. A list that leaves nothing (Google only,
 *  on a server without a key) falls back to the keyless two. */
function askable(sources: readonly Catalogue[]): Catalogue[] {
  const asked = sources.filter((s) => s !== "google" || googleBooksEnabled());
  return asked.length > 0 ? asked : ["openlibrary", "nb"];
}

/** Same-edition key: the ISBN-13 form when one exists, so an ISBN-10 from
 *  one source matches its ISBN-13 twin from another. */
function editionKey(isbn: string): string {
  return isbnVariants(isbn).find((v) => v.length === 13) ?? normalizeIsbn(isbn);
}

/**
 * Searches the metadata sources in parallel and returns all their results,
 * in priority order: by default Open Library first, then Google Books (when
 * configured), then the National Library of Norway; `sources` is the
 * reader's own choice and order from Preferences. No single catalog knows
 * every edition — nb.no is often the only one with the Norwegian printing —
 * so the sources are shown side by side rather than as fallbacks for each
 * other. Rows that resolve to the same edition (same ISBN, in either form)
 * appear once, from the highest-priority source; that also keeps a barcode
 * scan resolving to exactly one row, which is what lets the scan flow
 * auto-pick it.
 *
 * One source failing is normal and its rows are simply missing. If every
 * source asked failed, this throws CataloguesUnreachableError.
 */
export async function searchBooks(
  query: string,
  sources: readonly Catalogue[] = ALL_CATALOGUES,
): Promise<BookMetadata[]> {
  const search: Record<Catalogue, () => Promise<BookMetadata[]>> = {
    openlibrary: () => searchOpenLibrary(query),
    google: () => searchGoogleBooks(query),
    nb: () => searchNb(query),
  };
  const settled = await Promise.allSettled(askable(sources).map((s) => search[s]()));
  if (settled.every((s) => s.status === "rejected")) throw new CataloguesUnreachableError();

  const seen = new Set<string>();
  const results: BookMetadata[] = [];
  for (const r of settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []))) {
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
 *
 * With an ISBN, Open Library's record of that exact edition is fetched too:
 * its page count beats the work's median, and its work id fills in an Open
 * Library id (and so the work's description and subjects) for a book found
 * in another catalogue. The id used comes back as `openLibraryId`.
 */
export async function getBookDetails(
  params: {
    openLibraryId?: string | null;
    isbn?: string | null;
    title?: string | null;
    author?: string | null;
  },
  sources: readonly Catalogue[] = ALL_CATALOGUES,
): Promise<BookDetails> {
  const asked = askable(sources);
  const useOl = asked.includes("openlibrary");
  const [olGiven, edition, gb] = await Promise.all([
    params.openLibraryId && useOl
      ? getOpenLibraryDetails(params.openLibraryId)
      : Promise.resolve(null),
    params.isbn && useOl ? getOpenLibraryEdition(params.isbn) : Promise.resolve(null),
    asked.includes("google")
      ? getGoogleBooksDetails(params)
      : Promise.resolve(null),
  ]);
  // No id given: the edition's work, fetched once the edition named it.
  const workId = params.openLibraryId || edition?.workId || null;
  const ol = olGiven ?? (useOl && workId ? await getOpenLibraryDetails(workId) : null);

  const tags = [...new Set([...(gb?.tags ?? []), ...(ol?.tags ?? [])])].slice(0, 6);

  return {
    description: gb?.description ?? ol?.description ?? null,
    pageCount: gb?.pageCount ?? edition?.pageCount ?? ol?.pageCount ?? null,
    tags,
    coverUrl: gb?.coverUrl ?? ol?.coverUrl ?? null,
    openLibraryId: workId,
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
export async function getCoverCandidates(
  params: {
    isbn?: string | null;
    title?: string | null;
    author?: string | null;
  },
  sources: readonly Catalogue[] = ALL_CATALOGUES,
): Promise<CoverCandidate[]> {
  const { isbn, title, author } = params;
  const titleQuery = title
    ? `${title}${author ? ` ${author}` : ""}`.trim()
    : null;
  const asked = askable(sources);

  /** The exact-edition cover and the title-search hits from one source. */
  const fromSource: Record<
    Catalogue,
    () => Promise<[CoverCandidate | null, BookMetadata[]]>
  > = {
    openlibrary: () =>
      Promise.all([
        isbn ? olIsbnCover(isbn) : Promise.resolve(null),
        titleQuery ? searchOpenLibrary(titleQuery, 6).catch(() => []) : [],
      ]).then(([url, hits]) => [url ? { url, source: "openlibrary" } : null, hits]),
    google: () =>
      Promise.all([
        isbn || title ? getGoogleBooksDetails(params).catch(() => null) : null,
        titleQuery ? searchGoogleBooks(titleQuery, 6).catch(() => []) : [],
      ]).then(([details, hits]) => [
        details?.coverUrl ? { url: details.coverUrl, source: "googlebooks" } : null,
        hits,
      ]),
    nb: () =>
      Promise.all([
        isbn ? getNbCoverByIsbn(isbn).catch(() => null) : Promise.resolve(null),
        titleQuery ? searchNb(titleQuery, 6).catch(() => []) : [],
      ]).then(([url, hits]) => [url ? { url, source: "nb" } : null, hits]),
  };
  const perSource = await Promise.all(asked.map((s) => fromSource[s]()));

  const candidates: CoverCandidate[] = [];
  // Exact-edition (ISBN) hits first — most likely to be the copy you own —
  // in the reader's catalogue order.
  for (const [exact] of perSource) if (exact) candidates.push(exact);
  // Search hits are interleaved round-robin so every source keeps a fair
  // share of the capped grid — appended list-by-list, Open Library and
  // Google would fill all twelve slots before a single nb.no cover showed.
  const searchLists = perSource.map(([, hits]) => hits);
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
