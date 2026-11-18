import { grid, type Art, type Rect } from "@/components/room-art";

/**
 * The candle on the side table by the armchair (reading-room.tsx,
 * TimerCandle): lit while the reading timer runs and burning down as the
 * session goes on, from a new candle to a stub. It burns down over the
 * reader's daily reading goal when that is in minutes, so the stub is the
 * goal met, and over an hour otherwise. Past that it gutters on as a stub.
 * Paused or stopped, it's snuffed out where it stands, and it's put away
 * once the time is logged.
 *
 * A pillar candle in a brass dish, 5 dots wide: two frames of flame over
 * the wick (swapped to flicker, like the fire's), then the wax, which
 * sheds a drip down each side and a little pool in the dish as it burns.
 */

/** Rows of wax on a new candle, and on the stub it burns down to. */
export const CANDLE_TALL = 10;
export const CANDLE_STUB = 2;
/** How long a candle lasts without a daily goal in minutes. */
export const CANDLE_MINUTES = 60;

/** Rows of the flame over the wick. */
const FLAME_ROWS = 4;

// A teardrop, hottest low down; the second leans as it flickers.
const FLAME_A = ["..r..", ".rFr.", ".fFf.", "..f.."];
const FLAME_B = ["...r.", "..Fr.", ".fFf.", "..f.."];

/** The wax left after `elapsedMs` of a session that burns the candle down
 *  over `minutes`, in whole rows. */
export function candleRows(elapsedMs: number, minutes: number): number {
  const share = minutes > 0 ? Math.min(Math.max(elapsedMs / (minutes * 60_000), 0), 1) : 1;
  return Math.round(CANDLE_TALL - share * (CANDLE_TALL - CANDLE_STUB));
}

export interface CandleArt {
  art: Art;
  /** Two frames of flame, for room-frame-a and room-frame-b. */
  flames: [Rect[], Rect[]];
  /** Where the flame burns, from the art's top left: the middle of its
   *  glow, and where smoke rises from once it's snuffed. */
  flame: { x: number; y: number };
}

/** The candle with `rows` of wax left (CANDLE_STUB to CANDLE_TALL). The
 *  flame's rows are left clear in the art, so a snuffed candle is the same
 *  size and stands in the same place. */
export function candleArt(rows: number): CandleArt {
  const wax = Math.min(Math.max(Math.round(rows), CANDLE_STUB), CANDLE_TALL);
  const burnt = CANDLE_TALL - wax;
  const lines: string[] = Array.from({ length: FLAME_ROWS }, () => ".....");
  lines.push("..k..");
  for (let i = 0; i < wax; i++) {
    // Lit from the left, like the rest of the room: pale, pale, shaded.
    const line = [".", "y", "y", "Y", "."];
    // Once it has burnt a little a drip runs over the rim down the shaded
    // side, ending in a bead; further on, a bead on the other side.
    if (burnt >= 2 && i <= 1) line[3] = "y";
    if (burnt >= 2 && i === 2) line[4] = "Y";
    if (burnt >= 5 && i === 2) line[0] = "y";
    lines.push(line.join(""));
  }
  // The dish, with wax pooled in it once the candle is half gone.
  lines.push(burnt >= 4 ? "bYBYn" : "bBBBn");
  lines.push(".nnn.");
  return {
    art: { w: 5, h: lines.length, rects: grid(lines) },
    flames: [grid(FLAME_A), grid(FLAME_B)],
    flame: { x: 2.5, y: 2 },
  };
}
