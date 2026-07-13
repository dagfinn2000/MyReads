"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Tags, Trash2, X } from "lucide-react";
import { deleteTag, renameTag } from "@/lib/actions/tags";
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

/**
 * Tag housekeeping: rename a tag everywhere (renaming onto an existing tag
 * merges them) or remove one from every book. Lives behind a small icon
 * button next to the tag filter.
 */
export function ManageTagsDialog({
  tagCounts,
}: {
  tagCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const tags = Object.keys(tagCounts).sort();

  function reset() {
    setEditing(null);
    setNewName("");
    setConfirmingDelete(null);
  }

  function submitRename(from: string) {
    const to = newName.trim().toLowerCase();
    if (!to || to === from) {
      reset();
      return;
    }
    const merging = to in tagCounts;
    startTransition(async () => {
      const res = await renameTag(from, to);
      setMessage(
        res.error ??
          `${merging ? "Merged into" : "Renamed to"} “${to}” on ${res.count} book${res.count === 1 ? "" : "s"}.`,
      );
      reset();
      router.refresh();
    });
  }

  function submitDelete(tag: string) {
    startTransition(async () => {
      const res = await deleteTag(tag);
      setMessage(
        res.error ??
          `Removed “${tag}” from ${res.count} book${res.count === 1 ? "" : "s"}.`,
      );
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      onOpenChange={() => {
        reset();
        setMessage(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          title="Manage tags"
        >
          <Tags />
          <span className="sr-only">Manage tags</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage tags</DialogTitle>
          <DialogDescription>
            Rename or remove tags across your whole library. Renaming a tag to
            an existing one merges them.
          </DialogDescription>
        </DialogHeader>

        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tags yet — tag some books first.
          </p>
        ) : (
          <ul className="grid max-h-80 gap-1 overflow-y-auto pr-1">
            {tags.map((tag) => (
              <li
                key={tag}
                className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60"
              >
                {editing === tag ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitRename(tag);
                    }}
                  >
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={50}
                      autoFocus
                      className="h-8 flex-1"
                    />
                    <Button type="submit" size="icon" variant="ghost" className="size-8" disabled={pending} title="Save">
                      <Check />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-8" onClick={reset} title="Cancel">
                      <X />
                    </Button>
                  </form>
                ) : confirmingDelete === tag ? (
                  <>
                    <span className="flex-1 truncate text-sm">
                      Remove “{tag}” from {tagCounts[tag]} book
                      {tagCounts[tag] === 1 ? "" : "s"}?
                    </span>
                    <Button size="sm" variant="destructive" className="h-8" disabled={pending} onClick={() => submitDelete(tag)}>
                      Remove
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={reset} title="Cancel">
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{tag}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {tagCounts[tag]}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title={`Rename “${tag}”`}
                      onClick={() => {
                        setEditing(tag);
                        setNewName(tag);
                        setConfirmingDelete(null);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 hover:text-destructive"
                      title={`Remove “${tag}” from all books`}
                      onClick={() => {
                        setConfirmingDelete(tag);
                        setEditing(null);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </DialogContent>
    </Dialog>
  );
}
