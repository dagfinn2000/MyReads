import { describe, expect, it } from "vitest";
import { BookFormat, ReadingStatus } from "@prisma/client";
import {
  DAY_MS,
  chartPaceText,
  forecast,
  nowReadingPaceText,
  paceAmount,
  pagesPerDay,
} from "@/lib/pace";
import { unitFor } from "@/lib/progress-units";

const TZ = "Europe/Oslo";
const p = (page: number, iso: string) => ({ page, date: new Date(iso) });
// Noon in Oslo, 12 Oct 2026.
const now = new Date("2026-10-12T10:00:00Z");
const pages = (pageCount: number | null) =>
  unitFor({ format: BookFormat.PHYSICAL, pageCount, lengthMinutes: null }, {
    ebookUnit: "page",
    audiobookUnit: "page",
  });
const prefs = { timeZone: TZ };

describe("pagesPerDay over the whole read", () => {
  it("matches the old sparkline numbers", () => {
    const pass = [p(0, "2026-10-01T10:00:00Z"), p(120, "2026-10-04T10:00:00Z"), p(300, "2026-10-11T10:00:00Z")];
    expect(pagesPerDay(pass, "read", now, TZ)).toBe(30); // 300 pages over 10 days
  });

  it("floors a same-day pass to one day", () => {
    const pass = [p(0, "2026-10-12T08:00:00Z"), p(40, "2026-10-12T09:00:00Z")];
    expect(pagesPerDay(pass, "read", now, TZ)).toBe(40);
  });

  it("has no pace with one entry or nothing gained", () => {
    expect(pagesPerDay([p(0, "2026-10-12T08:00:00Z")], "read", now, TZ)).toBeNull();
    expect(pagesPerDay([p(50, "2026-10-01T08:00:00Z"), p(40, "2026-10-02T08:00:00Z")], "read", now, TZ)).toBeNull();
  });
});

describe("pagesPerDay over recent days", () => {
  const pass = [
    p(0, "2026-09-01T10:00:00Z"),
    p(200, "2026-09-20T10:00:00Z"),
    // The last 7 days in Oslo run 6–12 Oct.
    p(230, "2026-10-05T21:30:00Z"), // 23:30 on the 5th in Oslo: outside
    p(260, "2026-10-06T08:00:00Z"),
    p(250, "2026-10-08T08:00:00Z"), // a correction downwards credits nothing
    p(290, "2026-10-11T08:00:00Z"),
  ];

  it("sums only increases inside the window, in the reader's zone", () => {
    // 30 (6th) + 40 (11th) = 70 over 7 days
    expect(pagesPerDay(pass, "7d", now, TZ)).toBe(10);
  });

  it("divides a young read by its own age", () => {
    const young = [p(0, "2026-10-10T06:00:00Z"), p(90, "2026-10-12T06:00:00Z")];
    expect(pagesPerDay(young, "14d", now, TZ)).toBe(30); // 3 days
  });

  it("reads a typed start date as its calendar day", () => {
    const typed = [p(0, "2026-10-10T00:00:00Z"), p(90, "2026-10-12T06:00:00Z")];
    expect(pagesPerDay(typed, "7d", now, "America/Los_Angeles")).toBe(30);
  });

  it("is 0 after a break", () => {
    const paused = [p(0, "2026-08-01T10:00:00Z"), p(100, "2026-08-10T10:00:00Z")];
    expect(pagesPerDay(paused, "7d", now, TZ)).toBe(0);
  });
});

describe("forecast", () => {
  const last = new Date("2026-10-10T10:00:00Z");

  it("counts from the last entry for the whole read and from now for a window", () => {
    expect(forecast(200, 300, 10, "read", last, now)).toEqual({
      daysLeft: 10,
      finish: new Date(last.getTime() + 10 * DAY_MS),
      overAYear: false,
    });
    expect(forecast(200, 300, 10, "7d", last, now)?.finish).toEqual(new Date(now.getTime() + 10 * DAY_MS));
  });

  it("flags a finish more than a year out instead of dropping it", () => {
    expect(forecast(0, 400, 1, "read", last, now)).toMatchObject({ daysLeft: 400, overAYear: true });
  });

  it("has nothing to say without a page count, a pace or pages left", () => {
    expect(forecast(10, null, 5, "read", last, now)).toBeNull();
    expect(forecast(10, 300, 0, "7d", last, now)).toBeNull();
    expect(forecast(300, 300, 5, "read", last, now)).toBeNull();
  });
});

