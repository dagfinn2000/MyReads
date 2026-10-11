"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReadingStatus } from "@prisma/client";
import { Check, Dices, SquareCheckBig, X } from "lucide-react";
import { bulkUpdateBooks } from "@/lib/actions/bulk";
import { pickRandomBook } from "@/lib/actions/pick";
import { STATUS_LABELS } from "@/lib/display";
import { cn } from "@/lib/utils";
import type { LibraryDisplay } from "@/lib/library-view";
import { BookCard, BookRow, type BookCardBook } from "@/components/book-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LibraryGroup {
  title: string;
  books: BookCardBook[];
  /** The section's real size, which may exceed what's rendered. */
  total: number;
}

/** How many more cards each "Show more" asks the server for. */
const PAGE_STEP = 200;

/** Columns per breakpoint for each cover size (the View menu). */
const GRID_CLASS: Record<LibraryDisplay["cardSize"], string> = {
  small: "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8",
  medium: "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5",
  large: "grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

/**
 * The library grid with bulk-edit support. Normally the cards are plain
 * links; toggling select mode overlays each card with a checkbox hitbox and
 * shows a floating action bar (set status / add to or remove from a shelf /
 * add tags) that applies to every selected book in one server action.
 *
 * Renders only the slice the server sent. "Show more" and "Pick for me" both
 * go back to the server rather than working from a full in-memory library.
 */
export function LibraryView({
  books,
  groups,
  totalCount,
  searchParams,
  shelves,
  display,
}: {
  /** Only the books being rendered — the server sorts everything and slices. */
  books: BookCardBook[];
  /** Pre-grouped sections (author/series view) or null for the flat grid. */
  groups: LibraryGroup[] | null;
  /** How many books match the current filters, rendered or not. */
  totalCount: number;
  /** Current URL params, so "Show more" can raise the limit in place. */
  searchParams: Record<string, string>;
  shelves: { id: string; name: string }[];
  /** Cover size, grid or list, and which details cards show. */
  display: LibraryDisplay;
}) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState("keep");
  const [shelfId, setShelfId] = useState("keep");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage(null);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setStatus("keep");
    setShelfId("keep");
    setTags("");
    setMessage(null);
  }

  /** Random pick from Want to Read within the current filters (any filtered
   *  book when the current view has no unread ones).
   *
   *  Runs on the server: the page no longer ships the whole library, so
   *  picking from `books` would silently narrow the shuffle to the loaded
   *  slice instead of everything matching the filters. */
  function pickForMe() {
    startTransition(async () => {
      const pick = await pickRandomBook(searchParams);
      if (pick) router.push(`/books/${pick.id}`);
    });
  }

  function apply() {
    const addTags = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    // The shelf select's values are "add:<id>" and "remove:<id>".
    const [shelfAction, shelfTarget] = shelfId.split(":");
    if (status === "keep" && shelfId === "keep" && addTags.length === 0) {
      setMessage("Pick a status, shelf, or tags first.");
      return;
    }
    startTransition(async () => {
      const res = await bulkUpdateBooks({
        bookIds: [...selected],
        status: status === "keep" ? undefined : (status as ReadingStatus),
        addShelfId: shelfAction === "add" ? shelfTarget : undefined,
        removeShelfId: shelfAction === "remove" ? shelfTarget : undefined,
        addTags: addTags.length ? addTags : undefined,
      });
      if (res.error) {
        setMessage(res.error);
      } else {
        setMessage(`Updated ${res.count} book${res.count === 1 ? "" : "s"}.`);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const hiddenCount = totalCount - books.length;

  /** Raise ?limit= and let the server send the next slice. View state lives
   *  in the URL throughout this app, so "Show more" is shareable and survives
   *  a reload like every other part of the view. */
  function showMore() {
    const next = new URLSearchParams(searchParams);
    next.set("limit", String(books.length + PAGE_STEP));
    router.push(`/books?${next}`, { scroll: false });
  }

  const list = display.layout === "list";
  const renderGrid = (items: BookCardBook[]) => (
    <div className={list ? "grid gap-2" : GRID_CLASS[display.cardSize]}>
      {items.map((book) => {
        const isSelected = selected.has(book.id);
        return (
          <div
            key={book.id}
            className={cn(
              "relative rounded-lg",
              selectMode && isSelected && "ring-2 ring-primary",
            )}
          >
            {list ? (
              <BookRow book={book} details={display} />
            ) : (
              <BookCard
                book={book}
                details={display}
                compact={display.cardSize === "small"}
              />
            )}
            {selectMode && (
              <button
                type="button"
                onClick={() => toggle(book.id)}
                aria-pressed={isSelected}
                aria-label={`Select ${book.title}`}
                className="absolute inset-0 z-10 rounded-lg"
              >
                <span
                  className={cn(
                    "absolute left-2 top-2 flex size-6 items-center justify-center rounded-md border bg-background/90 shadow-sm",
                    isSelected &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {isSelected && <Check className="size-4" />}
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          {totalCount} book{totalCount === 1 ? "" : "s"}
          {hiddenCount > 0 ? ` · showing ${books.length}` : ""}
        </p>
        {!selectMode ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={pickForMe}
              disabled={books.length === 0}
              title="Open a random book from Want to Read (respects your filters)"
            >
              <Dices data-slot="icon" />
              Pick for me
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
              <SquareCheckBig data-slot="icon" />
              Select
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set(books.map((b) => b.id)))}
              title="Selects the books currently shown"
            >
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelectMode}>
              <X data-slot="icon" />
              Done
            </Button>
          </div>
        )}
      </div>

      {groups ? (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.title} className="grid gap-3">
              <h2 className="border-b pb-1 text-lg font-medium">
                {g.title}
                <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                  {/* The group's real size, even when only part of it is
                      rendered — the heading describes the shelf, not the
                      slice. */}
                  {g.total}
                </span>
              </h2>
              {renderGrid(g.books)}
            </section>
          ))}
        </div>
      ) : (
        renderGrid(books)
      )}

      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={showMore}>
            Show more ({hiddenCount} not shown)
          </Button>
        </div>
      )}

      {selectMode && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-lg">
          {/* Mobile rows: count / status+shelf / tags / apply. From sm up
              everything sits on one wrapping row with fixed widths. */}
          <span className="w-full text-sm font-medium tabular-nums sm:w-auto">
            {selected.size} selected
          </span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="min-w-0 flex-1 basis-[calc(50%-0.5rem)] sm:w-44 sm:flex-initial sm:basis-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Status: don&apos;t change</SelectItem>
              {Object.values(ReadingStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {shelves.length > 0 && (
            <Select value={shelfId} onValueChange={setShelfId}>
              <SelectTrigger className="min-w-0 flex-1 basis-[calc(50%-0.5rem)] sm:w-44 sm:flex-initial sm:basis-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Shelf: don&apos;t change</SelectItem>
                {shelves.map((s) => (
                  <SelectItem key={s.id} value={`add:${s.id}`}>
                    Add to “{s.name}”
                  </SelectItem>
                ))}
                {shelves.map((s) => (
                  <SelectItem key={`remove-${s.id}`} value={`remove:${s.id}`}>
                    Remove from “{s.name}”
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Add tags, comma separated"
            className="min-w-0 flex-1 basis-full sm:w-52 sm:flex-initial sm:basis-auto"
          />
          <Button
            size="sm"
            onClick={apply}
            disabled={pending || selected.size === 0}
            className="flex-1 sm:flex-initial"
          >
            {pending ? "Applying…" : "Apply"}
          </Button>
          {message && (
            <span className="text-sm text-muted-foreground">{message}</span>
          )}
        </div>
      )}
    </div>
  );
}
