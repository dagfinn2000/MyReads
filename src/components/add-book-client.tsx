"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, TriangleAlert, X } from "lucide-react";
import { createBook } from "@/lib/actions/books";
import type { TagImportSettings } from "@/lib/tag-rules";
import type { LibraryCheckResult } from "@/app/api/library/check/route";
import { duplicateNotice } from "@/lib/check-verdict";
import { BookForm, type BookFormValues } from "@/components/book-form";
import { ImportSearch } from "@/components/import-search";
import { NEWEST_FIRST_HREF, useShelfScan } from "@/components/shelf-scan";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** A picked or handed-over book, waiting in the review form. */
interface Prefill {
  values: BookFormValues;
  /** Came from the barcode scanner: adding another opens the camera. */
  scanned: boolean;
  /** Only an ISBN no catalogue knows (shelf scan's "Add by hand"): there is
   *  nothing to check the library for that the scan didn't already. */
  byHand?: boolean;
}

/**
 * Add-book flow: either search-and-import (pick a result → review the
 * prefilled form → save) or straight manual entry. An `initialIsbn` (from
 * the "do I own this?" page) seeds the search and auto-picks a single match,
 * same as a barcode scan.
 *
 * "Add and add another" comes back here instead of opening the book: each
 * round starts afresh (the round number keys the search and the form), on
 * the tab it was added from, with the camera open again if the book was
 * scanned, and a line saying what was just added.
 *
 * A shelf scan's session lives here, not in the search: switching to
 * Manual entry or reviewing a picked book unmounts the search box, and
 * codes still in line then are looked up and added all the same, with the
 * running total shown above whichever is on screen.
 */
