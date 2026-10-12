"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BookOwnership, type BookFormat } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { setOwnership } from "@/lib/actions/ownership";
import { removeScannedBook, scanAddBook, type ScanAnswer } from "@/lib/actions/shelf-scan";
import { checkVerdict, scanMatchLabel } from "@/lib/check-verdict";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** A barcode still in front of the camera is seen every few hundred ms;
 *  it only counts again once it has been out of view this long. */
const SAME_CODE_MS = 4000;

/** Catalogue lookups allowed a minute (lib/rate-limit.ts). */
const LOOKUPS_PER_MINUTE = 90;

/** The library, newest first: where Done goes, to see what was added. */
export const NEWEST_FIRST_HREF = "/books?sort=createdAt&dir=desc&group=none";

type RowState =
  | { kind: "waiting" }
  | { kind: "looking" }
  | { kind: "added"; bookId: string; title: string; authors: string[]; undoing?: boolean }
  | { kind: "removed"; title: string }
  | {
      kind: "have";
      match: "isbn" | "title";
      bookId: string;
      title: string;
      ownership: BookOwnership;
      format: BookFormat;
      /** "I bought it" pressed: saving, then done. */
      marking?: boolean;
      marked?: boolean;
    }
  | { kind: "same"; title: string | null }
  | { kind: "notFound" }
  | { kind: "failed" };

export interface ScanRow {
  id: number;
  isbn: string;
  /** Add it although the library has the same title (Add anyway). */
  force?: boolean;
  state: RowState;
}

export interface ShelfScanSnapshot {
  /** Newest first. */
  rows: ScanRow[];
  /** Books added and not undone. */
  added: number;
  /** Codes waiting or being looked up. */
  pending: number;
  /** While the lookup budget is spent: when scanning carries on (ms). */
  pausedUntil: number | null;
  /** Catalogue lookups this minute, as of the last answer. */
  budgetUsed: number | null;
  /** The latest result in words, for screen readers. */
  announcement: string;
}

function titleOf(state: RowState): string | null {
  return "title" in state ? state.title : null;
}

function describe(row: ScanRow): string {
  const { state } = row;
  switch (state.kind) {
    case "added":
      return `Added: ${state.title}`;
    case "removed":
      return `Removed: ${state.title}`;
    case "have":
      return `${haveLabel(state)}: ${state.title}`;
    case "same":
      return `Same barcode again${state.title ? `: ${state.title}` : ""}, ignored`;
    case "notFound":
      return `Not found: ${row.isbn}`;
    case "failed":
      return `Couldn't look up ${row.isbn}`;
    default:
      return "";
  }
}

/** What the library has, worded like the check page, or that it's now
 *  marked owned from here. */
function haveLabel(state: Extract<RowState, { kind: "have" }>): string {
  return state.marked ? "Marked as owned" : scanMatchLabel(state.match, state.ownership);
}

function fromAnswer(answer: Exclude<ScanAnswer, { kind: "paused" }>): RowState {
  switch (answer.kind) {
    case "added":
      return { kind: "added", bookId: answer.book.id, title: answer.book.title, authors: answer.book.authors };
    case "have":
      return {
        kind: "have",
        match: answer.match,
        bookId: answer.book.id,
        title: answer.book.title,
        ownership: answer.book.ownership,
        format: answer.book.format,
      };
    case "notFound":
      return { kind: "notFound" };
    case "error":
      return { kind: "failed" };
  }
}

/**
 * One shelf-scanning session: the list of scanned codes and the queue that
 * looks them up one at a time (server actions run one after another
 * anyway). It lives with the whole add page rather than inside the camera
 * dialog or the search box, so closing the dialog, switching to Manual
 * entry or picking a search result doesn't lose a code still in the queue:
 * those are still looked up and added, and the summary at the top of the
 * page counts them.
 */
class ShelfScanSession {
  private snapshot: ShelfScanSnapshot = {
    rows: [],
    added: 0,
    pending: 0,
    pausedUntil: null,
    budgetUsed: null,
    announcement: "",
  };
  private listeners = new Set<() => void>();
  private queue: number[] = [];
  private lastSeen = new Map<string, number>();
  private seen = new Set<string>();
  private nextId = 1;
  private working = false;
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<ShelfScanSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    next.added = next.rows.filter((r) => r.state.kind === "added").length;
    next.pending = this.queue.length;
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  private setRow(id: number, change: Partial<ScanRow>, announce = false) {
    let said = this.snapshot.announcement;
    const rows = this.snapshot.rows.map((r) => {
      if (r.id !== id) return r;
      const row = { ...r, ...change };
      if (announce) said = describe(row);
      return row;
    });
    this.set({ rows, announcement: said });
  }

