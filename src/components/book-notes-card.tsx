"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BookNote, Quote } from "@prisma/client";
import { PenLine, Pencil, Quote as QuoteIcon } from "lucide-react";
import { ReadingStatus } from "@/lib/enums";
import {
  CHAPTER_MAX,
  arrangeTimeline,
  chapterChoices,
  chapterLabel,
  chapterStarts,
  stripAt,
  stripEnd,
  type TimelineEntry,
} from "@/lib/book-notes";
import { addNoteOrQuote } from "@/lib/actions/notes";
import { formatDate } from "@/lib/display";
import { motionAllowed } from "@/lib/motion";
import { submitKeepingInput } from "@/lib/submit-form";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";
import { QuoteCardButton } from "@/components/quote-card-dialog";
import {
  DeleteNoteButton,
  DeleteQuoteButton,
  NoteForm,
  QuoteForm,
  focusPencil,
} from "@/components/quotes-card";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Kind = "note" | "quote";

type Entry =
  | (TimelineEntry & { kind: "note"; text: string; item: BookNote })
  | (TimelineEntry & { kind: "quote"; text: string; item: Quote });

/** The id an entry goes by on the page: notes and quotes are two tables. */
const entryKey = (e: { kind: Kind; id: string }) => `${e.kind}-${e.id}`;

export interface NotesCardBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  currentPage: number | null;
  status: ReadingStatus;
}

/**
 * Notes & quotes on a book's page: the reader's own notes and the book's
 * quotes together, in the order of the book and under the chapters they
 * name (lib/book-notes.ts), along a rail. Above them a strip of the book
 * from its first page to its last shows where each one sits, the chapters,
 * and how far the reader has got; pointing at a mark shows what it is, and
 * a click goes to it. Under them, one form adds either.
 *
 * Opens on the add form, ready to type a note, when the address ends in
 * #add-note (the "Add a note" link on Now reading).
 */
