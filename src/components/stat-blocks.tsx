import { Card, CardContent } from "@/components/ui/card";

/** Simple horizontal CSS bar — no chart library needed at this scale. */
export function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-5 rounded bg-muted">
        <div
          className="h-full rounded bg-primary/80"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

export function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{children}</div>
      </CardContent>
    </Card>
  );
}
