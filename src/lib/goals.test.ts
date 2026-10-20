import { describe, expect, it } from "vitest";
import { formatNumber } from "@/lib/display";
import {
  describePace,
  goalPace,
  goalProgress,
  markRereads,
  monthClock,
  monthEnd,
  readingDaysIn,
  spanClock,
  splitGoals,
  unitWord,
  yearClock,
} from "@/lib/goals";

const finish = (bookId: string, date: string, pageCount: number | null = 300) => ({
  bookId,
  dateFinished: new Date(date),
  pageCount,
});

describe("markRereads", () => {
  it("marks later finishes of the same book", () => {
    const marked = markRereads(
      [finish("a", "2026-03-01"), finish("a", "2025-06-01"), finish("b", "2026-01-01")],
      new Set(),
    );
    expect(marked.map((f) => f.isReread)).toEqual([true, false, false]);
  });

  it("counts an undated earlier read as coming first", () => {
    const marked = markRereads([finish("a", "2026-03-01")], new Set(["a"]));
    expect(marked[0].isReread).toBe(true);
  });
});

describe("goalProgress", () => {
  // What countWindow gives for a year: a first read, a re-read, a book with
  // no page count, and pages logged in a book not finished yet.
  const year = [
    { isReread: false, books: 1, pages: 300 },
    { isReread: true, books: 1, pages: 200 },
    { isReread: false, books: 1, pages: 0 },
    { isReread: false, books: 0, pages: 120 },
  ];

  it("counts books, re-reads included by default", () => {
    expect(goalProgress(year, { unit: "BOOKS", countRereads: true })).toBe(3);
    expect(goalProgress(year, { unit: "BOOKS", countRereads: false })).toBe(2);
  });

  it("adds up pages, skipping the re-read when re-reads are left out", () => {
    expect(goalProgress(year, { unit: "PAGES", countRereads: true })).toBe(620);
    expect(goalProgress(year, { unit: "PAGES", countRereads: false })).toBe(420);
  });
});

describe("yearClock", () => {
  it("counts today as gone and as left", () => {
    expect(yearClock("2026-10-12", 2026)).toEqual({
      when: "current",
      elapsed: 285,
      total: 365,
      daysLeft: 81,
      fraction: 285 / 365,
    });
  });

  it("starts on day 1 and ends on the last day of a leap year", () => {
    expect(yearClock("2026-01-01", 2026)).toMatchObject({ elapsed: 1, daysLeft: 365 });
    expect(yearClock("2028-12-31", 2028)).toMatchObject({
      elapsed: 366,
      total: 366,
      daysLeft: 1,
      fraction: 1,
    });
  });

  it("is full for a past year and empty for a future one", () => {
    expect(yearClock("2026-10-12", 2025)).toMatchObject({ when: "past", fraction: 1, daysLeft: 0 });
    expect(yearClock("2026-10-12", 2027)).toMatchObject({
      when: "future",
      fraction: 0,
      daysLeft: 365,
    });
  });
});

describe("goalPace and describePace", () => {
  const oct12 = yearClock("2026-10-12", 2026);
  const fmt = (n: number) => formatNumber(n);
  const say = (done: number, target: number, unit: "BOOKS" | "PAGES", clock = oct12) =>
    describePace(goalPace(done, target, unit, clock), unit, fmt, "1 Jan 2027");

  it("is on schedule within half a book of an even pace", () => {
    // 24 × 285/365 = 18.7 expected by 12 October.
    expect(goalPace(19, 24, "BOOKS", oct12)).toEqual({ kind: "on-schedule" });
    expect(say(19, 24, "BOOKS")).toBe("Right on schedule.");
    // Everyone is on schedule on 1 January.
    expect(say(0, 24, "BOOKS", yearClock("2026-01-01", 2026))).toBe("Right on schedule.");
  });

  it("rounds how far ahead", () => {
    expect(goalPace(21, 24, "BOOKS", oct12)).toEqual({ kind: "ahead", by: 2 });
    expect(say(21, 24, "BOOKS")).toBe("2 books ahead of schedule.");
    expect(say(20, 24, "BOOKS")).toBe("1 book ahead of schedule.");
  });

  it("says how often a book gets a reader back on track", () => {
    // 8 to go in 81 days: one every 10 days.
    expect(goalPace(16, 24, "BOOKS", oct12)).toEqual({ kind: "behind", by: 3, everyDays: 10 });
    expect(say(16, 24, "BOOKS")).toBe("3 books behind. About 1 book every 10 days gets you there.");
  });

  it("never says 'every 1 days'", () => {
    // 50 to go in 81 days.
    expect(say(50, 100, "BOOKS")).toBe("28 books behind. About 1 book a day gets you there.");
  });

  it("asks for several books a day when there are more books than days left", () => {
    const dec31 = yearClock("2026-12-31", 2026);
    expect(goalPace(20, 24, "BOOKS", dec31)).toEqual({ kind: "behind", by: 4, perDay: 4 });
    expect(say(20, 24, "BOOKS", dec31)).toBe("4 books behind. About 4 books a day gets you there.");
  });

  it("puts a pages goal in pages a day, on schedule within half a percent", () => {
    // 8,000 × 285/365 = 6,246.6 expected; 3,000 to go in 81 days.
    expect(say(5000, 8000, "PAGES")).toBe(
      "1,247 pages behind. About 38 pages a day gets you there.",
    );
    expect(say(6220, 8000, "PAGES")).toBe("Right on schedule.");
    expect(say(6300, 8000, "PAGES")).toBe("53 pages ahead of schedule.");
  });

  it("celebrates a reached goal, with any overshoot", () => {
    expect(say(26, 24, "BOOKS")).toBe("Goal reached. 2 books more than you planned.");
    expect(say(24, 24, "BOOKS")).toBe("Goal reached.");
    expect(say(8001, 8000, "PAGES")).toBe("Goal reached. 1 page more than you planned.");
  });

  it("closes a past year and waits for a future one", () => {
    const past = yearClock("2026-10-12", 2025);
    expect(goalPace(17, 20, "BOOKS", past)).toEqual({ kind: "missed", short: 3 });
    expect(say(17, 20, "BOOKS", past)).toBe("Ended 3 books short.");
    expect(say(799, 800, "PAGES", past)).toBe("Ended 1 page short.");
    expect(say(22, 20, "BOOKS", past)).toBe("Goal reached. 2 books more than you planned.");
    expect(say(0, 26, "BOOKS", yearClock("2026-10-12", 2027))).toBe(
      "Starts counting on 1 Jan 2027.",
    );
  });
});

