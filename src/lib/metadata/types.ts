/** Normalized book metadata, independent of which API it came from. */
export interface BookMetadata {
  title: string;
  authors: string[];
  isbn: string | null;
  coverUrl: string | null;
  description: string | null;
  pageCount: number | null;
  publishedDate: string | null;
  tags: string[];
  openLibraryId: string | null;
  source: "openlibrary" | "googlebooks" | "nb";
}

/** A candidate cover image offered by the cover picker. */
export interface CoverCandidate {
  url: string;
  source: BookMetadata["source"];
}

/** Extra fields fetched lazily when the user picks a search result. */
export interface BookDetails {
  description: string | null;
  pageCount: number | null;
  tags: string[];
  coverUrl: string | null;
}
