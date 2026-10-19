import { shiftDayKey } from "@/lib/dates";
import type { Preferences } from "@/lib/preferences";

/**
 * The daily reading goal (Preferences > Reading): a number of pages, or
 * minutes of reading, every day. Pages are counted the way the reading
 * calendar counts them (lib/progress.ts) and minutes come from the reading
 * timer (lib/reading-time.ts), both by day in the reader's zone. Pure, so
 * Now reading, Stats and the tests share it.
 */

export interface DailyGoalTarget {
  unit: "pages" | "minutes";
  amount: number;
}

/** The goal Preferences set, or null when it's off. */
export function dailyGoalTarget(
  prefs: Pick<Preferences, "dailyGoal" | "dailyGoalPages" | "dailyGoalMinutes">,
): DailyGoalTarget | null {
  if (prefs.dailyGoal === "pages") return { unit: "pages", amount: prefs.dailyGoalPages };
  if (prefs.dailyGoal === "minutes") return { unit: "minutes", amount: prefs.dailyGoalMinutes };
  return null;
}

/** The days the goal was met, from that unit's totals by day. */
export function goalMetDays(byDay: ReadonlyMap<string, number>, amount: number): Set<string> {
  const met = new Set<string>();
  for (const [day, value] of byDay) if (value >= amount) met.add(day);
  return met;
}

export interface DailyGoalStatus {
  /** Pages or minutes so far today. */
  today: number;
  met: boolean;
  /** Still to go today; 0 once met. */
  left: number;
  /** Days in a row the goal was met, up to today, or up to yesterday while
   *  today is still going. */
  streak: number;
  /** Days met in the week before today. */
  lastWeek: number;
}

export function dailyGoalStatus(
  byDay: ReadonlyMap<string, number>,
  target: DailyGoalTarget,
  todayKey: string,
): DailyGoalStatus {
  const met = goalMetDays(byDay, target.amount);
  const today = byDay.get(todayKey) ?? 0;
  let cursor = met.has(todayKey) ? todayKey : shiftDayKey(todayKey, -1);
  let streak = 0;
  while (met.has(cursor)) {
    streak++;
    cursor = shiftDayKey(cursor, -1);
  }
  let lastWeek = 0;
  for (let back = 1; back <= 7; back++) if (met.has(shiftDayKey(todayKey, -back))) lastWeek++;
  return {
    today,
    met: today >= target.amount,
    left: Math.max(target.amount - today, 0),
    streak,
    lastWeek,
  };
}

/** "pages" or "page", "minutes" or "minute". */
export function goalUnitWord(unit: DailyGoalTarget["unit"], n: number): string {
  if (unit === "pages") return n === 1 ? "page" : "pages";
  return n === 1 ? "minute" : "minutes";
}

/** The lines beside the ring: what today stands at, and how the goal has
 *  gone lately. */
export function dailyGoalLines(
  status: DailyGoalStatus,
  target: DailyGoalTarget,
): { headline: string; detail: string | null } {
  const headline = status.met
    ? "Daily goal met"
    : `${status.left} ${goalUnitWord(target.unit, status.left)} to go today`;
  const detail =
    status.streak >= 2
      ? `${status.streak} days in a row`
      : status.lastWeek > 0
        ? `met on ${status.lastWeek} of the last 7 days`
        : null;
  return { headline, detail };
}
