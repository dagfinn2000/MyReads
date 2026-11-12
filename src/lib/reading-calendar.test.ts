import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  calendarWeeks,
  calendarYears,
  currentRun,
  daysBetween,
  longestRun,
  monthColumns,
  runDays,
  runYear,
  runsIn,
  streakRuns,
  windowRange,
} from "@/lib/reading-calendar";

const book = (id: string, format = "PHYSICAL") => ({
  id,
  title: `Title ${id}`,
  authors: [`Author ${id}`],
  coverUrl: null,
  format,
});

describe("buildCalendar", () => {
  const books = [book("a"), book("b"), book("audio", "AUDIOBOOK")];
  const logDays = [
    { bookId: "a", day: "2026-03-01", pages: 20, current: true },
    { bookId: "b", day: "2026-03-01", pages: 35, current: true },
    // An earlier pass of the same book on the same day adds up.
    { bookId: "a", day: "2026-03-01", pages: 5, current: false },
    { bookId: "audio", day: "2026-03-02", pages: 40, current: true },
    // Someone else's book (not in the list) is ignored.
    { bookId: "stranger", day: "2026-03-03", pages: 99, current: true },
  ];
  const dayMinutes = [
    { day: "2026-03-01", bookId: "a", audiobook: false, minutes: 30 },
    { day: "2026-03-02", bookId: "audio", audiobook: true, minutes: 45 },
    // Time without pages moved is still a reading day.
    { day: "2026-03-04", bookId: "b", audiobook: false, minutes: 15 },
    { day: "2026-03-05", bookId: "b", audiobook: false, minutes: 0 },
  ];

  it("puts each day's pages, time and books together", () => {
    const cal = buildCalendar({ logDays, dayMinutes, books, statsAudiobooks: "full" });
    expect(Object.keys(cal.days).sort()).toEqual(["2026-03-01", "2026-03-02", "2026-03-04"]);
    const [pages, minutes, perBook] = cal.days["2026-03-01"];
    expect([pages, minutes]).toEqual([60, 30]);
    // Most pages first, each book named once.
    expect(perBook.map(([i, p, m]) => [cal.books[i].id, p, m])).toEqual([
      ["b", 35, 0],
      ["a", 25, 30],
    ]);
    expect(cal.days["2026-03-02"].slice(0, 2)).toEqual([40, 45]);
    expect(cal.days["2026-03-04"].slice(0, 2)).toEqual([0, 15]);
    expect(cal.books.map((b) => b.id).sort()).toEqual(["a", "audio", "b"]);
    expect(cal.books.find((b) => b.id === "a")).toEqual({
      id: "a",
      title: "Title a",
      author: "Author a",
      coverUrl: null,
    });
    expect(cal.timed).toBe(true);
    expect(cal.goalDays).toEqual([]);
  });

  it("keeps audiobooks as reading days without their pages when they count as books", () => {
    const cal = buildCalendar({ logDays, dayMinutes, books, statsAudiobooks: "books" });
    const [pages, minutes, perBook] = cal.days["2026-03-02"];
    expect([pages, minutes]).toEqual([0, 45]);
    // The book still says what was logged in it.
    expect(perBook).toEqual([[cal.books.findIndex((b) => b.id === "audio"), 40, 45]]);
  });

  it("leaves audiobooks out altogether when What counts does", () => {
    const cal = buildCalendar({ logDays, dayMinutes, books, statsAudiobooks: "out" });
    expect(cal.days["2026-03-02"]).toBeUndefined();
    expect(cal.books.some((b) => b.id === "audio")).toBe(false);
    // Only audiobooks were ever timed: then nothing was.
    const onlyAudio = buildCalendar({
      logDays: [],
      dayMinutes: [dayMinutes[1]],
      books,
      statsAudiobooks: "out",
    });
    expect(onlyAudio.timed).toBe(false);
  });

  it("lists the daily goal's days in order", () => {
    const cal = buildCalendar({
      logDays,
      dayMinutes: [],
      books,
      statsAudiobooks: "full",
      goalDays: new Set(["2026-03-02", "2026-03-01"]),
    });
    expect(cal.goalDays).toEqual(["2026-03-01", "2026-03-02"]);
    expect(cal.timed).toBe(false);
  });
});

