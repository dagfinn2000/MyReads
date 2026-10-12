"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { catalogueBookValues } from "@/lib/catalogue-values";
import { looksLikeIsbn } from "@/lib/isbn";
import { SOURCE_LABELS, type BookDetails, type BookMetadata } from "@/lib/metadata/types";
import type { TagImportSettings } from "@/lib/tag-rules";
import type { BookFormValues } from "@/components/book-form";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { NEWEST_FIRST_HREF, type ShelfScan } from "@/components/shelf-scan";
import { Input } from "@/components/ui/input";

/** Shortest query worth sending: one or two letters match most of a
 *  catalogue, and every search fans out to three of them. Mirrored by the
 *  route (app/api/metadata/search). */
const MIN_QUERY_LENGTH = 3;

/** Pause in typing before searching. Raised from 400ms for the same reason —
 *  each distinct prefix is a fresh cache miss against free services. */
const DEBOUNCE_MS = 700;

/** Everything copied, no tag rules: for a caller with no settings. */
const IMPORT_ALL_TAGS: TagImportSettings = {
  mode: "all",
  rules: { renames: [], skips: [] },
  knownTags: [],
};

/**
 * Search-as-you-type against /api/metadata/search (Open Library, with
 * optional Google Books fallback server-side). Picking a result fetches the
 * lazy details (description, subjects) and hands a prefilled form-value
 * object to the parent, which switches to the review form.
 *
 * With `shelfScan`, the barcode scanner also offers "Keep scanning",
 * which adds each scanned book straight away (components/shelf-scan.tsx).
 * The session is the parent's, so codes still in line when this unmounts
 * (Manual entry, a picked result) are looked up and added all the same.
 */
