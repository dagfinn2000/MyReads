"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { ReadingStatus } from "@/lib/enums";
import { bulkUpdateBooks } from "@/lib/actions/bulk";
import { moveFromReading } from "@/lib/actions/progress";
import { bringBackTidyItems, fillFromCatalogue, finishFilling, leaveTidyItem } from "@/lib/actions/tidy";
import { Button } from "@/components/ui/button";

/** "Leave it": this stops showing on Tidy up. */
export function LeaveButton({ itemKey, label = "Leave it" }: { itemKey: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void (await leaveTidyItem(itemKey)))}
    >
      {label}
    </Button>
  );
}

/** Everything left alone shows again. */
export function BringBackButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => bringBackTidyItems())}
      className="underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
    >
      Show the {count} you left alone
    </button>
  );
}

/**
 * A book on Currently Reading that hasn't moved in a while: put it down,
 * or back on the pile. Both go through the same actions as Now reading and
 * bulk edit, so the reading log and stats stay right.
 */
export function StaleActions({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (go: () => Promise<{ error?: string } | object>) =>
    startTransition(async () => {
      const result = await go();
      if ("error" in result && result.error) return setError(result.error);
      router.refresh();
    });
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => moveFromReading(bookId, "DNF"))}>
        Stopped
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => bulkUpdateBooks({ bookIds: [bookId], status: ReadingStatus.WANT_TO_READ }))}
      >
        Back to Want to Read
      </Button>
      {error && <span className="w-full text-xs text-destructive">{error}</span>}
    </span>
  );
}

/**
 * "Fill from the catalogues": asks about each book in turn (lib/actions/
 * tidy.ts), filling in covers and page counts where the catalogues know
 * them. When the lookup budget runs out it waits and carries on; Stop
 * ends the run. The page refreshes when it's done.
 */
export function FillFromCatalogue({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "running"; done: number; filled: number; waitUntil: number | null }
    | { phase: "done"; filled: number; failed: string | null }
  >({ phase: "idle" });
  const stopped = useRef(false);

  async function run() {
    stopped.current = false;
    let done = 0;
    let filled = 0;
    let failed: string | null = null;
    setState({ phase: "running", done, filled, waitUntil: null });
    for (let i = 0; i < ids.length && !stopped.current; ) {
      const result = await fillFromCatalogue(ids[i]);
      if (result.kind === "paused") {
        const waitUntil = Date.now() + result.retryInMs;
        setState({ phase: "running", done, filled, waitUntil });
        await new Promise((r) => setTimeout(r, result.retryInMs + 250));
        continue; // the same book again
      }
      if (result.kind === "error") {
        failed = result.message;
        // The catalogues being out of reach won't change for the next book.
        if (result.message.startsWith("Couldn't reach")) break;
      }
      if (result.kind === "filled") filled++;
      done++;
      i++;
      setState({ phase: "running", done, filled, waitUntil: null });
    }
    await finishFilling();
    setState({ phase: "done", filled, failed });
    router.refresh();
  }

  if (state.phase === "running") {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>
          {state.waitUntil
            ? `Waiting a moment for the catalogues… ${state.done} of ${ids.length} so far`
            : `Looking up ${Math.min(state.done + 1, ids.length)} of ${ids.length}`}
          {state.filled > 0 && ` · ${state.filled} filled`}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => (stopped.current = true)}>
          Stop
        </Button>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <Button type="button" size="sm" onClick={run}>
        <Wand2 data-slot="icon" />
        Fill from the catalogues
      </Button>
      <span className="text-muted-foreground" role="status">
        {state.phase === "done"
          ? `${state.filled === 0 ? "Nothing new found" : `Filled in ${state.filled} ${state.filled === 1 ? "book" : "books"}`}${state.failed ? `. ${state.failed}` : "."}`
          : `${ids.length} ${ids.length === 1 ? "has" : "have"} an ISBN to look up by. Only what's missing is filled in.`}
      </span>
    </div>
  );
}
