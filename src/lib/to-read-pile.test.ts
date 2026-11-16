import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@/lib/enums";
import { pileLastsText, pileSummary, sinceMonth, type PileBook } from "@/lib/to-read-pile";

// Monday 16 November 2026, noon UTC.
const NOW = new Date("2026-11-16T12:00:00Z");
const day = (key: string) => new Date(`${key}T00:00:00Z`);
const at = (key: string) => new Date(`${key}T10:00:00Z`);

let n = 0;
function book(over: Partial<PileBook> = {}): PileBook {
  n++;
  return {
    id: `b${n}`,
    title: `Book ${n}`,
    authors: [],
    coverUrl: null,
    status: ReadingStatus.WANT_TO_READ,
    createdAt: at("2026-06-01"),
    dateStarted: null,
    dateFinished: null,
    ...over,
  };
}

describe("pileSummary", () => {
  it("counts what waits now, and what went on and came off in twelve months", () => {
    const books = [
      book({ createdAt: at("2026-03-10") }),
      book({ createdAt: at("2024-01-05") }),
      // Added in May, started in September: on the pile for a while.
      book({ status: ReadingStatus.READING, createdAt: at("2026-05-01"), dateStarted: day("2026-09-01") }),
      // Added already read: never on it.
      book({
        status: ReadingStatus.READ,
        createdAt: at("2026-07-01"),
        dateStarted: day("2026-02-01"),
        dateFinished: day("2026-03-01"),
      }),
      // Read, with no dates at all: never on it either.
      book({ status: ReadingStatus.READ, createdAt: at("2026-07-01") }),
    ];
    const s = pileSummary(books, NOW, "UTC");
    expect(s.size).toBe(2);
    expect(s.added).toBe(2);
    expect(s.started).toBe(1);
    expect(s.oldest.map((b) => b.id)).toEqual([books[1].id, books[0].id]);
  });

  it("follows the pile month by month", () => {
    const books = [
      book({ createdAt: at("2026-01-15") }),
      book({ status: ReadingStatus.READING, createdAt: at("2026-02-10"), dateStarted: day("2026-08-20") }),
      book({ createdAt: at("2026-11-02") }),
    ];
    const s = pileSummary(books, NOW, "UTC");
    expect(s.monthly).toHaveLength(13);
    expect(s.monthly[0]).toEqual({ month: "2025-11", size: 0 });
    const by = Object.fromEntries(s.monthly.map((m) => [m.month, m.size]));
    expect(by["2026-01"]).toBe(1);
    expect(by["2026-07"]).toBe(2);
    expect(by["2026-08"]).toBe(1);
    expect(by["2026-11"]).toBe(2);
  });

  it("sorts how long books have waited into buckets, with the middle one", () => {
    const books = [
      book({ createdAt: at("2026-11-10") }),
      book({ createdAt: at("2026-08-01") }),
      book({ createdAt: at("2026-01-01") }),
      book({ createdAt: at("2025-06-01") }),
      book({ createdAt: at("2020-06-01") }),
    ];
    const s = pileSummary(books, NOW, "UTC");
    expect(s.ages).toEqual([1, 1, 1, 1, 1]);
    expect(s.medianDays).toBe(319);
  });

  it("goes by the reader's own day", () => {
    // Added late on 31 October in New York: 1 November in UTC.
    const b = book({ createdAt: new Date("2026-11-01T02:00:00Z") });
    const ny = pileSummary([b], NOW, "America/New_York");
    expect(ny.monthly.find((m) => m.month === "2026-10")?.size).toBe(1);
    const utc = pileSummary([b], NOW, "UTC");
    expect(utc.monthly.find((m) => m.month === "2026-10")?.size).toBe(0);
  });
});

describe("pileLastsText and sinceMonth", () => {
  it("says how long the pile lasts at a pace", () => {
    expect(pileLastsText(0, 12)).toBeNull();
    expect(pileLastsText(10, 0)).toBeNull();
    expect(pileLastsText(1, 24)).toBe("about a month");
    expect(pileLastsText(4, 12)).toBe("about 4 months");
    expect(pileLastsText(14, 12)).toBe("about a year");
    expect(pileLastsText(20, 12)).toBe("about a year and a half");
    expect(pileLastsText(60, 12)).toBe("about 5 years");
  });

  it("names the month a book was added", () => {
    expect(sinceMonth(at("2021-03-09"), "UTC")).toBe("Mar 2021");
  });
});
