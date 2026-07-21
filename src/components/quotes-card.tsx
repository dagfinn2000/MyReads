"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Quote } from "@prisma/client";
import { Pencil, Trash2, X } from "lucide-react";
import { addQuote, deleteQuote, updateQuote } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Quotes & highlights on the book detail page: passages worth keeping, each
 * with an optional page reference and personal note. Quotes are listed in
 * page order (unpaged ones last), with inline edit and delete.
 */
export function QuotesCard({
  bookId,
  quotes,
}: {
  bookId: string;
  quotes: Quote[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotes &amp; highlights</CardTitle>
      </CardHeader>
      {/* grid-cols-1 clamps the tracks so a long unbroken token (a pasted
          URL, say) wraps via break-words instead of stretching the card. */}
      <CardContent className="grid grid-cols-1 gap-4">
        {quotes.length > 0 && (
          <ul className="grid grid-cols-1 gap-3">
            {quotes.map((quote) => (
              <li key={quote.id} className="grid grid-cols-1 gap-1">
                {editingId === quote.id ? (
                  <QuoteForm quote={quote} onDone={() => setEditingId(null)} />
                ) : (
                  <>
                    <blockquote className="whitespace-pre-line break-words border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">
                      {quote.text}
                    </blockquote>
                    <div className="flex min-h-7 flex-wrap items-center gap-x-2 pl-3">
                      {quote.page != null && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          p. {quote.page}
                        </span>
                      )}
                      {quote.note && (
                        <span className="min-w-0 break-words text-xs italic text-muted-foreground">
                          {quote.note}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit quote"
                          onClick={() => setEditingId(quote.id)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <DeleteQuoteButton quoteId={quote.id} />
                      </span>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <QuoteForm bookId={bookId} />
      </CardContent>
    </Card>
  );
}

/** Add form (pass `bookId`) or inline edit form (pass `quote` + `onDone`). */
function QuoteForm({
  bookId,
  quote,
  onDone,
}: {
  bookId?: string;
  quote?: Quote;
  onDone?: () => void;
}) {
  const action = quote ? updateQuote.bind(null, quote.id) : addQuote;
  const [state, formAction, pending] = useActionState(action, {});

  // Editing: close the form once the save lands. (The add form instead
  // relies on React resetting an uncontrolled form after its action.)
  useEffect(() => {
    if (state.success) onDone?.();
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-2">
      {!quote && bookId && <input type="hidden" name="bookId" value={bookId} />}
      <Textarea
        name="text"
        rows={2}
        required
        maxLength={5000}
        placeholder="A passage worth keeping…"
        defaultValue={quote?.text ?? ""}
        aria-label={quote ? "Quote text" : "New quote"}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="page"
          type="number"
          min={1}
          max={100000}
          className="w-20"
          placeholder="Page"
          defaultValue={quote?.page ?? ""}
          aria-label="Page"
        />
        <Input
          name="note"
          maxLength={2000}
          className="min-w-36 flex-1"
          placeholder="Note (optional)"
          defaultValue={quote?.note ?? ""}
          aria-label="Note"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {quote
            ? pending
              ? "Saving…"
              : "Save"
            : pending
              ? "Adding…"
              : "Add quote"}
        </Button>
        {quote && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

/** Trash icon that expands to an inline confirm — no dialog for something
 *  this small, but still not a single misclick away from data loss. */
function DeleteQuoteButton({ quoteId }: { quoteId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete quote"
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
        onClick={() => startTransition(() => deleteQuote(quoteId))}
      >
        {pending ? "Deleting…" : "Delete quote"}
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
