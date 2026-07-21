import { describe, expect, it } from "vitest";
import {
  currentPassEntries,
  dailyPageTotals,
  dayKey,
  readingStreaks,
} from "@/lib/progress";

/** Local-noon date — keeps day math away from midnight/DST edges. */
function day(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12);
}

describe("dayKey", () => {
  it("formats local dates as sortable keys, zero-padded", () => {
    expect(dayKey(day(2026, 7, 21))).toBe("2026-07-21");
    expect(dayKey(day(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("currentPassEntries", () => {
  const e = (page: number, date: Date) => ({ page, date });

  it("slices from the latest page-0 anchor", () => {
    const entries = [
      e(120, day(2026, 1, 1)),
      e(0, day(2026, 2, 1)), // re-read anchor
      e(30, day(2026, 2, 3)),
    ];
    expect(currentPassEntries(entries, null)).toEqual(entries.slice(1));
  });

  it("uses the latest anchor when several passes are logged", () => {
    const entries = [
      e(0, day(2026, 1, 1)),
      e(300, day(2026, 1, 9)),
      e(0, day(2026, 3, 1)),
      e(50, day(2026, 3, 2)),
    ];
    expect(currentPassEntries(entries, null)).toEqual(entries.slice(2));
  });

  it("falls back to the started-date window when no anchor exists", () => {
    // Upgrade-seeded logs have no page-0 anchor.
    const entries = [
      e(80, day(2026, 1, 1)),
      e(120, day(2026, 2, 1)),
      e(150, day(2026, 2, 5)),
    ];
    expect(currentPassEntries(entries, day(2026, 2, 1))).toEqual(entries.slice(1));
  });

  it("returns everything when there is no anchor and no start date", () => {
    const entries = [e(10, day(2026, 1, 1)), e(20, day(2026, 1, 2))];
    expect(currentPassEntries(entries, null)).toEqual(entries);
  });
});

describe("dailyPageTotals", () => {
  const e = (bookId: string, page: number, date: Date) => ({ bookId, page, date });

  it("credits each increase to the later entry's day; the first entry is inert", () => {
    const totals = dailyPageTotals([
      e("a", 10, day(2026, 1, 1)), // first entry — no predecessor, no credit
      e("a", 50, day(2026, 1, 1)), // +40
      e("a", 80, day(2026, 1, 2)), // +30
    ]);
    expect(totals.get("2026-01-01")).toBe(40);
    expect(totals.get("2026-01-02")).toBe(30);
  });

  it("ignores decreases but moves the baseline", () => {
    const totals = dailyPageTotals([
      e("a", 100, day(2026, 1, 1)),
      e("a", 20, day(2026, 1, 2)), // correction/reset — no credit
      e("a", 50, day(2026, 1, 3)), // +30 from the new baseline
    ]);
    expect(totals.get("2026-01-02")).toBeUndefined();
    expect(totals.get("2026-01-03")).toBe(30);
  });

  it("sums across books and keeps their logs independent", () => {
    const totals = dailyPageTotals([
      e("a", 0, day(2026, 1, 1)),
      e("a", 25, day(2026, 1, 2)), // +25
      e("b", 200, day(2026, 1, 1)), // first entry of b — inert despite a's log
      e("b", 260, day(2026, 1, 2)), // +60
    ]);
    expect(totals.get("2026-01-02")).toBe(85);
    expect(totals.get("2026-01-01")).toBeUndefined();
  });

  it("sorts each book's log by date before walking it", () => {
    const totals = dailyPageTotals([
      e("a", 90, day(2026, 1, 3)),
      e("a", 30, day(2026, 1, 1)),
      e("a", 60, day(2026, 1, 2)),
    ]);
    expect(totals.get("2026-01-02")).toBe(30);
    expect(totals.get("2026-01-03")).toBe(30);
  });
});

describe("readingStreaks", () => {
  const keys = (...days: string[]) => new Set(days);

  it("counts a run ending today as the current streak", () => {
    const { current, longest } = readingStreaks(
      keys("2026-01-01", "2026-01-02", "2026-01-03"),
      day(2026, 1, 3),
    );
    expect(current).toBe(3);
    expect(longest).toBe(3);
  });

  it("does not break the streak on an unlogged today", () => {
    const { current } = readingStreaks(
      keys("2026-01-01", "2026-01-02", "2026-01-03"),
      day(2026, 1, 4), // today not logged yet — day isn't over
    );
    expect(current).toBe(3);
  });

  it("ends the current streak after a full missed day", () => {
    const { current, longest } = readingStreaks(
      keys("2026-01-01", "2026-01-02", "2026-01-03"),
      day(2026, 1, 5),
    );
    expect(current).toBe(0);
    expect(longest).toBe(3);
  });

  it("tracks the longest run across gaps", () => {
    const { longest } = readingStreaks(
      keys("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-08"),
      day(2026, 1, 8),
    );
    expect(longest).toBe(3);
  });

  it("spans month boundaries", () => {
    const { longest } = readingStreaks(
      keys("2026-01-31", "2026-02-01"),
      day(2026, 2, 1),
    );
    expect(longest).toBe(2);
  });

  it("returns zeros for an empty log", () => {
    expect(readingStreaks(new Set(), day(2026, 1, 1))).toEqual({
      current: 0,
      longest: 0,
    });
  });
});