  private row(id: number) {
    return this.snapshot.rows.find((r) => r.id === id);
  }

  private enqueue(id: number) {
    this.queue.push(id);
    this.set({});
    void this.work();
  }

  /** A barcode from the camera. True when it added a row to the list. */
  handleCode = (code: string): boolean => {
    const now = Date.now();
    const last = this.lastSeen.get(code);
    this.lastSeen.set(code, now);
    if (last !== undefined && now - last < SAME_CODE_MS) return false;

    const id = this.nextId++;
    if (this.seen.has(code)) {
      const earlier = this.snapshot.rows.find((r) => r.isbn === code && titleOf(r.state));
      const row: ScanRow = {
        id,
        isbn: code,
        state: { kind: "same", title: earlier ? titleOf(earlier.state) : null },
      };
      this.set({ rows: [row, ...this.snapshot.rows], announcement: describe(row) });
      return true;
    }
    this.seen.add(code);
    this.set({ rows: [{ id, isbn: code, state: { kind: "waiting" } }, ...this.snapshot.rows] });
    this.enqueue(id);
    return true;
  };

  undo = async (id: number) => {
    const row = this.row(id);
    if (row?.state.kind !== "added" || row.state.undoing) return;
    const added = row.state;
    this.setRow(id, { state: { ...added, undoing: true } });
    try {
      // "Book not found" means it is gone already, which is what was asked.
      await removeScannedBook(added.bookId);
      this.setRow(id, { state: { kind: "removed", title: added.title } }, true);
    } catch {
      this.setRow(id, { state: added });
    }
  };

  /** "I bought it" / "I have it again" on a wishlist or given-away match. */
  markOwned = async (id: number) => {
    const row = this.row(id);
    if (row?.state.kind !== "have" || row.state.marking || row.state.marked) return;
    const have = row.state;
    this.setRow(id, { state: { ...have, marking: true } });
    try {
      const res = await setOwnership(have.bookId, BookOwnership.OWNED);
      if (res.error) throw new Error(res.error);
      this.setRow(id, { state: { ...have, ownership: BookOwnership.OWNED, marked: true } }, true);
    } catch {
      this.setRow(id, { state: have });
      this.set({ announcement: `Couldn't mark ${have.title} as owned` });
    }
  };

  addAnyway = (id: number) => {
    if (this.row(id)?.state.kind !== "have") return;
    this.setRow(id, { force: true, state: { kind: "waiting" } });
    this.enqueue(id);
  };

  retry = (id: number) => {
    if (this.row(id)?.state.kind !== "failed") return;
    this.setRow(id, { state: { kind: "waiting" } });
    this.enqueue(id);
  };

  /** Runs the queue while the add page is open. */
  start = () => {
    this.active = true;
    void this.work();
  };

  stop = () => {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  };

  private async work() {
    if (this.working || !this.active) return;
    this.working = true;
    try {
      while (this.queue.length > 0 && this.active) {
        const until = this.snapshot.pausedUntil;
        if (until !== null && until > Date.now()) {
          if (this.timer) clearTimeout(this.timer);
          this.timer = setTimeout(() => void this.work(), until - Date.now());
          return;
        }
        if (until !== null) this.set({ pausedUntil: null });

        const id = this.queue[0];
        const row = this.row(id);
        if (!row) {
          this.queue.shift();
          continue;
        }
        this.setRow(id, { state: { kind: "looking" } });
        let answer: ScanAnswer;
        try {
          answer = await scanAddBook(row.isbn, row.force ? { force: true } : undefined);
        } catch {
          this.queue.shift();
          this.setRow(id, { state: { kind: "failed" } }, true);
          continue;
        }
        if (answer.kind === "paused") {
          // Back in line at the front; codes scanned meanwhile wait behind.
          this.setRow(id, { state: { kind: "waiting" } });
          this.set({
            pausedUntil: Date.now() + answer.retryInMs + 500,
            budgetUsed: answer.budget.used,
            announcement: "Paused: the catalogues allow 90 lookups a minute.",
          });
          continue;
        }
        this.queue.shift();
        this.set({ budgetUsed: answer.budget.used });
        this.setRow(id, { state: fromAnswer(answer) }, true);
      }
    } finally {
      this.working = false;
    }
  }
}

export type ShelfScan = Pick<
  ShelfScanSession,
  "handleCode" | "undo" | "markOwned" | "addAnyway" | "retry"
> & {
  snapshot: ShelfScanSnapshot;
};

/** A shelf-scanning session for as long as the calling component is
 *  mounted. */