export function ImportSearch({
  onPick,
  initialQuery,
  tagImport = IMPORT_ALL_TAGS,
  openScannerOnMount = false,
  shelfScan,
}: {
  /** `scanned`: the pick came from the barcode scanner, so adding another
   *  can open the camera again. */
  onPick: (values: BookFormValues, how: { scanned: boolean }) => void;
  /** Seeds the search box (e.g. an ISBN from the check page) and auto-picks
   *  a single match, exactly like a barcode scan. */
  initialQuery?: string;
  /** How catalogue subjects become tags (Preferences, New books). */
  tagImport?: TagImportSettings;
  openScannerOnMount?: boolean;
  /** The page's shelf-scan session, and "Add by hand" for a scanned code
   *  no catalogue knows. */
  shelfScan?: { scan: ShelfScan; onAddByHand: (isbn: string) => void };
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? "");
  // Results are stored with the query they answer. Everything the UI needs —
  // which results to show, and whether a search is outstanding — is then
  // derived from that one fact, instead of three states nudged into
  // agreement by setState calls at the top of the effect.
  // `failed`: the catalogues couldn't be reached, which is not the same
  // answer as "they have nothing by that name".
  const [answer, setAnswer] = useState<{
    query: string;
    list: BookMetadata[];
    failed?: boolean;
  } | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Set when the query came from the barcode scanner (or an initialQuery):
  // an ISBN search that returns exactly one result skips the picking step.
  const autoPickRef = useRef(Boolean(initialQuery));
  // Whether that query came from the camera itself.
  const scannedRef = useRef(false);
  // The parent's callback and settings, read when a pick lands. Kept out of
  // `pick`'s dependencies: they change identity whenever the page re-renders
  // (after a book is added, say), and `pick` changing would rerun the search
  // effect, aborting the search in flight and spending another lookup.
  const latest = useRef({ onPick, tagImport });
  useEffect(() => {
    latest.current = { onPick, tagImport };
  });

  const trimmed = query.trim();
  const longEnough = trimmed.length >= MIN_QUERY_LENGTH;
  const answered = answer?.query === trimmed;
  // A typed character invalidates the previous answer by itself: the results
  // stop matching the query, which is exactly what "searching" means.
  const results = answered ? answer.list : [];
  const failed = answered && answer.failed === true;
  const searching = longEnough && !answered;

  /** Barcode scanner handoff — the ISBN just becomes the search query. */
  const handleScan = useCallback((isbn: string) => {
    autoPickRef.current = true;
    scannedRef.current = true;
    setQuery(isbn);
  }, []);

  /** Fetch description/subjects for the chosen result, then prefill.
   *  Stable across renders (it reads the parent's callback through a ref),
   *  so the search effect can depend on it honestly instead of omitting it.
   *  `searched` is the query: an ISBN there is the book in hand, and beats
   *  whatever edition's ISBN the row carries (an Open Library row's can be
   *  any edition of the work). */
  const pick = useCallback(async (result: BookMetadata, key: string, searched: string) => {
    setPickingId(key);
    const scannedIsbn = looksLikeIsbn(searched) ? searched : undefined;
    let details: Partial<BookDetails> | null = null;
    try {
      const params = new URLSearchParams();
      if (result.openLibraryId) params.set("olid", result.openLibraryId);
      const isbn = scannedIsbn ?? result.isbn;
      if (isbn) params.set("isbn", isbn);
      params.set("title", result.title);
      if (result.authors[0]) params.set("author", result.authors[0]);
      const res = await fetch(`/api/metadata/details?${params}`);
      if (res.ok) {
        const data = await res.json();
        details = data.details;
      }
    } catch {
      // details are a bonus; the search result alone is enough to prefill
    }

    const scanned = scannedRef.current;
    scannedRef.current = false;
    latest.current.onPick(
      catalogueBookValues(result, details, latest.current.tagImport, scannedIsbn),
      { scanned },
    );
    setPickingId(null);
  }, []);

  // Debounced search: waits for a pause in typing, then cancels any in-flight
  // request so stale responses can't overwrite newer ones. An ISBN scan is
  // unaffected by the debounce — it sets the whole query at once.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/metadata/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        const list: BookMetadata[] = data.results ?? [];
        // 502: no catalogue answered. Other errors (a spent lookup budget)
        // also mean "couldn't search", not "nothing found".
        setAnswer({ query: trimmed, list, failed: !res.ok });
        if (autoPickRef.current) {
          autoPickRef.current = false;
          if (list.length === 1) {
            void pick(list[0], list[0].openLibraryId ?? `${list[0].title}-0`, trimmed);
          } else {
            scannedRef.current = false;
          }
        }
      } catch {
        // A failed lookup answers the query with nothing, which stops the
        // spinner and says the search failed. An abort is a newer query
        // taking over and must not answer this one.
        if (!controller.signal.aborted) setAnswer({ query: trimmed, list: [], failed: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Also abort a request already in flight: without this, navigating away
      // mid-search left the fetch running and its setState firing into an
      // unmounted component.
      abortRef.current?.abort();
    };
  }, [trimmed, pick]);


  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by title, author, or ISBN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <BarcodeScanner
          onDetected={handleScan}
          defaultOpen={openScannerOnMount}
          shelfScan={
            shelfScan && {
              ...shelfScan,
              onDone: () => router.push(NEWEST_FIRST_HREF),
            }
          }
        />
      </div>

      {searching && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </p>
      )}

      {!searching && longEnough && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {failed
            ? "Couldn't reach the book catalogues. Try again in a moment, or add the book manually."
            : "No results. You can still add the book manually."}
        </p>
      )}

      {/* grid-cols-1 (minmax(0,1fr)) caps the track at the container width;
          a bare `grid` sizes its implicit column by content, so one long
          nowrap title would stretch every card past the page edge. */}
      <ul className="grid grid-cols-1 gap-2">
        {results.map((r, i) => {
          const key = r.openLibraryId ?? `${r.title}-${i}`;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => pick(r, key, trimmed)}
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
                    {/* Results now mix all sources — say which catalog each
                        row came from so the right edition is easy to spot. */}
                    {` · ${SOURCE_LABELS[r.source]}`}
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
