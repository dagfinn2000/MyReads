import { looksLikeIsbn, normalizeIsbn } from "@/lib/isbn";
import { cachedLookup } from "./cache";
import type { BookDetails, BookMetadata } from "./types";

/**
 * Open Library client — the primary (and keyless) metadata source.
 * https://openlibrary.org/dev/docs/api/search
 *
 * Open Library asks API consumers to send an identifying User-Agent.
 */
const UA = "myreads/1.0 (self-hosted personal library)";

const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "isbn",
  "cover_i",
  "first_publish_year",
  "number_of_pages_median",
].join(",");

interface OlSearchDoc {
  key?: string; // "/works/OL45883W"
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
}

interface OlSearchResponse {
  docs?: OlSearchDoc[];
}

/** Prefer an ISBN-13 when the edition list offers several identifiers. */
function pickIsbn(isbns: string[] | undefined): string | null {
  if (!isbns?.length) return null;
  return isbns.find((i) => i.length === 13) ?? isbns[0];
}

/**
 * Searches Open Library and returns normalized results. Responses are cached
 * in the database for a week, so retyping the same query is free.
 */
export async function searchOpenLibrary(
  query: string,
  limit = 10,
): Promise<BookMetadata[]> {
  const data = await cachedLookup<OlSearchResponse>(
    "ol-search",
    // The limit is part of the key: the import search (10) and the cover
    // picker (6) must not overwrite each other's cached result lists.
    `${query}|${limit}`,
    async () => {
      const url = new URL("https://openlibrary.org/search.json");
      url.searchParams.set("q", query);
      url.searchParams.set("fields", SEARCH_FIELDS);
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      return (await res.json()) as OlSearchResponse;
    },
  );

  // null means the request failed and nothing was cached: an outage, which
  // searchBooks needs to tell apart from "no matches".
  if (data === null) throw new Error("Open Library unavailable");
  return (data.docs ?? [])
    .filter((d) => d.title)
    .map((d) => ({
      title: d.title!,
      authors: d.author_name ?? [],
      isbn: pickIsbn(d.isbn),
      coverUrl: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
        : null,
      description: null, // requires a per-work request; fetched on selection
      pageCount: d.number_of_pages_median ?? null,
      publishedDate: d.first_publish_year?.toString() ?? null,
      tags: [],
      openLibraryId: d.key?.replace("/works/", "") ?? null,
      source: "openlibrary" as const,
    }));
}

interface OlWork {
  description?: string | { value?: string };
  subjects?: string[];
}

/**
 * Fetches description + subjects for one work — done lazily when the user
 * picks a search result, since it's an extra request per book.
 * Subjects on Open Library are noisy ("Accessible book", century-spanning
 * lists), so only a few short ones are kept as tag suggestions.
 */
export async function getOpenLibraryDetails(
  openLibraryId: string,
): Promise<BookDetails> {
  const work = await cachedLookup<OlWork>(
    "ol-work",
    openLibraryId,
    async () => {
      const res = await fetch(
        `https://openlibrary.org/works/${encodeURIComponent(openLibraryId)}.json`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) return null;
      return (await res.json()) as OlWork;
    },
  );

  const description =
    typeof work?.description === "string"
      ? work.description
      : (work?.description?.value ?? null);

  const tags = (work?.subjects ?? [])
    .filter((s) => s.length <= 25 && !/accessible|protected|reading level/i.test(s))
    .slice(0, 5)
    .map((s) => s.toLowerCase());

  return { description, pageCount: null, tags, coverUrl: null };
}

interface OlEdition {
  number_of_pages?: number;
  works?: { key?: string }[];
}

/**
 * One edition by ISBN: its own page count (search rows only carry the
 * median across every edition of the work) and the work it belongs to,
 * which finds an Open Library id for a book that came from another
 * catalogue. Null when Open Library has no such edition or can't be
 * reached; a 404 is not cached, so an edition added later is found then.
 */
export async function getOpenLibraryEdition(
  isbn: string,
): Promise<{ pageCount: number | null; workId: string | null } | null> {
  if (!looksLikeIsbn(isbn)) return null;
  const code = normalizeIsbn(isbn);
  // /isbn/{code}.json redirects to the edition's own record; fetch follows.
  const edition = await cachedLookup<OlEdition>("ol-edition", code, async () => {
    const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(code)}.json`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as OlEdition;
  });
  if (!edition) return null;

  const pages = edition.number_of_pages;
  const workKey = edition.works?.[0]?.key;
  return {
    pageCount: typeof pages === "number" && Number.isInteger(pages) && pages > 0 ? pages : null,
    workId: typeof workKey === "string" ? workKey.replace("/works/", "") || null : null,
  };
}
