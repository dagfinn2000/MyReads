import { dayKey, keyToUtcDate, shiftDayKey } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/display";
import { heatmapLegend, heatmapLevel, heatmapThresholds } from "@/lib/heatmap";
import type { Preferences } from "@/lib/preferences";
import { readingStreaks } from "@/lib/progress";

/** Cell tint per intensity level (0 = no reading that day). */
const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
];

function shortMonth(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
}

/** Day-of-week labels down the side, every other row. */
const DAY_LABELS = {
  monday: ["Mon", "", "Wed", "", "Fri", "", ""],
  sunday: ["", "Mon", "", "Wed", "", "Fri", ""],
};

/**
 * GitHub-style calendar of the last 12 months: one cell per day, tinted by
 * pages read that day (see dailyPageTotals for how entries become pages).
 * Server component — plain divs with title tooltips, no interactivity.
 *
 * Days are counted in the reader's time zone, weeks start on their chosen
 * day, and the shades follow their chosen scale (all from Preferences). The
 * calendar itself is laid out on midnight-UTC dates built from day keys, so
 * the server's own zone can't shift a cell.
 */
export function ReadingHeatmap({
  totals,
  prefs,
}: {
  totals: Map<string, number>;
  prefs: Pick<
    Preferences,
    "weekStart" | "timeZone" | "heatmapScale" | "dateFormat" | "numberFormat"
  >;
}) {
  const now = new Date();

  if (totals.size === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Update a book&apos;s current page as you read — every day you log
        progress lights up here.
      </p>
    );
  }

  // Window: the first day of the week on/before (today − 364 days) through
  // today.
  const todayKey = dayKey(now, prefs.timeZone);
  const firstWeekday = prefs.weekStart === "sunday" ? 0 : 1;
  let startKey = shiftDayKey(todayKey, -364);
  while (keyToUtcDate(startKey).getUTCDay() !== firstWeekday) {
    startKey = shiftDayKey(startKey, -1);
  }

  const weeks: { date: Date; key: string }[][] = [];
  let cursor = startKey;
  while (cursor <= todayKey) {
    const week: { date: Date; key: string }[] = [];
    for (let i = 0; i < 7 && cursor <= todayKey; i++) {
      week.push({ date: keyToUtcDate(cursor), key: cursor });
      cursor = shiftDayKey(cursor, 1);
    }
    weeks.push(week);
  }

  // A month label above the first column of each new month; the very first
  // column is only labelled when its month lasts a few columns, so the
  // window edge doesn't produce two overlapping labels.
  const labels: (string | null)[] = weeks.map((week, i) =>
    i > 0 && week[0].date.getUTCMonth() !== weeks[i - 1][0].date.getUTCMonth()
      ? shortMonth(week[0].date)
      : null,
  );
  if (!labels.slice(1, 4).some(Boolean)) labels[0] = shortMonth(weeks[0][0].date);

  // Summary line: days and pages inside the window, streaks over the full log.
  const windowDays = weeks.flat();
  const windowTotals = windowDays.map((d) => totals.get(d.key) ?? 0);
  const daysRead = windowTotals.filter((p) => p > 0).length;
  const pagesInWindow = windowTotals.reduce((sum, p) => sum + p, 0);
  const { current, longest } = readingStreaks(
    new Set(totals.keys()),
    now,
    prefs.timeZone,
  );

  const thresholds = heatmapThresholds(prefs.heatmapScale, windowTotals);
  const legend = heatmapLegend(thresholds);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {daysRead}
        </span>{" "}
        reading {daysRead === 1 ? "day" : "days"} (
        {formatNumber(pagesInWindow, prefs)} pages) in the last year
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

      {/* Right to left so a narrow screen opens on the latest weeks. */}
      <div dir="rtl" className="overflow-x-auto pb-1">
        <div dir="ltr" className="flex w-max min-w-full gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-[17px] text-[10px] leading-3 text-muted-foreground">
            {DAY_LABELS[prefs.weekStart].map((d, i) => (
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
                    className={`size-3 rounded-[3px] ${LEVEL_CLASS[heatmapLevel(pages, thresholds)]}`}
                    title={
                      pages > 0
                        ? `${pages} pages · ${formatDate(day.date, prefs)}`
                        : formatDate(day.date, prefs)
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
        {LEVEL_CLASS.map((cls, i) => (
          <span key={cls} className={`size-3 rounded-[3px] ${cls}`} title={legend[i]} />
        ))}
        <span className="ml-1">More</span>
      </div>
    </div>
  );
}