describe("windows", () => {
  it("covers the last 365 days, or one whole year", () => {
    expect(windowRange("recent", "2026-11-12")).toEqual({
      from: "2025-11-13",
      to: "2026-11-12",
      last: "2026-11-12",
    });
    expect(windowRange(2026, "2026-11-12")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
      last: "2026-11-12",
    });
    expect(windowRange(2024, "2026-11-12")).toEqual({
      from: "2024-01-01",
      to: "2024-12-31",
      last: "2024-12-31",
    });
  });

  it("offers this year and every year read in, newest first", () => {
    expect(calendarYears(["2023-05-01", "2025-01-01", "2023-06-01"], "2026-02-01")).toEqual([
      2026, 2025, 2023,
    ]);
    expect(calendarYears([], "2026-02-01")).toEqual([2026]);
  });

  it("lays the window out in whole weeks from the reader's first weekday", () => {
    // 1 January 2026 is a Thursday.
    const range = windowRange(2026, "2026-12-31");
    const monday = calendarWeeks(range, "monday");
    expect(monday[0][0]).toBe("2025-12-29");
    expect(monday[0][3]).toBe("2026-01-01");
    expect(monday.at(-1)![0]).toBe("2026-12-28");
    expect(monday.every((w) => w.length === 7)).toBe(true);
    expect(monday).toHaveLength(53);
    const sunday = calendarWeeks(range, "sunday");
    expect(sunday[0][0]).toBe("2025-12-28");
    expect(sunday.at(-1)!.at(-1)).toBe("2027-01-02");
  });

  it("names each month over the column holding its first day", () => {
    const range = windowRange(2026, "2026-12-31");
    const months = monthColumns(calendarWeeks(range, "monday"), range);
    expect(months[0]).toBe(0);
    expect(months.filter((m) => m !== null)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // February 2026 starts on a Sunday, the last day of week 5.
    expect(months[4]).toBe(1);
  });

  it("names a month the window starts partway through only when there's room", () => {
    // From 13 November: November gets the first column, December's name
    // comes three columns later.
    const recent = windowRange("recent", "2026-11-12");
    const months = monthColumns(calendarWeeks(recent, "monday"), recent);
    expect(months[0]).toBe(10);
    // From 25 November there's no room before December.
    const late = windowRange("recent", "2026-11-24");
    const lateMonths = monthColumns(calendarWeeks(late, "monday"), late);
    expect(lateMonths[0]).toBeNull();
    expect(lateMonths[1]).toBe(11);
  });
});

describe("streaks", () => {
  const days = [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-10",
    "2025-12-30",
    "2025-12-31",
    "2026-01-02", // twice is once
    "2026-01-20",
    "2026-01-21",
  ];
  const runs = streakRuns(days);

  it("finds every run of days in a row, across the new year", () => {
    expect(runs).toEqual([
      { from: "2025-12-30", to: "2026-01-03", days: 5 },
      { from: "2026-01-10", to: "2026-01-10", days: 1 },
      { from: "2026-01-20", to: "2026-01-21", days: 2 },
    ]);
    expect(streakRuns([])).toEqual([]);
  });

  it("picks the longest, the latest of equals", () => {
    expect(longestRun(runs)).toEqual(runs[0]);
    expect(longestRun(streakRuns(["2026-01-01", "2026-01-05"]))!.from).toBe("2026-01-05");
    expect(longestRun([])).toBeNull();
  });

  it("cuts runs at the window's edges", () => {
    const range = windowRange(2026, "2026-01-20");
    expect(runsIn(runs, range)).toEqual([
      { from: "2026-01-01", to: "2026-01-03", days: 3 },
      { from: "2026-01-10", to: "2026-01-10", days: 1 },
      // Tomorrow hasn't happened: the window ends today.
      { from: "2026-01-20", to: "2026-01-20", days: 1 },
    ]);
    expect(runsIn(runs, windowRange(2024, "2026-01-20"))).toEqual([]);
  });

  it("keeps the current streak alive until today is over", () => {
    expect(currentRun(runs, "2026-01-21")).toEqual({ ...runs[2], waiting: false });
    expect(currentRun(runs, "2026-01-22")).toEqual({ ...runs[2], waiting: true });
    expect(currentRun(runs, "2026-01-23")).toBeNull();
    expect(currentRun([], "2026-01-23")).toBeNull();
  });

  it("files a run under the year most of it is in", () => {
    expect(runYear(runs[0])).toBe(2026);
    expect(runYear({ from: "2025-12-01", to: "2026-01-02", days: 33 })).toBe(2025);
    expect(runYear({ from: "2025-03-01", to: "2025-03-09", days: 9 })).toBe(2025);
  });

  it("lists a run's days", () => {
    expect(runDays(runs[0])).toEqual([
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(3);
  });
});
