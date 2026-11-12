"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { BookNote, Quote } from "@prisma/client";
import { Trash2, X } from "lucide-react";
import { CHAPTER_MAX } from "@/lib/book-notes";
import { deleteNote, updateNote } from "@/lib/actions/notes";
import { deleteQuote, updateQuote } from "@/lib/actions/quotes";
import { submitKeepingInput } from "@/lib/submit-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// The edit forms and delete buttons of quotes and notes, shared by a book's
// Notes & quotes card (components/book-notes-card.tsx) and the quotes page.

type EditProps = {
  onDone: () => void;
  /** The id of a datalist of the book's chapters, for the chapter box. */
  chapterList?: string;
};

/** A quote's inline edit form. It opens with the text focused, and Escape
 *  cancels it. */
export function QuoteForm({
  quote,
  ...props
}: EditProps & { quote: Pick<Quote, "id" | "text" | "page" | "chapter" | "note"> }) {
  return <EditForm kind="quote" entry={quote} {...props} />;
}

/** A note's inline edit form, the same. */
export function NoteForm({
  note,
  ...props
}: EditProps & { note: Pick<BookNote, "id" | "text" | "page" | "chapter"> }) {
  return <EditForm kind="note" entry={note} {...props} />;
}

function EditForm({
  kind,
  entry,
  onDone,
  chapterList,
}: EditProps & {
  kind: "quote" | "note";
  entry: { id: string; text: string; page: number | null; chapter: string | null; note?: string | null };
}) {
  const action = (kind === "quote" ? updateQuote : updateNote).bind(null, entry.id);
  const [state, formAction, pending] = useActionState(action, {});

  // Once a save lands the form closes. A failed save leaves what was typed
  // (submitKeepingInput).
  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);

  return (
    <form
      action={formAction}
      onSubmit={submitKeepingInput(formAction)}
      className="grid gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) {
          e.preventDefault();
          onDone();
        }
      }}
    >
      <Textarea
        name="text"
        rows={kind === "quote" ? 2 : 3}
        required
        maxLength={5000}
        defaultValue={entry.text}
        aria-label={kind === "quote" ? "Quote text" : "Note"}
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="chapter"
          maxLength={CHAPTER_MAX}
          list={chapterList}
          autoComplete="off"
          className="w-32"
          placeholder="Chapter"
          defaultValue={entry.chapter ?? ""}
          aria-label="Chapter"
        />
        <Input
          name="page"
          type="number"
          min={1}
          max={100000}
          className="w-20"
          placeholder="Page"
          defaultValue={entry.page ?? ""}
          aria-label="Page"
        />
        {kind === "quote" && (
          <Input
            name="note"
            maxLength={2000}
            className="min-w-36 flex-1"
            placeholder="Why it stuck (optional)"
            defaultValue={entry.note ?? ""}
            aria-label="Why it stuck"
          />
        )}
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

/**
 * Where focus goes once a quote or a note is deleted and its row
 * disappears: the next pencil in the same list (`data-quote-scope`), else
 * the previous one's, else the scope's fallback (the add form on a book
 * page), else the page heading. Worked out before the delete, while the row
 * is still there.
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

/**
 * Focuses the pencil of a quote or note (by its `data-quote-edit`), and
 * focuses it again should the refresh after a save or a delete draw its row
 * afresh, which drops focus to the page: a note whose chapter changed moves
 * to another section, and deleting the last entry of a section moves the
 * ones after it. Watches for a few seconds, and stops once it has caught
 * one such drop, or at the reader's next click.
 */
export function focusPencil(key: string): void {
  const find = () => document.querySelector<HTMLElement>(`[data-quote-edit="${CSS.escape(key)}"]`);
  find()?.focus();
  const until = performance.now() + 3000;
  let stopped = false;
  const stop = () => {
    stopped = true;
    window.removeEventListener("pointerdown", stop, true);
  };
  window.addEventListener("pointerdown", stop, true);
  const watch = () => {
    if (stopped) return;
    if (performance.now() > until) return stop();
    const active = document.activeElement;
    const pencil = find();
    if (pencil && (!active || active === document.body)) {
      pencil.focus();
      return stop();
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}

/** Trash icon that expands to an inline confirm — no dialog for something
 *  this small, but still not a single misclick away from data loss. */
export function DeleteQuoteButton({ quoteId }: { quoteId: string }) {
  return <DeleteButton what="quote" onDelete={() => deleteQuote(quoteId)} />;
}

/** The same for a note. */
export function DeleteNoteButton({ noteId }: { noteId: string }) {
  return <DeleteButton what="note" onDelete={() => deleteNote(noteId)} />;
}

function DeleteButton({ what, onDelete }: { what: string; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${what}`}
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
          const key = next?.getAttribute("data-quote-edit");
          startTransition(async () => {
            await onDelete();
            if (key) focusPencil(key);
            else next?.focus();
          });
        }}
      >
        {pending ? "Deleting…" : `Delete ${what}`}
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
