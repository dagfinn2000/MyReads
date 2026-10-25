import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, parsePreferences } from "@/lib/preferences";
import {
  REMINDER_TIMES,
  deviceLabel,
  formatClock,
  parseReminderDays,
  reminderDaysText,
  reminderDue,
  reminderMessage,
  weekdaysInOrder,
} from "@/lib/reminders";

const everyDay = { time: "20:00", days: [0, 1, 2, 3, 4, 5, 6] };
const at = (iso: string) => new Date(iso);

describe("reminderDue", () => {
  // 25 October 2026 is a Sunday, the day Oslo goes back to UTC+1.
  it("is due from the chosen time, in the reader's zone, for an hour", () => {
    expect(reminderDue(everyDay, null, at("2026-10-25T18:59:00Z"), "Europe/Oslo")).toBeNull();
    expect(reminderDue(everyDay, null, at("2026-10-25T19:00:00Z"), "Europe/Oslo")).toBe("2026-10-25");
    expect(reminderDue(everyDay, null, at("2026-10-25T19:59:00Z"), "Europe/Oslo")).toBe("2026-10-25");
    expect(reminderDue(everyDay, null, at("2026-10-25T20:00:00Z"), "Europe/Oslo")).toBeNull();
  });

  it("counts the day where the reader is, not where the server is", () => {
    // 20:05 on Sunday in New York is already Monday in UTC.
    expect(reminderDue(everyDay, null, at("2026-10-26T00:05:00Z"), "America/New_York")).toBe("2026-10-25");
    expect(reminderDue(everyDay, null, at("2026-10-26T00:05:00Z"), "UTC")).toBeNull();
  });

  it("goes once a day", () => {
    expect(reminderDue(everyDay, "2026-10-25", at("2026-10-25T19:10:00Z"), "Europe/Oslo")).toBeNull();
    expect(reminderDue(everyDay, "2026-10-24", at("2026-10-25T19:10:00Z"), "Europe/Oslo")).toBe("2026-10-25");
  });

  it("only on the chosen days", () => {
    const weekdays = { time: "20:00", days: [1, 2, 3, 4, 5] };
    expect(reminderDue(weekdays, null, at("2026-10-25T19:10:00Z"), "Europe/Oslo")).toBeNull();
    expect(reminderDue(weekdays, null, at("2026-10-26T19:10:00Z"), "Europe/Oslo")).toBe("2026-10-26");
  });

  it("comes through the clocks changing", () => {
    const late = { time: "02:30", days: [0] };
    // Spring: 02:30 never happens in Oslo on 28 March 2027; it comes at 03:00.
    expect(reminderDue(late, null, at("2027-03-28T00:59:00Z"), "Europe/Oslo")).toBeNull();
    expect(reminderDue(late, null, at("2027-03-28T01:00:00Z"), "Europe/Oslo")).toBe("2027-03-28");
    // Autumn: 02:30 happens twice, and the second finds the day taken.
    expect(reminderDue(late, null, at("2026-10-25T00:30:00Z"), "Europe/Oslo")).toBe("2026-10-25");
    expect(reminderDue(late, "2026-10-25", at("2026-10-25T01:30:00Z"), "Europe/Oslo")).toBeNull();
  });
});

describe("the reminder settings", () => {
  it("are every day at eight by default, and skip a day already read", () => {
    expect(DEFAULT_PREFERENCES.reminderTime).toBe("20:00");
    expect(DEFAULT_PREFERENCES.reminderDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(DEFAULT_PREFERENCES.reminderSkipIfRead).toBe(true);
  });

  it("keep only times on the half hour, and real days, each once", () => {
    expect(REMINDER_TIMES).toHaveLength(48);
    expect(REMINDER_TIMES[0]).toBe("00:00");
    expect(REMINDER_TIMES[47]).toBe("23:30");
    expect(parsePreferences({ reminderTime: "07:30" }).reminderTime).toBe("07:30");
    expect(parsePreferences({ reminderTime: "07:15" }).reminderTime).toBe("20:00");
    expect(parsePreferences({ reminderTime: 730 }).reminderTime).toBe("20:00");
    expect(parseReminderDays([5, 1, 1, 9, -1, 2.5, "3"])).toEqual([1, 5]);
    expect(parseReminderDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseReminderDays("weekdays")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parsePreferences({ reminderSkipIfRead: false }).reminderSkipIfRead).toBe(false);
  });

  it("read the days the reader's way", () => {
    expect(weekdaysInOrder("monday")).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(reminderDaysText([0, 1, 2, 3, 4, 5, 6], "monday")).toBe("Every day");
    expect(reminderDaysText([1, 2, 3, 4, 5], "monday")).toBe("Weekdays");
    expect(reminderDaysText([0, 6], "monday")).toBe("Weekends");
    expect(reminderDaysText([0, 3], "monday")).toBe("Wed, Sun");
    expect(reminderDaysText([0, 3], "sunday")).toBe("Sun, Wed");
  });

  it("show the time on a 24-hour clock, or the American way", () => {
    expect(formatClock("20:00", "d-mmm-y")).toBe("20:00");
    expect(formatClock("20:30", "mm/dd/y")).toBe("8:30 pm");
    expect(formatClock("00:00", "mmm-d-y")).toBe("12:00 am");
    expect(formatClock("12:00", "mmm-d-y")).toBe("12:00 pm");
  });
});

describe("reminderMessage", () => {
  it("names the book, where the reader is, and what's left of the goal", () => {
    expect(
      reminderMessage({ book: { title: "Dune", place: "page 120 of 412" }, goalLeft: "20 pages" }),
    ).toEqual({
      title: "Time to read",
      body: "Dune · page 120 of 412\n20 pages to go for today's goal",
      url: "/reading",
    });
    expect(reminderMessage({ book: { title: "Dune", place: null }, goalLeft: null }).body).toBe("Dune");
    expect(reminderMessage({ book: null, goalLeft: null }).body).toBe("Pick up where you left off.");
  });
});

describe("deviceLabel", () => {
  it("names the browser and what it runs on", () => {
    expect(
      deviceLabel("Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0"),
    ).toBe("Firefox on Linux");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iPhone");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome on Android");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0",
      ),
    ).toBe("Edge on Windows");
    expect(deviceLabel(null)).toBe("A browser");
  });
});