export function AddBookClient({
  seriesNames = [],
  initialIsbn,
  defaults = {},
  tagImport,
}: {
  seriesNames?: string[];
  initialIsbn?: string;
  /** Format, status and ownership a new book starts with (Preferences). */
  defaults?: Pick<BookFormValues, "format" | "status" | "ownership">;
  /** How a catalogue's subjects become tags (Preferences, New books). */
  tagImport?: TagImportSettings;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("search");
  const [round, setRound] = useState(0);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [lastAdded, setLastAdded] = useState<{ id: string; title: string } | null>(null);
  const [reopenScanner, setReopenScanner] = useState(false);
  const shelf = useShelfScan();
  const dupe = useDuplicateCheck(prefill && !prefill.byHand ? prefill.values : null);

  // Stable, so the search never sees new callbacks (see ImportSearch).
  // The camera reopens once, for the round right after a scanned book.
  const handlePick = useCallback((values: BookFormValues, how: { scanned: boolean }) => {
    setPrefill({ values, scanned: how.scanned });
    setReopenScanner(false);
  }, []);
  // From the shelf scan, so adding another goes back to the camera.
  const handleAddByHand = useCallback((isbn: string) => {
    setPrefill({ values: { isbn }, scanned: true, byHand: true });
    setReopenScanner(false);
  }, []);

  function handleAdded(book: { id: string; title: string }) {
    setLastAdded(book);
    setReopenScanner(prefill?.scanned ?? false);
    setPrefill(null);
    setRound((r) => r + 1);
    // The handoff from the check page is used up: a reload shouldn't search
    // for it again. Anything else in the address (an ownership, say) stays.
    if (initialIsbn) {
      const params = new URLSearchParams(window.location.search);
      params.delete("isbn");
      router.replace(params.size > 0 ? `/books/new?${params}` : "/books/new", { scroll: false });
    }
  }

  return (
    <div className="grid gap-4">
      {/* Always in the page, so each new "Added" is read out; the strip
          below is what's seen. sr-only takes it out of the grid, so it adds
          no gap. */}
      <p role="status" className="sr-only">
        {lastAdded ? `Added ${lastAdded.title}` : ""}
      </p>
      {lastAdded && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1 break-words">
            Added <b className="font-medium">{lastAdded.title}</b> ·{" "}
            <Link href={`/books/${lastAdded.id}`} className="underline underline-offset-2">
              Open it
            </Link>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={() => setLastAdded(null)}
          >
            <X />
          </Button>
        </div>
      )}

      {/* What a shelf scan added, once the camera is closed. The sr-only
          line is always there, so the total is read out when it changes;
          the visible one comes and goes. */}
      <p role="status" className="sr-only">
        {shelf.snapshot.pending === 0 && shelf.snapshot.added > 0
          ? `Added ${shelf.snapshot.added} book${shelf.snapshot.added === 1 ? "" : "s"} from the shelf`
          : ""}
      </p>
      <p className="text-sm text-muted-foreground empty:hidden">
        {shelf.snapshot.pending > 0
          ? `Still adding ${shelf.snapshot.pending} book${shelf.snapshot.pending === 1 ? "" : "s"}…`
          : shelf.snapshot.added > 0 && (
              <>
                Added {shelf.snapshot.added} book{shelf.snapshot.added === 1 ? "" : "s"} from the shelf ·{" "}
                <Link href={NEWEST_FIRST_HREF} className="underline underline-offset-2">
                  See them in the library
                </Link>
              </>
            )}
      </p>

      {prefill ? (
        <>
          <div>
            <Button variant="ghost" size="sm" onClick={() => setPrefill(null)}>
              <ArrowLeft data-slot="icon" />
              Back to search
            </Button>
          </div>
          {dupe?.match && dupe.book && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {duplicateNotice(dupe.match, dupe.book.ownership).lead}
                <Link
                  href={`/books/${dupe.book.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {dupe.book.title}
                </Link>
                {duplicateNotice(dupe.match, dupe.book.ownership).tail}
              </span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {prefill.byHand
              ? "No catalogue knows this ISBN, so fill in the rest yourself."
              : "Review the imported details, adjust anything you like, then save."}
          </p>
          <BookForm
            key={round}
            action={createBook}
            initial={{ ...defaults, ...prefill.values }}
            showStatus
            seriesNames={seriesNames}
            onAdded={handleAdded}
            autoFocusTitle={prefill.byHand}
          />
        </>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(next) => {
            setTab(next);
            setReopenScanner(false);
          }}
        >
          <TabsList>
            <TabsTrigger value="search">Search &amp; import</TabsTrigger>
            <TabsTrigger value="manual">Manual entry</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="pt-4">
            <ImportSearch
              key={round}
              onPick={handlePick}
              // Only the first round: after adding that book, the next
              // search starts empty.
              initialQuery={round === 0 ? initialIsbn : undefined}
              tagImport={tagImport}
              openScannerOnMount={reopenScanner}
              shelfScan={{ scan: shelf, onAddByHand: handleAddByHand }}
            />
          </TabsContent>
          <TabsContent value="manual" className="pt-4">
            <BookForm
              key={round}
              action={createBook}
              initial={defaults}
              showStatus
              seriesNames={seriesNames}
              onAdded={handleAdded}
              autoFocusTitle={round > 0}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** Identifies the book a check result belongs to, so a stale answer is never
 *  shown against a newly picked book. */
function checkKey(prefill: BookFormValues | null): string {
  if (!prefill) return "";
  const author = prefill.authors?.split(",")[0]?.trim() ?? "";
  return `${prefill.isbn ?? ""}|${prefill.title ?? ""}|${author}`;
}

/** Once a result is picked, quietly ask the library whether it's already
 *  there (exact ISBN, or same title + author as another edition). Best
 *  effort: a failed check just means no warning. */
function useDuplicateCheck(
  prefill: BookFormValues | null,
): LibraryCheckResult | null {
  // The answer is stored with the book it was fetched for. Clearing it when
  // the pick changes is then a render-time comparison rather than a setState
  // at the top of the effect — which was an extra render pass, and left a
  // frame in which the previous book's "you already own this" warning showed
  // against the newly picked one.
  const [answer, setAnswer] = useState<{
    key: string;
    result: LibraryCheckResult;
  } | null>(null);

  const key = checkKey(prefill);

  useEffect(() => {
    if (!prefill?.isbn && !prefill?.title) return;
    const params = new URLSearchParams();
    if (prefill.isbn) params.set("isbn", prefill.isbn);
    if (prefill.title) params.set("title", prefill.title);
    const author = prefill.authors?.split(",")[0]?.trim();
    if (author) params.set("author", author);

    let cancelled = false;
    fetch(`/api/library/check?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LibraryCheckResult | null) => {
        if (!cancelled && data) setAnswer({ key: checkKey(prefill), result: data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prefill]);

  return answer?.key === key ? answer.result : null;
}
