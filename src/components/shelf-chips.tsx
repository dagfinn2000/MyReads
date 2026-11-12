"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, X } from "lucide-react";
import { createShelf, deleteShelf } from "@/lib/actions/shelves";
import { deleteSmartShelf, startSmartShelfDraft } from "@/lib/actions/smart-shelves";
import type { ActionState } from "@/lib/actions/helpers";
import { orderByIds } from "@/lib/library-order";
import { cn } from "@/lib/utils";
import { submitKeepingInput } from "@/lib/submit-form";
import { ManageShelvesDialog } from "@/components/manage-shelves-dialog";
import { usePreferences } from "@/components/preferences-provider";
import { RulePills, useDescribeRules } from "@/components/smart-shelf-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface ShelfInfo {
  id: string;
  name: string;
  bookCount: number;
  /** A smart shelf's rules (lib/smart-shelves.ts); unset for a shelf of
   *  the reader's own. */
  rules?: string;
}

/**
 * Custom-shelf row on the library page: one chip per shelf (click to
 * filter, "All" to clear), a "+ New shelf" chip, a "Manage shelves" chip
 * (rename, merge, reorder, hide, delete), and a delete button on the
 * active shelf (confirm dialog — deleting a shelf never touches its books).
 *
 * Smart shelves sit among them, marked with sparkles. The one on screen
 * also has a pencil to change its rules, and its rules show under the row.
 *
 * Chips follow the reader's own order (shelfOrder; shelves not in it
 * follow by name) and leave out hidden shelves, except the one on screen.
 *
 * Like every other library control, the selection lives in the URL
 * (?shelfId=…) so it composes with status tabs, search, and sorting.
 */
