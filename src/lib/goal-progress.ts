import type { GoalUnit } from "@/lib/enums";
import {
  goalPace,
  goalProgress,
  monthClock,
  monthSpan,
  readingDaysIn,
  type GoalPace,
  type YearClock,
} from "@/lib/goals";
import { countWindow, type CountBook, type CountRules, type Pass } from "@/lib/stats-count";

/**
 * Progress toward a goal over any run of days, whatever it counts: finished
 * books or their pages (by the "What counts" rules, like the stats cards),
 * or days with reading logged. The Stats page and the year in review both
 * go through here, so a goal reads the same on each.
 */

export interface GoalRuleLike {
  target: number;
  unit: GoalUnit;
  countRereads: boolean;
}

export interface GoalContext<B extends CountBook = CountBook> {
  passes: Pass<B>[];
  rules: CountRules;
  /** Days ("2026-05-12") with any reading logged: pages, or timer minutes. */
  readingDays: ReadonlySet<string>;
}

/** Days with pages logged or minutes timed. */
export function readingDaySet(...byDay: ReadonlyMap<string, number>[]): Set<string> {
  const days = new Set<string>();
  for (const map of byDay) for (const [day, n] of map) if (n > 0) days.add(day);
  return days;
}

export function progressIn<B extends CountBook>(
  goal: GoalRuleLike,
  from: string,
  to: string,
  ctx: GoalContext<B>,
): number {
  if (goal.unit === "DAYS") return readingDaysIn(ctx.readingDays, from, to);
  return goalProgress(countWindow(ctx.passes, { from, to }, ctx.rules), goal);
}

/** One month of a monthly goal. */
export interface MonthProgress {
  month: number;
  done: number;
  target: number;
  met: boolean;
  clock: YearClock;
  pace: GoalPace;
}

/** Every month of `year` against a monthly goal. */
export function monthlyProgress<B extends CountBook>(
  goal: GoalRuleLike,
  year: number,
  todayKey: string,
  ctx: GoalContext<B>,
): MonthProgress[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const { from, to } = monthSpan(year, month);
    const clock = monthClock(todayKey, year, month);
    const done = clock.when === "future" ? 0 : progressIn(goal, from, to, ctx);
    return {
      month,
      done,
      target: goal.target,
      met: clock.when !== "future" && done >= goal.target,
      clock,
      pace: goalPace(done, goal.target, goal.unit, clock),
    };
  });
}

/** Months met out of the months that have begun. */
export function monthsMet(months: MonthProgress[]): { met: number; of: number } {
  const begun = months.filter((m) => m.clock.when !== "future");
  return { met: begun.filter((m) => m.met).length, of: begun.length };
}
