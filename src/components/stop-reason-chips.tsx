"use client";

import { useState, useTransition } from "react";
import { setStopReason } from "@/lib/actions/progress";
import { STOP_REASONS, STOP_REASON_LABELS, type StopReason } from "@/lib/stop-reasons";
import { cn } from "@/lib/utils";

/**
 * "Why?" after Stopped on Now reading: one tap names why the book was put
 * down (lib/stop-reasons.ts), and a second tap on the same reason takes it
 * back. Saying nothing is fine too; Stats counts those as not given.
 */
export function StopReasonChips({ bookId }: { bookId: string }) {
  const [picked, setPicked] = useState<StopReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pick = (reason: StopReason) => {
    const next = picked === reason ? null : reason;
    const before = picked;
    setPicked(next);
    setError(null);
    startTransition(async () => {
      const result = await setStopReason(bookId, next);
      if (result.error) {
        setPicked(before);
        setError(result.error);
      }
    });
  };

  return (
    <div className="grid w-full gap-1.5">
      <p id={`why-${bookId}`} className="text-xs">
        Why did you stop? <span className="text-muted-foreground/80">(if you like)</span>
      </p>
      <div role="group" aria-labelledby={`why-${bookId}`} className="flex flex-wrap gap-1.5">
        {STOP_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={picked === r}
            onClick={() => pick(r)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              picked === r
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground hover:bg-accent",
            )}
          >
            {STOP_REASON_LABELS[r]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
