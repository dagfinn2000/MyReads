"use client";

import { useState, useTransition } from "react";
import type { ProgressEntry } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { Trash2, X } from "lucide-react";
import { deleteProgressEntry } from "@/lib/actions/progress";
import { formatDate } from "@/lib/display";
import { Button } from "@/components/ui/button";

const DAY_MS = 86_400_000;

/** "34" for double digits, "3.5" below — pace never shows as "0". */
function paceLabel(pace: number): string {
  if (pace >= 10) return String(Math.round(pace));
  return String(Math.max(Math.round(pace * 10) / 10, 0.1));
}

/**
 * Sparkline of the current reading pass — page position over time — with a
 * pace line under it: pages/day plus a finish forecast while the book is
 * being read, or the retrospective pace once it's finished. Pure display;
 * rendered inside the reading-card form.
 */
export function ProgressChart({
  entries,
  pageCount,
  status,
}: {
  entries: Pick<ProgressEntry, "page" | "date">[];
  pageCount: number | null;
  status: ReadingStatus;
}) {
  if (entries.length < 2) return null;
  const first = entries[0];
  const last = entries[entries.length - 1];

  // Geometry: x spans first→last entry, y spans 0→page count (or the
  // highest logged page when the count is unknown).
  const W = 300;
  const H = 60;
  const PAD = 3;
  const maxPage = Math.max(pageCount ?? 0, ...entries.map((e) => e.page)) || 1;
  const spanX = Math.max(last.date.getTime() - first.date.getTime(), 1);
  const points = entries.map((e) => {
    const x = PAD + ((e.date.getTime() - first.date.getTime()) / spanX) * (W - 2 * PAD);
    const y = H - PAD - (e.page / maxPage) * (H - 2 * PAD);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastXY = points[points.length - 1].split(",");

  // Pace over the pass so far; a same-day pass is floored to one day.
  const spanDays = Math.max(spanX / DAY_MS, 1);
  const gained = last.page - first.page;
  const pace = gained > 0 ? gained / spanDays : null;

  let paceText: string | null = null;
  if (pace && status === ReadingStatus.READING) {
    paceText = `~${paceLabel(pace)} pages/day`;
    const remaining = (pageCount ?? 0) - last.page;
    if (remaining > 0) {
      const daysLeft = remaining / pace;
      // A forecast a year+ out says "pace", not "date".
      if (daysLeft <= 366) {
        const finish = new Date(last.date.getTime() + daysLeft * DAY_MS);
        paceText += ` · on pace to finish ${formatDate(finish)}`;
      }
    }
  } else if (pace && status === ReadingStatus.READ) {
    paceText = `~${paceLabel(pace)} pages/day over ${Math.max(Math.round(spanDays), 1)} days`;
  }

  return (
    <div className="grid max-w-sm gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Reading progress over time"
      >
        <polygon
          points={`${PAD},${H - PAD} ${points.join(" ")} ${lastXY[0]},${H - PAD}`}
          className="fill-primary/15"
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-primary"
        />
        <circle cx={lastXY[0]} cy={lastXY[1]} r={3} className="fill-primary" />
      </svg>
      {paceText && (
        <p className="text-xs text-muted-foreground tabular-nums">{paceText}</p>
      )}
    </div>
  );
}

/**
 * The raw reading log, collapsed by default: every logged position with a
 * delete button, newest first. Deleting an entry only affects the charts —
 * the book's current page stays whatever the reading card says.
 */
export function ProgressLog({ entries }: { entries: ProgressEntry[] }) {
  if (entries.length === 0) return null;
  const newestFirst = [...entries].reverse();

  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        Progress log ({entries.length}{" "}
        {entries.length === 1 ? "entry" : "entries"})
      </summary>
      <ul className="grid gap-1 pt-2">
        {newestFirst.map((e) => (
          <li key={e.id} className="flex min-h-7 items-center gap-3 text-sm">
            <span className="w-20 tabular-nums">
              {e.page === 0 ? "Started" : `Page ${e.page}`}
            </span>
            <span className="text-muted-foreground">{formatDate(e.date)}</span>
            <span className="ml-auto">
              <DeleteEntryButton entryId={e.id} />
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Trash icon that expands to an inline confirm, same as reads and quotes. */
function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete progress entry"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => deleteProgressEntry(entryId))}
      >
        {pending ? "Deleting…" : "Delete entry"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel delete"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        <X className="size-3.5" />
      </Button>
    </span>
  );
}
