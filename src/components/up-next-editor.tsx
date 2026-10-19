"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ListOrdered, Plus, Search, X } from "lucide-react";
import { setUpNextOrder } from "@/lib/actions/up-next";
import { foldForSearch } from "@/lib/utils";
import { BookCover } from "@/components/book-card";
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

export interface UpNextItem {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}

/** How many of the other Want to Read books the add list shows at once. */
const SHOWN = 6;

/**
 * Now reading's "Edit list": the reader's own Up next list, to put in
 * order and take books off, and the rest of Want to Read to add from (the
 * suggestions first). Every change shows at once and is saved behind it,
 * the whole list each time, so a quick run of moves lands in order.
 */
export function UpNextEditor({ picks, others }: { picks: UpNextItem[]; others: UpNextItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [order, setOrder] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map([...picks, ...others].map((b) => [b.id, b])), [picks, others]);
  const folded = useMemo(
    () => [...picks, ...others].map((b) => ({ id: b.id, text: foldForSearch(`${b.title} ${b.authors.join(" ")}`) })),
    [picks, others],
  );
  const rows = order.flatMap((id) => byId.get(id) ?? []);
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  const candidates = folded
    .filter(({ id, text }) => !order.includes(id) && words.every((w) => text.includes(w)))
    .slice(0, SHOWN)
    .flatMap(({ id }) => byId.get(id) ?? []);

  function onOpenChange(open: boolean) {
    if (!open) return;
    setOrder(picks.map((b) => b.id));
    setQuery("");
  }

  function save(next: string[]) {
    setOrder(next);
    startTransition(async () => {
      await setUpNextOrder(next);
      router.refresh();
    });
  }

  /** Keep the keyboard on a row's move buttons once React has redrawn the
   *  list, the same direction if it can still go that way. A moved or
   *  removed row takes the focus with it otherwise. */
  function focusRow(id: string | undefined, move: "-1" | "1") {
    requestAnimationFrame(() => {
      if (!id) return searchRef.current?.focus();
      const buttons = [
        ...(listRef.current?.querySelectorAll<HTMLButtonElement>(`[data-row="${CSS.escape(id)}"]`) ?? []),
      ].filter((b) => !b.disabled);
      (buttons.find((b) => b.dataset.move === move) ?? buttons[0])?.focus();
    });
  }

  /** After an add, the next book down the add list takes the focus. */
  function focusCandidate(index: number) {
    requestAnimationFrame(() => {
      const buttons = addRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (buttons?.length) buttons[Math.min(index, buttons.length - 1)].focus();
      else searchRef.current?.focus();
    });
  }

  function move(id: string, by: -1 | 1) {
    const i = order.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
    focusRow(id, by === -1 ? "-1" : "1");
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ListOrdered className="size-3.5" />
          {picks.length > 0 ? "Edit list" : "Pick your own"}
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90dvh,44rem)] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Up next</DialogTitle>
          <DialogDescription>
            Your picks come first on Now reading, in this order, before the suggestions. Starting a
            book takes it off the list.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Nothing picked yet. Add books from Want to Read below.
            </p>
          ) : (
            <ol ref={listRef} className="grid gap-1" aria-label="Your Up next list">
              {rows.map((book, i) => (
                <li key={book.id} className="flex min-w-0 items-center gap-2.5 rounded-lg bg-muted/50 py-1.5 pr-1 pl-2">
                  <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <BookCover book={book} className="aspect-[2/3] w-7 shrink-0 rounded-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{book.title}</span>
                    {book.authors.length > 0 && (
                      <span className="block truncate text-xs text-muted-foreground">{book.authors.join(", ")}</span>
                    )}
                  </span>
                  <span className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-row={book.id}
                      data-move="-1"
                      disabled={i === 0}
                      aria-label={`Move ${book.title} up`}
                      onClick={() => move(book.id, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-row={book.id}
                      data-move="1"
                      disabled={i === rows.length - 1}
                      aria-label={`Move ${book.title} down`}
                      onClick={() => move(book.id, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Take ${book.title} off Up next`}
                      onClick={() => {
                        const next = order.filter((id) => id !== book.id);
                        save(next);
                        focusRow(next[Math.min(i, next.length - 1)], "1");
                      }}
                    >
                      <X />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <section className="grid gap-2" aria-labelledby="up-next-add">
            <h3 id="up-next-add" className="text-sm font-medium">
              Add from Want to Read
            </h3>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                aria-label="Find a Want to Read book"
                placeholder="Find a Want to Read book"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ul ref={addRef} className="grid gap-0.5">
              {candidates.map((book, i) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => {
                      save([...order, book.id]);
                      focusCandidate(i);
                    }}
                    className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <BookCover book={book} className="aspect-[2/3] w-7 shrink-0 rounded-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{book.title}</span>
                      {book.authors.length > 0 && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {book.authors.join(", ")}
                        </span>
                      )}
                    </span>
                    <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only">Add to Up next</span>
                  </button>
                </li>
              ))}
              {candidates.length === 0 && (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">
                  {words.length > 0 ? "No Want to Read book matches." : "Every Want to Read book is on the list."}
                </li>
              )}
            </ul>
          </section>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