export function ShelfChips({
  shelves,
  activeShelfId,
  searchParams,
}: {
  /** Both kinds, by name; the reader's order is applied here. */
  shelves: ShelfInfo[];
  activeShelfId: string;
  searchParams: Record<string, string>;
}) {
  const prefs = usePreferences();
  const router = useRouter();
  const describe = useDescribeRules(shelves);
  const ordered = orderByIds(shelves, prefs.shelfOrder);
  const visible = ordered.filter(
    (s) => s.id === activeShelfId || !prefs.hiddenShelves.includes(s.id),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kind, setKind] = useState<"shelf" | "smart">("shelf");
  const [smartError, setSmartError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();

  // Closing the dialog is part of submitting, not a reaction to state
  // changing afterwards: the action runs, and on success the dialog closes
  // in the same flow. Reacting to `createState` in an effect meant an extra
  // render pass, and depended on each success producing a new object
  // identity to avoid re-closing a dialog the user had reopened.
  const [createState, createAction, creating] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await createShelf(prev, formData);
      if (result.success) setDialogOpen(false);
      return result;
    },
    {},
  );

  const active = shelves.find((s) => s.id === activeShelfId);

  function shelfHref(shelfId: string | null): string {
    const params = new URLSearchParams(searchParams);
    if (shelfId) params.set("shelfId", shelfId);
    else params.delete("shelfId");
    const qs = params.toString();
    return `/books${qs ? `?${qs}` : ""}`;
  }

  /** The library laid out as it is now, with just these filters. */
  function withView(rules: string): string {
    const params = new URLSearchParams(rules);
    for (const key of ["group", "sort", "dir"]) {
      if (searchParams[key]) params.set(key, searchParams[key]);
    }
    return `/books?${params}`;
  }

  /** Opens a smart shelf's rules in the filter bar, to be changed there. */
  function editRules(shelf: ShelfInfo) {
    setEditError(null);
    startTransition(async () => {
      const res = await startSmartShelfDraft({ id: shelf.id });
      if (res.error || res.rules === undefined) {
        setEditError(res.error ?? "Couldn't open that shelf's rules.");
        return;
      }
      router.push(withView(res.rules));
    });
  }

  /** Names a new smart shelf, then lets its rules be chosen in the bar. */
  function startSmart(formData: FormData) {
    setSmartError(null);
    startTransition(async () => {
      const res = await startSmartShelfDraft({ name: String(formData.get("name") ?? "") });
      if (res.error) {
        setSmartError(res.error);
        return;
      }
      setDialogOpen(false);
      // Off any smart shelf on screen: its own rules can't be the start.
      if (active?.rules !== undefined) router.push(shelfHref(null));
      else router.refresh();
    });
  }

  return (
    // data-keeps-search: see ShelfTabs.
    <div className="flex flex-wrap items-center gap-1.5" data-keeps-search="">
      <span className="mr-1 text-sm text-muted-foreground">Shelves:</span>
      {/* No prefetching, here or below: see BookLink. */}
      <Link
        href={shelfHref(null)}
        prefetch={false}
        className={cn(
          "rounded-full border px-3 py-1 text-sm transition-colors hover:border-ring/60",
          !active && "border-primary bg-primary/10 font-medium",
        )}
      >
        All
      </Link>
      {visible.map((shelf) => {
        const smart = shelf.rules !== undefined;
        const on = shelf.id === activeShelfId;
        return (
          <span key={shelf.id} className="inline-flex items-center">
            <Link
              href={shelfHref(shelf.id)}
              prefetch={false}
              title={smart ? `Smart shelf: ${describe(shelf.rules!).join(", ")}` : undefined}
              data-smart-shelf={smart ? "" : undefined}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors hover:border-ring/60",
                on && "rounded-r-none border-primary bg-primary/10 font-medium",
              )}
            >
              {smart && (
                <Sparkles
                  aria-hidden
                  className={cn("mr-1.5 size-3.5", on ? "text-primary" : "text-muted-foreground")}
                />
              )}
              {smart && <span className="sr-only">Smart shelf: </span>}
              {shelf.name}
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {shelf.bookCount}
              </span>
            </Link>
            {on && smart && (
              <button
                type="button"
                title={`Change the rules of “${shelf.name}”`}
                aria-label={`Change the rules of “${shelf.name}”`}
                disabled={starting}
                onClick={() => editRules(shelf)}
                className="border-y border-primary bg-primary/10 py-1 pl-1.5 pr-1 text-sm hover:text-primary"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {on && (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    title={`Delete ${smart ? "smart shelf" : "shelf"} “${shelf.name}”`}
                    className={cn(
                      "rounded-r-full border border-l-0 border-primary bg-primary/10 py-1 pr-2.5 text-sm hover:text-destructive",
                      smart ? "pl-1" : "pl-1.5",
                    )}
                  >
                    <X className="size-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Delete {smart ? "smart shelf" : "shelf"} “{shelf.name}”?
                    </DialogTitle>
                    <DialogDescription>
                      {smart
                        ? "Only its rules go: every book on it stays in your library, just as it is."
                        : `The ${shelf.bookCount} book${shelf.bookCount === 1 ? "" : "s"} on it stay in your library — only the shelf goes away.`}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          startTransition(async () => {
                            if (smart) {
                              await deleteSmartShelf(shelf.id);
                              router.replace(shelfHref(null));
                            } else {
                              await deleteShelf(shelf.id);
                            }
                          })
                        }
                      >
                        Delete {smart ? "smart shelf" : "shelf"}
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </span>
        );
      })}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          setSmartError(null);
          if (open) setKind("shelf");
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New shelf
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New shelf</DialogTitle>
            <DialogDescription>
              {kind === "shelf"
                ? "A freeform group like “Sanderson” or “Fantasy”. Assign books from their detail pages, or several at once with Select."
                : "Fills itself with every book that matches its rules, like “unread sci-fi under 300 pages”, and keeps up as your books change. You choose the rules next, with the library’s filters."}
            </DialogDescription>
          </DialogHeader>
          <ShelfKindChoice kind={kind} onChange={setKind} />
          <form
            action={kind === "shelf" ? createAction : startSmart}
            onSubmit={kind === "shelf" ? submitKeepingInput(createAction) : undefined}
            className="grid gap-3"
          >
            <Input
              name="name"
              aria-label="Shelf name"
              placeholder={kind === "shelf" ? "Shelf name" : "Short sci-fi"}
              required
              maxLength={50}
              autoFocus
            />
            {kind === "shelf" && createState.error && (
              <p className="text-sm text-destructive">{createState.error}</p>
            )}
            {kind === "smart" && smartError && (
              <p className="text-sm text-destructive">{smartError}</p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              {kind === "shelf" ? (
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create shelf"}
                </Button>
              ) : (
                <Button type="submit" disabled={starting}>
                  {starting ? "Opening…" : "Choose its rules"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {shelves.length > 0 && (
        <ManageShelvesDialog
          shelves={ordered}
          activeShelfId={activeShelfId}
          shelfHref={shelfHref}
          onEditRules={editRules}
        />
      )}
      {active?.rules !== undefined && (
        <div className="flex w-full flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span className="mr-0.5">Fills itself with books that match:</span>
          <RulePills rules={describe(active.rules)} />
          <button
            type="button"
            onClick={() => editRules(active)}
            disabled={starting}
            className="ml-1 rounded-sm text-foreground underline-offset-4 hover:underline"
          >
            Change rules
          </button>
          {editError && <span className="w-full text-destructive">{editError}</span>}
        </div>
      )}
    </div>
  );
}

/** Two cards to pick the kind of a new shelf: one filled by hand, or a
 *  smart one that fills itself. */
export function ShelfKindChoice({
  kind,
  onChange,
  smartDisabled,
  labels = { shelf: "Shelf", smart: "Smart shelf" },
  notes = { shelf: "You put books on it", smart: "Fills itself from rules" },
}: {
  kind: "shelf" | "smart";
  onChange: (kind: "shelf" | "smart") => void;
  smartDisabled?: boolean;
  labels?: { shelf: string; smart: string };
  notes?: { shelf: string; smart: string };
}) {
  const option = (value: "shelf" | "smart") => {
    const on = kind === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={value === "smart" && smartDisabled}
        onClick={() => onChange(value)}
        className={cn(
          "grid gap-0.5 rounded-md border px-3 py-2 text-left transition-colors hover:border-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
          on && "border-primary bg-primary/10",
        )}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {value === "smart" && <Sparkles aria-hidden className="size-3.5 text-primary" />}
          {labels[value]}
        </span>
        <span className="text-xs text-muted-foreground">{notes[value]}</span>
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label="Kind of shelf" className="grid grid-cols-2 gap-2">
      {option("shelf")}
      {option("smart")}
    </div>
  );
}