export function BookNotesCard({
  book,
  quotes,
  notes,
}: {
  book: NotesCardBook;
  quotes: Quote[];
  notes: BookNote[];
}) {
  const entries = useMemo<Entry[]>(
    () => [
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, page: n.page, chapter: n.chapter, createdAt: n.createdAt, text: n.text, item: n })),
      ...quotes.map((q) => ({ kind: "quote" as const, id: q.id, page: q.page, chapter: q.chapter, createdAt: q.createdAt, text: q.text, item: q })),
    ],
    [notes, quotes],
  );
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const lastEdited = useRef<string | null>(null);
  const chapterList = useId();

  // When an edit closes (saved or cancelled), put focus back on that
  // entry's pencil rather than letting it drop to the page.
  useEffect(() => {
    if (editing) {
      lastEdited.current = editing;
      return;
    }
    const key = lastEdited.current;
    lastEdited.current = null;
    if (key) focusPencil(key);
  }, [editing]);

  // A mark's flash fades after a moment.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  const both = notes.length > 0 && quotes.length > 0;
  // A filter left on a kind that has since gone shows everything again.
  const shown = both && filter !== "all" ? entries.filter((e) => e.kind === filter) : entries;
  const sections = arrangeTimeline(shown);
  const here = book.status === ReadingStatus.READING && book.currentPage ? book.currentPage : null;
  const end = stripEnd(book.pageCount, shown, here);
  const choices = chapterChoices(entries);

  const goTo = (key: string) => {
    const el = document.getElementById(`entry-${key}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: motionAllowed() ? "smooth" : "auto" });
    el.querySelector<HTMLElement>("[data-quote-edit]")?.focus({ preventScroll: true });
    setFlash(key);
  };

  return (
    <Card id="notes" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Notes &amp; quotes</CardTitle>
        {both && (
          <CardAction>
            <div role="group" aria-label="Show" className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 text-xs">
              {(
                [
                  ["all", "All", entries.length],
                  ["note", "Notes", notes.length],
                  ["quote", "Quotes", quotes.length],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className="rounded-md px-2 py-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
                >
                  {label} <span className="tabular-nums opacity-70">{count}</span>
                </button>
              ))}
            </div>
          </CardAction>
        )}
      </CardHeader>
      {/* grid-cols-1 clamps the tracks so a long unbroken token (a pasted
          URL, say) wraps via break-words instead of stretching the card. */}
      <CardContent className="grid grid-cols-1 gap-5" data-quote-scope="">
        {end !== null && (
          <BookStrip entries={shown} all={entries} end={end} here={here} onPick={goTo} />
        )}

        {sections.length > 0 ? (
          // One list, the chapter headings inside the first entry of each:
          // an entry whose chapter changes then moves within the list
          // rather than being drawn afresh in another, which would lose an
          // edit that is still saving.
          <ol
            aria-label="Notes and quotes in book order"
            className="relative grid grid-cols-1 gap-3 before:absolute before:inset-y-1.5 before:left-[5px] before:w-px before:bg-border"
          >
            {sections.flatMap((section, si) =>
              section.entries.map((entry, ei) => {
                const key = entryKey(entry);
                return (
                  <EntryRow
                    key={key}
                    entry={entry}
                    book={book}
                    heading={
                      ei === 0 && (section.label || !section.paged)
                        ? { label: section.label, paged: section.paged, first: si === 0 }
                        : null
                    }
                    editing={editing === key}
                    flashing={flash === key}
                    chapterList={chapterList}
                    onEdit={() => setEditing(key)}
                    onDone={() => setEditing(null)}
                  />
                );
              }),
            )}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Jot down thoughts as you read, tied to a page or a chapter. They line up here in
            the order of the book, with the passages you keep.
          </p>
        )}

        <AddForm book={book} entries={entries} chapterList={chapterList} />
        <datalist id={chapterList}>
          {choices.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </CardContent>
    </Card>
  );
}

/**
 * The strip of the book: page 1 at the left, the last page at the right,
 * with the chapters shaded in turn, a dot for each note and a bookmark for
 * each quote, and how far the reader has got while reading. Decoration for
 * the list below, which says the same, so it's hidden from screen readers
 * and its marks take no focus.
 */
function BookStrip({
  entries,
  all,
  end,
  here,
  onPick,
}: {
  entries: Entry[];
  /** Every entry, whatever is filtered: the chapters stay put. */
  all: Entry[];
  end: number;
  here: number | null;
  onPick: (key: string) => void;
}) {
  const at = (page: number) => `${(stripAt(page, end) * 100).toFixed(2)}%`;
  const chapters = chapterStarts(all).filter((c) => c.page <= end);
  const marks = entries
    .filter((e) => e.page != null && e.page > 0)
    // Notes over quotes where they meet, so a dot isn't lost under a mark.
    .sort((a, b) => (a.kind === b.kind ? a.page! - b.page! : a.kind === "quote" ? -1 : 1));

  return (
    <div aria-hidden="true" className="grid gap-1">
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-4 h-2 overflow-hidden rounded-full bg-muted">
          {here && (
            <span
              className="bar-grow absolute inset-y-0 left-0 rounded-full bg-primary/25"
              style={{ width: at(here) }}
            />
          )}
          {/* Over the part read, so the chapters show there too. */}
          {chapters.map((c, i) =>
            i % 2 === 1 ? (
              <span
                key={c.key}
                className="absolute inset-y-0 bg-foreground/[0.08]"
                style={{ left: at(c.page), right: chapters[i + 1] ? `calc(100% - ${at(chapters[i + 1].page)})` : 0 }}
              />
            ) : null,
          )}
        </div>
        {chapters.map((c) =>
          c.page > 1 ? (
            <span
              key={c.key}
              title={c.label}
              className="absolute top-3 h-4 w-px bg-foreground/25"
              style={{ left: at(c.page) }}
            />
          ) : null,
        )}
        {here && (
          <span
            title={`You're on page ${here}`}
            className="absolute top-[26px] -ml-[5px] size-0 border-x-[5px] border-b-[6px] border-x-transparent border-b-primary"
            style={{ left: at(here) }}
          />
        )}
        {marks.map((e, i) => (
          <button
            key={entryKey(e)}
            type="button"
            tabIndex={-1}
            onClick={() => onPick(entryKey(e))}
            className={cn(
              "strip-mark group absolute outline-none",
              e.kind === "note" ? "top-[15px] -ml-[5px] size-[10px]" : "top-1.5 -ml-[3px] h-4 w-1.5",
            )}
            style={{ left: at(e.page!), "--i": Math.min(i, 24) } as CSSProperties}
          >
            <span
              className={cn(
                "block size-full transition-transform group-hover:scale-125",
                e.kind === "note"
                  ? "rounded-full bg-primary ring-2 ring-card"
                  : "strip-bookmark bg-primary/70 group-hover:bg-primary",
              )}
            />
            <MarkTip entry={e} at={stripAt(e.page!, end)} />
          </button>
        ))}
      </div>
      {/* The ends, and the reader's page under its arrow; an end gives way
          when the page comes near it. */}
      <div className="relative flex h-4 justify-between text-[11px] text-muted-foreground tabular-nums">
        <span className={cn(here && stripAt(here, end) < 0.12 && "invisible")}>p. 1</span>
        {here && (
          <span
            className="absolute top-0 font-medium whitespace-nowrap text-foreground"
            style={{ left: at(here), translate: `${(-stripAt(here, end) * 100).toFixed(1)}% 0` }}
          >
            You&apos;re on p. {here}
          </span>
        )}
        <span className={cn(here && stripAt(here, end) > 0.88 && "invisible")}>p. {end}</span>
      </div>
    </div>
  );
}

