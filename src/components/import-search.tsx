"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import type { BookMetadata } from "@/lib/metadata/types";
import type { BookFormValues } from "@/components/book-form";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Input } from "@/components/ui/input";

/**
 * Search-as-you-type against /api/metadata/search (Open Library, with
 * optional Google Books fallback server-side). Picking a result fetches the
 * lazy details (description, subjects) and hands a prefilled form-value
 * object to the parent, which switches to the review form.
 */
export function ImportSearch({
  onPick,
  initialQuery,
}: {
  onPick: (values: BookFormValues) => void;
  /** Seeds the search box (e.g. an ISBN from the check page) and auto-picks
   *  a single match, exactly like a barcode scan. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<BookMetadata[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Set when the query came from the barcode scanner (or an initialQuery):
  // an ISBN search that returns exactly one result skips the picking step.
  const autoPickRef = useRef(Boolean(initialQuery));

  /** Barcode scanner handoff — the ISBN just becomes the search query. */
  const handleScan = useCallback((isbn: string) => {
    autoPickRef.current = true;
    setQuery(isbn);
  }, []);

  // Debounced search: waits 400ms after the last keystroke, cancels any
  // in-flight request so stale responses can't overwrite newer ones.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/metadata/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        const list: BookMetadata[] = data.results ?? [];
        setResults(list);
        setSearching(false);
        if (autoPickRef.current) {
          autoPickRef.current = false;
          if (list.length === 1) {
            void pick(list[0], list[0].openLibraryId ?? `${list[0].title}-0`);
          }
        }
      } catch {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /** Fetch description/subjects for the chosen result, then prefill. */
  async function pick(result: BookMetadata, key: string) {
    setPickingId(key);
    let details = {
      description: result.description,
      pageCount: null as number | null,
      tags: result.tags,
      coverUrl: null as string | null,
    };
    try {
      const params = new URLSearchParams();
      if (result.openLibraryId) params.set("olid", result.openLibraryId);
      if (result.isbn) params.set("isbn", result.isbn);
      params.set("title", result.title);
      if (result.authors[0]) params.set("author", result.authors[0]);
      const res = await fetch(`/api/metadata/details?${params}`);
      if (res.ok) {
        const data = await res.json();
        details = { ...details, ...data.details };
      }
    } catch {
      // details are a bonus; the search result alone is enough to prefill
    }

    onPick({
      title: result.title,
      authors: result.authors.join(", "),
      isbn: result.isbn ?? "",
      description: details.description ?? result.description ?? "",
      coverUrl: result.coverUrl ?? details.coverUrl ?? "",
      pageCount: (result.pageCount ?? details.pageCount)?.toString() ?? "",
      publishedDate: result.publishedDate ?? "",
      tags: [...new Set([...result.tags, ...details.tags])].join(", "),
      openLibraryId: result.openLibraryId ?? "",
    });
    setPickingId(null);
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by title, author, or ISBN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <BarcodeScanner onDetected={handleScan} />
      </div>

      {searching && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </p>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No results. You can still add the book manually.
        </p>
      )}

      <ul className="grid gap-2">
        {results.map((r, i) => {
          const key = r.openLibraryId ?? `${r.title}-${i}`;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => pick(r, key)}
                disabled={pickingId !== null}
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-ring/60 disabled:opacity-60"
              >
                <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.coverUrl.replace("-L.jpg", "-S.jpg")}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="size-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.authors.join(", ")}
                    {r.publishedDate ? ` · ${r.publishedDate}` : ""}
                    {r.pageCount ? ` · ${r.pageCount} pages` : ""}
                  </p>
                </div>
                {pickingId === key && (
                  <Loader2 className="ml-auto size-4 shrink-0 animate-spin" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
