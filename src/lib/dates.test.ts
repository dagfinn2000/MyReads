import { describe, expect, it } from "vitest";
import { calendarDay, dayKey, shiftDayKey } from "@/lib/dates";

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
