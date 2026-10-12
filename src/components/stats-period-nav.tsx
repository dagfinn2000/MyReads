import Link from "next/link";
import { STATS_PERIODS, type StatsPeriod } from "@/lib/preferences";
import { PERIOD_LABELS, statsHref } from "@/lib/stats-period";
import { cn } from "@/lib/utils";

/**
 * The period buttons under the Stats heading. Plain links, so the choice is
 * in the address and can be bookmarked; each one names its period even for
 * All time, so it wins over the period Preferences opens on. The goal year
 * being looked at comes along.
 */
export function StatsPeriodNav({
  period,
  goalYear,
}: {
  period: StatsPeriod;
  goalYear: number | null;
}) {
  return (
    <nav aria-label="Stats period" className="flex flex-wrap gap-1.5">
      {STATS_PERIODS.map((p) => (
        <Link
          key={p}
          href={statsHref({ period: p, goalYear })}
          scroll={false}
          aria-current={p === period ? "page" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            p === period
              ? "border-primary bg-primary/10 font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {PERIOD_LABELS[p]}
        </Link>
      ))}
    </nav>
  );
}
