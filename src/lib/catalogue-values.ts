import { isbnVariants, looksLikeIsbn, normalizeIsbn } from "@/lib/isbn";
import type { BookDetails, BookMetadata } from "@/lib/metadata/types";
import { catalogueTags, type TagImportSettings } from "@/lib/tag-rules";

/**
 * Turning what the catalogues say about a book into book-form values, and
 * comparing those with what a form already holds. Pure and client-safe:
 * the import search, the shelf scan (server side) and the edit page's
 * "Look up details" all go through here, so a book gets the same page
 * count, tags and Open Library id whichever way it came in.
 */

/** The catalogue's fields as the book form holds them: all strings. */
export interface CatalogueValues {
  title: string;
  authors: string; // comma-separated
  isbn: string;
  description: string;
  coverUrl: string;
  pageCount: string;
  publishedDate: string;
  tags: string; // comma-separated
  openLibraryId: string;
}

export type CatalogueField = keyof CatalogueValues;

/**
 * The best page count on offer. An Open Library search row only knows the
 * median across every edition of the work, so the details' count (Google's
 * or the exact edition's) comes first. An nb.no or Google row describes
 * one edition, so its own count does.
 */
export function bestPageCount(
  row: Pick<BookMetadata, "source" | "pageCount"> | null,
  detailsPageCount: number | null | undefined,
): number | null {
  const details = detailsPageCount ?? null;
  if (!row) return details;
  return row.source === "openlibrary" ? (details ?? row.pageCount) : (row.pageCount ?? details);
}

/**
 * Form values for a catalogue's book: the search row (if there is one) plus
 * the details fetched for it, with the subjects run through the reader's
 * tag settings. `scannedIsbn` is the code the reader scanned or searched
 * for; it wins over the row's ISBN, which for an Open Library row can be
 * any edition of the work.
 */
export function catalogueBookValues(
  row: BookMetadata | null,
  details: Partial<BookDetails> | null,
  tagImport: TagImportSettings,
  scannedIsbn?: string,
): CatalogueValues {
  const pages = bestPageCount(row, details?.pageCount);
  return {
    title: row?.title ?? "",
    authors: row?.authors.join(", ") ?? "",
    isbn: scannedIsbn && looksLikeIsbn(scannedIsbn) ? normalizeIsbn(scannedIsbn) : (row?.isbn ?? ""),
    description: details?.description ?? row?.description ?? "",
    coverUrl: row?.coverUrl ?? details?.coverUrl ?? "",
    pageCount: pages ? String(pages) : "",
    publishedDate: row?.publishedDate ?? "",
    tags: catalogueTags([...(row?.tags ?? []), ...(details?.tags ?? [])], tagImport).join(", "),
    openLibraryId: row?.openLibraryId ?? details?.openLibraryId ?? "",
  };
}

export const CATALOGUE_FIELD_LABELS: Record<CatalogueField, string> = {
  title: "Title",
  authors: "Author(s)",
  isbn: "ISBN",
  description: "Description",
  coverUrl: "Cover",
  pageCount: "Pages",
  publishedDate: "Published",
  tags: "Tags",
  openLibraryId: "Open Library id",
};

/** One field the catalogue could fill in. */
export interface CatalogueDiffRow {
  field: CatalogueField;
  label: string;
  /** What the form holds now ("" = empty). */
  current: string;
  /** What filling it in would put there. For tags, only the new ones,
   *  which are added to the reader's own. */
  value: string;
  /** Ticked to begin with: only when the form's field is empty. */
  checked: boolean;
}

function splitList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** A value as compared: equal after this means nothing to offer. */
function comparable(field: CatalogueField, value: string): string {
  const v = value.trim().replace(/\s+/g, " ");
  switch (field) {
    case "title":
      return v.toLowerCase();
    case "authors":
      return splitList(v.toLowerCase()).join(",");
    case "isbn":
      return normalizeIsbn(v);
    case "pageCount": {
      const n = Number(v);
      return v && Number.isFinite(n) ? String(n) : v;
    }
    default:
      return v;
  }
}

function sameIsbn(a: string, b: string): boolean {
  if (!a || !b) return false;
  return isbnVariants(a).includes(normalizeIsbn(b));
}

/**
 * The fields the catalogue could fill in on a form, in form order. A field
 * is offered when the catalogue has a value and it differs from the form's
 * (ignoring case and spacing in the title and authors, hyphens in the ISBN
 * and the other ISBN form, and how a number is written). Empty fields come
 * ticked; ones that differ come unticked, so nothing the reader typed is
 * overwritten by accident. Tags are only ever added to, the cover is only
 * offered for a book without one (the cover picker changes covers), and the
 * Open Library id only when there is none.
 */
export function diffAgainstForm(
  current: CatalogueValues,
  catalogue: CatalogueValues,
): CatalogueDiffRow[] {
  const rows: CatalogueDiffRow[] = [];
  const order: CatalogueField[] = [
    "title",
    "authors",
    "isbn",
    "pageCount",
    "publishedDate",
    "tags",
    "description",
    "coverUrl",
    "openLibraryId",
  ];
  for (const field of order) {
    const now = current[field].trim();
    const offered = catalogue[field].trim();
    if (!offered) continue;
    const row = { field, label: CATALOGUE_FIELD_LABELS[field], current: now };

    if (field === "tags") {
      const have = new Set(splitList(now.toLowerCase()));
      const added = splitList(offered).filter((t) => !have.has(t.toLowerCase()));
      if (added.length > 0) rows.push({ ...row, value: added.join(", "), checked: !now });
      continue;
    }
    if ((field === "coverUrl" || field === "openLibraryId") && now) continue;
    if (field === "isbn" && sameIsbn(now, offered)) continue;
    if (comparable(field, now) === comparable(field, offered)) continue;
    rows.push({ ...row, value: offered, checked: !now });
  }
  return rows;
}
