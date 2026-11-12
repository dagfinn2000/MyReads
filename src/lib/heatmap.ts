import type { HeatmapScale } from "@/lib/preferences";

/**
 * Colour steps for the reading calendar: a day with at least t[0] pages
 * (or minutes) gets the second shade, t[1] the third, t[2] the darkest. Any
 * reading at all gets the first shade.
 */
export type Thresholds = [number, number, number];

/** What the calendar is shaded by: pages logged, or time read with the
 *  timer. */
export type HeatmapUnit = "pages" | "minutes";

const FIXED: Record<HeatmapUnit, Record<Exclude<HeatmapScale, "auto">, Thresholds>> = {
  pages: {
    standard: [20, 50, 100],
    gentle: [10, 25, 50],
    heavy: [50, 100, 200],
  },
  // A quarter of an hour, half an hour, an hour.
  minutes: {
    standard: [15, 30, 60],
    gentle: [10, 20, 30],
    heavy: [30, 60, 120],
  },
};

/**
 * The steps for a scale. "auto" centres them on the reader's own typical
 * day — the median of the days they read at all — so a calendar that is
 * almost all one shade on a fixed scale shows its variation again: half the
 * typical day, the typical day, twice the typical day.
 */
export function heatmapThresholds(
  scale: HeatmapScale,
  dayTotals: Iterable<number>,
  unit: HeatmapUnit = "pages",
): Thresholds {
  const fixed = FIXED[unit];
  if (scale !== "auto") return fixed[scale] ?? fixed.standard;
  const days = [...dayTotals].filter((p) => p > 0).sort((a, b) => a - b);
  if (days.length === 0) return fixed.standard;
  const median = days[Math.floor(days.length / 2)];
  const half = Math.max(1, Math.round(median / 2));
  const typical = Math.max(half + 1, Math.round(median));
  return [half, typical, Math.max(typical + 1, Math.round(median * 2))];
}

/** 0 = no reading that day, 1–4 = the shades. */
export function heatmapLevel(pages: number, t: Thresholds): number {
  if (pages <= 0) return 0;
  if (pages < t[0]) return 1;
  if (pages < t[1]) return 2;
  if (pages < t[2]) return 3;
  return 4;
}

/** Tooltip for each legend shade, lightest first. */
export function heatmapLegend(t: Thresholds, unit: HeatmapUnit = "pages"): string[] {
  const u = unit === "pages" ? "pages" : "min";
  return [
    "No reading",
    `Under ${t[0]} ${u}`,
    `${t[0]}–${t[1] - 1} ${u}`,
    `${t[1]}–${t[2] - 1} ${u}`,
    `${t[2]}+ ${u}`,
  ];
}
