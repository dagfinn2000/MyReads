import { formatDate } from "@/lib/display";
import { dayKey, readingStreaks } from "@/lib/progress";

/** Cell tint per intensity level (0 = no reading that day). */
const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
];

/** Fixed pages/day thresholds — comparable across the whole year. */
function level(pages: number): number {
  if (pages <= 0) return 0;
  if (pages < 20) return 1;
  if (pages < 50) return 2;
  if (pages < 100) return 3;
  return 4;
}

function shortMonth(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short" });
}

/**
 * GitHub-style calendar of the last 12 months: one cell per day, tinted by
 * pages read that day (see dailyPageTotals for how entries become pages).
 * Server component — plain divs with title tooltips, no interactivity.
 */
export function ReadingHeatmap({ totals }: { totals: Map<string, number> }) {
  const today = new Date();

  if (totals.size === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Update a book&apos;s current page as you read — every day you log
        progress lights up here.
      </p>
    );
  }

  // Window: the Monday on/before (today − 364 days) through today.
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 364);
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

  const weeks: { date: Date; key: string }[][] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const week: { date: Date; key: string }[] = [];
    for (let i = 0; i < 7 && cursor <= today; i++) {
      week.push({ date: new Date(cursor), key: dayKey(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  // A month label above the first column of each new month; the very first
  // column is only labelled when its month lasts a few columns, so the
  // window edge doesn't produce two overlapping labels.
  const labels: (string | null)[] = weeks.map((week, i) =>
    i > 0 && week[0].date.getMonth() !== weeks[i - 1][0].date.getMonth()
      ? shortMonth(week[0].date)
      : null,
  );
  if (!labels.slice(1, 4).some(Boolean)) labels[0] = shortMonth(weeks[0][0].date);

  // Summary line: days and pages inside the window, streaks over the full log.
  const windowDays = weeks.flat();
  const daysRead = windowDays.filter((d) => (totals.get(d.key) ?? 0) > 0).length;
  const pagesInWindow = windowDays.reduce(
    (sum, d) => sum + (totals.get(d.key) ?? 0),
    0,
  );
  const { current, longest } = readingStreaks(new Set(totals.keys()), today);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {daysRead}
        </span>{" "}
        reading {daysRead === 1 ? "day" : "days"} (
        {pagesInWindow.toLocaleString("en")} pages) in the last year
        {current > 1 && (
          <>
            {" "}
            · current streak{" "}
            <span className="font-medium text-foreground tabular-nums">
              {current} days
            </span>
          </>
        )}
        {longest > 1 && ` · longest ${longest}`}
      </p>

      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-[17px] text-[10px] leading-3 text-muted-foreground">
            {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
              <span key={i} className="h-3">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              <div className="relative h-[14px] text-[10px] text-muted-foreground">
                {labels[i] && (
                  <span className="absolute left-0 whitespace-nowrap">
                    {labels[i]}
                  </span>
                )}
              </div>
              {week.map((day) => {
                const pages = totals.get(day.key) ?? 0;
                return (
                  <div
                    key={day.key}
                    className={`size-3 rounded-[3px] ${LEVEL_CLASS[level(pages)]}`}
                    title={
                      pages > 0
                        ? `${pages} pages · ${formatDate(day.date)}`
                        : formatDate(day.date)
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span className="mr-1">Less</span>
        {LEVEL_CLASS.map((cls) => (
          <span key={cls} className={`size-3 rounded-[3px] ${cls}`} />
        ))}
        <span className="ml-1">More</span>
      </div>
    </div>
  );
}
