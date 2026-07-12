"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { createShelf, deleteShelf } from "@/lib/actions/shelves";
import { cn } from "@/lib/utils";
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
}

/**
 * Custom-shelf row on the library page: one chip per shelf (click to
 * filter, "All" to clear), a "+ New shelf" chip, and a delete button on the
 * active shelf (confirm dialog — deleting a shelf never touches its books).
 *
 * Like every other library control, the selection lives in the URL
 * (?shelfId=…) so it composes with status tabs, search, and sorting.
 */
export function ShelfChips({
  shelves,
  activeShelfId,
  searchParams,
}: {
  shelves: ShelfInfo[];
  activeShelfId: string;
  searchParams: Record<string, string>;
}) {
  const [createState, createAction, creating] = useActionState(createShelf, {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Each successful create returns a fresh state object, so this closes the
  // dialog exactly once per creation.
  useEffect(() => {
    if (createState.success) setDialogOpen(false);
  }, [createState]);

  const active = shelves.find((s) => s.id === activeShelfId);

  function shelfHref(shelfId: string | null): string {
    const params = new URLSearchParams(searchParams);
    if (shelfId) params.set("shelfId", shelfId);
    else params.delete("shelfId");
    const qs = params.toString();
    return `/books${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm text-muted-foreground">Shelves:</span>
      <Link
        href={shelfHref(null)}
        className={cn(
          "rounded-full border px-3 py-1 text-sm transition-colors hover:border-ring/60",
          !active && "border-primary bg-primary/10 font-medium",
        )}
      >
        All
      </Link>
      {shelves.map((shelf) => (
        <span key={shelf.id} className="inline-flex items-center">
          <Link
            href={shelfHref(shelf.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors hover:border-ring/60",
              shelf.id === activeShelfId &&
                "rounded-r-none border-primary bg-primary/10 font-medium",
            )}
          >
            {shelf.name}
            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
              {shelf.bookCount}
            </span>
          </Link>
          {shelf.id === activeShelfId && (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  title={`Delete shelf “${shelf.name}”`}
                  className="rounded-r-full border border-l-0 border-primary bg-primary/10 py-1 pl-1.5 pr-2.5 text-sm hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete shelf “{shelf.name}”?</DialogTitle>
                  <DialogDescription>
                    The {shelf.bookCount} book{shelf.bookCount === 1 ? "" : "s"} on
                    it stay in your library — only the shelf goes away.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      onClick={() => startTransition(() => deleteShelf(shelf.id))}
                    >
                      Delete shelf
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </span>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New shelf
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New shelf</DialogTitle>
            <DialogDescription>
              A freeform group like “Sanderson” or “Fantasy”. Assign books from
              their detail pages.
            </DialogDescription>
          </DialogHeader>
          <form action={createAction} className="grid gap-3">
            <Input name="name" placeholder="Shelf name" required maxLength={50} autoFocus />
            {createState.error && (
              <p className="text-sm text-destructive">{createState.error}</p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create shelf"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
