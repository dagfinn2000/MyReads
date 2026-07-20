import { cachedLookup } from "./cache";
import type { BookDetails, BookMetadata } from "./types";

/**
 * Google Books client — optional. Only active when GOOGLE_BOOKS_API_KEY is
 * set; used to (a) enrich Open Library picks with better descriptions and
 * page counts, and (b) as a search fallback when Open Library is down or
 * returns nothing.
 */
export function googleBooksEnabled(): boolean {
  return !!process.env.GOOGLE_BOOKS_API_KEY;
}

interface GbVolume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    publishedDate?: string;
    categories?: string[];
    industryIdentifiers?: { type?: string; identifier?: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

interface GbResponse {
  items?: GbVolume[];
}

async function gbQuery(q: string, limit: number): Promise<GbResponse | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY!);

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  return (await res.json()) as GbResponse;
}

function volumeIsbn(v: GbVolume): string | null {
  const ids = v.volumeInfo?.industryIdentifiers ?? [];
  return (
    ids.find((i) => i.type === "ISBN_13")?.identifier ??
    ids.find((i) => i.type === "ISBN_10")?.identifier ??
    null
  );
}

/** Google serves image links over http; browsers will block that on an https page. */
function httpsify(url: string | undefined): string | null {
  return url ? url.replace(/^http:/, "https:") : null;
}

function toMetadata(v: GbVolume): BookMetadata | null {
  const info = v.volumeInfo;
  if (!info?.title) return null;
  return {
    title: info.title,
    authors: info.authors ?? [],
    isbn: volumeIsbn(v),
    coverUrl: httpsify(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    description: info.description ?? null,
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    tags: (info.categories ?? []).slice(0, 5).map((c) => c.toLowerCase()),
    openLibraryId: null,
    source: "googlebooks",
  };
}

/** Full-text search, used as fallback when Open Library yields nothing. */
export async function searchGoogleBooks(
  query: string,
  limit = 10,
): Promise<BookMetadata[]> {
  if (!googleBooksEnabled()) return [];
  // The limit is part of the key: the import search (10) and the cover
  // picker (6) must not overwrite each other's cached result lists.
  const data = await cachedLookup<GbResponse>("gb-search", `${query}|${limit}`, () =>
    gbQuery(query, limit),
  );
  return (data?.items ?? [])
    .map(toMetadata)
    .filter((m): m is BookMetadata => m !== null);
}

/**
 * Looks up a single volume for enrichment — by ISBN when available (exact),
 * otherwise by title + author (best effort).
 */
export async function getGoogleBooksDetails(params: {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
}): Promise<BookDetails | null> {
  if (!googleBooksEnabled()) return null;

  let q: string;
  if (params.isbn) {
    q = `isbn:${params.isbn}`;
  } else if (params.title) {
    q = `intitle:"${params.title}"${params.author ? ` inauthor:"${params.author}"` : ""}`;
  } else {
    return null;
  }

  const data = await cachedLookup<GbResponse>("gb-volume", q, () =>
    gbQuery(q, 1),
  );
  const info = data?.items?.[0]?.volumeInfo;
  if (!info) return null;

  return {
    description: info.description ?? null,
    pageCount: info.pageCount ?? null,
    tags: (info.categories ?? []).slice(0, 5).map((c) => c.toLowerCase()),
    coverUrl: httpsify(info.imageLinks?.thumbnail),
  };
}
