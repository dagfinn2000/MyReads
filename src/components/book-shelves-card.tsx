"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { createShelf, toggleBookShelf } from "@/lib/actions/shelves";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Shelf assignment on the book detail page: a checkbox per shelf plus an
 * inline "new shelf" creator that puts the book on the new shelf right away.
 * Toggles are optimistic so the checkboxes feel instant.
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
  const [pendingIds, setOptimistic] = useOptimistic(
    memberIds,
    (ids: string[], toggle: { shelfId: string; member: boolean }) =>
      toggle.member
        ? [...ids, toggle.shelfId]
        : ids.filter((id) => id !== toggle.shelfId),
  );
  const [, startTransition] = useTransition();
  const [createState, createAction, creating] = useActionState(createShelf, {});

  function toggle(shelfId: string, member: boolean) {
    startTransition(async () => {
      setOptimistic({ shelfId, member });
      await toggleBookShelf(bookId, shelfId, member);
    });
  }

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
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {shelves.map((shelf) => {
            const member = pendingIds.includes(shelf.id);
            return (
              <label
                key={shelf.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
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

        <form action={createAction} className="flex gap-2">
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
