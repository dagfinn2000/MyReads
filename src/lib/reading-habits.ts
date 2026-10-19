import { calendarDay, keyToUtcDate } from "@/lib/dates";
import { MIN_TIMED_MINUTES } from "@/lib/reading-time";
import type { WeekStart } from "@/lib/preferences";
import { inWindow, type CountBook, type Pass } from "@/lib/stats-count";
import type { DayWindow } from "@/lib/stats-period";

/**
 * The Reading habits card on Stats, for the chosen period: which days of
 * the week the reading happens on, pages on an average reading day, how
 * long a book takes from start to finish and, from the reading timer, an
 * average sitting and pages an hour. Pure, from what the stats page
 * already has: the passes (lib/stats-count.ts, so "What counts" applies
 * the same way as to Pages read) and the timed log entries.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** One timed log entry (lib/stats-query.ts timedEntriesForUser). */
export interface TimedEntry {
  day: string;
  minutes: number;
  /** Pages since the entry before it in the same book; null for a book's
   *  first entry, which has nothing to measure from. */
  pages: number | null;
  audiobook: boolean;
}

export interface WeekdayPages {
  /** "Mon". */
  short: string;
  /** "Mondays". */
  plural: string;
  pages: number;
  /** Reading days that fell on it. */
  days: number;
}

export interface ReadingHabits {
  /** In the reader's week order. */
  weekdays: WeekdayPages[];
  /** The weekday with the most pages, when one stands out. */
  topWeekday: WeekdayPages | null;
  readingDays: number;
  /** Pages on an average day with any reading. */
  pagesPerReadingDay: number | null;
  /** Middle of the start-to-finish days of the books finished, and how
   *  many books that's from. */
  bookDays: { median: number; books: number } | null;
  /** From the timer: an average timed stretch, and pages an hour. */
  sitting: { minutes: number; sittings: number } | null;
  pagesPerHour: number | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function readingHabits<B extends CountBook>(
  passes: readonly Pass<B>[],
  window: DayWindow,
  timed: readonly TimedEntry[],
  opts: { weekStart: WeekStart; timeZone: string; withoutAudiobooks: boolean },
): ReadingHabits {
  const byDay = new Map<string, number>();
  for (const pass of passes) {
    for (const l of pass.logged) {
      if (l.pages > 0 && inWindow(l.day, window)) byDay.set(l.day, (byDay.get(l.day) ?? 0) + l.pages);
    }
  }

  const sundayFirst = WEEKDAYS.map((name) => ({ short: name.slice(0, 3), plural: `${name}s`, pages: 0, days: 0 }));
  let total = 0;
  for (const [day, pages] of byDay) {
    const w = sundayFirst[keyToUtcDate(day).getUTCDay()];
    w.pages += pages;
    w.days++;
    total += pages;
  }
  const weekdays = opts.weekStart === "sunday" ? sundayFirst : [...sundayFirst.slice(1), sundayFirst[0]];
  const ranked = [...weekdays].sort((a, b) => b.pages - a.pages);
  const topWeekday = ranked[0].pages > 0 && ranked[0].pages > ranked[1].pages ? ranked[0] : null;

  const spans = passes.flatMap((p) => {
    if (p.kind !== "finished" || !p.day || !p.dateStarted || !inWindow(p.day, window)) return [];
    const started = keyToUtcDate(calendarDay(p.dateStarted, opts.timeZone));
    const days = Math.round((keyToUtcDate(p.day).getTime() - started.getTime()) / 86_400_000) + 1;
    return days >= 1 ? [days] : [];
  });

  const stretches = timed.filter((t) => inWindow(t.day, window) && !(opts.withoutAudiobooks && t.audiobook));
  const timedMinutes = stretches.reduce((sum, t) => sum + t.minutes, 0);
  // Pages an hour leaves audiobooks out: they play at their own speed.
  const measured = stretches.filter((t) => t.pages !== null && !t.audiobook);
  const measuredMinutes = measured.reduce((sum, t) => sum + t.minutes, 0);
  const measuredPages = measured.reduce((sum, t) => sum + (t.pages ?? 0), 0);

  return {
    weekdays,
    topWeekday,
    readingDays: byDay.size,
    pagesPerReadingDay: byDay.size > 0 ? total / byDay.size : null,
    bookDays: spans.length > 0 ? { median: median(spans), books: spans.length } : null,
    sitting:
      stretches.length > 0 ? { minutes: timedMinutes / stretches.length, sittings: stretches.length } : null,
    pagesPerHour:
      measuredMinutes >= MIN_TIMED_MINUTES && measuredPages > 0 ? (measuredPages / measuredMinutes) * 60 : null,
  };
}
