"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Pause, Play, Square, Timer, X } from "lucide-react";
import { parseDuration } from "@/lib/progress-units";
import {
  MAX_ENTRY_MINUTES,
  elapsedMs,
  formatClock,
  parseTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  timerMinutes,
  type TimerState,
} from "@/lib/reading-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The reading timer on the quick-log row: Start when you sit down to read,
 * Pause and Stop, and the time read goes with the next page you log. It
 * can also be typed in ("Add time").
 *
 * The timer lives in this browser's storage as the moment it started, so it
 * keeps going while the page is closed or the phone is locked, and a second
 * tab on the same book shows the same timer. The clock only ticks while the
 * page is in view. Without storage (a private window that refuses it) it
 * still works for as long as the page stays open.
 */

const KEY_PREFIX = "myreads-timer:";
const CHANGED = "myreads-timer";

// When storage refuses a write, timers carry on in memory for this visit.
const memory = new Map<string, string>();
let storageBroken = false;

function readRaw(bookId: string): string | null {
  if (storageBroken) return memory.get(bookId) ?? null;
  try {
    return window.localStorage.getItem(KEY_PREFIX + bookId);
  } catch {
    return memory.get(bookId) ?? null;
  }
}

function writeTimer(bookId: string, timer: TimerState | null) {
  if (timer) memory.set(bookId, JSON.stringify(timer));
  else memory.delete(bookId);
  try {
    if (timer) window.localStorage.setItem(KEY_PREFIX + bookId, JSON.stringify(timer));
    else window.localStorage.removeItem(KEY_PREFIX + bookId);
  } catch {
    storageBroken = true;
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * Minutes a log gave back (an undone Finished on a read with no page logged
 * yet): onto this book's timer, so they go with the next log.
 */
export function giveBackTime(bookId: string, minutes: number) {
  const ms = minutes * 60_000;
  const timer = parseTimer(readRaw(bookId));
  writeTimer(
    bookId,
    timer ? { ...timer, banked: timer.banked + ms } : { runningSince: null, banked: ms, stopped: true },
  );
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** The current moment, refreshed every second while `ticking` and the page
 *  is in view. */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    let id: number | undefined;
    const tick = () => setNow(Date.now());
    const start = () => {
      if (id === undefined && !document.hidden) id = window.setInterval(tick, 1000);
    };
    const stop = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        tick();
        start();
      }
    };
    tick();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ticking]);
  return now;
}

export type TimedMinutes = { minutes?: number } | { error: string };

export interface ReadingTimerControl {
  timer: TimerState | null;
  now: number;
  /** The time box's text, or null while it's hidden. */
  box: string | null;
  setBox: (text: string | null) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Throw the time away: the timer and the box. */
  discard: () => void;
  /** The time to send with a log: the running timer's, or the box's. */
  minutesForLog: () => TimedMinutes;
  /** After a log took the time: back to no timer. */
  consumed: () => void;
}

export function useReadingTimer(bookId: string, readStartedAt?: number | null): ReadingTimerControl {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(bookId),
    () => null,
  );
  const parsed = parseTimer(raw);
  // A running timer whose clock predates this reading pass was left behind by
  // an earlier read of the book (finished elsewhere, then "Read again"). It
  // isn't this session's time, so ignore it and clear it, rather than letting
  // the next log silently bank up to a day of reading that never happened.
  const stale = parsed?.runningSince != null && readStartedAt != null && parsed.runningSince < readStartedAt;
  const timer = stale ? null : parsed;
  useEffect(() => {
    if (stale) writeTimer(bookId, null);
  }, [stale, bookId]);
  const [typed, setTyped] = useState<string | null>(null);
  const now = useNow(timer?.runningSince != null);
  // A stopped timer shows its minutes in the box until they're logged, also
  // after a reload; once typed over, the typing wins.
  const box = typed ?? (timer?.stopped ? String(timerMinutes(timer.banked)) : null);

  return {
    timer,
    now,
    box,
    setBox: setTyped,
    start: () => {
      setTyped(null);
      writeTimer(bookId, startTimer(Date.now()));
    },
    pause: () => timer && writeTimer(bookId, pauseTimer(timer, Date.now())),
    resume: () => timer && writeTimer(bookId, resumeTimer(timer, Date.now())),
    stop: () => {
      if (!timer) return;
      const stopped = stopTimer(timer, Date.now());
      setTyped(String(timerMinutes(stopped.banked)));
      writeTimer(bookId, stopped);
    },
    discard: () => {
      setTyped(null);
      writeTimer(bookId, null);
    },
    minutesForLog: () => {
      if (timer && !timer.stopped) {
        const ms = elapsedMs(timer, Date.now());
        // A timer running for over a day is almost always one left going by
        // mistake; don't silently cap it at a day and bank it.
        if (ms > MAX_ENTRY_MINUTES * 60_000) {
          return { error: "The timer's been running over a day. Stop it and check the time first." };
        }
        return { minutes: timerMinutes(ms) };
      }
      if (box === null || box.trim() === "") return {};
      const minutes = parseDuration(box);
      if (minutes === null) return { error: "Type the time read in minutes, like 25 or 1:10." };
      if (minutes > MAX_ENTRY_MINUTES) return { error: "That's more than a day of reading." };
      return minutes > 0 ? { minutes } : {};
    },
    consumed: () => {
      setTyped(null);
      if (timer) writeTimer(bookId, null);
    },
  };
}

/** The timer's line under the quick-log row. */
export function ReadingTimer({ control: t }: { control: ReadingTimerControl }) {
  const id = useId();
  const { timer, box } = t;

  if (box !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={id} className="text-muted-foreground">
          Time read
        </label>
        <span className="flex items-center gap-1.5">
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            className="h-8 w-16 tabular-nums"
            value={box}
            onChange={(e) => t.setBox(e.target.value)}
          />
          <span className="text-muted-foreground">min</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Forget this time"
          title="Forget this time"
          onClick={t.discard}
        >
          <X className="size-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground">Goes with the next page you log.</span>
      </div>
    );
  }

  if (!timer) {
    return (
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={t.start}>
          <Timer className="size-4" />
          Start timer
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => t.setBox("")}
        >
          Add time
        </Button>
      </div>
    );
  }

  const running = timer.runningSince != null;
  const clock = formatClock(elapsedMs(timer, t.now));
  const control = `grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    running ? "hover:bg-primary/15" : "hover:bg-foreground/10"
  }`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {/* Media-style controls inside the pill, so Pause and Stop never sit
          beside Now reading's Finished and Stopped looking like them. */}
      <span
        className={`inline-flex h-8 items-center gap-2 rounded-full pr-1 pl-3 tabular-nums ${
          running ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${running ? "timer-breathe bg-primary" : "bg-muted-foreground/60"}`}
        />
        <span className="font-medium">{running ? "Reading" : "Paused"}</span>
        {/* role=timer is never read out as it changes. */}
        <span role="timer" aria-label={`${running ? "Reading" : "Paused"} for ${clock}`}>
          {clock}
        </span>
        <span className="flex items-center">
          {running ? (
            <button type="button" className={control} aria-label="Pause timer" title="Pause" onClick={t.pause}>
              <Pause className="size-3.5" />
            </button>
          ) : (
            <button type="button" className={control} aria-label="Resume timer" title="Resume" onClick={t.resume}>
              <Play className="size-3.5" />
            </button>
          )}
          <button type="button" className={control} aria-label="Stop timer" title="Stop" onClick={t.stop}>
            <Square className="size-3" />
          </button>
        </span>
      </span>
    </div>
  );
}
