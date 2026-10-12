import { describe, expect, it } from "vitest";
import {
  BACKUP_DUE_DAYS,
  backupAgeDays,
  backupAgeText,
  backupReminderMessage,
  backupReminderText,
  backupStatusText,
  isBackupDue,
} from "@/lib/backup";

const DAY = 86_400_000;
const NOW = new Date("2026-10-12T12:00:00.000Z");
const ago = (days: number, ms = 0) => new Date(NOW.getTime() - days * DAY - ms);

describe("isBackupDue", () => {
  it("is due with no download on record", () => {
    expect(isBackupDue(null, NOW)).toBe(true);
  });

  it("is due from 30 whole days on", () => {
    expect(BACKUP_DUE_DAYS).toBe(30);
    expect(isBackupDue(ago(29), NOW)).toBe(false);
    expect(isBackupDue(ago(30, -1), NOW)).toBe(false);
    expect(isBackupDue(ago(30), NOW)).toBe(true);
    expect(isBackupDue(ago(31), NOW)).toBe(true);
  });

  it("is not due for a date in the future", () => {
    expect(isBackupDue(ago(-3), NOW)).toBe(false);
  });
});

describe("backupAgeDays", () => {
  it("counts calendar days in the reader's zone", () => {
    // 23:30 and 00:30 the next day in Oslo; the same day in UTC.
    const last = new Date("2026-03-10T22:30:00.000Z");
    const now = new Date("2026-03-10T23:30:00.000Z");
    expect(backupAgeDays(last, now, "Europe/Oslo")).toBe(1);
    expect(backupAgeDays(last, now, "UTC")).toBe(0);
  });

  it("reads the download's day the way its date is shown", () => {
    // Exactly midnight UTC reads as that date everywhere (see calendarDay),
    // so in New York it is the 11th, and a day before the 12th.
    const last = new Date("2026-10-11T00:00:00.000Z");
    expect(backupAgeDays(last, NOW, "America/New_York")).toBe(1);
    expect(backupStatusText(last, NOW, { timeZone: "America/New_York" })).toBe(
      "Last downloaded 11 Oct 2026 · yesterday",
    );
  });

  it("is never negative", () => {
    expect(backupAgeDays(ago(-2), NOW, "UTC")).toBe(0);
  });
});

describe("backupAgeText", () => {
  it("says today, yesterday or how many days", () => {
    expect(backupAgeText(0)).toBe("today");
    expect(backupAgeText(1)).toBe("yesterday");
    expect(backupAgeText(42)).toBe("42 days ago");
    expect(backupAgeText(1234, { numberFormat: "space" })).toBe("1 234 days ago");
  });
});

describe("backupStatusText", () => {
  const prefs = { dateFormat: "d-mmm-y", timeZone: "UTC" } as const;

  it("has no date for an account that never downloaded one here", () => {
    expect(backupStatusText(null, NOW, prefs)).toBe("No download on record yet");
  });

  it("gives the date in the reader's format, and how long ago", () => {
    expect(backupStatusText(new Date("2026-09-03T08:00:00.000Z"), NOW, prefs)).toBe(
      "Last downloaded 3 Sep 2026 · 39 days ago",
    );
    expect(backupStatusText(ago(0, 60_000), NOW, prefs)).toBe(
      "Last downloaded 12 Oct 2026 · today",
    );
    expect(backupStatusText(ago(1), NOW, { ...prefs, dateFormat: "iso" })).toBe(
      "Last downloaded 2026-10-11 · yesterday",
    );
  });
});

describe("backupReminderText", () => {
  it("covers both cases", () => {
    expect(backupReminderText(null, NOW, { timeZone: "UTC" })).toBe(
      "No backup download on record yet.",
    );
    expect(backupReminderText(ago(42), NOW, { timeZone: "UTC" })).toBe(
      "Your last backup was 42 days ago.",
    );
  });
});

describe("backupReminderMessage", () => {
  const base = {
    reminder: "monthly",
    lastBackupAt: ago(42),
    snoozedBy: undefined,
    userId: "me",
    now: NOW,
    prefs: { timeZone: "UTC" },
  } as const;

  it("shows when on, due and not snoozed", () => {
    expect(backupReminderMessage(base)).toBe("Your last backup was 42 days ago.");
    expect(backupReminderMessage({ ...base, lastBackupAt: null })).toBe(
      "No backup download on record yet.",
    );
  });

  it("stays away with the reminder off", () => {
    expect(backupReminderMessage({ ...base, reminder: "off" })).toBeNull();
  });

  it("stays away when the last backup is recent", () => {
    expect(backupReminderMessage({ ...base, lastBackupAt: ago(3) })).toBeNull();
  });

  it("stays away when this account said Not now", () => {
    expect(backupReminderMessage({ ...base, snoozedBy: "me" })).toBeNull();
  });

  it("still shows when another account in the browser said Not now", () => {
    expect(backupReminderMessage({ ...base, snoozedBy: "someone-else" })).toBe(
      "Your last backup was 42 days ago.",
    );
  });
});
