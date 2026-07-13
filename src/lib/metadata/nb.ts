import { cachedLookup } from "./cache";
import type { BookMetadata } from "./types";

/**
 * National Library of Norway (Nasjonalbiblioteket) client — keyless, and by
 * far the best source for Norwegian editions: legal deposit means essentially
 * every book published in Norway is in the catalog with a cover scan.
 * https://api.nb.no/catalog/v1/items
 *
 * Deliberately polled *after* Open Library and Google Books in the search
 * chain; its main job is supplying Norwegian-edition covers and ISBN matches.
 *
 * Cover images for in-copyright books are only served as small thumbnails
 * (~200px high) — larger IIIF sizes return 403.
 */
const UA = "myreads/1.0 (self-hosted personal library)";

interface NbItem {
  metadata?: {
    title?: string;
    /** "Last, First" strings. */
    creators?: string[];
    identifiers?: { isbn13?: string[]; isbn10?: string[] };
    originInfo?: { issued?: string };
    pageCount?: number;
  };
  _links?: {
    /** IIIF image URL at 200px height — the largest freely served size. */
    thumbnail_large?: { href?: string };
  };
}

interface NbResponse {
  _embedded?: { items?: NbItem[] };
}

async function nbQuery(q: string, size: number): Promise<NbResponse | null> {
  const url = new URL("https://api.nb.no/catalog/v1/items");
  url.searchParams.set("q", q);
  url.searchParams.set("filter", "mediatype:bøker");
  url.searchParams.set("size", String(size));

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as NbResponse;
}

/** nb.no lists creators as "Nesbø, Jo"; flip to the "Jo Nesbø" everything
 *  else in the app uses. Names without exactly one comma pass through. */
function flipName(creator: string): string {
  const parts = creator.split(",").map((p) => p.trim());
  return parts.length === 2 && parts[0] && parts[1]
    ? `${parts[1]} ${parts[0]}`
    : creator;
}

function toMetadata(item: NbItem): BookMetadata | null {
  const md = item.metadata;
  if (!md?.title) return null;
  return {
    title: md.title,
    authors: (md.creators ?? []).map(flipName),
    isbn: md.identifiers?.isbn13?.[0] ?? md.identifiers?.isbn10?.[0] ?? null,
    coverUrl: item._links?.thumbnail_large?.href ?? null,
    description: null,
    pageCount: md.pageCount ?? null,
    publishedDate: md.originInfo?.issued ?? null,
    tags: [],
    openLibraryId: null,
    source: "nb",
  };
}

/** Searches the nb.no catalog. Used as the last link in the search chain. */
export async function searchNb(
  query: string,
  limit = 10,
): Promise<BookMetadata[]> {
  const data = await cachedLookup<NbResponse>("nb-search", query, () =>
    nbQuery(query, limit),
  );
  return (data?._embedded?.items ?? [])
    .map(toMetadata)
    .filter((m): m is BookMetadata => m !== null);
}

/**
 * Looks up the cover for a specific edition by ISBN — exact matches only,
 * which is what makes nb.no valuable: scanning the barcode on a Norwegian
 * book yields the Norwegian cover, not the original edition's.
 */
export async function getNbCoverByIsbn(isbn: string): Promise<string | null> {
  const data = await cachedLookup<NbResponse>("nb-isbn", isbn, () =>
    nbQuery(`isbn:${isbn}`, 1),
  );
  return data?._embedded?.items?.[0]?._links?.thumbnail_large?.href ?? null;
}
