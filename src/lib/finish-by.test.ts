import { describe, expect, it } from "vitest";
import { BookFormat, ReadingStatus } from "@/lib/enums";
import {
  finishByLine,
  finishBySoon,
  finishByState,
  finishSoonBadge,
  keepsFinishBy,
  perDayText,
  type FinishByBook,
} from "@/lib/finish-by";
import { unitFor } from "@/lib/progress-units";

// Monday 16 November 2026, mid-morning UTC.
const NOW = new Date("2026-11-16T10:00:00Z");
const day = (key: string) => new Date(`${key}T00:00:00Z`);

function book(over: Partial<FinishByBook> = {}): FinishByBook {
  return {
    status: ReadingStatus.READING,
    finishBy: day("2026-11-20"),
    pageCount: 300,
    currentPage: 100,
    ...over,
  };
}

const pages = unitFor(
  { format: BookFormat.PHYSICAL, pageCount: 300, lengthMinutes: null },
  { ebookUnit: "page", audiobookUnit: "page" },
);

describe("finishByState", () => {
  it("counts today and the day itself, and the pages a day it takes", () => {
    const s = finishByState(book(), null, NOW, "UTC");
    // 16, 17, 18, 19 and 20 November: five days for 200 pages.
    expect(s).toMatchObject({ kind: "ahead", due: "2026-11-20", days: 5, pagesLeft: 200, perDay: 40 });
  });

  it("is on track when the reader's pace covers it, and not when it doesn't", () => {
    expect(finishByState(book(), 45, NOW, "UTC")).toMatchObject({ onTrack: true });
    expect(finishByState(book(), 39, NOW, "UTC")).toMatchObject({ onTrack: false });
    expect(finishByState(book(), null, NOW, "UTC")).toMatchObject({ onTrack: null });
    // A book not started has no pace to go by.
    expect(
      finishByState(book({ status: ReadingStatus.WANT_TO_READ, currentPage: null }), 99, NOW, "UTC"),
    ).toMatchObject({ onTrack: null, started: false, pagesLeft: 300, perDay: 60 });
  });

  it("knows the day itself, a day gone by, and a book at its last page", () => {
    expect(finishByState(book({ finishBy: day("2026-11-16") }), null, NOW, "UTC")).toEqual({
      kind: "today",
      due: "2026-11-16",
      pagesLeft: 200,
    });
    expect(finishByState(book({ finishBy: day("2026-11-13") }), null, NOW, "UTC")).toEqual({
      kind: "late",
      due: "2026-11-13",
      daysLate: 3,
    });
    expect(finishByState(book({ currentPage: 300 }), null, NOW, "UTC")).toMatchObject({ kind: "done" });
  });

  it("goes by the reader's own day", () => {
    // At noon UTC it's already Tuesday the 17th in Auckland: four days
    // left, not five.
    const noon = new Date("2026-11-16T12:00:00Z");
    expect(finishByState(book(), null, noon, "Pacific/Auckland")).toMatchObject({ days: 4 });
    expect(finishByState(book(), null, noon, "UTC")).toMatchObject({ days: 5 });
  });

  it("has nothing to say without a day, or for a book read or put down", () => {
    expect(finishByState(book({ finishBy: null }), null, NOW)).toBeNull();
    expect(finishByState(book({ status: ReadingStatus.READ }), null, NOW)).toBeNull();
    expect(finishByState(book({ status: ReadingStatus.DNF }), null, NOW)).toBeNull();
    expect(keepsFinishBy(ReadingStatus.WANT_TO_READ)).toBe(true);
  });

  it("still counts the days without a page count", () => {
    expect(finishByState(book({ pageCount: null }), 20, NOW, "UTC")).toMatchObject({
      kind: "ahead",
      days: 5,
      perDay: null,
      onTrack: null,
    });
  });
});

describe("perDayText", () => {
  it("rounds up, in the book's unit", () => {
    expect(perDayText(31.2, pages)).toBe("32 pages a day");
    expect(perDayText(0.3, pages)).toBe("1 page a day");
    const percent = unitFor(
      { format: BookFormat.EBOOK, pageCount: 400, lengthMinutes: null },
      { ebookUnit: "percent", audiobookUnit: "page" },
    );
    expect(perDayText(21, percent)).toBe("6% a day");
    const time = unitFor(
      { format: BookFormat.AUDIOBOOK, pageCount: 300, lengthMinutes: 600 },
      { ebookUnit: "page", audiobookUnit: "time" },
    );
    expect(perDayText(30, time)).toBe("1 h a day");
    expect(perDayText(10, time)).toBe("20 min a day");
  });
});

describe("finishByLine", () => {
  const prefs = { timeZone: "UTC" };
  it("says what it takes and how it's going", () => {
    expect(finishByLine(finishByState(book(), 45, NOW, "UTC")!, pages, NOW, prefs)).toEqual({
      label: "Finish by Fri 20 Nov",
      detail: "40 pages a day gets you there, and your pace does.",
      tone: "good",
    });
    expect(finishByLine(finishByState(book(), 10, NOW, "UTC")!, pages, NOW, prefs).tone).toBe("warn");
    const notStarted = finishByState(
      book({ status: ReadingStatus.WANT_TO_READ, currentPage: null }),
      null,
      NOW,
      "UTC",
    )!;
    expect(finishByLine(notStarted, pages, NOW, prefs, true)).toEqual({
      label: "Due back Fri 20 Nov",
      detail: "60 pages a day if you start today.",
      tone: "calm",
    });
  });

  it("words today, a day past, and a day next year", () => {
    expect(
      finishByLine(finishByState(book({ finishBy: day("2026-11-16") }), null, NOW, "UTC")!, pages, NOW, prefs),
    ).toEqual({ label: "Finish by today", detail: "200 pages to go.", tone: "warn" });
    expect(
      finishByLine(finishByState(book({ finishBy: day("2026-11-15") }), null, NOW, "UTC")!, pages, NOW, prefs),
    ).toMatchObject({ detail: "A day past it.", tone: "late" });
    expect(
      finishByLine(finishByState(book({ finishBy: day("2027-01-08") }), null, NOW, "UTC")!, pages, NOW, prefs)
        .label,
    ).toBe("Finish by Fri 8 Jan 2027");
  });
});

describe("finishBySoon and the library badge", () => {
  it("points out a day within two weeks, or past, but not one further off", () => {
    expect(finishBySoon(finishByState(book({ finishBy: day("2026-11-29") }), null, NOW, "UTC"))).toBe(true);
    expect(finishBySoon(finishByState(book({ finishBy: day("2026-11-30") }), null, NOW, "UTC"))).toBe(false);
    expect(finishBySoon(null)).toBe(false);
    expect(finishSoonBadge(book(), NOW, { timeZone: "UTC" })).toEqual({ day: "Fri 20 Nov", late: false });
    expect(finishSoonBadge(book({ finishBy: day("2026-11-01") }), NOW, { timeZone: "UTC" })).toEqual({
      day: "Sun 1 Nov",
      late: true,
    });
    expect(finishSoonBadge(book({ currentPage: 300 }), NOW, { timeZone: "UTC" })).toBeUndefined();
  });
});
