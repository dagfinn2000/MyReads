import { describe, expect, it } from "vitest";
import {
  calendarDay,
  dayKey,
  endOfZonedDay,
  shiftDayKey,
  zonedDayStart,
} from "@/lib/dates";

describe("dayKey", () => {
  // 03:30 UTC on 2 March: still the 1st in New York, already the 2nd in Tokyo.
  const moment = new Date("2026-03-02T03:30:00Z");

  it("reads a moment in the given zone", () => {
    expect(dayKey(moment, "America/New_York")).toBe("2026-03-01");
    expect(dayKey(moment, "Asia/Tokyo")).toBe("2026-03-02");
    expect(dayKey(moment, "UTC")).toBe("2026-03-02");
  });
});

describe("shiftDayKey", () => {
  it("steps across month, year and leap-day boundaries", () => {
    expect(shiftDayKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDayKey("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is unaffected by daylight-saving changes", () => {
    // Europe and the US both change clocks in March.
    expect(shiftDayKey("2026-03-28", 1)).toBe("2026-03-29");
    expect(shiftDayKey("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("calendarDay", () => {
  it("reads a typed date (midnight UTC) as that day everywhere", () => {
    const typed = new Date("2026-05-12T00:00:00.000Z");
    expect(calendarDay(typed, "America/Los_Angeles")).toBe("2026-05-12");
    expect(calendarDay(typed, "Pacific/Auckland")).toBe("2026-05-12");
  });

  it("reads any other moment in the reader's zone", () => {
    const evening = new Date("2026-05-12T23:30:00.000Z");
    expect(calendarDay(evening, "America/Los_Angeles")).toBe("2026-05-12");
    expect(calendarDay(evening, "Europe/Oslo")).toBe("2026-05-13");
  });
});

describe("zonedDayStart", () => {
  const iso = (key: string, tz: string) => zonedDayStart(key, tz).toISOString();

  it("is local midnight as an instant", () => {
    expect(iso("2026-01-15", "UTC")).toBe("2026-01-15T00:00:00.000Z");
    expect(iso("2026-01-15", "Europe/Oslo")).toBe("2026-01-14T23:00:00.000Z");
    expect(iso("2026-07-01", "Europe/Oslo")).toBe("2026-06-30T22:00:00.000Z");
    expect(iso("2026-01-15", "America/New_York")).toBe("2026-01-15T05:00:00.000Z");
    expect(iso("2026-01-15", "Asia/Tokyo")).toBe("2026-01-14T15:00:00.000Z");
    expect(iso("2026-01-01", "Pacific/Kiritimati")).toBe("2025-12-31T10:00:00.000Z");
  });

  it("handles the days the clocks change", () => {
    // Oslo springs forward at 02:00 on 29 March and falls back on 25 October.
    expect(iso("2026-03-29", "Europe/Oslo")).toBe("2026-03-28T23:00:00.000Z");
    expect(iso("2026-03-30", "Europe/Oslo")).toBe("2026-03-29T22:00:00.000Z");
    expect(iso("2026-10-26", "Europe/Oslo")).toBe("2026-10-25T23:00:00.000Z");
    expect(iso("2026-11-01", "America/New_York")).toBe("2026-11-01T04:00:00.000Z");
  });

  it("falls on the day it was asked for", () => {
    for (const tz of ["Europe/Oslo", "America/New_York", "Asia/Tokyo", "Pacific/Kiritimati"]) {
      expect(dayKey(zonedDayStart("2026-03-29", tz), tz)).toBe("2026-03-29");
      expect(dayKey(new Date(zonedDayStart("2026-03-29", tz).getTime() - 1), tz)).toBe(
        "2026-03-28",
      );
    }
  });

  it("ends a millisecond before the next day starts", () => {
    expect(endOfZonedDay("2026-03-28", "Europe/Oslo").toISOString()).toBe(
      "2026-03-28T22:59:59.999Z",
    );
  });
});
