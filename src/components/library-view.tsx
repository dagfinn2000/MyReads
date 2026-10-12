"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { Check, Dices, SquareCheckBig, X } from "lucide-react";
import { bulkDeleteBooks, bulkUpdateBooks } from "@/lib/actions/bulk";
import { pickRandomBook } from "@/lib/actions/pick";
import { FORMAT_LABELS, OWNERSHIP_LABELS, STATUS_LABELS, formatNumber } from "@/lib/display";
import { orderByIds } from "@/lib/library-order";
import { cn } from "@/lib/utils";
import type { LibraryDisplay } from "@/lib/library-view";
import {
  BookCard,
  BookCoverTile,
  BookOnShelf,
  BookRow,
  type BookCardBook,
} from "@/components/book-card";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Cards that fade in one after another when the library opens. The rest
 *  appear together, so a big library (or "Show more") never waits. */
const STAGGERED_CARDS = 24;

/** Columns per breakpoint for each cover size (the View menu). */
const GRID_COLUMNS: Record<LibraryDisplay["cardSize"], string> = {
  small: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
  medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  large: "grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

/** Space between cards. A bookshelf has none across, so its ledges join
 *  up; its slots pad the covers apart instead (globals.css). */
const GRID_GAPS: Record<LibraryDisplay["cardSize"], string> = {
  small: "gap-2 sm:gap-3",
  medium: "gap-3 sm:gap-4",
  large: "gap-4",
};

/** Comma-separated tags as typed, cleaned the way tags are stored. */
function splitTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The library grid with bulk-edit support. Normally the cards are plain
 * links; toggling select mode overlays each card with a checkbox hitbox and
 * shows a floating action bar (status, shelf, format, ownership, tags to
 * add or remove, or delete) that applies to every selected book in one
 * server action. Once every card on screen is picked, "Select all N books
 * that match" widens the selection to every book the filters match, which
 * the server finds again from the same URL parameters.
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
  const prefs = usePreferences();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState("keep");
  const [shelfId, setShelfId] = useState("keep");
  const [format, setFormat] = useState("keep");
  const [ownership, setOwnership] = useState("keep");
  const [tags, setTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  // The filters (as matchKey below) for which "every book that matches" was
  // chosen. Any other filters on screen and it no longer applies.
  const [matchingFor, setMatchingFor] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // --- Bulk selection ---
  // Only books on screen count as picked. The selection outlives a change
  // of filters (this component stays mounted), and acting on books no
  // longer shown, Delete above all, is never what anyone means.
  const shownIds = new Set((groups ? groups.flatMap((g) => g.books) : books).map((b) => b.id));
  const picked = [...selected].filter((id) => shownIds.has(id));
  const matchKey = (() => {
    const params = new URLSearchParams(searchParams);
    params.delete("limit");
    return params.toString();
  })();
  const allMatching = matchingFor === matchKey;
  const selCount = allMatching ? totalCount : picked.length;
  const canSelectMatching =
    !allMatching && picked.length === shownIds.size && totalCount > shownIds.size;
  const booksLabel = (n: number) => `${formatNumber(n, prefs)} book${n === 1 ? "" : "s"}`;
  const target = () =>
    allMatching ? { matching: searchParams } : { bookIds: picked };

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMatchingFor(null);
    setMessage(null);
  }

  function clearSelection() {
    setSelected(new Set());
    setMatchingFor(null);
  }

  function exitSelectMode() {
    setSelectMode(false);
    clearSelection();
    setStatus("keep");
    setShelfId("keep");
    setFormat("keep");
    setOwnership("keep");
    setTags("");
    setRemoveTags("");
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
    const addTags = splitTags(tags);
    const dropTags = splitTags(removeTags);
    // The shelf select's values are "add:<id>" and "remove:<id>".
    const [shelfAction, shelfTarget] = shelfId.split(":");
    if (
      status === "keep" &&
      shelfId === "keep" &&
      format === "keep" &&
      ownership === "keep" &&
      addTags.length === 0 &&
      dropTags.length === 0
    ) {
      setMessage("Pick a change first.");
      return;
    }
    startTransition(async () => {
      const res = await bulkUpdateBooks({
        ...target(),
        status: status === "keep" ? undefined : (status as ReadingStatus),
        format: format === "keep" ? undefined : (format as BookFormat),
        ownership: ownership === "keep" ? undefined : (ownership as BookOwnership),
        addShelfId: shelfAction === "add" ? shelfTarget : undefined,
        removeShelfId: shelfAction === "remove" ? shelfTarget : undefined,
        addTags: addTags.length ? addTags : undefined,
        removeTags: dropTags.length ? dropTags : undefined,
      });
      if (res.error) {
        setMessage(res.error);
      } else {
        setMessage(`Updated ${booksLabel(res.count ?? 0)}.`);
        clearSelection();
        router.refresh();
      }
    });
  }

  function deleteSelected() {
    startDelete(async () => {
      const res = await bulkDeleteBooks({
        ...target(),
        // The count the dialog named: if the matches have changed since,
        // the server refuses rather than delete a different set.
        expectedCount: allMatching ? totalCount : undefined,
      });
      setDeleteOpen(false);
      if (res.error) {
        setMessage(res.error);
      } else {
        setMessage(`Deleted ${booksLabel(res.count ?? 0)}.`);
        clearSelection();
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
  const style = list ? null : display.cardStyle;
  const renderGrid = (items: BookCardBook[]) => (
    // no-lift: cards stay put on hover while picking, so the selection ring
    // keeps lining up with the card.
    <div
      className={cn(
        "grid",
        list && "gap-2",
        !list && GRID_COLUMNS[display.cardSize],
        style === "shelf" ? "bookshelf gap-y-6" : !list && GRID_GAPS[display.cardSize],
        selectMode && "no-lift",
      )}
    >
      {items.map((book, i) => {
        const isSelected = selected.has(book.id);
        return (
          <div
            key={book.id}
            className={cn(
              "card-in relative rounded-lg",
              style === "shelf" && "shelf-slot",
              selectMode && isSelected && "ring-2 ring-primary",
            )}
            style={{ "--i": i < STAGGERED_CARDS ? i : 0 } as React.CSSProperties}
          >
            {list ? (
              <BookRow book={book} details={display} formatPrefs={prefs} />
            ) : style === "shelf" ? (
              <BookOnShelf book={book} />
            ) : style === "covers" ? (
              <BookCoverTile book={book} compact={display.cardSize === "small"} />
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
    // While selecting, room at the bottom so the action bar never covers
    // the last books.
    <div className={cn("grid gap-4", selectMode && "pb-80 sm:pb-48")}>
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
              onClick={() => {
                setSelected(new Set(shownIds));
                setMatchingFor(null);
              }}
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
              <h2 className="border-b pb-1 font-heading text-lg font-medium">
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
        <div className="fixed bottom-4 left-1/2 z-50 grid max-h-[min(70dvh,34rem)] w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 gap-2 overflow-y-auto rounded-xl border bg-card p-3 shadow-lg">
          {/* Rows: the count (and "all that match"), the changes in two
              columns on phones and four from sm up, then Apply, Delete and
              how it went. The bar scrolls if a short screen can't fit it. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium tabular-nums">
              {formatNumber(selCount, prefs)} selected
            </span>
            {allMatching ? (
              <>
                <span className="text-muted-foreground">
                  All {booksLabel(totalCount)} that match are selected.
                </span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={clearSelection}>
                  Clear selection
                </Button>
              </>
            ) : canSelectMatching ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setMatchingFor(matchKey)}
              >
                Select all {booksLabel(totalCount)} that match
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Status" className="w-full min-w-0">
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
                <SelectTrigger aria-label="Shelf" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Shelf: don&apos;t change</SelectItem>
                  {/* Hidden shelves too: hiding is only about the chip row. */}
                  {orderByIds(shelves, prefs.shelfOrder).map((s) => (
                    <SelectItem key={s.id} value={`add:${s.id}`}>
                      Add to “{s.name}”
                    </SelectItem>
                  ))}
                  {orderByIds(shelves, prefs.shelfOrder).map((s) => (
                    <SelectItem key={`remove-${s.id}`} value={`remove:${s.id}`}>
                      Remove from “{s.name}”
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger aria-label="Format" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Format: don&apos;t change</SelectItem>
                {Object.values(BookFormat).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownership} onValueChange={setOwnership}>
              <SelectTrigger aria-label="Ownership" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Ownership: don&apos;t change</SelectItem>
                {Object.values(BookOwnership).map((o) => (
                  <SelectItem key={o} value={o}>
                    {OWNERSHIP_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Add tags, comma separated"
              aria-label="Add tags, comma separated"
              className="col-span-2"
            />
            <Input
              value={removeTags}
              onChange={(e) => setRemoveTags(e.target.value)}
              placeholder="Remove tags, comma separated"
              aria-label="Remove tags, comma separated"
              className="col-span-2"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={apply}
              disabled={pending || deleting || selCount === 0}
              className="flex-1 sm:flex-initial"
            >
              {pending ? "Applying…" : "Apply"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={pending || deleting || selCount === 0}
            >
              Delete…
            </Button>
            <span role="status" className="basis-full text-sm text-muted-foreground sm:basis-auto">
              {message}
            </span>
          </div>
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          // Start on Cancel, not the backup link: Enter shouldn't delete.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelDeleteRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete {booksLabel(selCount)}?</DialogTitle>
            <DialogDescription>
              They leave your library with their reading history, quotes and
              loans. This can&apos;t be undone, so{" "}
              <a href="/api/export">download a backup</a> first if you might
              want them back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button ref={cancelDeleteRef} variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={deleteSelected}>
              {deleting ? "Deleting…" : `Delete ${booksLabel(selCount)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
