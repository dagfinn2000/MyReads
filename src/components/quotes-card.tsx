"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { Quote } from "@prisma/client";
import { Pencil, Trash2, X } from "lucide-react";
import { addQuote, deleteQuote, updateQuote } from "@/lib/actions/quotes";
import { submitKeepingInput } from "@/lib/submit-form";
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
  const listRef = useRef<HTMLUListElement>(null);
  const lastEditedId = useRef<string | null>(null);

  // When an edit closes (saved or cancelled), put focus back on that
  // quote's pencil rather than letting it drop to the page.
  useEffect(() => {
    if (editingId) {
      lastEditedId.current = editingId;
      return;
    }
    const id = lastEditedId.current;
    lastEditedId.current = null;
    if (id) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-quote-edit="${CSS.escape(id)}"]`)
        ?.focus();
    }
  }, [editingId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotes &amp; highlights</CardTitle>
      </CardHeader>
      {/* grid-cols-1 clamps the tracks so a long unbroken token (a pasted
          URL, say) wraps via break-words instead of stretching the card. */}
      <CardContent className="grid grid-cols-1 gap-4" data-quote-scope="">
        {quotes.length > 0 && (
          <ul ref={listRef} className="grid grid-cols-1 gap-3">
            {quotes.map((quote) => (
              <li key={quote.id} className="grid grid-cols-1 gap-1">
                {editingId === quote.id ? (
                  <QuoteForm quote={quote} onDone={() => setEditingId(null)} />
                ) : (
                  <>
                    <blockquote className="long-text whitespace-pre-line break-words border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">
                      {quote.text}
                    </blockquote>
                    <div className="flex min-h-7 flex-wrap items-center gap-x-2 pl-3">
                      {quote.page != null && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          p. {quote.page}
                        </span>
                      )}
                      {quote.note && (
                        <span className="long-text min-w-0 break-words text-xs italic text-muted-foreground">
                          {quote.note}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit quote"
                          data-quote-edit={quote.id}
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

/** Add form (pass `bookId`) or inline edit form (pass `quote` + `onDone`).
 *  The edit form opens with the text focused, and Escape cancels it. */
export function QuoteForm({
  bookId,
  quote,
  onDone,
}: {
  bookId?: string;
  quote?: Pick<Quote, "id" | "text" | "page" | "note">;
  onDone?: () => void;
}) {
  const action = quote ? updateQuote.bind(null, quote.id) : addQuote;
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Once a save lands, editing closes the form and adding empties it for
  // the next quote. A failed save leaves what was typed (submitKeepingInput).
  useEffect(() => {
    if (!state.success) return;
    if (quote) onDone?.();
    else formRef.current?.reset();
  }, [state, quote, onDone]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={submitKeepingInput(formAction)}
      className="grid gap-2"
      onKeyDown={
        quote
          ? (e) => {
              if (e.key === "Escape" && !pending) {
                e.preventDefault();
                onDone?.();
              }
            }
          : undefined
      }
    >
      {!quote && bookId && <input type="hidden" name="bookId" value={bookId} />}
      <Textarea
        name="text"
        rows={2}
        required
        maxLength={5000}
        placeholder="A passage worth keeping…"
        defaultValue={quote?.text ?? ""}
        aria-label={quote ? "Quote text" : "New quote"}
        autoFocus={!!quote}
        // The add form's box is where focus goes after deleting the last
        // quote above it (see focusAfterDelete).
        data-quote-fallback={quote ? undefined : ""}
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

/**
 * Where focus goes once a quote is deleted and its row disappears: the next
 * quote's pencil in the same list (`data-quote-scope`), else the previous
 * one's, else the scope's fallback (the add form on a book page), else the
 * page heading. Worked out before the delete, while the row is still there.
 */
function focusAfterDelete(from: HTMLElement): HTMLElement | null {
  const scope = from.closest("[data-quote-scope]");
  const own = from.closest("li")?.querySelector<HTMLElement>("[data-quote-edit]");
  const pencils = scope ? [...scope.querySelectorAll<HTMLElement>("[data-quote-edit]")] : [];
  const i = own ? pencils.indexOf(own) : -1;
  return (
    (i >= 0 ? (pencils[i + 1] ?? pencils[i - 1]) : undefined) ??
    scope?.querySelector<HTMLElement>("[data-quote-fallback]") ??
    document.querySelector<HTMLElement>("main h1[tabindex]")
  );
}

/** Trash icon that expands to an inline confirm — no dialog for something
 *  this small, but still not a single misclick away from data loss. */
export function DeleteQuoteButton({ quoteId }: { quoteId: string }) {
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
        onClick={(e) => {
          const next = focusAfterDelete(e.currentTarget);
          startTransition(async () => {
            await deleteQuote(quoteId);
            next?.focus();
          });
        }}
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
