"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { undoMoveFromReading } from "@/lib/actions/progress";
import { nowReadingPaceText } from "@/lib/pace";
import { currentPassEntries } from "@/lib/progress";
import { progressFigure, unitFor } from "@/lib/progress-units";
import type { UndoMove } from "@/lib/reading-log";
import { usePreferences } from "@/components/preferences-provider";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { RecentEntries, type LogBook } from "@/components/progress-log";
import { QuickLog, type MovedResult, type QuickLogBook } from "@/components/quick-log";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface NowReadingBook extends QuickLogBook, LogBook {
  authors: string[];
  coverUrl: string | null;
  progress: { id: string; page: number; date: Date }[];
}

interface Moved {
  book: NowReadingBook;
  message: string;
  undo: UndoMove;
}

/**
 * The rows of the Now reading page, one per book being read, with the
 * quick-log row, Finished and Stopped.
 *
 * Rows keep the order the page first had for this visit: logging a page
 * makes a book the most recent, but moving it to the top under the
 * reader's finger (and losing their focus) would be worse. A book moved to
 * Read or Did Not Finish leaves the page's list, so its row stays here in
 * place as a line with Undo until the visit ends.
 */
export function NowReading({
  books,
  empty,
}: {
  books: NowReadingBook[];
  /** Shown when nothing is being read (and nothing was just moved). */
  empty: React.ReactNode;
}) {
  const [order] = useState(() => books.map((b) => b.id));
  const [moved, setMoved] = useState<Map<string, Moved>>(() => new Map());
  const [focusId, setFocusId] = useState<string | null>(null);

  const byId = new Map(books.map((b) => [b.id, b]));
  // Books started since the page loaded (another tab, say) go first.
  const ids = [...books.map((b) => b.id).filter((id) => !order.includes(id)), ...order].filter(
    (id) => byId.has(id) || moved.has(id),
  );
  if (ids.length === 0) return <>{empty}</>;

  // A book in the page's list always shows as a row, so whichever lands
  // first, the move's result or the refreshed list, nothing flickers: the
  // row stays until the list drops the book, and comes back as soon as an
  // undo returns it.
  return (
    <ul className="grid grid-cols-1 gap-3">
      {ids.map((id) => {
        const book = byId.get(id);
        if (book) {
          return (
            <li key={id}>
              <NowReadingRow
                book={book}
                autoFocus={focusId === id}
                onMoved={(result) =>
                  setMoved((m) =>
                    new Map(m).set(id, { book, message: result.message, undo: result.undo }),
                  )
                }
              />
            </li>
          );
        }
        return (
          <li key={id}>
            <MovedRow moved={moved.get(id)!} onUndone={() => setFocusId(id)} />
          </li>
        );
      })}
    </ul>
  );
}

function NowReadingRow({
  book,
  autoFocus,
  onMoved,
}: {
  book: NowReadingBook;
  autoFocus: boolean;
  onMoved: (result: MovedResult) => void;
}) {
  const prefs = usePreferences();
  const info = unitFor(book, prefs);
  const pass = currentPassEntries(book.progress, book.dateStarted, prefs.timeZone);
  const pace = nowReadingPaceText({ pass, info, from: prefs.paceFrom, now: new Date(), prefs });
  const pct =
    book.currentPage != null && book.pageCount
      ? Math.min((book.currentPage / book.pageCount) * 100, 100)
      : null;

  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
        <BookLink bookId={book.id} className="lift-cover self-start" title={book.title}>
          <BookCover book={book} className="cover-shadow aspect-[2/3] w-full" />
        </BookLink>
        <div className="grid min-w-0 content-start gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-base font-medium">
              <Link href={`/books/${book.id}`} className="hover:underline">
                {book.title}
              </Link>
            </h2>
            {book.authors.length > 0 && (
              <p className="truncate text-sm text-muted-foreground">{book.authors.join(", ")}</p>
            )}
          </div>
          {pct !== null && (
            <div className="h-2 rounded-full bg-muted">
              <div className="bar-grow h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums sm:text-sm">
            <span>{book.currentPage != null ? progressFigure(book.currentPage, info) : "Not started"}</span>
            <span>{pace}</span>
          </div>
          <QuickLog book={book} showMoveButtons onMoved={onMoved} autoFocus={autoFocus} />
          <div className="grid gap-1">
            <RecentEntries entries={book.progress} book={book} />
            {book.progress.length > 0 && (
              <Link
                href={`/books/${book.id}#progress-log`}
                className="justify-self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Full log
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** A book just moved to Read or Did Not Finish: what happened, and Undo. */
function MovedRow({ moved, onUndone }: { moved: Moved; onUndone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const undoRef = useRef<HTMLButtonElement>(null);

  // The button that was pressed is gone with the row; Undo is the obvious
  // next stop for focus.
  useEffect(() => {
    undoRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10"
    >
      <span className="min-w-0">{moved.message}</span>
      <Button
        ref={undoRef}
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await undoMoveFromReading(moved.book.id, moved.undo);
            if (result.error) setError(result.error);
            else onUndone();
          })
        }
      >
        {pending ? "Undoing…" : "Undo"}
      </Button>
      {error && <span className="w-full text-destructive">{error}</span>}
    </div>
  );
}
