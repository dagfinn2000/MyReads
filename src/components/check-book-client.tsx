"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BookOwnership } from "@prisma/client";
import {
  CircleCheck,
  CircleHelp,
  Heart,
  Loader2,
  Plus,
  Repeat,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { LibraryCheckResult } from "@/app/api/library/check/route";
import { setOwnership } from "@/lib/actions/ownership";
import { checkVerdict, type CheckVerdict, type VerdictTone } from "@/lib/check-verdict";
import { OWNERSHIP_BADGE_LABELS, STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/display";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { BookCover } from "@/components/book-card";
import { Stars } from "@/components/stars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** "I bought it" for one book: saving, saved, or what went wrong. Tied to the
 *  book's id, so a save still running when the next ISBN is checked never
 *  lands on that one's answer. */
interface Mark {
  id: string;
  state: "saving" | "done" | { error: string };
}

const TONE_BOX: Record<VerdictTone, string> = {
  success: "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
  info: "border-sky-300 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
  warn: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
};

const TONE_ICON: Record<VerdictTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-sky-600 dark:text-sky-400",
  warn: "text-amber-600 dark:text-amber-400",
};

const TONE_ICONS: Record<VerdictTone, LucideIcon> = {
  success: CircleCheck,
  info: Heart,
  warn: TriangleAlert,
};

/**
 * The "do I own this?" flow: scan or type an ISBN, ask
 * /api/library/check, and say what the library knows. A match reads its
 * ownership as well as the edition: a book you own is green, a wishlist
 * book is "On your wishlist" with an "I bought it" button, and a borrowed
 * or given-away copy is amber (see lib/check-verdict.ts). Not in the
 * library hands off to the add flow, ISBN prefilled, as a book you own or
 * one for the wishlist.
 */
export function CheckBookClient() {
  const [isbn, setIsbn] = useState("");
  const [checkedIsbn, setCheckedIsbn] = useState<string | null>(null);
  const [result, setResult] = useState<LibraryCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mark, setMark] = useState<Mark | null>(null);
  const [, startMarking] = useTransition();

  const check = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setChecking(true);
    setError(null);
    setResult(null);
    setMark(null);
    setCheckedIsbn(value);
    try {
      const res = await fetch(
        `/api/library/check?isbn=${encodeURIComponent(value)}`,
      );
      if (!res.ok) {
        // The route explains a bad ISBN or a spent lookup budget itself.
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Check failed. Are you online?");
        return;
      }
      setResult((await res.json()) as LibraryCheckResult);
    } catch {
      setError("Check failed. Are you online?");
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

  function markOwned(id: string) {
    setMark({ id, state: "saving" });
    startMarking(async () => {
      let state: Mark["state"];
      try {
        const res = await setOwnership(id, BookOwnership.OWNED);
        state = res.error ? { error: res.error } : "done";
      } catch {
        state = { error: "Couldn't save that. Are you online?" };
      }
      // Only the book this was for: another ISBN may have been checked
      // while it saved.
      if (state === "done") {
        setResult((r) =>
          r?.book?.id === id ? { ...r, book: { ...r.book, ownership: BookOwnership.OWNED } } : r,
        );
      }
      setMark((m) => (m?.id === id ? { id, state } : m));
    });
  }

  const book = result?.book;
  const verdict = result?.match && book ? checkVerdict(result.match, book) : null;
  const bookMark = mark && mark.id === book?.id ? mark.state : null;

  // Read out the answer when it arrives, and again once a book is marked.
  let announce = "";
  if (error) announce = error;
  else if (!checking && result) {
    if (bookMark === "done") announce = "Marked as owned.";
    else if (typeof bookMark === "object" && bookMark) announce = bookMark.error;
    else announce = verdict?.headline ?? "Not in your library.";
  }

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

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {checking && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking your library…
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!checking && book && verdict && (
        <MatchVerdict
          book={book}
          verdict={verdict}
          isbn={checkedIsbn ?? ""}
          mark={bookMark}
          onMarkOwned={() => markOwned(book.id)}
        />
      )}
      {!checking && result && !verdict && (
        <NoMatch result={result} isbn={checkedIsbn ?? ""} />
      )}
    </div>
  );
}

function MatchVerdict({
  book,
  verdict,
  isbn,
  mark,
  onMarkOwned,
}: {
  book: NonNullable<LibraryCheckResult["book"]>;
  verdict: CheckVerdict;
  isbn: string;
  mark: Mark["state"] | null;
  onMarkOwned: () => void;
}) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  const marked = mark === "done";
  const saving = mark === "saving";
  const markError = typeof mark === "object" && mark ? mark.error : null;

  // The pressed button is gone once the book is marked, so focus moves to
  // the new answer instead of dropping back to the page.
  useEffect(() => {
    if (marked) headingRef.current?.focus();
  }, [marked]);

  const Icon = TONE_ICONS[verdict.tone];
  const detail = marked ? "Marked as owned. It's on your shelf now." : verdict.detail;
  const showMark = verdict.markOwned !== null && !marked;

  return (
    <div className={`grid gap-3 rounded-lg border p-4 ${TONE_BOX[verdict.tone]}`}>
      <div className="grid gap-1">
        <p
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 font-medium outline-none"
        >
          <Icon className={`size-5 shrink-0 ${TONE_ICON[verdict.tone]}`} />
          {verdict.headline}
        </p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
      <MatchedBook book={book} />
      {(showMark || verdict.addAnyway) && (
        <div className="flex flex-wrap gap-2">
          {showMark && (
            <Button
              size="sm"
              variant={verdict.markOwned === "I bought it" ? "default" : "outline"}
              onClick={onMarkOwned}
              disabled={saving}
            >
              {saving ? "Saving…" : verdict.markOwned}
            </Button>
          )}
          {verdict.addAnyway && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/books/new?isbn=${encodeURIComponent(isbn)}`}>
                <Plus data-slot="icon" />
                Add this edition anyway
              </Link>
            </Button>
          )}
        </div>
      )}
      {markError && <p className="text-sm text-destructive">{markError}</p>}
    </div>
  );
}

function NoMatch({ result, isbn }: { result: LibraryCheckResult; isbn: string }) {
  const addHref = `/books/new?isbn=${encodeURIComponent(isbn)}`;
  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <p className="flex items-center gap-2 font-medium">
        <CircleHelp className="size-5 text-muted-foreground" />
        Not in your library.
      </p>
      {result.lookupFailed && (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t reach the book catalogues, so only this exact edition was checked,
          not other editions of the same title.
        </p>
      )}
      {result.lookedUp && (
        <p className="text-sm text-muted-foreground">
          Looked up: <span className="font-medium">{result.lookedUp.title}</span>
          {result.lookedUp.authors.length > 0
            ? ` by ${result.lookedUp.authors.join(", ")}`
            : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={addHref}>
            <Plus data-slot="icon" />
            Add it to the library
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`${addHref}&ownership=${BookOwnership.WISHLIST}`}>
            <Heart data-slot="icon" />
            Add to wishlist
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Compact result card: cover, title, status, ownership, rating — linked to
 *  the book. */
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
      <BookCover book={book} className="h-20 w-14 shrink-0 rounded" />
      <div className="grid min-w-0 gap-1">
        <p className="truncate text-sm font-medium">{book.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {book.authors.join(", ")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={`${STATUS_BADGE_CLASS[book.status]} text-[10px]`}>
            {STATUS_LABELS[book.status]}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {OWNERSHIP_BADGE_LABELS[book.ownership]}
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