/** What a mark on the strip is, shown while it's pointed at: placed under
 *  it, and kept inside the strip at either end. */
function MarkTip({ entry, at }: { entry: Entry; at: number }) {
  const chapter = chapterLabel(entry.chapter);
  return (
    <span
      className="pointer-events-none absolute top-full z-20 mt-2 hidden w-60 rounded-md bg-popover p-2 text-left text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 group-hover:block"
      style={{ left: "50%", translate: `${(-at * 100).toFixed(1)}% 0` }}
    >
      <span className="block font-medium text-muted-foreground tabular-nums">
        {entry.kind === "note" ? "Note" : "Quote"} · p. {entry.page}
        {chapter && ` · ${chapter}`}
      </span>
      <span className="mt-0.5 line-clamp-3 whitespace-pre-line">{entry.text}</span>
    </span>
  );
}

/** One note or quote on the rail: its text, page and day, and the pencil,
 *  picture (quotes) and trash. */
function EntryRow({
  entry,
  book,
  heading,
  editing,
  flashing,
  chapterList,
  onEdit,
  onDone,
}: {
  entry: Entry;
  book: NotesCardBook;
  /** The chapter heading above it, when it starts a section. */
  heading: { label: string | null; paged: boolean; first: boolean } | null;
  editing: boolean;
  flashing: boolean;
  chapterList: string;
  onEdit: () => void;
  onDone: () => void;
}) {
  const prefs = usePreferences();
  const key = entryKey(entry);
  const day = formatDate(entry.createdAt, prefs);
  const meta = [entry.page != null && entry.page > 0 ? `p. ${entry.page}` : null, day].filter(Boolean).join(" · ");

  return (
    <li className="grid grid-cols-1 gap-3">
      {heading && (
        <h3
          className={cn(
            "relative pl-6 text-xs font-medium tracking-wide text-muted-foreground uppercase",
            !heading.first && "mt-2",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-0 size-[11px] -translate-y-1/2 rounded-full border-2 border-primary/60 bg-card"
          />
          {heading.label ?? "No page"}
          {heading.label && !heading.paged && <span className="font-normal normal-case"> · no page</span>}
        </h3>
      )}
      <div
        id={`entry-${key}`}
        data-flash={flashing ? "" : undefined}
        className="timeline-entry relative -mx-2 grid scroll-mt-24 grid-cols-1 gap-1 rounded-lg px-2 py-0.5 pl-8"
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute",
            entry.kind === "note"
              ? "top-[7px] left-[9px] size-[9px] rounded-full bg-primary ring-[3px] ring-card"
              : "strip-bookmark top-1 left-[10.5px] h-3.5 w-[6px] bg-primary/70",
          )}
        />
        {editing ? (
          entry.kind === "quote" ? (
            <QuoteForm quote={entry.item} onDone={onDone} chapterList={chapterList} />
          ) : (
            <NoteForm note={entry.item} onDone={onDone} chapterList={chapterList} />
          )
        ) : (
          <>
            {entry.kind === "quote" ? (
              <blockquote className="long-text border-l-2 border-primary/40 pl-3 text-sm leading-relaxed break-words whitespace-pre-line">
                <span className="sr-only">Quote: </span>
                {entry.text}
              </blockquote>
            ) : (
              <p className="long-text text-sm leading-relaxed break-words whitespace-pre-line">
                <span className="sr-only">Note: </span>
                {entry.text}
              </p>
            )}
            <div className={cn("flex min-h-7 flex-wrap items-center gap-x-2", entry.kind === "quote" && "pl-3")}>
              <span className="text-xs text-muted-foreground tabular-nums">{meta}</span>
              {entry.kind === "quote" && entry.item.note && (
                <span className="long-text min-w-0 text-xs break-words text-muted-foreground italic">
                  {entry.item.note}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={entry.kind === "quote" ? "Edit quote" : "Edit note"}
                  data-quote-edit={key}
                  onClick={onEdit}
                >
                  <Pencil className="size-3.5" />
                </Button>
                {entry.kind === "quote" ? (
                  <>
                    <QuoteCardButton quote={entry.item} book={book} />
                    <DeleteQuoteButton quoteId={entry.id} />
                  </>
                ) : (
                  <DeleteNoteButton noteId={entry.id} />
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Adds a note or a quote. While the book is being read the page box starts
 * at the reader's page, since that's usually where a note is about; the
 * kind starts as whichever was added last to this book.
 */
function AddForm({
  book,
  entries,
  chapterList,
}: {
  book: NotesCardBook;
  entries: Entry[];
  chapterList: string;
}) {
  const [kind, setKind] = useState<Kind>(() => {
    const newest = entries.reduce<Entry | null>((a, e) => (!a || e.createdAt > a.createdAt ? e : a), null);
    return newest?.kind ?? "note";
  });
  const [state, formAction, pending] = useActionState(addNoteOrQuote, {});
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const startPage = book.status === ReadingStatus.READING && book.currentPage ? book.currentPage : undefined;

  // Once a save lands the text empties for the next one, ready to type.
  // The chapter and page stay: the next is most likely from the same place.
  // (Not form.reset(), which would also clear the controlled kind.) A
  // failed save leaves everything as typed.
  useEffect(() => {
    if (!state.success || !formRef.current) return;
    for (const name of ["text", "note"]) {
      const field = formRef.current.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = "";
    }
    textRef.current?.focus();
  }, [state]);

  // #add-note: straight to a new note.
  useEffect(() => {
    const open = () => {
      if (window.location.hash !== "#add-note") return;
      setKind("note");
      formRef.current?.scrollIntoView({ block: "center", behavior: motionAllowed() ? "smooth" : "auto" });
      textRef.current?.focus({ preventScroll: true });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  return (
    <form
      ref={formRef}
      id="add-note"
      action={formAction}
      onSubmit={submitKeepingInput(formAction)}
      className="grid scroll-mt-24 gap-2"
    >
      <input type="hidden" name="bookId" value={book.id} />
      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">Add a note or a quote</legend>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 text-xs">
          {(
            [
              ["note", "Note", PenLine],
              ["quote", "Quote", QuoteIcon],
            ] as const
          ).map(([value, label, Icon]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea
        ref={textRef}
        name="text"
        rows={2}
        required
        maxLength={5000}
        placeholder={kind === "note" ? "A thought, a question, a guess at what comes next…" : "A passage worth keeping…"}
        aria-label={kind === "note" ? "New note" : "New quote"}
        // Where focus goes after deleting the last entry above it (see
        // focusAfterDelete in quotes-card.tsx).
        data-quote-fallback=""
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="chapter"
          maxLength={CHAPTER_MAX}
          list={chapterList}
          autoComplete="off"
          className="w-32"
          placeholder="Chapter"
          aria-label="Chapter"
        />
        <Input
          name="page"
          type="number"
          min={1}
          max={100000}
          className="w-20"
          placeholder="Page"
          defaultValue={startPage ?? ""}
          aria-label="Page"
        />
        {kind === "quote" && (
          <Input
            name="note"
            maxLength={2000}
            className="min-w-36 flex-1"
            placeholder="Why it stuck (optional)"
            aria-label="Why it stuck"
          />
        )}
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Adding…" : kind === "note" ? "Add note" : "Add quote"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
