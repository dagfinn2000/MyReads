"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  catalogueBookValues,
  diffAgainstForm,
  type CatalogueDiffRow,
  type CatalogueField,
  type CatalogueValues,
} from "@/lib/catalogue-values";
import { isbnVariants, looksLikeIsbn, normalizeIsbn } from "@/lib/isbn";
import type { BookDetails, BookMetadata } from "@/lib/metadata/types";
import type { TagImportSettings } from "@/lib/tag-rules";
import { foldForSearch } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TOO_MANY = "Too many lookups this minute. Try again in a moment.";
const UNREACHABLE = "Couldn't reach the book catalogues.";

/** A lookup that ends with something to say instead of values. */
class LookupMessage extends Error {}

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new LookupMessage(UNREACHABLE);
  }
  if (res.status === 429) throw new LookupMessage(TOO_MANY);
  if (!res.ok) throw new LookupMessage(UNREACHABLE);
  return (await res.json()) as T;
}

async function search(q: string): Promise<BookMetadata[]> {
  return (await getJson<{ results?: BookMetadata[] }>(`/api/metadata/search?q=${encodeURIComponent(q)}`))
    .results ?? [];
}

/**
 * What the catalogues say about the book in the form. With an ISBN, that
 * edition's search row (the first row if none has the same ISBN); with
 * only an Open Library id, just the details; with neither, a search by
 * title and first author whose first row counts only if its title is the
 * same. Then the details for whatever was found. Each request spends from
 * the reader's lookup budget, like the add page's search.
 */
async function lookUpCatalogue(
  current: CatalogueValues,
  settings: TagImportSettings,
): Promise<CatalogueValues> {
  const isbn = looksLikeIsbn(current.isbn) ? normalizeIsbn(current.isbn) : "";
  const olid = current.openLibraryId.trim();
  const title = current.title.trim();
  const author = current.authors.split(",")[0]?.trim() ?? "";

  let row: BookMetadata | null = null;
  if (isbn) {
    const variants = isbnVariants(isbn);
    const rows = await search(isbn);
    row = rows.find((r) => r.isbn && variants.includes(normalizeIsbn(r.isbn))) ?? rows[0] ?? null;
    if (!row && !olid) throw new LookupMessage("Couldn't find this ISBN in the catalogues.");
  } else if (!olid) {
    const q = [title, author].filter(Boolean).join(" ");
    const first = q.length >= 3 ? (await search(q))[0] : undefined;
    if (!first || foldForSearch(first.title.trim()) !== foldForSearch(title)) {
      throw new LookupMessage("Couldn't find this exact book. Add its ISBN and try again.");
    }
    row = first;
  }

  const params = new URLSearchParams();
  const detailsOlid = olid || row?.openLibraryId;
  const detailsIsbn = isbn || row?.isbn;
  if (detailsOlid) params.set("olid", detailsOlid);
  if (detailsIsbn) params.set("isbn", detailsIsbn);
  params.set("title", title || row?.title || "");
  const detailsAuthor = author || row?.authors[0];
  if (detailsAuthor) params.set("author", detailsAuthor);
  let details: BookDetails | null = null;
  try {
    details = (await getJson<{ details: BookDetails }>(`/api/metadata/details?${params}`)).details;
  } catch (e) {
    // The search row alone is still worth offering.
    if (!row) throw e;
  }

  const values = catalogueBookValues(row, details, settings, isbn || undefined);
  // An Open Library row found by title carries the ISBN of any edition of
  // the work, which may not be this copy's.
  if (!isbn && row?.source === "openlibrary") values.isbn = "";
  return values;
}

function shorten(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

/**
 * "Look up details" on the edit page: asks the catalogues about the book
 * and offers what they know as ticked or unticked rows. Empty fields come
 * ticked; anything that would replace what the reader typed comes
 * unticked. Filling puts the values into the form, which still has to be
 * saved.
 */
export function LookupDetails({
  settings,
  read,
  onFill,
}: {
  settings: TagImportSettings;
  /** The form's current values. */
  read: () => CatalogueValues;
  onFill: (rows: CatalogueDiffRow[]) => void;
}) {
  const headingId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CatalogueDiffRow[] | null>(null);
  const [ticked, setTicked] = useState<Set<CatalogueField>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  async function lookUp() {
    setLoading(true);
    setRows(null);
    setMessage(null);
    const current = read();
    try {
      const offered = diffAgainstForm(current, await lookUpCatalogue(current, settings));
      if (offered.length === 0) {
        setMessage("The catalogue has nothing new for this book.");
      } else {
        setRows(offered);
        setTicked(new Set(offered.filter((r) => r.checked).map((r) => r.field)));
      }
    } catch (e) {
      setMessage(e instanceof LookupMessage ? e.message : UNREACHABLE);
    } finally {
      setLoading(false);
    }
  }

  function close(said: string | null) {
    setRows(null);
    setMessage(said);
    buttonRef.current?.focus();
  }

  function fill() {
    const chosen = (rows ?? []).filter((r) => ticked.has(r.field));
    onFill(chosen);
    close(
      chosen.length === 0
        ? null
        : `Filled in ${chosen.length} field${chosen.length === 1 ? "" : "s"}. Save changes to keep them.`,
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button ref={buttonRef} type="button" variant="outline" onClick={lookUp} disabled={loading}>
          {loading ? <Loader2 data-slot="icon" className="animate-spin" /> : <Search data-slot="icon" />}
          Look up details
        </Button>
        {/* Always in the page, so screen readers hear each new message. */}
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      </div>

      {rows && (
        <section aria-labelledby={headingId} className="grid gap-3 rounded-lg border bg-card p-3">
          <h2 id={headingId} className="text-sm font-semibold">
            From the catalogue
          </h2>
          <ul className="grid gap-3">
            {rows.map((r) => (
              <li key={r.field}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={ticked.has(r.field)}
                    onChange={(e) => {
                      const next = new Set(ticked);
                      if (e.target.checked) next.add(r.field);
                      else next.delete(r.field);
                      setTicked(next);
                    }}
                  />
                  <span className="grid min-w-0 gap-0.5 text-sm">
                    <span className="font-medium">{r.label}</span>
                    {r.field === "coverUrl" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.value}
                        alt="Catalogue cover"
                        className="h-16 w-11 rounded bg-muted object-cover"
                      />
                    ) : (
                      <span className="break-words">
                        {r.field === "tags" ? `Add ${r.value}` : shorten(r.value)}
                      </span>
                    )}
                    {r.field !== "coverUrl" && (
                      <span className="break-words text-xs text-muted-foreground">
                        Now: {r.current ? shorten(r.current, 80) : "empty"}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={fill}>
              Fill in ticked fields
            </Button>
            <Button type="button" variant="outline" onClick={() => close(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