describe("paceAmount", () => {
  it("speaks pages", () => {
    expect(paceAmount(34.4, pages(400))).toBe("about 34 pages a day");
    expect(paceAmount(3.46, pages(400))).toBe("about 3.5 pages a day");
    expect(paceAmount(0.01, pages(400))).toBe("about 0.1 pages a day");
    expect(paceAmount(1, pages(400))).toBe("about 1 page a day");
  });

  it("speaks percent and time", () => {
    const ebook = unitFor({ format: BookFormat.EBOOK, pageCount: 389, lengthMinutes: null }, {
      ebookUnit: "percent",
      audiobookUnit: "page",
    });
    expect(paceAmount(23, ebook)).toBe("about 5.9% a day");
    const audio = unitFor({ format: BookFormat.AUDIOBOOK, pageCount: 476, lengthMinutes: 970 }, {
      ebookUnit: "page",
      audiobookUnit: "time",
    });
    expect(paceAmount(23.5, audio)).toBe("about 48 min a day");
    expect(paceAmount(35.3, audio)).toBe("about 1 h 12 min a day");
    expect(paceAmount(29.45, audio)).toBe("about 1 h a day");
  });
});

describe("chartPaceText", () => {
  const pass = [p(0, "2026-10-01T10:00:00Z"), p(300, "2026-10-11T10:00:00Z")];

  it("gives the pace and finish date while reading", () => {
    expect(
      chartPaceText({ status: ReadingStatus.READING, pass, info: pages(600), from: "read", now, prefs }),
    ).toBe("about 30 pages a day · on pace to finish 21 Oct 2026");
  });

  it("names the window and says when nothing was read in it", () => {
    const text = chartPaceText({ status: ReadingStatus.READING, pass, info: pages(600), from: "7d", now, prefs });
    expect(text).toMatch(/^about 43 pages a day, last 7 days · on pace to finish /);
    const old = [p(0, "2026-08-01T10:00:00Z"), p(100, "2026-08-10T10:00:00Z")];
    expect(
      chartPaceText({ status: ReadingStatus.READING, pass: old, info: pages(600), from: "7d", now, prefs }),
    ).toBe("No reading in the last 7 days");
  });

  it("says more than a year rather than nothing", () => {
    const slow = [p(0, "2026-01-01T10:00:00Z"), p(10, "2026-10-11T10:00:00Z")];
    expect(
      chartPaceText({ status: ReadingStatus.READING, pass: slow, info: pages(900), from: "read", now, prefs }),
    ).toBe("about 0.1 pages a day · more than a year to go at this pace");
  });

  it("leaves out the forecast without a page count", () => {
    expect(
      chartPaceText({ status: ReadingStatus.READING, pass, info: pages(null), from: "read", now, prefs }),
    ).toBe("about 30 pages a day");
  });

  it("always uses the whole read for a finished book", () => {
    expect(
      chartPaceText({ status: ReadingStatus.READ, pass, info: pages(300), from: "7d", now, prefs }),
    ).toBe("about 30 pages a day over 10 days");
    const oneDay = [p(0, "2026-10-11T08:00:00Z"), p(300, "2026-10-11T20:00:00Z")];
    expect(
      chartPaceText({ status: ReadingStatus.READ, pass: oneDay, info: pages(300), from: "read", now, prefs }),
    ).toBe("about 300 pages a day over 1 day");
  });
});

describe("nowReadingPaceText", () => {
  it("counts the days left", () => {
    const pass = [p(0, "2026-10-01T10:00:00Z"), p(300, "2026-10-11T10:00:00Z")];
    expect(nowReadingPaceText({ pass, info: pages(630), from: "read", now, prefs })).toBe(
      "about 30 pages a day · 11 days left",
    );
    expect(nowReadingPaceText({ pass, info: pages(320), from: "read", now, prefs })).toBe(
      "about 30 pages a day · 1 day left",
    );
  });

  it("says over a year, and asks for entries when there's no pace", () => {
    const slow = [p(0, "2026-01-01T10:00:00Z"), p(10, "2026-10-11T10:00:00Z")];
    expect(nowReadingPaceText({ pass: slow, info: pages(900), from: "read", now, prefs })).toBe(
      "about 0.1 pages a day · over a year left",
    );
    expect(
      nowReadingPaceText({ pass: [p(0, "2026-10-11T10:00:00Z")], info: pages(300), from: "read", now, prefs }),
    ).toBe("No pace yet. Log a page or two.");
  });
});