describe("month clocks", () => {
  it("knows each month's last day, leap Februaries included", () => {
    expect(monthEnd(2026, 1)).toBe("2026-01-31");
    expect(monthEnd(2026, 2)).toBe("2026-02-28");
    expect(monthEnd(2028, 2)).toBe("2028-02-29");
    expect(monthEnd(2026, 4)).toBe("2026-04-30");
    expect(monthEnd(2026, 12)).toBe("2026-12-31");
  });

  it("counts today as gone and as left, like the year's clock", () => {
    expect(monthClock("2026-10-12", 2026, 10)).toEqual({
      when: "current",
      elapsed: 12,
      total: 31,
      daysLeft: 20,
      fraction: 12 / 31,
    });
    expect(monthClock("2026-10-12", 2026, 9).when).toBe("past");
    expect(monthClock("2026-10-12", 2026, 11)).toMatchObject({ when: "future", daysLeft: 30 });
  });

  it("is the year's clock for a whole year", () => {
    expect(spanClock("2026-10-12", "2026-01-01", "2026-12-31")).toEqual(
      yearClock("2026-10-12", 2026),
    );
  });
});

describe("reading-days goals", () => {
  const fmt = (n: number) => formatNumber(n);
  const oct12 = monthClock("2026-10-12", 2026, 10);

  it("counts the days in the window", () => {
    const days = ["2026-09-30", "2026-10-01", "2026-10-12", "2026-11-01"];
    expect(readingDaysIn(days, "2026-10-01", "2026-10-31")).toBe(2);
    expect(unitWord("DAYS", 1)).toBe("day");
    expect(unitWord("DAYS", 2)).toBe("days");
  });

  it("says on how many of the days left to read", () => {
    // 20 days a month: about 7.7 expected by the 12th, 3 read; 17 to go in 20.
    const pace = goalPace(3, 20, "DAYS", oct12);
    expect(pace).toEqual({ kind: "behind", by: 5, daysOf: [17, 20] });
    expect(describePace(pace, "DAYS", fmt)).toBe(
      "5 days behind. Reading on 17 of the 20 days left gets you there.",
    );
  });

  it("asks for every day left when that's exactly what it takes", () => {
    const pace = goalPace(5, 25, "DAYS", oct12);
    expect(describePace(pace, "DAYS", fmt)).toBe(
      "5 days behind. Read every day left to get there.",
    );
  });

  it("says when the days left can't get there any more", () => {
    const pace = goalPace(2, 25, "DAYS", oct12);
    expect(pace).toEqual({ kind: "out-of-reach", short: 3 });
    expect(describePace(pace, "DAYS", fmt)).toBe(
      "Out of reach: reading every day left still ends 3 days short.",
    );
  });

  it("is on schedule within half a day", () => {
    expect(goalPace(8, 20, "DAYS", oct12)).toEqual({ kind: "on-schedule" });
    expect(describePace(goalPace(20, 20, "DAYS", oct12), "DAYS", fmt)).toBe("Goal reached.");
  });
});

describe("splitGoals", () => {
  it("keeps next year's goal out of the past, newest past first", () => {
    const goals = [{ year: 2024 }, { year: 2027 }, { year: 2026 }, { year: 2025 }];
    expect(splitGoals(goals, 2026)).toEqual({
      current: { year: 2026 },
      upcoming: [{ year: 2027 }],
      past: [{ year: 2025 }, { year: 2024 }],
    });
    expect(splitGoals([{ year: 2025 }], 2026).current).toBeNull();
  });
});
