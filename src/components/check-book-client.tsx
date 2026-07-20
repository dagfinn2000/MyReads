"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { ReadingStatus } from "@prisma/client";
import { BookOpen, CircleCheck, CircleHelp, Loader2, Plus, Repeat } from "lucide-react";
import type { LibraryCheckResult } from "@/app/api/library/check/route";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/display";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Stars } from "@/components/stars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The "do I own this?" flow: scan or type an ISBN, ask
 * /api/library/check, and render one of three verdicts — exact edition
 * owned, same title in a different edition, or not in the library (with a
 * one-tap handoff to the add flow, ISBN prefilled).
 */
export function CheckBookClient() {
  const [isbn, setIsbn] = useState("");
  const [checkedIsbn, setCheckedIsbn] = useState<string | null>(null);
  const [result, setResult] = useState<LibraryCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setChecking(true);
    setError(null);
    setResult(null);
    setCheckedIsbn(value);
    try {
      const res = await fetch(
        `/api/library/check?isbn=${encodeURIComponent(value)}`,
      );
      if (!res.ok) throw new Error();
      setResult((await res.json()) as LibraryCheckResult);
    } catch {
      setError("Check failed — are you online?");
    } finally {
      setChecking(false);
    }
  }, []);

  /** Scanner handoff: show the ISBN in the box and check it right away. */
  const handleScan = useCallback(
    (scanned: string) => {
      setIsbn(scanned);
      void check(scanned);
    },
    [check],
  );

  return (
    <div className="grid gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void check(isbn);
        }}
      >
        <Input
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          placeholder="ISBN, e.g. 9788203365973"
          inputMode="numeric"
          autoFocus
        />
        <Button type="submit" variant="outline" disabled={checking || !isbn.trim()}>
          Check
        </Button>
        <BarcodeScanner onDetected={handleScan} />
      </form>

      {checking && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking your library…
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!checking && result && (
        <Verdict result={result} isbn={checkedIsbn ?? ""} />
      )}
    </div>
  );
}

function Verdict({ result, isbn }: { result: LibraryCheckResult; isbn: string }) {
  const addHref = `/books/new?isbn=${encodeURIComponent(isbn)}`;

  if (result.match && result.book) {
    const exact = result.match === "isbn";
    return (
      <div
        className={`grid gap-3 rounded-lg border p-4 ${
          exact
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
        }`}
      >
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck
            className={`size-5 ${exact ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
          />
          {exact
            ? "In your library — this exact edition."
            : "You have this title — as a different edition."}
        </p>
        <MatchedBook book={result.book} />
        {!exact && (
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href={addHref}>
                <Plus data-slot="icon" />
                Add this edition anyway
              </Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <p className="flex items-center gap-2 font-medium">
        <CircleHelp className="size-5 text-muted-foreground" />
        Not in your library.
      </p>
      {result.lookedUp && (
        <p className="text-sm text-muted-foreground">
          Looked up: <span className="font-medium">{result.lookedUp.title}</span>
          {result.lookedUp.authors.length > 0
            ? ` — ${result.lookedUp.authors.join(", ")}`
            : ""}
        </p>
      )}
      <div>
        <Button asChild size="sm">
          <Link href={addHref}>
            <Plus data-slot="icon" />
            Add it to the library
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Compact result card: cover, title, status, rating — linked to the book. */
function MatchedBook({
  book,
}: {
  book: NonNullable<LibraryCheckResult["book"]>;
}) {
  return (
    <Link
      href={`/books/${book.id}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-ring/60"
    >
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="size-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-1">
        <p className="truncate text-sm font-medium">{book.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {book.authors.join(", ")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            className={`${STATUS_BADGE_CLASS[book.status as ReadingStatus]} text-[10px]`}
          >
            {STATUS_LABELS[book.status as ReadingStatus]}
          </Badge>
          {book.rating != null && <Stars value={book.rating} />}
          {book.timesRead > 1 && (
            <Badge variant="outline" className="text-[10px]">
              <Repeat data-slot="icon" className="size-2.5" />
              {book.timesRead}×
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
