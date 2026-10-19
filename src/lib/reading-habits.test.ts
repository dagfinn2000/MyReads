import { describe, expect, it } from "vitest";
import { BookFormat, ReadingStatus } from "@/lib/enums";
import { readingHabits, type TimedEntry } from "@/lib/reading-habits";
import type { Pass } from "@/lib/stats-count";
import { ALL_TIME } from "@/lib/stats-period";

const OSLO = "Europe/Oslo";
const book = {
  id: "b",
  status: ReadingStatus.READ,
  format: BookFormat.PHYSICAL,
  pageCount: 300,
  currentPage: null,
  dateStarted: null,
  dateFinished: null,
  rating: null,
};

function pass(over: Partial<Pass>): Pass {
  return {
    book,
    kind: "finished",
    date: null,
    day: null,
    dateStarted: null,
    isReread: false,
    rating: null,
    countsAsBook: true,
    wholePages: 300,
    logged: [],
    ...over,
  };
}

const opts = { weekStart: "monday" as const, timeZone: OSLO, withoutAudiobooks: false };

describe("readingHabits", () => {
  // 2026-10-12 is a Monday, 2026-10-18 a Sunday.
  const passes = [
    pass({
      logged: [
        { day: "2026-10-12", pages: 20 },
        { day: "2026-10-18", pages: 60 },
        { day: "2026-10-11", pages: 40 }, // the Sunday before
      ],
    }),
    pass({ logged: [{ day: "2026-10-18", pages: 10 }, { day: "2026-10-14", pages: 0 }] }),
  ];

  it("adds up pages by weekday, in the reader's week order", () => {
    const h = readingHabits(passes, ALL_TIME, [], opts);
    expect(h.weekdays.map((w) => w.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(h.weekdays.map((w) => w.pages)).toEqual([20, 0, 0, 0, 0, 0, 110]);
    expect(h.weekdays[6]).toMatchObject({ plural: "Sundays", days: 2 });
    expect(h.topWeekday?.plural).toBe("Sundays");
    expect(readingHabits(passes, ALL_TIME, [], { ...opts, weekStart: "sunday" }).weekdays[0].short).toBe("Sun");
  });

  it("counts pages on an average reading day, a day with nothing logged aside", () => {
    const h = readingHabits(passes, ALL_TIME, [], opts);
    expect(h.readingDays).toBe(3);
    expect(h.pagesPerReadingDay).toBeCloseTo(130 / 3);
  });

  it("keeps to the period", () => {
    const h = readingHabits(passes, { from: "2026-10-12", to: "2026-10-18" }, [], opts);
    expect(h.readingDays).toBe(2);
    expect(h.weekdays[6].pages).toBe(70);
  });

  it("names no top day when nothing was read, or two days tie", () => {
    expect(readingHabits([], ALL_TIME, [], opts)).toMatchObject({
      topWeekday: null,
      readingDays: 0,
      pagesPerReadingDay: null,
      bookDays: null,
      sitting: null,
      pagesPerHour: null,
    });
    const tie = [pass({ logged: [{ day: "2026-10-12", pages: 10 }, { day: "2026-10-13", pages: 10 }] })];
    expect(readingHabits(tie, ALL_TIME, [], opts).topWeekday).toBeNull();
  });

  it("takes the middle of how long the finished books took, start and finish day both counted", () => {
    const finished = [
      // A typed start date (midnight UTC) and a finish 9 days later: 10 days.
      pass({ day: "2026-03-10", dateStarted: new Date("2026-03-01T00:00:00Z") }),
      // Started and finished the same day: 1 day.
      pass({ day: "2026-05-01", dateStarted: new Date("2026-05-01T09:00:00Z") }),
      // Started at 23:30 UTC, already the 3rd in Oslo: 4 days.
      pass({ day: "2026-06-06", dateStarted: new Date("2026-06-02T23:30:00Z") }),
      // Not finished, or with no start: left out.
      pass({ kind: "stopped", day: "2026-06-06", dateStarted: new Date("2026-01-01T00:00:00Z") }),
      pass({ day: "2026-06-06" }),
    ];
    expect(readingHabits(finished, ALL_TIME, [], opts).bookDays).toEqual({ median: 4, books: 3 });
    expect(readingHabits(finished.slice(0, 2), ALL_TIME, [], opts).bookDays).toEqual({ median: 5.5, books: 2 });
    expect(readingHabits(finished, { from: "2026-05-01", to: "2026-12-31" }, [], opts).bookDays?.books).toBe(2);
  });

  it("averages the timer's sittings, and pages an hour without audiobooks", () => {
    const timed: TimedEntry[] = [
      { day: "2026-10-12", minutes: 30, pages: 20, audiobook: false },
      { day: "2026-10-13", minutes: 60, pages: 40, audiobook: false },
      // A book's first entry: a sitting, but nothing to measure pages from.
      { day: "2026-10-14", minutes: 30, pages: null, audiobook: false },
      { day: "2026-10-15", minutes: 120, pages: 300, audiobook: true },
    ];
    const h = readingHabits([], ALL_TIME, timed, opts);
    expect(h.sitting).toEqual({ minutes: 60, sittings: 4 });
    expect(h.pagesPerHour).toBeCloseTo(40);
    expect(readingHabits([], ALL_TIME, timed, { ...opts, withoutAudiobooks: true }).sitting).toEqual({
      minutes: 40,
      sittings: 3,
    });
    // Too little timed reading to say.
    expect(readingHabits([], ALL_TIME, [{ day: "2026-10-12", minutes: 5, pages: 9, audiobook: false }], opts).pagesPerHour).toBeNull();
  });
});
