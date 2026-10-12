import { shiftDayKey } from "@/lib/dates";
import { STATS_PERIODS, type StatsPeriod } from "@/lib/preferences";

/**
 * The period buttons on the Stats page. A period is a window of day keys in
 * the reader's zone, both ends included; all time has no ends. The choice
 * lives in the address (/stats?period=30d) so it can be bookmarked, and
 * Preferences says which one Stats opens on.
 */

export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  all: "All time",
  year: "This year",
  "12m": "Last 12 months",
  "30d": "Last 30 days",
};

/** The same, mid-sentence: "Pages read · last 30 days". */
export const PERIOD_WORDS: Record<StatsPeriod, string> = {
  all: "all time",
  year: "this year",
  "12m": "last 12 months",
  "30d": "last 30 days",
};

/** Day keys from `from` to `to`, both included. Null means no limit. */
export interface DayWindow {
  from: string | null;
  to: string | null;
}

export const ALL_TIME: DayWindow = { from: null, to: null };

/** The period in the address, or the reader's default when it's missing or
 *  not one we know. A repeated parameter goes by its first value. */
export function parsePeriod(
  raw: string | string[] | undefined,
  fallback: StatsPeriod,
): StatsPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (STATS_PERIODS as readonly string[]).includes(value ?? "")
    ? (value as StatsPeriod)
    : fallback;
}

/** A whole calendar year, as the goal and the year in review count it. */
export function yearWindow(year: number): DayWindow {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * The days a period covers, ending today. This year is the whole calendar
 * year, so a finish date typed later in the year counts the same here as in
 * the goal and the year in review. Last 12 months is the reading calendar's
 * 365 days.
 */
export function periodWindow(period: StatsPeriod, todayKey: string): DayWindow {
  switch (period) {
    case "year":
      return yearWindow(Number(todayKey.slice(0, 4)));
    case "12m":
      return { from: shiftDayKey(todayKey, -364), to: todayKey };
    case "30d":
      return { from: shiftDayKey(todayKey, -29), to: todayKey };
    default:
      return ALL_TIME;
  }
}

/**
 * The goal year in the address, when the goal card can show it: next year
 * (to set it ahead of time) or a past year that has a goal (its Edit link).
 * Anything else, the current year included, gives null: show this year.
 */
export function parseGoalYear(
  raw: string | string[] | undefined,
  currentYear: number,
  pastGoalYears: ReadonlySet<number>,
): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  if (year === currentYear + 1) return year;
  if (year < currentYear && pastGoalYears.has(year)) return year;
  return null;
}

/** "/stats?period=30d&goalYear=2027#goal", with only the parts given. */
export function statsHref({
  period,
  goalYear,
  hash,
}: {
  period?: StatsPeriod;
  goalYear?: number | null;
  hash?: string;
}): string {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  if (goalYear != null) params.set("goalYear", String(goalYear));
  const query = params.toString();
  return `/stats${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
