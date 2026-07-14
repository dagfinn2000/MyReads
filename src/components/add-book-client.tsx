"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { createBook } from "@/lib/actions/books";
import type { LibraryCheckResult } from "@/app/api/library/check/route";
import { BookForm, type BookFormValues } from "@/components/book-form";
import { ImportSearch } from "@/components/import-search";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Add-book flow: either search-and-import (pick a result → review the
 * prefilled form → save) or straight manual entry. An `initialIsbn` (from
 * the "do I own this?" page) seeds the search and auto-picks a single match,
 * same as a barcode scan.
 */
export function AddBookClient({
  seriesNames = [],
  initialIsbn,
}: {
  seriesNames?: string[];
  initialIsbn?: string;
}) {
  const [prefill, setPrefill] = useState<BookFormValues | null>(null);
  const dupe = useDuplicateCheck(prefill);

  if (prefill) {
    return (
      <div className="grid gap-4">
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
              {dupe.match === "isbn"
                ? "This exact edition is already in your library: "
                : "You already have this title: "}
              <Link
                href={`/books/${dupe.book.id}`}
                className="font-medium underline underline-offset-2"
              >
                {dupe.book.title}
              </Link>
              . You can still add it (say, a second copy) — just so you know.
            </span>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Review the imported details, adjust anything you like, then save.
        </p>
        <BookForm
          action={createBook}
          initial={prefill}
          submitLabel="Add to library"
          showStatus
          seriesNames={seriesNames}
        />
      </div>
    );
  }

  return (
    <Tabs defaultValue="search">
      <TabsList>
        <TabsTrigger value="search">Search &amp; import</TabsTrigger>
        <TabsTrigger value="manual">Manual entry</TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="pt-4">
        <ImportSearch onPick={setPrefill} initialQuery={initialIsbn} />
      </TabsContent>
      <TabsContent value="manual" className="pt-4">
        <BookForm
          action={createBook}
          submitLabel="Add to library"
          showStatus
          seriesNames={seriesNames}
        />
      </TabsContent>
    </Tabs>
  );
}

/** Once a result is picked, quietly ask the library whether it's already
 *  there (exact ISBN, or same title + author as another edition). Best
 *  effort: a failed check just means no warning. */
function useDuplicateCheck(
  prefill: BookFormValues | null,
): LibraryCheckResult | null {
  const [result, setResult] = useState<LibraryCheckResult | null>(null);

  useEffect(() => {
    setResult(null);
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
        if (!cancelled && data) setResult(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prefill]);

  return result;
}
