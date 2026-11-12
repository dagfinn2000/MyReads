import { describe, expect, it } from "vitest";
import { pickFigures, shelfLayout, yearCardFileName } from "@/lib/year-card";
import type { YearWrapped } from "@/lib/year-wrapped";

function year(over: Partial<YearWrapped> = {}): YearWrapped {
  return {
    year: 2026,
    current: false,
    books: 42,
    bookWord: "finished",
    rereads: 3,
    pages: 12_480,
    minutes: 5_790,
    days: ["2026-03-01", "2026-03-02", "2026-03-03", "2026-05-09"],
    months: Array(12).fill(0),
    genres: [],
    finishes: [],
    top: [],
    ratings: true,
    goal: null,
    ...over,
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");

describe("pickFigures", () => {
  it("shows books, pages, the longest streak and hours", () => {
    expect(pickFigures(year(), fmt)).toEqual([
      { value: "42", label: "books finished" },
      { value: "12,480", label: "pages" },
      { value: "3", label: "days in a row" },
      { value: "97", label: "hours reading" },
    ]);
  });

  it("fills in with days read and re-reads when the timer wasn't used", () => {
    expect(pickFigures(year({ minutes: 0 }), fmt).map((f) => f.label)).toEqual([
      "books finished",
      "pages",
      "days in a row",
      "days reading",
    ]);
    expect(pickFigures(year({ minutes: 0, days: [] }), fmt).map((f) => f.label)).toEqual([
      "books finished",
      "pages",
      "re-reads",
    ]);
  });

  it("says days reading without a streak, and one book in the singular", () => {
    const figures = pickFigures(year({ books: 1, bookWord: "read", days: ["2026-01-01"], minutes: 0, rereads: 0 }), fmt);
    expect(figures).toEqual([
      { value: "1", label: "book read" },
      { value: "12,480", label: "pages" },
      { value: "1", label: "day reading" },
    ]);
  });
});

describe("shelfLayout", () => {
  it("centres a few books at their own widths", () => {
    const spots = shelfLayout([{ width: 2, height: 1 }, { width: 3, height: 0.9 }], 1000, 100, 20);
    expect(spots.map((s) => s.w)).toEqual([40, 60]);
    expect(spots[1].x - (spots[0].x + spots[0].w)).toBe(2);
    expect(spots[0].x).toBeCloseTo((1000 - 102) / 2);
    expect(spots[1].h).toBeCloseTo(90);
  });

  it("squeezes many books to fit", () => {
    const spots = shelfLayout(Array.from({ length: 400 }, () => ({ width: 1.9, height: 1 })), 888, 100);
    const end = spots[spots.length - 1].x + spots[spots.length - 1].w;
    expect(spots[0].x).toBeGreaterThanOrEqual(-0.001);
    expect(end).toBeLessThanOrEqual(888.001);
  });

  it("has nothing to place without books", () => {
    expect(shelfLayout([], 888, 100)).toEqual([]);
  });
});

describe("yearCardFileName", () => {
  it("names the picture after the year", () => {
    expect(yearCardFileName(2026)).toBe("2026-in-books.png");
  });
});
