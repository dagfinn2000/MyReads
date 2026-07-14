"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Book, Read } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { Pencil, Repeat, Trash2, X } from "lucide-react";
import {
  addPastRead,
  deletePastRead,
  readAgain,
  updatePastRead,
} from "@/lib/actions/reads";
import { formatDate, toDateInputValue } from "@/lib/display";
import { Stars } from "@/components/stars";
import { StarRatingInput } from "@/components/star-rating-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** "12 May 2024 – 3 Jun 2024", partial-date variants, or "Undated read". */
function readLabel(read: Pick<Read, "dateStarted" | "dateFinished">): string {
  const start = formatDate(read.dateStarted);
  const finish = formatDate(read.dateFinished);
  if (start && finish) return `${start} – ${finish}`;
  if (finish) return `Finished ${finish}`;
  if (start) return `Started ${start}`;
  return "Undated read";
}

/**
 * Read history on the book detail page: every past pass through the book
 * (dates + what you rated it that time), a "Read it again" button that
 * archives the current pass and restarts the book, and a form for recording
 * reads from before the app. The Book row itself always holds the latest
 * read — that's the "Latest" row here and the editable reading card above.
 */
export function ReadHistoryCard({
  book,
  reads,
}: {
  book: Pick<
    Book,
    "id" | "status" | "dateStarted" | "dateFinished" | "rating"
  >;
  reads: Read[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const finished = book.status === ReadingStatus.READ;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Read history</CardTitle>
        {finished && <ReadAgainButton bookId={book.id} />}
      </CardHeader>
      <CardContent className="grid gap-4">
        {(reads.length > 0 || finished) && (
          <ul className="grid gap-2">
            {reads.map((read) => (
              <li key={read.id} className="grid gap-1">
                {editingId === read.id ? (
                  <PastReadForm
                    read={read}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      {readLabel(read)}
                    </span>
                    {read.rating != null && <Stars value={read.rating} />}
                    <span className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit read"
                        onClick={() => setEditingId(read.id)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <DeleteReadButton readId={read.id} />
                    </span>
                  </div>
                )}
              </li>
            ))}
            {finished && (
              <li className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span>
                  {readLabel(book)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    latest — edit in the reading card
                  </span>
                </span>
                {book.rating != null && <Stars value={book.rating} />}
              </li>
            )}
          </ul>
        )}
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Read this before? Record a past read
          </summary>
          <div className="pt-3">
            <PastReadForm bookId={book.id} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

/** Add form (pass `bookId`) or inline edit form (pass `read` + `onDone`). */
function PastReadForm({
  bookId,
  read,
  onDone,
}: {
  bookId?: string;
  read?: Read;
  onDone?: () => void;
}) {
  const action = read ? updatePastRead.bind(null, read.id) : addPastRead;
  const [state, formAction, pending] = useActionState(action, {});

  // Editing: close the form once the save lands. (The add form instead
  // relies on React resetting an uncontrolled form after its action.)
  useEffect(() => {
    if (state.success) onDone?.();
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-2">
      {!read && bookId && <input type="hidden" name="bookId" value={bookId} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Started</Label>
          <Input
            name="dateStarted"
            type="date"
            className="w-40"
            defaultValue={toDateInputValue(read?.dateStarted)}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Finished</Label>
          <Input
            name="dateFinished"
            type="date"
            className="w-40"
            defaultValue={toDateInputValue(read?.dateFinished)}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">
            Rating that time
          </Label>
          <StarRatingInput name="rating" defaultValue={read?.rating ?? 0} />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {read
              ? pending
                ? "Saving…"
                : "Save"
              : pending
                ? "Adding…"
                : "Add read"}
          </Button>
          {read && (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Dates are optional — an undated read still counts in your totals.
      </p>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

/** Archives the current pass and restarts the book; inline confirm since it
 *  changes status and dates in one click. */
function ReadAgainButton({ bookId }: { bookId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        <Repeat data-slot="icon" />
        Read it again
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => readAgain(bookId))}
      >
        {pending ? "Starting…" : "Start re-read"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel re-read"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        <X className="size-3.5" />
      </Button>
    </span>
  );
}

/** Trash icon that expands to an inline confirm, same as quotes. */
function DeleteReadButton({ readId }: { readId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete read"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => deletePastRead(readId))}
      >
        {pending ? "Deleting…" : "Delete read"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel delete"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        <X className="size-3.5" />
      </Button>
    </span>
  );
}
