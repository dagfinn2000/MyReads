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
import {
  countWindow,
  type BookDayPages,
  type CountBook,
  type CountRules,
  type Pass,
} from "@/lib/stats-count";
import type { DayMinutes } from "@/lib/stats-query";

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

/**
 * The days a reading-days goal counts: pages logged or minutes timed, with
 * audiobooks left out when "What counts" leaves them out of the stats, as
 * a books or pages goal leaves them out.
 */
export function goalReadingDays(
  logDays: readonly BookDayPages[],
  dayMinutes: readonly DayMinutes[],
  audiobookIds: ReadonlySet<string>,
  rules: Pick<CountRules, "statsAudiobooks">,
): Set<string> {
  const out = rules.statsAudiobooks === "out";
  const days = new Set<string>();
  for (const d of logDays) if (d.pages > 0 && !(out && audiobookIds.has(d.bookId))) days.add(d.day);
  for (const m of dayMinutes) if (m.minutes > 0 && !(out && m.audiobook)) days.add(m.day);
  return days;
}

/** Whether today counts toward a reading-days goal already (see goalPace). */
export function todayRead(goal: { unit: GoalUnit }, todayKey: string, ctx: GoalContext): boolean {
  return goal.unit === "DAYS" && ctx.readingDays.has(todayKey);
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
    // "31 days a month" means every day: February is met at 28.
    const target = goal.unit === "DAYS" ? Math.min(goal.target, clock.total) : goal.target;
    return {
      month,
      done,
      target,
      met: clock.when !== "future" && done >= target,
      clock,
      pace: goalPace(
        done,
        target,
        goal.unit,
        clock,
        clock.when === "current" && todayRead(goal, todayKey, ctx),
      ),
    };
  });
}

/** Months met out of the months that have begun. */
export function monthsMet(months: MonthProgress[]): { met: number; of: number } {
  const begun = months.filter((m) => m.clock.when !== "future");
  return { met: begun.filter((m) => m.met).length, of: begun.length };
}
