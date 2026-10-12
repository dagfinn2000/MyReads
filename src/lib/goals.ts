import type { GoalUnit } from "@prisma/client";
import { keyToUtcDate } from "@/lib/dates";

/**
 * Finished passes and what they count toward, and how a goal is going.
 * Shared by the stats page and the year in review, so a goal shows the same
 * progress on both. What each pass adds (books, pages) comes from
 * lib/stats-count.ts, which applies the "What counts" preferences.
 */

/** One finished pass through a book: the current one on a Read book, or
 *  an archived re-read or pre-app read. */
export interface Finish {
  bookId: string;
  dateFinished: Date;
  pageCount: number | null;
  /** True when the book had been finished before this pass. */
  isReread: boolean;
}

/**
 * Marks which finishes are re-reads. A finish is a re-read when the same
 * book has an earlier dated finish, or any undated past read — "read it
 * before" placeholders are presumed to come first.
 */
export function markRereads<T extends { bookId: string; dateFinished: Date }>(
  finishes: T[],
  undatedReadBookIds: ReadonlySet<string>,
): (T & { isReread: boolean })[] {
  const byBook = new Map<string, Date[]>();
  for (const f of finishes) {
    const list = byBook.get(f.bookId) ?? [];
    list.push(f.dateFinished);
    byBook.set(f.bookId, list);
  }
  return finishes.map((f) => ({
    ...f,
    isReread:
      undatedReadBookIds.has(f.bookId) ||
      (byBook.get(f.bookId) ?? []).some((d) => d < f.dateFinished),
  }));
}

export interface GoalRule {
  unit: GoalUnit;
  countRereads: boolean;
}

/** The finishes that count toward a goal — all of them, or first reads
 *  only when re-reads are left out. */
export function countedFinishes<T extends Pick<Finish, "isReread">>(
  finishes: T[],
  rule: Pick<GoalRule, "countRereads">,
): T[] {
  return rule.countRereads ? finishes : finishes.filter((f) => !f.isReread);
}

/** Progress toward a goal from what the year's passes add (countWindow in
 *  lib/stats-count.ts): their books, or their pages. */
export function goalProgress(
  yearItems: { isReread: boolean; books: number; pages: number }[],
  rule: GoalRule,
): number {
  return countedFinishes(yearItems, rule).reduce(
    (sum, i) => sum + (rule.unit === "PAGES" ? i.pages : i.books),
    0,
  );
}

/** "book" or "books", "page" or "pages". */
export function unitWord(unit: GoalUnit, n: number): string {
  if (unit === "PAGES") return n === 1 ? "page" : "pages";
  return n === 1 ? "book" : "books";
}

/** How far through a goal's year today is. Today counts as gone and as
 *  left: 12 Oct 2026 is day 285 of 365, with 81 days to go. */
export interface YearClock {
  when: "past" | "current" | "future";
  elapsed: number;
  total: number;
  daysLeft: number;
  /** elapsed / total: where the "today" tick sits on the goal bar. */
  fraction: number;
}

export function yearClock(todayKey: string, year: number): YearClock {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const total = leap ? 366 : 365;
  const thisYear = Number(todayKey.slice(0, 4));
  if (year < thisYear) return { when: "past", elapsed: total, total, daysLeft: 0, fraction: 1 };
  if (year > thisYear) return { when: "future", elapsed: 0, total, daysLeft: total, fraction: 0 };
  const elapsed =
    Math.round((keyToUtcDate(todayKey).getTime() - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  return {
    when: "current",
    elapsed,
    total,
    daysLeft: total - elapsed + 1,
    fraction: elapsed / total,
  };
}

export type GoalPace =
  | { kind: "reached"; over: number }
  | { kind: "upcoming" }
  | { kind: "missed"; short: number }
  | { kind: "on-schedule" }
  | { kind: "ahead"; by: number }
  /** Behind, and what catching up takes: a book every few days, or so many
   *  books or pages a day. */
  | { kind: "behind"; by: number; everyDays?: number; perDay?: number };

/**
 * Where a goal stands against the calendar. "On schedule" is within half a
 * book (or half a percent of a pages goal) of an even pace through the
 * year.
 */
export function goalPace(
  done: number,
  target: number,
  unit: GoalUnit,
  clock: YearClock,
): GoalPace {
  if (clock.when === "future") return { kind: "upcoming" };
  if (done >= target) return { kind: "reached", over: done - target };
  if (clock.when === "past") return { kind: "missed", short: target - done };

  const diff = done - target * clock.fraction;
  const tolerance = unit === "PAGES" ? Math.max(1, target / 200) : 0.5;
  if (Math.abs(diff) < tolerance) return { kind: "on-schedule" };
  const by = Math.round(Math.abs(diff));
  if (diff > 0) return { kind: "ahead", by };

  const remaining = target - done;
  if (unit === "BOOKS" && remaining <= clock.daysLeft) {
    return { kind: "behind", by, everyDays: Math.floor(clock.daysLeft / remaining) };
  }
  return { kind: "behind", by, perDay: Math.ceil(remaining / clock.daysLeft) };
}

/** The pace as a sentence: "3 books behind. About 1 book every 10 days
 *  gets you there." `startsOn` is 1 January of the goal's year, formatted. */
export function describePace(
  pace: GoalPace,
  unit: GoalUnit,
  fmt: (n: number) => string = String,
  startsOn = "1 January",
): string {
  const amount = (n: number) => `${fmt(n)} ${unitWord(unit, n)}`;
  switch (pace.kind) {
    case "reached":
      return pace.over > 0
        ? `Goal reached. ${amount(pace.over)} more than you planned.`
        : "Goal reached.";
    case "upcoming":
      return `Starts counting on ${startsOn}.`;
    case "missed":
      return `Ended ${amount(pace.short)} short.`;
    case "on-schedule":
      return "Right on schedule.";
    case "ahead":
      return `${amount(pace.by)} ahead of schedule.`;
    case "behind": {
      const needed =
        pace.everyDays === undefined
          ? `About ${amount(pace.perDay ?? 0)} a day`
          : pace.everyDays === 1
            ? "About 1 book a day"
            : `About 1 book every ${fmt(pace.everyDays)} days`;
      return `${amount(pace.by)} behind. ${needed} gets you there.`;
    }
  }
}

/** This year's goal, the ones set ahead (soonest first) and past ones
 *  (newest first). Next year's goal is never a past one. */
export function splitGoals<G extends { year: number }>(
  goals: G[],
  currentYear: number,
): { current: G | null; upcoming: G[]; past: G[] } {
  return {
    current: goals.find((g) => g.year === currentYear) ?? null,
    upcoming: goals.filter((g) => g.year > currentYear).sort((a, b) => a.year - b.year),
    past: goals.filter((g) => g.year < currentYear).sort((a, b) => b.year - a.year),
  };
}
