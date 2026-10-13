import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Simple horizontal CSS bar — no chart library needed at this scale. */
export function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-2.5 rounded-full bg-muted">
        <div
          className="bar-grow h-full rounded-full bg-linear-to-r from-primary/70 to-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

export function StatCard({
  label,
  icon: Icon,
  note,
  children,
}: {
  label: string;
  /** A small picture of what is counted, in a tinted circle by the label. */
  icon?: LucideIcon;
  /** A small line under the number: which rule is on, what it includes. */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {Icon && (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="mt-1 font-heading text-3xl font-semibold tracking-tight tabular-nums">
          {children}
        </div>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
