"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { restoreDeletedBooks } from "@/lib/actions/recently-deleted";
import { JUST_DELETED_COOKIE } from "@/lib/just-deleted";
import { Button } from "@/components/ui/button";

/**
 * Says where a book deleted from its page went, on the library it lands
 * on, with Undo. Shown once: it clears the cookie that brought it, so a
 * reload doesn't show it again.
 */
export function JustDeletedNotice({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    document.cookie = `${JUST_DELETED_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  }, []);

  if (gone) return null;
  return (
    <aside
      aria-label="Book deleted"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2 text-sm"
    >
      <Trash2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-48 flex-1" role="status">
        {error ?? (
          <>
            “{title}” is in{" "}
            <Link href="/books/deleted" className="underline underline-offset-4">
              Recently deleted
            </Link>{" "}
            for 30 days.
          </>
        )}
      </span>
      <span className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreDeletedBooks([id]);
              if (res.error && !res.count) return setError(res.error);
              setGone(true);
              router.push(`/books/${id}`);
            })
          }
        >
          {pending ? "Putting it back…" : "Undo"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setGone(true)}>
          Close
        </Button>
      </span>
    </aside>
  );
}
