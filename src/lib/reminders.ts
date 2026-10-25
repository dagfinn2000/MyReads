import { dayKey, keyToUtcDate, zoneOffset } from "@/lib/dates";
import type { DateFormat } from "@/lib/preferences";

/**
 * Reading reminders (Preferences › Reading reminders): a notification on
 * the reader's phone or computer at the time they choose, on the days they
 * choose, and by default not on a day they have already read. The server
 * looks every few minutes (lib/reminders-run.ts) and sends at most one a
 * day; the browsers that take them are PushDevice rows. Pure, so the form,
 * the server and the tests share it.
 */

/** Whether this server sends reading reminders: yes, unless whoever runs
 *  it set READING_REMINDERS=off. Read on the server. */
export function remindersEnabled(): boolean {
  return process.env.READING_REMINDERS?.trim().toLowerCase() !== "off";
}

/** The most browsers one account can have reminders on. */
export const MAX_PUSH_DEVICES = 10;

/** The times a reminder can be set for: every half hour of the day. */
export const REMINDER_TIMES: readonly string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 ? "30" : "00"}`;
});

/** Weekdays as Date.getUTCDay counts them: 0 is Sunday. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** A chosen days list, made valid: each weekday once, in order, and never
 *  none (a reminder on no day is turned off by removing its devices). */
export function parseReminderDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...WEEKDAYS];
  const days = new Set<number>();
  for (const d of raw) if (Number.isInteger(d) && d >= 0 && d <= 6) days.add(d);
  return days.size ? [...days].sort((a, b) => a - b) : [...WEEKDAYS];
}

/** The weekdays in the order the reader's week runs. */
export function weekdaysInOrder(weekStart: "monday" | "sunday"): number[] {
  return weekStart === "monday" ? [1, 2, 3, 4, 5, 6, 0] : [...WEEKDAYS];
}

/** "Every day", "Weekdays", "Weekends" or the days themselves. */
export function reminderDaysText(days: readonly number[], weekStart: "monday" | "sunday"): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  const weekdays = [1, 2, 3, 4, 5];
  if (set.size === 5 && weekdays.every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return weekdaysInOrder(weekStart)
    .filter((d) => set.has(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(", ");
}

/** "20:00", or "8:00 pm" for a reader who writes dates the American way. */
export function formatClock(time: string, dateFormat?: DateFormat): string {
  const [h, m] = time.split(":").map(Number);
  if (dateFormat !== "mmm-d-y" && dateFormat !== "mm/dd/y") return time;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** How long after the chosen time a reminder still goes: one missed while
 *  the server was down for a moment still comes, but not hours late. It
 *  also carries a time that a clock change skips (02:30 on the night
 *  clocks go forward) to the first moment after it. */
export const REMINDER_WINDOW_MINUTES = 60;

/**
 * Whether a reminder is due at `now`, and for which day: the day in the
 * reader's zone if it is one of their days, the clock there has reached
 * their time (within the window), and none has gone that day yet. The day
 * is what to record once it's sent, so a clock going back an hour can't
 * bring the same time round twice.
 */
export function reminderDue(
  settings: { time: string; days: readonly number[] },
  lastDay: string | null,
  now: Date,
  timeZone: string,
): string | null {
  const today = dayKey(now, timeZone);
  if (lastDay === today) return null;
  if (!settings.days.includes(keyToUtcDate(today).getUTCDay())) return null;
  const wall = new Date(now.getTime() + zoneOffset(now.getTime(), timeZone));
  const minutes = wall.getUTCHours() * 60 + wall.getUTCMinutes();
  const [h, m] = settings.time.split(":").map(Number);
  const at = h * 60 + m;
  return minutes >= at && minutes < at + REMINDER_WINDOW_MINUTES ? today : null;
}

/** What a reminder says: the book being read, where the reader is in it,
 *  and what is left of today's goal. */
export interface ReminderMessage {
  title: string;
  body: string;
  /** The page a tap opens. */
  url: string;
}

export function reminderMessage(input: {
  /** The book read most lately of those being read, if any. */
  book: { title: string; place: string | null } | null;
  /** What is left of the daily goal today ("12 pages"), when there is one
   *  and it isn't met yet. */
  goalLeft: string | null;
}): ReminderMessage {
  const lines: string[] = [];
  if (input.book) lines.push(input.book.place ? `${input.book.title} · ${input.book.place}` : input.book.title);
  if (input.goalLeft) lines.push(`${input.goalLeft} to go for today's goal`);
  return {
    title: "Time to read",
    body: lines.length ? lines.join("\n") : "Pick up where you left off.",
    url: "/reading",
  };
}

/** What to call a browser in the list of devices, from its user agent:
 *  "Firefox on Android", "Safari on iPhone". */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "A browser";
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "a Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  return system ? `${browser} on ${system}` : browser;
}
