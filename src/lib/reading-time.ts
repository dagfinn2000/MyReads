import { formatLength, type UnitInfo } from "@/lib/progress-units";

/**
 * Time spent reading: the reading timer's state, and what the minutes saved
 * with log entries (ProgressEntry.minutes) say about a read, which is how
 * fast it goes and how long is left. Pure, so the quick-log row, the server
 * and the stats share it and tests can reach it.
 *
 * An entry's minutes are the time it took to get there from the entry
 * before it. Its pages are the rise over that entry, the same crediting
 * the reading calendar uses (lib/progress.ts), so speed only ever counts
 * stretches whose pages and time are both known.
 */

/** The most one log entry can carry: a whole day. */
export const MAX_ENTRY_MINUTES = 24 * 60;

/** Less timed reading than this gives no speed: a two-minute stretch says
 *  little about a book. */
export const MIN_TIMED_MINUTES = 10;

/**
 * The timer for one book, as the browser keeps it. `runningSince` is when
 * the current stretch began (ms since the epoch), null while paused or
 * stopped. `banked` holds the stretches before it, so pausing loses
 * nothing. `stopped` once Stop is pressed: the time waits to be logged.
 *
 * Kept as moments rather than a count, so the timer keeps going while the
 * page is closed or the phone is locked.
 */
export interface TimerState {
  runningSince: number | null;
  banked: number;
  stopped: boolean;
}

export function startTimer(now: number): TimerState {
  return { runningSince: now, banked: 0, stopped: false };
}

export function elapsedMs(t: TimerState, now: number): number {
  return t.banked + (t.runningSince != null ? Math.max(now - t.runningSince, 0) : 0);
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  return { runningSince: null, banked: elapsedMs(t, now), stopped: false };
}

export function resumeTimer(t: TimerState, now: number): TimerState {
  return t.runningSince != null ? t : { runningSince: now, banked: t.banked, stopped: false };
}

export function stopTimer(t: TimerState, now: number): TimerState {
  return { runningSince: null, banked: elapsedMs(t, now), stopped: true };
}

/** Whole minutes for the log: rounded, at least one, at most a day. */
export function timerMinutes(ms: number): number {
  return Math.min(Math.max(Math.round(ms / 60_000), 1), MAX_ENTRY_MINUTES);
}

/** The running clock: "0:07", "12:34", "1:02:03". */
export function formatClock(ms: number): string {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** A timer read back from storage, or null for anything that isn't one. */
export function parseTimer(raw: string | null): TimerState | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { runningSince, banked, stopped } = v as Record<string, unknown>;
    const time = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
    if (!(runningSince === null || time(runningSince)) || !time(banked)) return null;
    return {
      runningSince: runningSince as number | null,
      banked: banked as number,
      stopped: stopped === true && runningSince === null,
    };
  } catch {
    return null;
  }
}

type TimedPoint = { page: number; minutes?: number | null };

/** Every minute timed in a stretch of the log. */
export function totalMinutes(entries: readonly TimedPoint[]): number {
  return entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
}

/**
 * Pages an hour over the timed stretches of one pass (oldest first), or
 * null with too little timed reading to tell. A timed first entry has no
 * entry before it, so its pages are unknown and it is left out.
 */
export function pagesPerHour(pass: readonly TimedPoint[]): number | null {
  let pages = 0;
  let minutes = 0;
  for (let i = 1; i < pass.length; i++) {
    const m = pass[i].minutes;
    if (!m) continue;
    pages += Math.max(pass[i].page - pass[i - 1].page, 0);
    minutes += m;
  }
  if (minutes < MIN_TIMED_MINUTES || pages <= 0) return null;
  return (pages / minutes) * 60;
}

/** Minutes of reading left at that speed, or null when it can't be told. */
export function minutesLeft(
  lastPage: number,
  pageCount: number | null,
  perHour: number | null,
): number | null {
  if (!pageCount || !perHour || perHour <= 0) return null;
  const remaining = pageCount - lastPage;
  if (remaining <= 0) return null;
  return (remaining / perHour) * 60;
}

/** A time to go, rounded the way a person would say it: to the minute
 *  under an hour, to five minutes above. */
export function roughLength(minutes: number): string {
  const m = minutes < 60 ? Math.max(Math.round(minutes), 1) : Math.round(minutes / 5) * 5;
  return formatLength(m);
}

function speedLabel(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.max(Math.round(n * 10) / 10, 0.1));
}

/**
 * Reading speed in the book's unit: "about 40 pages an hour", "about 9% an
 * hour". Null for an audiobook going by time, which plays at its own speed
 * and already shows what's left.
 */
export function speedAmount(perHour: number, info: UnitInfo): string | null {
  if (info.unit === "time") return null;
  if (info.unit === "percent") return `about ${speedLabel((perHour / info.pageCount!) * 100)}% an hour`;
  const label = speedLabel(perHour);
  return `about ${label} ${label === "1" ? "page" : "pages"} an hour`;
}

/**
 * The speed line for a book being read: "about 40 pages an hour · 4 h 10 min
 * to go". Null until the pass has enough timed reading.
 */
export function speedText(
  pass: readonly (TimedPoint & { page: number })[],
  info: UnitInfo,
): string | null {
  const perHour = pagesPerHour(pass);
  if (perHour === null) return null;
  const speed = speedAmount(perHour, info);
  if (!speed) return null;
  const last = pass[pass.length - 1];
  const left = minutesLeft(last.page, info.pageCount, perHour);
  return left === null ? speed : `${speed} · ${roughLength(left)} to go`;
}

/** "35 min" or "1 h 10 min", for a log row. */
export function entryTime(minutes: number | null | undefined): string | null {
  return minutes ? formatLength(minutes) : null;
}

/** The minutes, and the days they fall on, inside a window of days
 *  ("2026-01-01" to "2026-12-31"; null ends are open). */
export function minutesInWindow(
  byDay: ReadonlyMap<string, number>,
  window: { from: string | null; to: string | null },
): { minutes: number; days: number } {
  let minutes = 0;
  let days = 0;
  for (const [day, m] of byDay) {
    if ((window.from && day < window.from) || (window.to && day > window.to)) continue;
    minutes += m;
    days++;
  }
  return { minutes, days };
}
