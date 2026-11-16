import { describe, expect, it } from "vitest";
import { BookFormat, ReadingStatus } from "@/lib/enums";
import type { CountBook, Pass } from "@/lib/stats-count";
import { changeText, dayOfYear, onCourseFor, sameDayLastYear, yearVersus } from "@/lib/year-versus";

const rules = { statsPagesRead: "finished" as const };
const B: CountBook = {
  id: "b",
  status: ReadingStatus.READ,
  format: BookFormat.PHYSICAL,
  pageCount: 300,
  currentPage: null,
  dateStarted: null,
  dateFinished: null,
  rating: null,
};

function finished(day: string, over: Partial<Pass> = {}): Pass {
  return {
    book: B,
    kind: "finished",
    date: new Date(`${day}T00:00:00Z`),
    day,
    dateStarted: null,
    isReread: false,
    rating: null,
    countsAsBook: true,
    wholePages: 300,
    logged: [],
    ...over,
  };
}

describe("sameDayLastYear and dayOfYear", () => {
  it("steps back a year, 29 February to the 28th", () => {
    expect(sameDayLastYear("2026-11-16")).toBe("2025-11-16");
    expect(sameDayLastYear("2028-02-29")).toBe("2027-02-28");
    expect(dayOfYear("2026-01-01")).toBe(0);
    expect(dayOfYear("2026-12-31")).toBe(364);
    expect(dayOfYear("2028-12-31")).toBe(365);
  });
});

describe("yearVersus", () => {
  const passes = [
    finished("2025-02-01", { rating: 8 }),
    finished("2025-11-16", { rating: 6 }),
    // After this day last year: in the whole year, not the comparison.
    finished("2025-12-20"),
    finished("2026-01-10", { rating: 10 }),
    finished("2026-03-01"),
    finished("2026-11-16"),
    // Still open: no book.
    { ...finished("2026-11-01"), kind: "open" as const, day: null, date: null },
  ];
  const days = new Set(["2025-03-01", "2025-11-17", "2026-02-02", "2026-02-03", "2026-11-16"]);
  const minutes = new Map([
    ["2025-03-01", 30],
    ["2026-02-02", 45],
  ]);

  it("sets this year so far beside last year to the same day", () => {
    const v = yearVersus(passes, "2026-11-16", rules, days, minutes)!;
    expect(v.lastYearDay).toBe("2025-11-16");
    expect(v.now).toMatchObject({ year: 2026, books: 3, pages: 900, days: 3, minutes: 45, rating: 10 });
    expect(v.then).toMatchObject({ year: 2025, books: 2, pages: 600, days: 1, minutes: 30, rating: 7 });
    expect(v.thenFullYear).toBe(3);
  });

  it("adds up the books day by day for the chart", () => {
    const v = yearVersus(passes, "2026-11-16", rules, days, null)!;
    expect(v.nowByDay).toHaveLength(dayOfYear("2026-11-16") + 1);
    expect(v.nowByDay[8]).toBe(0);
    expect(v.nowByDay[9]).toBe(1);
    expect(v.nowByDay.at(-1)).toBe(3);
    expect(v.thenByDay).toHaveLength(365);
    expect(v.thenByDay.at(-1)).toBe(3);
    expect(v.now.minutes).toBeNull();
  });

  it("has nothing to say without last year", () => {
    expect(yearVersus([finished("2026-03-01")], "2026-11-16", rules, new Set(), null)).toBeNull();
  });

  it("projects the year at its pace, once there's a pace", () => {
    const v = yearVersus(passes, "2026-11-16", rules, days, null)!;
    // 3 books in 320 days: about 3 by the end of the year.
    expect(onCourseFor(v)).toBe(3);
    const early = yearVersus(passes, "2026-01-10", rules, days, null)!;
    expect(onCourseFor(early)).toBeNull();
  });
});

describe("changeText", () => {
  it("signs the difference", () => {
    const fmt = (n: number) => String(n);
    expect(changeText(5, 3, fmt)).toBe("+2");
    expect(changeText(3, 5, fmt)).toBe("−2");
    expect(changeText(3, 3, fmt)).toBe("same");
  });
});
