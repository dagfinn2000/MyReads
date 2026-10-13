/**
 * Calendar-day helpers. A "day key" is "2026-07-17": sortable, comparable,
 * and the unit every reading-day statistic is counted in.
 *
 * Which day a moment falls on depends on the time zone. Without one these
 * use the server's local zone, which is how MyReads always behaved; with
 * the reader's zone (Preferences) late-evening reading lands on the evening
 * it happened rather than on the server's next day.
 */

const keyFormatters = new Map<string, Intl.DateTimeFormat>();

function keyFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = keyFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    keyFormatters.set(timeZone, f);
  }
  return f;
}

/** The day `d` falls on, in `timeZone` (default: the server's local zone). */
export function dayKey(d: Date, timeZone?: string): string {
  if (!timeZone) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }
  const parts = keyFormatter(timeZone).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** A key as midnight UTC — a stable Date for calendar arithmetic, free of
 *  daylight-saving jumps in any zone. */
export function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The key `days` days after (or, negative, before) `key`. */
export function shiftDayKey(key: string, days: number): string {
  const d = keyToUtcDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The calendar day a stored date means.
 *
 * Dates typed into a date field ("Finished: 12 May") are saved as midnight
 * UTC and mean that day wherever you are, so they read back in UTC — read in
 * New York they would otherwise show the 11th. Anything else is a moment in
 * time (a "finished today" stamp, a reading-log entry) and falls on whatever
 * day it was in the reader's zone.
 */
export function calendarDay(d: Date, timeZone?: string): string {
  const isMidnightUtc =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  return isMidnightUtc ? d.toISOString().slice(0, 10) : dayKey(d, timeZone);
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** How far `timeZone`'s wall clock is ahead of UTC at `ms`, in ms. */
export function zoneOffset(ms: number, timeZone: string): number {
  let f = offsetFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    offsetFormatters.set(timeZone, f);
  }
  const parts = f.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * The moment day `key` starts in `timeZone` (default: the server's zone):
 * local midnight as a real instant. The second pass corrects for a
 * daylight-saving change between UTC midnight and local midnight.
 */
export function zonedDayStart(key: string, timeZone?: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  if (!timeZone) return new Date(y, m - 1, d);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const first = utcMidnight - zoneOffset(utcMidnight, timeZone);
  return new Date(utcMidnight - zoneOffset(first, timeZone));
}

/** The last millisecond of day `key` in `timeZone`. */
export function endOfZonedDay(key: string, timeZone?: string): Date {
  return new Date(zonedDayStart(shiftDayKey(key, 1), timeZone).getTime() - 1);
}
