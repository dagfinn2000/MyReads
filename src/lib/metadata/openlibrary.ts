import { cachedLookup } from "./cache";
import type { BookDetails, BookMetadata } from "./types";

/**
 * Open Library client — the primary (and keyless) metadata source.
 * https://openlibrary.org/dev/docs/api/search
 *
 * Open Library asks API consumers to send an identifying User-Agent.
 */
const UA = "bibliotek/1.0 (self-hosted personal library)";

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
    query,
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

  return (data?.docs ?? [])
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
