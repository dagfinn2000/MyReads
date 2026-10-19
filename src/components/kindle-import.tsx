"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCheck, Check, FileText, Import, LoaderCircle, Search, X } from "lucide-react";
import { importKindleQuotes, kindleLibrary } from "@/lib/actions/quotes";
import { formatNumber } from "@/lib/display";
import {
  matchKindleBook,
  parseClippings,
  type KindleBook,
  type KindleHighlight,
  type LibraryBookRef,
} from "@/lib/kindle-clippings";
import { cn, foldForSearch } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Stage =
  | { step: "pick"; error?: string; reading?: boolean }
  | {
      step: "review";
      books: KindleBook[];
      library: LibraryBookRef[];
      /** Kindle book key → library book id, or null to skip it. */
      choice: Record<string, string | null>;
      /** What matching found, before any change. */
      found: Record<string, string | null>;
    }
  | { step: "importing"; title: string; done: number; total: number }
  | { step: "done"; added: number; already: number; books: number; failed: string[] };

/** Kept well under a server action's 1 MB limit. */
const BATCH_COUNT = 300;
const BATCH_CHARS = 300_000;

function batches(highlights: KindleHighlight[]): KindleHighlight[][] {
  const out: KindleHighlight[][] = [];
  let current: KindleHighlight[] = [];
  let chars = 0;
  for (const h of highlights) {
    const size = h.text.length + (h.note?.length ?? 0) + 100;
    if (current.length >= BATCH_COUNT || (current.length > 0 && chars + size > BATCH_CHARS)) {
      out.push(current);
      current = [];
      chars = 0;
    }
    current.push(h);
    chars += size;
  }
  if (current.length) out.push(current);
  return out;
}

function plural(n: number, one: string, many: string, prefs: Parameters<typeof formatNumber>[1]) {
  return `${formatNumber(n, prefs)} ${n === 1 ? one : many}`;
}

/**
 * "Import from Kindle" on the quotes page. The reader picks the Kindle's
 * My Clippings.txt; it's read here in the browser (lib/kindle-clippings.ts)
 * and shown book by book, each matched to a library book that can be
 * changed or skipped, before anything is saved. Then each book's
 * highlights go to the server in turn; ones already in Quotes stay out.
 */
