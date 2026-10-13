"use client";

import { useActionState, useOptimistic, useRef, useState, useTransition } from "react";
import { createShelf, toggleBookShelf } from "@/lib/actions/shelves";
import type { ActionState } from "@/lib/actions/helpers";
import { submitKeepingInput } from "@/lib/submit-form";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Shelf assignment on the book detail page: a checkbox per shelf plus an
 * inline "new shelf" creator that puts the book on the new shelf right away.
 * Toggles are optimistic so the checkboxes feel instant.
 *
 * With "Only this book's shelves" (Preferences > Book page) it lists just
 * the shelves the book is on, and the rest go in an "Add to a shelf" menu.
 * A shelf ticked or unticked here stays listed until the page is left, so a
 * checkbox never vanishes from under the pointer or keyboard focus.
 */
export function BookShelvesCard({
  bookId,
  shelves,
  memberIds,
}: {
  bookId: string;
  shelves: { id: string; name: string }[];
  memberIds: string[];
}) {
  const { shelvesCard } = usePreferences();
  const [pendingIds, setOptimistic] = useOptimistic(
    memberIds,
    (ids: string[], toggle: { shelfId: string; member: boolean }) =>
      toggle.member
        ? [...ids, toggle.shelfId]
        : ids.filter((id) => id !== toggle.shelfId),
  );
  const [, startTransition] = useTransition();
  const createForm = useRef<HTMLFormElement>(null);
  // A new shelf empties the box for the next one; a refused name stays, to
  // be fixed (submitKeepingInput).
  const [createState, createAction, creating] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await createShelf(prev, formData);
      if (result.success) createForm.current?.reset();
      return result;
    },
    {},
  );
  const [kept, setKept] = useState(() => new Set(memberIds));
  const [announcement, setAnnouncement] = useState("");
  const boxes = useRef(new Map<string, HTMLInputElement>());
  const trigger = useRef<HTMLButtonElement>(null);
  const justAdded = useRef<string | null>(null);

  function toggle(shelfId: string, member: boolean) {
    setKept((k) => (k.has(shelfId) ? k : new Set(k).add(shelfId)));
    startTransition(async () => {
      setOptimistic({ shelfId, member });
      await toggleBookShelf(bookId, shelfId, member);
    });
  }

  function add(shelfId: string) {
    const shelf = shelves.find((s) => s.id === shelfId);
    if (!shelf) return;
    justAdded.current = shelfId;
    toggle(shelfId, true);
    setAnnouncement(`Added to ${shelf.name}.`);
  }

  const mine = shelvesCard === "mine";
  const listed = mine
    ? shelves.filter((s) => kept.has(s.id) || pendingIds.includes(s.id))
    : shelves;
  const others = mine ? shelves.filter((s) => !listed.includes(s)) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shelves</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {shelves.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No shelves yet — create one below.
          </p>
        )}
        {mine && shelves.length > 0 && listed.length === 0 && (
          <p className="text-sm text-muted-foreground">Not on any shelf yet.</p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {listed.map((shelf) => {
            const member = pendingIds.includes(shelf.id);
            return (
              <label
                key={shelf.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  ref={(el) => {
                    if (el) boxes.current.set(shelf.id, el);
                    else boxes.current.delete(shelf.id);
                  }}
                  type="checkbox"
                  checked={member}
                  onChange={(e) => toggle(shelf.id, e.target.checked)}
                  className="size-4 accent-primary"
                />
                {shelf.name}
              </label>
            );
          })}
        </div>

        {others.length > 0 && (
          <Select value="" onValueChange={add}>
            <SelectTrigger ref={trigger} aria-label="Add to a shelf" className="w-full sm:w-64">
              <SelectValue placeholder="Add to a shelf…" />
            </SelectTrigger>
            <SelectContent
              onCloseAutoFocus={(e) => {
                const id = justAdded.current;
                justAdded.current = null;
                // That was the last shelf, so the menu is gone: focus the
                // shelf just added instead of losing focus to the page.
                if (id && !trigger.current) {
                  e.preventDefault();
                  boxes.current.get(id)?.focus();
                }
              }}
            >
              {others.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {mine && (
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        )}

        <form
          ref={createForm}
          action={createAction}
          onSubmit={submitKeepingInput(createAction)}
          className="flex gap-2"
        >
          <input type="hidden" name="bookId" value={bookId} />
          <Input
            name="name"
            placeholder="New shelf (adds this book to it)"
            required
            maxLength={50}
            className="max-w-64"
          />
          <Button type="submit" variant="outline" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </form>
        {createState.error && (
          <p className="text-sm text-destructive">{createState.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
