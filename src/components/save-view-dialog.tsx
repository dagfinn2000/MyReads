"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus } from "lucide-react";
import { saveView } from "@/lib/actions/saved-views";
import { SAVED_VIEW_NAME_MAX } from "@/lib/saved-views";
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

/**
 * "Save view": names the filters, sort and grouping on screen so they come
 * back with one click (a chip above the library). Saving under an existing
 * name updates that view.
 */
export function SaveViewDialog({ query }: { query: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveView(name, query);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName("");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          title="Save this view"
        >
          <BookmarkPlus />
          <span className="sr-only">Save this view</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
            <DialogDescription>
              Keeps the filters, sort and grouping you have now as a chip above
              the library. Using a name you already have updates that view.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Unread fantasy"
            maxLength={SAVED_VIEW_NAME_MAX}
            autoFocus
            aria-label="View name"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save view"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
