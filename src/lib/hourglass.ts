/**
 * The reading timer's hourglass (components/hourglass.tsx): a quarter-hour
 * glass, its sand running down for fifteen minutes of reading and the
 * glass turned over to start again, as someone reading by one would.
 */

/** How long one glass runs, in ms. */
export const GLASS_MS = 15 * 60_000;

/** Which glass the time read is on (0 for the first quarter hour, 1 once
 *  it's been turned over once, and so on) and how much of its sand has run
 *  through, from 0 to 1. */
export function hourglassAt(elapsedMs: number): { turn: number; run: number } {
  const ms = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const turn = Math.floor(ms / GLASS_MS);
  return { turn, run: (ms - turn * GLASS_MS) / GLASS_MS };
}
