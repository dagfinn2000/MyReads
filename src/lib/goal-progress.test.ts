import { describe, expect, it } from "vitest";
import {
  goalReadingDays,
  monthlyProgress,
  monthsMet,
  progressIn,
  todayRead,
} from "@/lib/goal-progress";
import { buildPasses, type CountBook, type CountRules } from "@/lib/stats-count";

const RULES: CountRules = {
  statsPagesRead: "finished",
  statsStoppedBooks: "none",
  statsAudiobooks: "full",
};

/** Passes for books each finished once, on `day`, all their pages counted. */
function finishes(...list: [id: string, day: string, pageCount?: number][]) {
  const books: CountBook[] = list.map(([id, day, pageCount = 300]) => ({
    id,
    status: "READ",
    format: "PHYSICAL",
    pageCount,
    currentPage: null,
    dateStarted: null,
    dateFinished: new Date(`${day}T00:00:00Z`),
    rating: null,
  }));
  return buildPasses({ books, reads: [], logDays: [], lastLogDates: new Map() }, RULES, "UTC");
}

describe("goalReadingDays", () => {
  const logDays = [
    { bookId: "paper", day: "2026-10-01", pages: 20, current: true },
    { bookId: "paper", day: "2026-10-02", pages: 0, current: true },
    { bookId: "audio", day: "2026-10-04", pages: 30, current: true },
  ];
  const minutes = [
    { day: "2026-10-02", audiobook: false, minutes: 0 },
    { day: "2026-10-03", audiobook: false, minutes: 15 },
    { day: "2026-10-05", audiobook: true, minutes: 40 },
  ];
  const audio = new Set(["audio"]);

  it("joins days with pages logged or minutes timed, leaving out zeroes", () => {
    const days = goalReadingDays(logDays, minutes, audio, { statsAudiobooks: "full" });
    expect([...days].sort()).toEqual(["2026-10-01", "2026-10-03", "2026-10-04", "2026-10-05"]);
  });

  it("leaves out audiobooks when What counts leaves them out", () => {
    const days = goalReadingDays(logDays, minutes, audio, { statsAudiobooks: "out" });
    expect([...days].sort()).toEqual(["2026-10-01", "2026-10-03"]);
  });
});

describe("progressIn", () => {
  const ctx = {
    passes: finishes(
      ["a", "2026-03-04"],
      ["b", "2026-03-30", 100],
      ["c", "2026-04-02"],
    ),
    rules: RULES,
    readingDays: new Set(["2026-03-01", "2026-03-31", "2026-04-01"]),
  };

  it("counts books, pages or reading days over the window", () => {
    const march = ["2026-03-01", "2026-03-31"] as const;
    expect(progressIn({ target: 2, unit: "BOOKS", countRereads: true }, ...march, ctx)).toBe(2);
    expect(progressIn({ target: 2, unit: "PAGES", countRereads: true }, ...march, ctx)).toBe(400);
    expect(progressIn({ target: 2, unit: "DAYS", countRereads: true }, ...march, ctx)).toBe(2);
  });
});

describe("monthlyProgress", () => {
  const ctx = {
    passes: finishes(
      ["a", "2026-01-10"],
      ["b", "2026-01-20"],
      ["c", "2026-02-05"],
      ["d", "2026-03-01"],
      ["e", "2026-03-15"],
      // A finish typed ahead of today: its month hasn't begun, so it waits.
      ["f", "2026-04-20"],
    ),
    rules: RULES,
    readingDays: new Set<string>(),
  };
  const goal = { target: 2, unit: "BOOKS" as const, countRereads: true };

  it("goes month by month, with nothing counted for months still to come", () => {
    const months = monthlyProgress(goal, 2026, "2026-03-20", ctx);
    expect(months).toHaveLength(12);
    expect(months.map((m) => m.done).slice(0, 4)).toEqual([2, 1, 2, 0]);
    expect(months.map((m) => m.met).slice(0, 4)).toEqual([true, false, true, false]);
    expect(months[0].pace).toEqual({ kind: "reached", over: 0 });
    expect(months[1].pace).toEqual({ kind: "missed", short: 1 });
    expect(months[2].clock.when).toBe("current");
    expect(months[3].pace).toEqual({ kind: "upcoming" });
  });

  it("asks a days goal for no more days than the month has", () => {
    const days = { target: 31, unit: "DAYS" as const, countRereads: true };
    const february = Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, "0")}`);
    const months = monthlyProgress(days, 2026, "2026-03-20", { ...ctx, readingDays: new Set(february) });
    expect(months[1]).toMatchObject({ done: 28, target: 28, met: true });
    expect(months[0]).toMatchObject({ done: 0, target: 31, met: false });
  });

  it("knows when today already counts toward a days goal", () => {
    const read = { ...ctx, readingDays: new Set(["2026-03-20"]) };
    expect(todayRead({ unit: "DAYS" }, "2026-03-20", read)).toBe(true);
    expect(todayRead({ unit: "DAYS" }, "2026-03-21", read)).toBe(false);
    expect(todayRead({ unit: "BOOKS" }, "2026-03-20", read)).toBe(false);
  });

  it("tallies the months met out of those begun", () => {
    expect(monthsMet(monthlyProgress(goal, 2026, "2026-03-20", ctx))).toEqual({ met: 2, of: 3 });
    expect(monthsMet(monthlyProgress(goal, 2025, "2026-03-20", ctx))).toEqual({ met: 0, of: 12 });
    expect(monthsMet(monthlyProgress(goal, 2027, "2026-03-20", ctx))).toEqual({ met: 0, of: 0 });
  });
});