export function KindleImport() {
  const router = useRouter();
  const prefs = usePreferences();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ step: "pick" });
  const [dragging, setDragging] = useState(false);
  const busy = stage.step === "importing" || (stage.step === "pick" && stage.reading);

  function onOpenChange(next: boolean) {
    // An import under way finishes first.
    if (!next && busy) return;
    setOpen(next);
    if (next) setStage({ step: "pick" });
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setStage({ step: "pick", reading: true });
    try {
      const [text, library] = await Promise.all([file.text(), kindleLibrary()]);
      const books = parseClippings(text);
      if (books.length === 0) {
        setStage({
          step: "pick",
          error: "No highlights in that file. It's called My Clippings.txt, in the Kindle's documents folder.",
        });
        return;
      }
      const choice = Object.fromEntries(books.map((b) => [b.key, matchKindleBook(b, library)]));
      setStage({ step: "review", books, library, choice, found: choice });
    } catch {
      setStage({ step: "pick", error: "That file couldn't be read. Try choosing it again." });
    }
  }

  async function runImport(books: KindleBook[], choice: Record<string, string | null>) {
    const chosen = books.filter((b) => choice[b.key]);
    let added = 0;
    let already = 0;
    const failed: string[] = [];
    const into = new Set<string>();
    for (const [i, book] of chosen.entries()) {
      setStage({ step: "importing", title: book.title, done: i, total: chosen.length });
      const bookId = choice[book.key]!;
      let ok = true;
      for (const part of batches(book.highlights)) {
        try {
          const res = await importKindleQuotes(bookId, part);
          if ("error" in res) ok = false;
          else {
            added += res.added;
            already += res.already;
            if (res.added > 0) into.add(bookId);
          }
        } catch {
          ok = false;
        }
      }
      if (!ok) failed.push(book.title);
    }
    setStage({ step: "done", added, already, books: into.size, failed });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Import />
          Import from Kindle
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={!busy}
        className="flex max-h-[min(90dvh,44rem)] flex-col sm:max-w-xl"
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Import from Kindle</DialogTitle>
          {stage.step === "pick" && (
            <DialogDescription>
              Connect your Kindle to a computer with its cable and open it like a USB stick. Your
              highlights and notes are in <span className="font-medium text-foreground">My Clippings.txt</span>,
              in the documents folder.
            </DialogDescription>
          )}
          {stage.step === "review" && (
            <DialogDescription>
              {plural(
                stage.books.reduce((n, b) => n + b.highlights.length, 0),
                "highlight",
                "highlights",
                prefs,
              )}{" "}
              in {plural(stage.books.length, "book", "books", prefs)}. Check which book in your
              library each one goes into; nothing is saved until you import.
            </DialogDescription>
          )}
        </DialogHeader>

        {stage.step === "pick" && (
          <div className="grid gap-3">
            <label
              htmlFor={inputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void readFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                dragging ? "border-primary bg-primary/5" : "hover:border-foreground/30 hover:bg-muted/50",
              )}
            >
              {stage.reading ? (
                <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
              ) : (
                <FileText className="size-8 text-muted-foreground/60" />
              )}
              <span className="font-medium">
                {stage.reading ? "Reading the file…" : "Choose My Clippings.txt"}
              </span>
              <span className="text-xs text-muted-foreground pointer-coarse:hidden">or drop it here</span>
              <input
                id={inputId}
                type="file"
                accept=".txt,text/plain"
                className="sr-only"
                disabled={stage.reading}
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {stage.error && (
              <p role="alert" className="text-sm text-destructive">
                {stage.error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The file is read here in your browser. Only the highlights you import are saved, and
              importing the same file again adds just the new ones.
            </p>
          </div>
        )}

        {stage.step === "review" && (
          <ReviewList
            stage={stage}
            onChoose={(key, id) => setStage({ ...stage, choice: { ...stage.choice, [key]: id } })}
          />
        )}

        {stage.step === "importing" && (
          <div className="grid gap-3 py-6" role="status">
            <p className="truncate text-center">
              Importing <span className="font-medium">{stage.title}</span>
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${((stage.done + 0.5) / stage.total) * 100}%` }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground tabular-nums">
              Book {stage.done + 1} of {stage.total}
            </p>
          </div>
        )}

        {stage.step === "done" && (
          <div className="grid justify-items-center gap-2 py-6 text-center" role="status">
            <BookCheck className="size-10 text-primary" />
            <p className="font-heading text-lg font-medium">
              {stage.added > 0
                ? `Added ${plural(stage.added, "highlight", "highlights", prefs)} to ${plural(stage.books, "book", "books", prefs)}`
                : "Nothing new to add"}
            </p>
            {stage.already > 0 && (
              <p className="text-sm text-muted-foreground">
                {plural(stage.already, "highlight was", "highlights were", prefs)} already in your
                quotes.
              </p>
            )}
            {stage.failed.length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                Couldn&apos;t import {stage.failed.join(", ")}. Try the file again.
              </p>
            )}
          </div>
        )}

        {stage.step === "review" && (
          <ReviewFooter
            stage={stage}
            onBack={() => setStage({ step: "pick" })}
            onImport={() => void runImport(stage.books, stage.choice)}
          />
        )}
        {stage.step === "done" && (
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Review = Extract<Stage, { step: "review" }>;

function ReviewFooter({
  stage,
  onBack,
  onImport,
}: {
  stage: Review;
  onBack: () => void;
  onImport: () => void;
}) {
  const prefs = usePreferences();
  const count = stage.books.reduce((n, b) => n + (stage.choice[b.key] ? b.highlights.length : 0), 0);
  const loose = stage.books.reduce((n, b) => n + (stage.choice[b.key] ? b.looseNotes : 0), 0);
  return (
    <DialogFooter className="items-center">
      {loose > 0 && (
        <p className="text-xs text-muted-foreground sm:mr-auto">
          {plural(loose, "note", "notes", prefs)} without a highlight stay{loose === 1 ? "s" : ""} out.
        </p>
      )}
      <Button variant="outline" onClick={onBack}>
        Choose another file
      </Button>
      <Button onClick={onImport} disabled={count === 0}>
        {count === 0 ? "Pick a book to import into" : `Import ${plural(count, "highlight", "highlights", prefs)}`}
      </Button>
    </DialogFooter>
  );
}

function ReviewList({
  stage,
  onChoose,
}: {
  stage: Review;
  onChoose: (key: string, bookId: string | null) => void;
}) {
  const prefs = usePreferences();
  const [changing, setChanging] = useState<string | null>(null);
  const byId = useMemo(() => new Map(stage.library.map((b) => [b.id, b])), [stage.library]);
  // Matched books first, so what needs a look is together at the end.
  const [order] = useState(() =>
    [...stage.books].sort((a, b) => Number(!stage.choice[a.key]) - Number(!stage.choice[b.key])),
  );

  return (
    <ul className="-mx-4 min-h-0 flex-1 divide-y overflow-y-auto border-t px-4">
      {order.map((book) => {
        const chosen = stage.choice[book.key];
        const target = chosen ? byId.get(chosen) : undefined;
        const withNotes =
          book.notes === 0 ? "" : book.notes === 1 ? ", 1 with a note" : `, ${formatNumber(book.notes, prefs)} with notes`;
        return (
          <li key={book.key} className="grid gap-2 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{book.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {book.author ? `${book.author} · ` : ""}
                  {plural(book.highlights.length, "highlight", "highlights", prefs)}
                  {withNotes}
                </p>
              </div>
              {changing !== book.key && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground"
                  aria-label={`${chosen ? "Change" : "Pick"} the book for ${book.title}`}
                  onClick={() => setChanging(book.key)}
                >
                  {chosen ? "Change" : "Pick a book"}
                </Button>
              )}
            </div>
            {changing === book.key ? (
              <BookFinder
                book={book}
                library={stage.library}
                chosen={chosen}
                onPick={(id) => {
                  onChoose(book.key, id);
                  setChanging(null);
                }}
                onCancel={() => setChanging(null)}
              />
            ) : target ? (
              <p className="flex min-w-0 items-center gap-1.5 text-sm">
                <Check className="size-3.5 shrink-0 text-primary" />
                <span className="shrink-0 text-muted-foreground">Into</span>
                <span className="truncate">{target.title}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {stage.found[book.key]
                  ? "Skipped"
                  : "Not found in your library. Add the book first, or pick it if it has another title there."}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Searching the library for the book a Kindle book's highlights go into. */
function BookFinder({
  book,
  library,
  chosen,
  onPick,
  onCancel,
}: {
  book: KindleBook;
  library: LibraryBookRef[];
  chosen: string | null;
  onPick: (bookId: string | null) => void;
  onCancel: () => void;
}) {
  const id = useId();
  // Starts with the title before any subtitle or series, which usually
  // finds the book even when the editions word it differently.
  const [query, setQuery] = useState(() => book.title.split(/[:(]/)[0].trim());
  const folded = useMemo(
    () => library.map((b) => ({ book: b, text: foldForSearch(`${b.title} ${b.authors.join(" ")}`) })),
    [library],
  );
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  const results = folded.filter(({ text }) => words.every((w) => text.includes(w))).slice(0, 6);

  return (
    <div className="grid gap-2 rounded-lg bg-muted/50 p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          autoFocus
          aria-label="Find the book in your library"
          placeholder="Find the book in your library"
          className="bg-background pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
        />
      </div>
      <ul className="grid gap-0.5">
        {results.map(({ book: b }) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onPick(b.id)}
              className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Check className={cn("size-3.5 shrink-0 text-primary", b.id !== chosen && "invisible")} />
              <span className="min-w-0 truncate">
                {b.title}
                {b.authors.length > 0 && <span className="text-muted-foreground"> · {b.authors.join(", ")}</span>}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">No book in your library matches.</li>
        )}
        <li>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5 shrink-0" />
            Skip this book
          </button>
        </li>
      </ul>
    </div>
  );
}
