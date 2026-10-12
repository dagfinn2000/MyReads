"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReadingStatus } from "@prisma/client";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Settings2, Trash2 } from "lucide-react";
import { savePreferences } from "@/lib/actions/preferences";
import { deleteShelf, renameShelf } from "@/lib/actions/shelves";
import { STATUS_LABELS, formatNumber } from "@/lib/display";
import { moveId, orderByIds } from "@/lib/library-order";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";
import type { ShelfInfo } from "@/components/shelf-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STATUSES = Object.values(ReadingStatus);

/**
 * Shelf housekeeping behind the "Manage shelves" chip: rename a shelf
 * (renaming onto another shelf's name merges the two), move it up or down
 * the chip row, hide it from the row, or delete it. Also which status tabs
 * the library shows, the same setting as in Preferences.
 *
 * Order and hiding are preferences (shelfOrder, hiddenShelves), so the
 * dialog shows each change at once and saves it behind the scenes; the
 * chips behind it catch up on the refresh.
 */
export function ManageShelvesDialog({
  shelves,
  activeShelfId,
  shelfHref,
}: {
  /** Every shelf, in chip order, hidden ones included. */
  shelves: ShelfInfo[];
  /** The shelf on screen (?shelfId=), if any. */
  activeShelfId: string;
  /** The library address for a shelf, or for all shelves. */
  shelfHref: (shelfId: string | null) => string;
}) {
  const router = useRouter();
  const prefs = usePreferences();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // What the dialog shows while saves catch up: the order, what's hidden,
  // and shelves just merged away or deleted. Taken from the props and
  // preferences each time it opens.
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [hiddenTabs, setHiddenTabs] = useState<ReadingStatus[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = orderByIds(shelves, order).filter((s) => !gone.includes(s.id));
  // Counted from the shelves that exist: the list may still name deleted ones.
  const hiddenCount = shelves.filter((s) => prefs.hiddenShelves.includes(s.id)).length;
  const shownTabs = STATUSES.filter((s) => !hiddenTabs.includes(s));

  function reset() {
    setEditing(null);
    setNewName("");
    setConfirmingDelete(null);
  }

  function onOpenChange(open: boolean) {
    reset();
    setMessage(null);
    if (!open) return;
    const ids = new Set(shelves.map((s) => s.id));
    setOrder(shelves.map((s) => s.id));
    setHidden(prefs.hiddenShelves.filter((id) => ids.has(id)));
    setHiddenTabs(prefs.hiddenStatusTabs);
    setGone([]);
  }

  /** Focus the first of `selectors` that is there and enabled, once React
   *  has redrawn the list. A moved or removed row takes the focus with it
   *  otherwise, and a keyboard user loses their place. */
  function focusSoon(...selectors: string[]) {
    requestAnimationFrame(() => {
      for (const selector of selectors) {
        const el = bodyRef.current?.querySelector<HTMLButtonElement>(selector);
        if (el && !el.disabled) {
          el.focus();
          return;
        }
      }
    });
  }

  /** Drop a merged or deleted shelf from the list, keeping the focus on the
   *  row that takes its place. */
  function removeRow(id: string) {
    const i = rows.findIndex((s) => s.id === id);
    const neighbour = rows[i + 1] ?? rows[i - 1];
    setGone((g) => [...g, id]);
    focusSoon(neighbour ? `[data-rename="${neighbour.id}"]` : "[data-status-tab]");
  }

  function move(shelf: ShelfInfo, by: -1 | 1) {
    // From the rows on screen, so ids of shelves since deleted drop out.
    const next = moveId(
      rows.map((s) => s.id),
      shelf.id,
      by,
    );
    setOrder(next);
    focusSoon(`[data-move="${shelf.id}:${by}"]`, `[data-move="${shelf.id}:${-by}"]`);
    startTransition(async () => {
      await savePreferences({ shelfOrder: next });
      setMessage("Chip order saved.");
      router.refresh();
    });
  }

  function toggleHidden(shelf: ShelfInfo) {
    const wasHidden = hidden.includes(shelf.id);
    const next = wasHidden
      ? hidden.filter((id) => id !== shelf.id)
      : [...hidden.filter((id) => rows.some((s) => s.id === id)), shelf.id];
    setHidden(next);
    startTransition(async () => {
      await savePreferences({ hiddenShelves: next });
      setMessage(
        wasHidden
          ? `“${shelf.name}” is back in the chip row.`
          : `“${shelf.name}” is hidden from the chip row.`,
      );
      router.refresh();
    });
  }

  function toggleTab(status: ReadingStatus) {
    const shown = !hiddenTabs.includes(status);
    if (shown && shownTabs.length === 1) return;
    const next = shown ? [...hiddenTabs, status] : hiddenTabs.filter((s) => s !== status);
    setHiddenTabs(next);
    startTransition(async () => {
      await savePreferences({ hiddenStatusTabs: next });
      router.refresh();
    });
  }

  function cancel(selector: string) {
    reset();
    focusSoon(selector);
  }

  function submitRename(shelf: ShelfInfo) {
    const to = newName.trim();
    if (!to || to === shelf.name) {
      cancel(`[data-rename="${shelf.id}"]`);
      return;
    }
    startTransition(async () => {
      const res = await renameShelf(shelf.id, to);
      if (res.error || !res.shelfId) {
        // The name stays in the box to fix.
        setMessage(res.error ?? "Couldn't rename that shelf.");
        return;
      }
      reset();
      if (res.merged) {
        const count = res.count ?? 0;
        setMessage(
          `Merged “${shelf.name}” into “${res.name}”: ${formatNumber(count, prefs)} book${count === 1 ? "" : "s"}.`,
        );
        removeRow(shelf.id);
      } else {
        setMessage(`Renamed “${shelf.name}” to “${res.name}”.`);
        focusSoon(`[data-rename="${shelf.id}"]`);
      }
      // The shelf on screen merged away: follow its books.
      if (shelf.id === activeShelfId && res.shelfId !== shelf.id) {
        router.replace(shelfHref(res.shelfId));
      } else {
        router.refresh();
      }
    });
  }

  function submitDelete(shelf: ShelfInfo) {
    startTransition(async () => {
      await deleteShelf(shelf.id);
      reset();
      setMessage(`Deleted “${shelf.name}”.`);
      removeRow(shelf.id);
      if (shelf.id === activeShelfId) router.replace(shelfHref(null));
      else router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
          Manage shelves
          {hiddenCount > 0 && ` (${hiddenCount} hidden)`}
        </button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        // Escape while renaming or confirming backs out of that, not the
        // whole dialog.
        onEscapeKeyDown={(e) => {
          if (editing) {
            e.preventDefault();
            cancel(`[data-rename="${editing}"]`);
          } else if (confirmingDelete) {
            e.preventDefault();
            cancel(`[data-delete="${confirmingDelete}"]`);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Manage shelves</DialogTitle>
          <DialogDescription>
            Rename, reorder or hide shelves. Renaming a shelf to an existing
            name merges the two. Hidden shelves still show on book pages.
          </DialogDescription>
        </DialogHeader>

        <div ref={bodyRef} className="grid min-w-0 gap-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shelves left.</p>
          ) : (
            <ul className="grid max-h-80 gap-1 overflow-y-auto pr-1">
              {rows.map((shelf, i) => {
                const isHidden = hidden.includes(shelf.id);
                const n = shelf.bookCount;
                const books = `${formatNumber(n, prefs)} book${n === 1 ? "" : "s"}`;
                return (
                  <li
                    key={shelf.id}
                    className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-1 hover:bg-muted/60"
                  >
                    {editing === shelf.id ? (
                      <form
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitRename(shelf);
                        }}
                      >
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          maxLength={50}
                          autoFocus
                          aria-label={`New name for “${shelf.name}”`}
                          className="h-8 min-w-0 flex-1 basis-40"
                        />
                        <span className="flex gap-1">
                          <Button type="submit" size="sm" disabled={pending}>
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => cancel(`[data-rename="${shelf.id}"]`)}
                          >
                            Cancel
                          </Button>
                        </span>
                      </form>
                    ) : confirmingDelete === shelf.id ? (
                      <>
                        <span className="min-w-0 flex-1 basis-40 text-sm">
                          Delete “{shelf.name}”?{" "}
                          {n === 0
                            ? "It has no books."
                            : `Its ${books} ${n === 1 ? "stays" : "stay"} in your library.`}
                        </span>
                        <span className="flex gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={pending}
                            onClick={() => submitDelete(shelf)}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancel(`[data-delete="${shelf.id}"]`)}
                          >
                            Cancel
                          </Button>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="grid min-w-0 flex-1 basis-28">
                          <span
                            className={cn("truncate text-sm", isHidden && "text-muted-foreground")}
                          >
                            {shelf.name}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {books}
                            {isHidden && " · hidden"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            data-rename={shelf.id}
                            title="Rename"
                            aria-label={`Rename “${shelf.name}”`}
                            onClick={() => {
                              setEditing(shelf.id);
                              setNewName(shelf.name);
                              setConfirmingDelete(null);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            data-move={`${shelf.id}:-1`}
                            disabled={i === 0}
                            title="Move up"
                            aria-label={`Move “${shelf.name}” up`}
                            onClick={() => move(shelf, -1)}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            data-move={`${shelf.id}:1`}
                            disabled={i === rows.length - 1}
                            title="Move down"
                            aria-label={`Move “${shelf.name}” down`}
                            onClick={() => move(shelf, 1)}
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            // One name with a pressed state, so a screen
                            // reader hears "Hide …, pressed" for a hidden
                            // shelf. The tooltip says what a click does.
                            aria-pressed={isHidden}
                            aria-label={`Hide “${shelf.name}” from the chip row`}
                            title={isHidden ? "Show in chip row" : "Hide from chip row"}
                            onClick={() => toggleHidden(shelf)}
                          >
                            {isHidden ? <EyeOff /> : <Eye />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 hover:text-destructive"
                            data-delete={shelf.id}
                            title="Delete"
                            aria-label={`Delete “${shelf.name}”`}
                            onClick={() => {
                              setConfirmingDelete(shelf.id);
                              setEditing(null);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
            {message}
          </p>

          <div
            role="group"
            aria-label="Status tabs to show"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="mr-1 text-sm text-muted-foreground">Status tabs to show:</span>
            {STATUSES.map((s) => {
              const shown = !hiddenTabs.includes(s);
              const last = shown && shownTabs.length === 1;
              return (
                <button
                  key={s}
                  type="button"
                  data-status-tab
                  aria-pressed={shown}
                  aria-disabled={last || undefined}
                  title={last ? "At least one status tab stays" : undefined}
                  onClick={() => toggleTab(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors hover:border-ring/60",
                    shown && "border-primary bg-primary/10 font-medium",
                    last && "cursor-not-allowed",
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
