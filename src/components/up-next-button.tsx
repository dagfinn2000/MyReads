"use client";

import { useState, useTransition } from "react";
import { ListOrdered, ListPlus, X } from "lucide-react";
import { addToUpNext, removeFromUpNext } from "@/lib/actions/up-next";
import { Button } from "@/components/ui/button";

/**
 * On a Want to Read book's page, beside its status: "Add to Up next", or
 * where it stands on the reader's own list with a way to take it off.
 */
export function UpNextButton({ bookId, place }: { bookId: string; place: number | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (place === null) {
    return (
      <>
        <Button
          variant="outline"
          size="xs"
          className="rounded-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await addToUpNext(bookId);
              setError(res.error ?? null);
            })
          }
        >
          <ListPlus />
          Add to Up next
        </Button>
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
      </>
    );
  }

  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/10 pr-0.5 pl-2 text-xs font-medium text-primary">
      <ListOrdered className="size-3" aria-hidden="true" />
      Up next #{place}
      <button
        type="button"
        className="grid size-5 place-items-center rounded-full outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        aria-label="Take it off Up next"
        title="Take it off Up next"
        disabled={pending}
        onClick={() => startTransition(() => removeFromUpNext(bookId))}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
