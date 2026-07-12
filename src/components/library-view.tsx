"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { Check, SquareCheckBig, X } from "lucide-react";
import { bulkUpdateBooks } from "@/lib/actions/bulk";
import { STATUS_LABELS } from "@/lib/display";
import { cn } from "@/lib/utils";
import { BookCard } from "@/components/book-card";
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
  books: Book[];
}

/**
 * The library grid with bulk-edit support. Normally the cards are plain
 * links; toggling select mode overlays each card with a checkbox hitbox and
 * shows a floating action bar (set status / add to shelf / add tags) that
 * applies to every selected book in one server action.
 */
export function LibraryView({
  books,
  groups,
  shelves,
}: {
  books: Book[];
  /** Pre-grouped sections (author/series view) or null for the flat grid. */
  groups: LibraryGroup[] | null;
  shelves: { id: string; name: string }[];
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

  function apply() {
    const addTags = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (status === "keep" && shelfId === "keep" && addTags.length === 0) {
      setMessage("Pick a status, shelf, or tags first.");
      return;
    }
    startTransition(async () => {
      const res = await bulkUpdateBooks({
        bookIds: [...selected],
        status: status === "keep" ? undefined : (status as ReadingStatus),
        addShelfId: shelfId === "keep" ? undefined : shelfId,
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

  const renderGrid = (list: Book[]) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {list.map((book) => {
        const isSelected = selected.has(book.id);
        return (
          <div
            key={book.id}
            className={cn(
              "relative rounded-lg",
              selectMode && isSelected && "ring-2 ring-primary",
            )}
          >
            <BookCard book={book} />
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
          {books.length} book{books.length === 1 ? "" : "s"}
        </p>
        {!selectMode ? (
          <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
            <SquareCheckBig data-slot="icon" />
            Select
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set(books.map((b) => b.id)))}
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
                  {g.books.length}
                </span>
              </h2>
              {renderGrid(g.books)}
            </section>
          ))}
        </div>
      ) : (
        renderGrid(books)
      )}

      {selectMode && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-lg">
          <span className="text-sm font-medium tabular-nums">
            {selected.size} selected
          </span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
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
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Shelf: don&apos;t change</SelectItem>
                {shelves.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Add to “{s.name}”
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Add tags, comma separated"
            className="w-52"
          />
          <Button
            size="sm"
            onClick={apply}
            disabled={pending || selected.size === 0}
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