export function useShelfScan(): ShelfScan {
  const [session] = useState(() => new ShelfScanSession());
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    session.start();
    return session.stop;
  }, [session]);
  return {
    snapshot,
    handleCode: session.handleCode,
    undo: session.undo,
    markOwned: session.markOwned,
    addAnyway: session.addAnyway,
    retry: session.retry,
  };
}

/** "Carrying on in 34 s", ticking down. Outside the live region, so it
 *  isn't read out every second. */
function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>Carrying on in {Math.max(1, Math.ceil((until - now) / 1000))} s.</>;
}

const KIND_LABELS: Record<RowState["kind"], string> = {
  waiting: "Waiting",
  looking: "Looking up",
  added: "Added",
  removed: "Removed",
  have: "Already in your library",
  same: "Same barcode again",
  notFound: "Not found",
  failed: "Couldn't look up",
};

function RowLine({
  row,
  scan,
  busy,
  onAddByHand,
}: {
  row: ScanRow;
  scan: ShelfScan;
  busy: boolean;
  onAddByHand: (isbn: string) => void;
}) {
  const { state } = row;
  const label = state.kind === "have" ? haveLabel(state) : KIND_LABELS[state.kind];
  // A wishlist or given-away copy of this very edition is most likely the
  // book in hand, so it can be marked owned from here (as on the check page).
  const markOwned =
    state.kind === "have" && !state.marked ? checkVerdict(state.match, state).markOwned : null;
  const text =
    state.kind === "added"
      ? [state.title, ...state.authors.slice(0, 1)].join(" · ")
      : state.kind === "same"
        ? `${state.title ?? row.isbn}, ignored`
        : (titleOf(state) ?? row.isbn);

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2.5 py-1.5">
      <span
        className={cn(
          "flex items-center gap-1 text-xs font-medium",
          (state.kind === "added" || (state.kind === "have" && state.marked)) &&
            "text-emerald-700 dark:text-emerald-400",
          ((state.kind === "have" && !state.marked) || state.kind === "notFound") &&
            "text-amber-700 dark:text-amber-400",
          state.kind === "failed" && "text-destructive",
          (state.kind === "waiting" ||
            state.kind === "looking" ||
            state.kind === "removed" ||
            state.kind === "same") &&
            "text-muted-foreground",
        )}
      >
        {state.kind === "looking" && <Loader2 className="size-3 animate-spin" aria-hidden />}
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-sm">{text}</span>
      {state.kind === "added" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={state.undoing}
          onClick={() => void scan.undo(row.id)}
        >
          Undo
        </Button>
      )}
      {state.kind === "have" && markOwned && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={state.marking}
          onClick={() => void scan.markOwned(row.id)}
        >
          {state.marking ? "Saving…" : markOwned}
        </Button>
      )}
      {state.kind === "have" && state.match === "title" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => scan.addAnyway(row.id)}>
          Add anyway
        </Button>
      )}
      {state.kind === "notFound" && (
        // The session outlives the add form, but saving it can open the
        // book, leaving the page, so not while codes are still being
        // looked up.
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onAddByHand(row.isbn)}
        >
          Add by hand
        </Button>
      )}
      {state.kind === "failed" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => scan.retry(row.id)}>
          Try again
        </Button>
      )}
    </li>
  );
}

/**
 * The list under the camera while "Keep scanning" is on: one row per
 * barcode, newest first, each with what can be done about it.
 */
export function ShelfScanPanel({
  scan,
  onAddByHand,
  onDone,
}: {
  scan: ShelfScan;
  onAddByHand: (isbn: string) => void;
  onDone: () => void;
}) {
  const s = scan.snapshot;
  return (
    <div className="grid gap-3">
      {s.pausedUntil !== null && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          {/* Read out once, through the announcement below. */}
          <p>Paused: the catalogues allow 90 lookups a minute.</p>
          <p className="text-muted-foreground">
            <Countdown until={s.pausedUntil} />
          </p>
        </div>
      )}
      {/* Only the latest result is read out; the list itself isn't live, so
          it isn't read again on every change. */}
      <p className="sr-only" aria-live="polite">
        {s.announcement}
      </p>
      {s.rows.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Scanned barcodes">
          {s.rows.map((row) => (
            <RowLine key={row.id} row={row} scan={scan} busy={s.pending > 0} onAddByHand={onAddByHand} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Not while codes are still in line: leaving the page would drop
            them. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={s.added === 0 || s.pending > 0}
          onClick={onDone}
        >
          Done
        </Button>
        <span className="text-xs text-muted-foreground">
          {s.added} added. Done opens the library, newest first.
        </span>
      </div>
      {s.budgetUsed !== null && (
        <p className="text-xs text-muted-foreground">
          Catalogue lookups this minute: {s.budgetUsed} of {LOOKUPS_PER_MINUTE}
        </p>
      )}
    </div>
  );
}
