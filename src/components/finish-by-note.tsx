import { CalendarClock } from "lucide-react";
import type { FinishByLine, FinishByTone } from "@/lib/finish-by";
import { cn } from "@/lib/utils";

const TONES: Record<FinishByTone, string> = {
  calm: "bg-muted text-muted-foreground",
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  late: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

/**
 * A book's finish-by day and what it takes (lib/finish-by.ts), as a soft
 * pill: muted while there's time, green when the reader's pace gets there,
 * amber when it doesn't (or it's today), red once the day has passed.
 */
export function FinishByNote({ line, className }: { line: FinishByLine; className?: string }) {
  return (
    <p
      className={cn(
        "finish-by-note inline-flex max-w-full items-start gap-1.5 rounded-2xl px-2.5 py-1 text-xs",
        TONES[line.tone],
        className,
      )}
    >
      <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium">{line.label}</span>
        <span className="opacity-90"> · {line.detail}</span>
      </span>
    </p>
  );
}
