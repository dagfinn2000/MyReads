"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { emptyRecentlyDeleted, forgetDeletedBooks, restoreDeletedBooks } from "@/lib/actions/recently-deleted";
import { Button } from "@/components/ui/button";
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

/** Put back, or delete for good (asked twice: the second tap says so). */
export function BinRowActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [sure, setSure] = useState(false);

  if (restored) {
    return (
      <span className="text-sm text-muted-foreground" role="status">
        Back in your library.{" "}
        <Link href={`/books/${id}`} className="text-foreground underline underline-offset-4">
          Open it
        </Link>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await restoreDeletedBooks([id]);
            if (res.error && !res.count) return setError(res.error);
            setRestored(true);
            router.refresh();
          })
        }
      >
        <RotateCcw data-slot="icon" />
        Put back
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={sure ? "text-destructive hover:text-destructive" : undefined}
        disabled={pending}
        aria-label={sure ? `Delete “${title}” for good` : undefined}
        onBlur={() => setSure(false)}
        onClick={() => {
          if (!sure) return setSure(true);
          startTransition(async () => {
            const res = await forgetDeletedBooks([id]);
            if (res.error) return setError(res.error);
            router.refresh();
          });
        }}
      >
        {sure ? "Delete for good" : "Delete now"}
      </Button>
      {error && (
        <span className="basis-full text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

/** Empties the bin, after asking. */
export function EmptyBinButton({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const books = count === 1 ? "1 book" : `${count} books`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive">
          Empty
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {books} for good?</DialogTitle>
          <DialogDescription>
            {count === 1 ? "It goes" : "They go"} now instead of when the 30 days are up, with
            reading history, notes, quotes and loans. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await emptyRecentlyDeleted();
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Deleting…" : `Delete ${books}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
