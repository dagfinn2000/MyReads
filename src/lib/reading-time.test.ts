import { describe, expect, it } from "vitest";
import type { UnitInfo } from "@/lib/progress-units";
import {
  MAX_ENTRY_MINUTES,
  elapsedMs,
  formatClock,
  minutesInWindow,
  minutesLeft,
  pagesPerHour,
  parseTimer,
  pauseTimer,
  resumeTimer,
  roughLength,
  speedText,
  startTimer,
  stopTimer,
  timerMinutes,
  totalMinutes,
} from "@/lib/reading-time";

const MIN = 60_000;

const pages: UnitInfo = { unit: "page", wanted: "page", pageCount: 400, lengthMinutes: null, fallback: null };
const percent: UnitInfo = { ...pages, unit: "percent", wanted: "percent" };
const time: UnitInfo = { ...pages, unit: "time", wanted: "time", lengthMinutes: 600 };

describe("the timer", () => {
  it("counts from the start while running", () => {
    const t = startTimer(1_000);
    expect(elapsedMs(t, 1_000 + 5 * MIN)).toBe(5 * MIN);
  });

  it("keeps what was read before a pause, and stops counting while paused", () => {
    let t = startTimer(0);
    t = pauseTimer(t, 10 * MIN);
    expect(elapsedMs(t, 30 * MIN)).toBe(10 * MIN);
    t = resumeTimer(t, 30 * MIN);
    expect(elapsedMs(t, 35 * MIN)).toBe(15 * MIN);
  });

  it("resuming a running timer changes nothing", () => {
    const t = startTimer(0);
    expect(resumeTimer(t, 5 * MIN)).toBe(t);
  });

  it("stopping freezes the time and marks it waiting to be logged", () => {
    const t = stopTimer(startTimer(0), 23 * MIN);
    expect(t).toEqual({ runningSince: null, banked: 23 * MIN, stopped: true });
    expect(elapsedMs(t, 99 * MIN)).toBe(23 * MIN);
  });

  it("never counts backwards when the clock is behind the start", () => {
    expect(elapsedMs(startTimer(10 * MIN), 5 * MIN)).toBe(0);
  });

  it("rounds to whole minutes, at least one and at most a day", () => {
    expect(timerMinutes(10_000)).toBe(1);
    expect(timerMinutes(22.6 * MIN)).toBe(23);
    expect(timerMinutes(40 * 60 * MIN)).toBe(MAX_ENTRY_MINUTES);
  });

  it("shows a clock with hours only when there are some", () => {
    expect(formatClock(7_000)).toBe("0:07");
    expect(formatClock(12 * MIN + 34_000)).toBe("12:34");
    expect(formatClock(62 * MIN + 3_000)).toBe("1:02:03");
  });

  it("reads back what it stored, and nothing else", () => {
    const t = { runningSince: 5, banked: 10, stopped: false };
    expect(parseTimer(JSON.stringify(t))).toEqual(t);
    expect(parseTimer(null)).toBeNull();
    expect(parseTimer("not json")).toBeNull();
    expect(parseTimer('{"runningSince":"soon","banked":0}')).toBeNull();
    expect(parseTimer('{"runningSince":null,"banked":-4}')).toBeNull();
    // A running timer can't also be stopped.
    expect(parseTimer('{"runningSince":5,"banked":0,"stopped":true}')?.stopped).toBe(false);
  });
});

describe("speed and time left", () => {
  const pass = [
    { page: 0, minutes: null },
    { page: 40, minutes: 60 },
    { page: 60, minutes: null }, // untimed: left out
    { page: 100, minutes: 30 },
  ];

  it("divides the pages of timed stretches by their time", () => {
    // 40 pages in 60 min, then 40 in 30: 80 pages in 90 minutes.
    expect(pagesPerHour(pass)).toBeCloseTo(53.33, 1);
    expect(totalMinutes(pass)).toBe(90);
  });

  it("gives no speed for too little timed reading, or no pages", () => {
    expect(pagesPerHour([{ page: 0 }, { page: 5, minutes: 4 }])).toBeNull();
    expect(pagesPerHour([{ page: 10 }, { page: 10, minutes: 30 }])).toBeNull();
    // A timed first entry has nothing before it to measure from.
    expect(pagesPerHour([{ page: 40, minutes: 60 }])).toBeNull();
  });

  it("works out the time left from the speed", () => {
    expect(minutesLeft(100, 400, 60)).toBe(300);
    expect(minutesLeft(400, 400, 60)).toBeNull();
    expect(minutesLeft(100, null, 60)).toBeNull();
  });

  it("rounds the time left the way a person would say it", () => {
    expect(roughLength(24.4)).toBe("24 min");
    expect(roughLength(0.2)).toBe("1 min");
    expect(roughLength(251)).toBe("4 h 10 min");
    expect(roughLength(119)).toBe("2 h");
  });

  it("says the speed and what's left in the book's unit", () => {
    const read = [{ page: 0 }, { page: 40, minutes: 60 }, { page: 100, minutes: 90 }];
    expect(speedText(read, pages)).toBe("about 40 pages an hour · 7 h 30 min to go");
    expect(speedText(read, percent)).toBe("about 10% an hour · 7 h 30 min to go");
    // An audiobook going by time plays at its own speed.
    expect(speedText(read, time)).toBeNull();
    expect(speedText([{ page: 0 }, { page: 5 }], pages)).toBeNull();
  });
});

describe("minutesInWindow", () => {
  const byDay = new Map([
    ["2025-12-31", 30],
    ["2026-01-01", 45],
    ["2026-06-10", 20],
  ]);

  it("adds up the minutes and days inside the window", () => {
    expect(minutesInWindow(byDay, { from: "2026-01-01", to: "2026-12-31" })).toEqual({
      minutes: 65,
      days: 2,
    });
    expect(minutesInWindow(byDay, { from: null, to: null })).toEqual({ minutes: 95, days: 3 });
    expect(minutesInWindow(new Map(), { from: null, to: null })).toEqual({ minutes: 0, days: 0 });
  });
});
