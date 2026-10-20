import { describe, expect, it } from "vitest";
import { monthlyProgress, monthsMet, progressIn, readingDaySet } from "@/lib/goal-progress";
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

describe("readingDaySet", () => {
  it("joins days from pages and minutes, leaving out zeroes", () => {
    const pages = new Map([
      ["2026-10-01", 20],
      ["2026-10-02", 0],
    ]);
    const minutes = new Map([
      ["2026-10-02", 0],
      ["2026-10-03", 15],
      ["2026-10-01", 5],
    ]);
    expect([...readingDaySet(pages, minutes)].sort()).toEqual(["2026-10-01", "2026-10-03"]);
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

  it("tallies the months met out of those begun", () => {
    expect(monthsMet(monthlyProgress(goal, 2026, "2026-03-20", ctx))).toEqual({ met: 2, of: 3 });
    expect(monthsMet(monthlyProgress(goal, 2025, "2026-03-20", ctx))).toEqual({ met: 0, of: 12 });
    expect(monthsMet(monthlyProgress(goal, 2027, "2026-03-20", ctx))).toEqual({ met: 0, of: 0 });
  });
});
