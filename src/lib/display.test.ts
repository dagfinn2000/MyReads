import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatFileSize,
  formatNumber,
  formatShortDay,
  formatWeekdayDay,
  toDateInputValue,
} from "@/lib/display";

describe("formatDate", () => {
  const d = new Date("2024-05-02T00:00:00.000Z");

  it("defaults to day, short month, year", () => {
    expect(formatDate(d)).toBe("2 May 2024");
  });

  it("follows the chosen format", () => {
    expect(formatDate(d, { dateFormat: "mmm-d-y" })).toBe("May 2, 2024");
    expect(formatDate(d, { dateFormat: "dd.mm.y" })).toBe("02.05.2024");
    expect(formatDate(d, { dateFormat: "dd/mm/y" })).toBe("02/05/2024");
    expect(formatDate(d, { dateFormat: "mm/dd/y" })).toBe("05/02/2024");
    expect(formatDate(d, { dateFormat: "iso" })).toBe("2024-05-02");
  });

  it("puts a timestamp on the reader's day", () => {
    const late = new Date("2024-05-02T22:00:00.000Z");
    expect(formatDate(late, { timeZone: "Asia/Tokyo", dateFormat: "iso" })).toBe("2024-05-03");
    expect(formatDate(late, { timeZone: "America/Chicago", dateFormat: "iso" })).toBe(
      "2024-05-02",
    );
  });

  it("is empty for no date", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("toDateInputValue", () => {
  it("matches the day formatDate shows", () => {
    const late = new Date("2024-05-02T22:00:00.000Z");
    expect(toDateInputValue(late, "Asia/Tokyo")).toBe("2024-05-03");
    expect(toDateInputValue(new Date("2024-05-02T00:00:00.000Z"), "Asia/Tokyo")).toBe(
      "2024-05-02",
    );
  });
});

describe("formatNumber", () => {
  it("groups thousands the chosen way", () => {
    expect(formatNumber(12345)).toBe("12,345");
    expect(formatNumber(12345, { numberFormat: "period" })).toBe("12.345");
    // Norwegian grouping uses a no-break space.
    expect(formatNumber(12345, { numberFormat: "space" }).replace(/\s/g, " ")).toBe("12 345");
  });
});

describe("formatFileSize", () => {
  it("counts bytes, then KB, MB and GB in 1,024s", () => {
    expect(formatFileSize(0)).toBe("0 bytes");
    expect(formatFileSize(830)).toBe("830 bytes");
    expect(formatFileSize(1023)).toBe("1,023 bytes");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(64 * 1024 + 300)).toBe("64 KB");
    expect(formatFileSize(1.25 * 1024 * 1024)).toBe("1.3 MB");
    expect(formatFileSize(3 * 1024 ** 3)).toBe("3 GB");
  });

  it("moves up a unit rather than show 1,024 of one", () => {
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1 MB");
    expect(formatFileSize(1023.4 * 1024)).toBe("1,023 KB");
  });

  it("keeps one decimal only below 10", () => {
    expect(formatFileSize(9.94 * 1024)).toBe("9.9 KB");
    expect(formatFileSize(9.96 * 1024)).toBe("10 KB");
    expect(formatFileSize(12.6 * 1024 * 1024)).toBe("13 MB");
  });

  it("writes the decimal mark the chosen way", () => {
    expect(formatFileSize(1.5 * 1024 * 1024, { numberFormat: "period" })).toBe("1,5 MB");
    expect(formatFileSize(1.5 * 1024 * 1024, { numberFormat: "space" })).toBe("1,5 MB");
    expect(formatFileSize(1500, { numberFormat: "period" })).toBe("1,5 KB");
  });
});

describe("formatWeekdayDay", () => {
  const d = new Date("2026-10-12T10:00:00.000Z");

  it("names the weekday and month", () => {
    expect(formatWeekdayDay(d, { timeZone: "UTC" })).toBe("Monday 12 October");
  });

  it("puts the month first for month-first date styles", () => {
    expect(formatWeekdayDay(d, { timeZone: "UTC", dateFormat: "mmm-d-y" })).toBe("Monday, October 12");
    expect(formatWeekdayDay(d, { timeZone: "UTC", dateFormat: "mm/dd/y" })).toBe("Monday, October 12");
  });

  it("follows the reader's zone across midnight", () => {
    const late = new Date("2026-10-12T23:30:00.000Z");
    expect(formatWeekdayDay(late, { timeZone: "Asia/Tokyo" })).toBe("Tuesday 13 October");
    expect(formatWeekdayDay(late, { timeZone: "America/New_York" })).toBe("Monday 12 October");
  });
});

describe("formatShortDay", () => {
  it("abbreviates for a menu", () => {
    expect(formatShortDay("2026-10-10")).toBe("Sat 10 Oct");
    expect(formatShortDay("2026-10-10", "mmm-d-y")).toBe("Sat, Oct 10");
  });
});
