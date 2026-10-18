/**
 * The fireside's pieces (Decorate › House › By the fire, lib/room-
 * styles.ts): the fireplace, the armchair, the rug in front of them and
 * the lamp beside the side table, each in a few designs. Every fireplace
 * and armchair is the size of the house's own (room-art.tsx draws those),
 * and every rug and lamp stays inside the hearth's width, so the hearth
 * lays out the same whichever are chosen, and the avatar sits in any
 * armchair the same way (avatar-art.ts).
 *
 * They're drawn in the house's paints like the rest of the room, so the
 * wood, fabric and stone follow the style and the Decorate colours. Brick,
 * marble, blue tiles, a sheepskin and the lamps' coloured glass keep
 * their own colours (reading-room.css).
 */
import type { RoomChair, RoomFireplace, RoomLamp, RoomRug } from "@/lib/room-styles";
import {
  armchairArt,
  fireplaceArt,
  floorLampArt,
  grid,
  rugArt,
  type Art,
  type Paint,
  type Rect,
} from "@/components/room-art";

/** A steady pseudo-random number in [0, 1) for a place, so brickwork and
 *  fleece look the same on every visit. */
function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** A text grid that must be `w` wide on every row. */
function sheet(w: number, rows: readonly string[], key?: Record<string, Paint>): Rect[] {
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`row ${i} is ${r.length} wide, not ${w}`);
  });
  return grid(rows, 0, 0, key);
}

// ── Fireplaces, 44 × 48 ──────────────────────────────────────────────────

/** A fireplace and where its fire burns: the flames (FLAMES_A/B, 14 × 10)
 *  have their top left at each of `fires`, with the logs under them if
 *  `logs`. `glow` is the middle of the firelight, from the top left. */
export interface Fireplace {
  art: Art;
  fires: readonly { x: number; y: number }[];
  logs: boolean;
  glow: { x: number; y: number };
}

/** The wooden mantel shelf most of them share, with the candlesticks and
 *  the clock standing on it. */
function mantel(R: Rect[]) {
  R.push([0, 0, 44, 1, "wood-hi"], [0, 1, 44, 2, "wood"], [0, 3, 44, 1, "wood-lo"]);
  R.push([0, 0, 1, 4, "wood-deep"], [43, 0, 1, 4, "wood-deep"]);
}

/** The iron grate in front of the logs, as on the stone fireplace. */
function grate(R: Rect[], x = 13, w = 18) {
  R.push([x, 42, w, 1, "ink"], [x + 1, 43, 1, 2, "ink"], [x + w - 2, 43, 1, 2, "ink"]);
  for (let gx = x + 2; gx < x + w - 1; gx += 3) R.push([gx, 40, 1, 2, "ink"]);
}

/** A round-topped opening `w` wide from `x`, its top at `y`, down to the
 *  hearth: `rim` round the edge, soot inside, embers glowing at the foot. */
function archedOpening(R: Rect[], x: number, y: number, w: number, rim: Paint) {
  const rows = [w - 6, w - 2, w];
  rows.forEach((rw, i) => R.push([x + (w - rw) / 2 - 1, y + i, rw + 2, 1, rim]));
  R.push([x - 1, y + 3, w + 2, 45 - y - 3, rim]);
  rows.forEach((rw, i) => R.push([x + (w - rw) / 2, y + i + 1, rw, 1, "soot"]));
  R.push([x, y + 4, w, 45 - y - 4, "soot"]);
  R.push([x, 39, w, 6, "ember"]);
}

/** Red brick laid in courses, with an arch of bricks on end over the fire
 *  and an oak beam for a mantel. */
function brickFireplace(): Art {
  const R: Rect[] = [];
  R.push([3, 4, 38, 41, "mortar"]);
  const tones: Paint[] = ["firebrick", "firebrick-lo", "firebrick", "firebrick-dark", "firebrick", "firebrick-lo"];
  for (let course = 0; course < 14; course++) {
    const y = 4 + course * 3;
    const h = Math.min(2, 45 - y);
    if (h <= 0) break;
    for (let bx = course % 2 ? 0 : 3; bx < 41; bx += 6) {
      const x0 = Math.max(3, bx);
      const x1 = Math.min(41, bx + 5);
      if (x1 <= x0) continue;
      R.push([x0, y, x1 - x0, h, tones[Math.floor(noise(bx, course, 3) * tones.length)]]);
      R.push([x0, y, Math.min(2, x1 - x0), 1, "firebrick-hi"]);
    }
  }
  // A flat arch over the opening: bricks on end, splayed at the ends,
  // either side of a keystone.
  R.push([8, 17, 28, 5, "mortar"]);
  for (let k = 0; k < 6; k++) {
    for (const x of [9 + k * 3, 32 - k * 3]) {
      const splay = k === 0 ? 1 : 0;
      R.push([x - splay * (x < 22 ? 0 : -1), 18, 2, 3, k % 2 ? "firebrick-lo" : "firebrick-dark"]);
      R.push([x, 18, 2, 1, "firebrick"]);
    }
  }
  R.push([20, 16, 4, 6, "firebrick-hi"], [20, 16, 4, 1, "mortar"], [21, 17, 2, 4, "firebrick"], [20, 21, 4, 1, "firebrick-lo"]);
  R.push([11, 22, 22, 23, "firebrick-dark"], [12, 22, 20, 23, "soot"], [12, 39, 20, 6, "ember"]);
  R.push([12, 22, 20, 1, "firebrick-deep"]);
  grate(R);
  // An oak beam, pegged at the ends, and a stone hearth.
  R.push([0, 0, 44, 1, "wood-hi"], [0, 1, 44, 3, "wood"], [0, 4, 44, 1, "wood-deep"]);
  R.push([0, 0, 1, 5, "wood-deep"], [43, 0, 1, 5, "wood-deep"]);
  for (const [x, w] of [[5, 6], [16, 4], [27, 7], [37, 3]] as const) R.push([x, 2, w, 1, "wood-lo"]);
  R.push([3, 1, 1, 1, "wood-deep"], [40, 1, 1, 1, "wood-deep"]);
  R.push([0, 45, 44, 1, "stone-hi"], [0, 46, 44, 1, "stone"], [0, 47, 44, 1, "stone-lo"]);
  return { w: 44, h: 48, rects: R };
}

/** White marble: a shelf over a carved frieze, fluted pilasters either side
 *  and an iron grate with a brass rim round its arch. */
function marbleFireplace(): Art {
  const R: Rect[] = [];
  R.push([0, 0, 44, 1, "marble-hi"], [0, 1, 44, 2, "marble"], [0, 3, 44, 1, "marble-lo"]);
  R.push([2, 4, 40, 1, "marble-lo"], [3, 5, 38, 7, "marble"], [3, 5, 38, 1, "marble-hi"]);
  // A carved tablet in the middle of the frieze, and a rosette over each
  // pilaster.
  R.push([14, 6, 16, 1, "marble-lo"], [14, 7, 1, 3, "marble-lo"], [15, 10, 15, 1, "marble-hi"], [29, 7, 1, 3, "marble-hi"]);
  R.push([20, 8, 4, 1, "marble-lo"]);
  for (const cx of [6, 37]) R.push([cx - 1, 7, 3, 3, "marble-lo"], [cx, 8, 1, 1, "marble-hi"]);
  R.push([3, 11, 38, 1, "marble-lo"]);
  // Pilasters, with a capital and a plinth.
  for (const px of [3, 34]) {
    R.push([px, 12, 7, 33, "marble"], [px, 12, 7, 1, "marble-hi"], [px, 13, 7, 1, "marble-lo"]);
    for (const fx of [px + 1, px + 3, px + 5]) R.push([fx, 15, 1, 25, "marble-lo"]);
    R.push([px, 41, 7, 1, "marble-hi"], [px - (px === 3 ? 1 : 0), 42, 8, 3, "marble"], [px, 44, 7, 1, "marble-lo"]);
  }
  // A vein or two.
  for (const [x, y] of [[8, 6], [9, 7], [33, 9], [34, 10], [36, 6]] as const) R.push([x, y, 1, 1, "marble-lo"]);
  // The iron insert between them.
  R.push([10, 12, 24, 33, "ink"]);
  archedOpening(R, 14, 18, 16, "brass");
  R.push([13, 21, 1, 24, "brass-hi"]);
  R.push([11, 43, 22, 1, "brass-hi"], [11, 44, 22, 1, "brass-lo"], [11, 42, 1, 1, "brass"], [32, 42, 1, 1, "brass"]);
  R.push([0, 45, 44, 1, "marble-hi"], [0, 46, 44, 1, "marble"], [0, 47, 44, 1, "marble-lo"]);
  return { w: 44, h: 48, rects: R };
}

/** A wooden surround framing blue-and-white tiles round an iron grate. */
function tiledFireplace(): Art {
  const R: Rect[] = [];
  mantel(R);
  R.push([3, 4, 38, 4, "wood"], [3, 4, 38, 1, "wood-deep"], [3, 6, 38, 1, "wood-lo"]);
  for (const px of [3, 37]) R.push([px, 8, 4, 37, "wood"], [px, 8, 1, 37, "wood-hi"], [px + 3, 8, 1, 37, "wood-lo"]);
  // Tiles 4 dots square with a dot of grout between, each with a little
  // flower in the middle and a quarter at each corner, so where four meet
  // the corners make a diamond.
  R.push([7, 8, 30, 37, "tile-lo"]);
  for (let ty = 9; ty < 44; ty += 5) {
    for (let tx = 8; tx < 37; tx += 5) {
      const h = Math.min(4, 45 - ty);
      R.push([tx, ty, 4, h, "tile"]);
      R.push([tx + 1, ty + 1, 2, Math.min(2, h - 1), "delft"]);
      for (const [cx, cy] of [[0, 0], [3, 0], [0, 3], [3, 3]] as const) {
        if (cy < h) R.push([tx + cx, ty + cy, 1, 1, "delft-lo"]);
      }
    }
  }
  // The iron grate, its top a round arch.
  R.push([12, 18, 20, 27, "ink"], [13, 17, 18, 1, "ink"]);
  archedOpening(R, 14, 19, 16, "metal-lo");
  grate(R);
  R.push([0, 45, 44, 1, "stone-hi"], [0, 46, 44, 1, "stone"], [0, 47, 44, 1, "stone-lo"]);
  return { w: 44, h: 48, rects: R };
}

/** A plain chimney breast with a long, low opening, the flames rising off
 *  a bed of stones, under a floating oak shelf. */
function modernFireplace(): Art {
  const R: Rect[] = [];
  R.push([0, 0, 44, 1, "wood-hi"], [0, 1, 44, 1, "wood"], [0, 2, 44, 1, "wood-lo"], [2, 3, 40, 1, "case-shadow"]);
  R.push([2, 3, 40, 42, "stone"], [2, 3, 1, 42, "stone-hi"], [41, 3, 1, 42, "stone-lo"], [2, 44, 40, 1, "stone-lo"]);
  R.push([2, 4, 40, 1, "case-shadow"]);
  for (const [x, y] of [[7, 11], [36, 11], [7, 19], [36, 19]] as const) R.push([x, y, 1, 1, "stone-lo"]);
  // The opening, framed in black steel.
  R.push([5, 24, 34, 17, "ink"], [6, 25, 32, 15, "soot"], [6, 34, 32, 6, "ember"]);
  for (let x = 6; x < 38; x++) {
    const n = noise(x, 1, 9);
    R.push([x, 37, 1, 1, n < 0.4 ? "stone-hi" : n < 0.75 ? "stone" : "stone-lo"]);
    R.push([x, 38, 1, 2, noise(x, 2, 9) < 0.5 ? "stone-lo" : "stone-deep"]);
  }
  R.push([5, 40, 34, 1, "metal-lo"]);
  R.push([0, 45, 44, 1, "stone-lo"], [0, 46, 44, 2, "stone-deep"]);
  return { w: 44, h: 48, rects: R };
}

export const FIREPLACES: Record<RoomFireplace, Fireplace> = {
  stone: { art: fireplaceArt(), fires: [{ x: 15, y: 28 }], logs: true, glow: { x: 22, y: 36 } },
  brick: { art: brickFireplace(), fires: [{ x: 15, y: 29 }], logs: true, glow: { x: 22, y: 36 } },
  marble: { art: marbleFireplace(), fires: [{ x: 15, y: 30 }], logs: true, glow: { x: 22, y: 37 } },
  tiles: { art: tiledFireplace(), fires: [{ x: 15, y: 30 }], logs: true, glow: { x: 22, y: 37 } },
  modern: {
    art: modernFireplace(),
    fires: [
      { x: 8, y: 27 },
      { x: 22, y: 27 },
    ],
    logs: false,
    glow: { x: 22, y: 32 },
  },
};

// ── Armchairs, 29 × 31 ───────────────────────────────────────────────────
// The avatar sits in the middle, between the arms (x 7 to 22), with its
// feet on the floor, so every chair's seat is where the wingback's is.

const CHAIR_KEY: Record<string, Paint> = { "o": "brass-hi", "O": "brass" };

/** A club chair: a low, rounded back and fat arms, in smooth leather. */
const CLUB = sheet(29, [
  ".............................",
  ".............................",
  "........XXXXXXXXXXXXX........",
  "......XXcccccccccccccXX......",
  ".....XccCCCCCCCCCCCCCCxX.....",
  "....XcCCCCCCCCCCCCCCCCCxX....",
  "....XcCcCCCCCCCCCCCCCCCxX....",
  "....XcCcCCCCCCCCCCCCCCCxX....",
  "....XcCcCCCCCCCCCCCCCCCxX....",
  ".XXXXXCCCCCCCCCCCCCCCCCXXXXX.",
  "XcccccXCCCCCCCCCCCCCCCXcccccX",
  "XcCCCxXCCCCCCCCCCCCCCCXcCCCxX",
  "XcCCCxXCCCCCCCCCCCCCCCXcCCCxX",
  "XcCCCxXCCCCCCCCCCCCCCCXcCCCxX",
  "XcCCCxXCCCCCCCCCCCCCCCXcCCCxX",
  "XcCCCxXCCCCCCCCCCCCCCCXcCCCxX",
  "XcCCCxXxxxxxxxxxxxxxxxXcCCCxX",
  "XcCCCxXcccccccccccccccXcCCCxX",
  "XcCCCxXcCCCCCCCCCCCCCxXcCCCxX",
  "XcCCCxXCCCCCCCCCCCCCCxXcCCCxX",
  "XcCCCxXxxxxxxxxxxxxxxxXcCCCxX",
  "XcCCCxXXXXXXXXXXXXXXXXXcCCCxX",
  "XcCCCxXcCCCCCCCCCCCCCxXcCCCxX",
  "XcCCCxXCCCCCCCCCCCCCCxXcCCCxX",
  "XcCCCxXCCCCCCCCCCCCCCxXcCCCxX",
  "XxxxxxXxxxxxxxxxxxxxxxXxxxxxX",
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "..DWD...................DWD..",
  "..DWD...................DWD..",
  "..DWD...................DWD..",
  "...D.....................D...",
]);

/** A Chesterfield chair: back and arms one height, deep-buttoned, the
 *  arms rolled, brass studs along the front, on bun feet. */
const CHESTERFIELD = sheet(29, [
  ".............................",
  ".............................",
  ".............................",
  ".............................",
  ".............................",
  ".............................",
  ".XXXXX.XXXXXXXXXXXXXXX.XXXXX.",
  "XccccxXcccccccccccccccXccccxX",
  "XcCCCxXCCCCCCCCCCCCCCCXcCCCxX",
  "XcCXCxXxxxxxxxxxxxxxxxXcCXCxX",
  "XcCCCxXCCCCCCCCCCCCCCCXcCCCxX",
  "XxxxxxXCXCCCXCCCXCCCXCXxxxxxX",
  "XXXXXXXCCxCxCxCxCxCxCCXXXXXXX",
  "XcCxCxXCCCXCCCXCCCXCCCXcCxCxX",
  "XcCxCxXCCxCxCxCxCxCxCCXcCxCxX",
  "XcCxCxXCXCCCXCCCXCCCXCXcCxCxX",
  "XcCxCxXxxxxxxxxxxxxxxxXcCxCxX",
  "XcCxCxXcccccccccccccccXcCxCxX",
  "XcCxCxXcCCCCCCCCCCCCCxXcCxCxX",
  "XcCxCxXCCCCCCCCCCCCCCxXcCxCxX",
  "XcCxCxXxxxxxxxxxxxxxxxXcCxCxX",
  "XcCxCxXXXXXXXXXXXXXXXXXcCxCxX",
  "XcCxCxXcCCCCCCCCCCCCCxXcCxCxX",
  "XcCxCxXCCCCCCCCCCCCCCxXcCxCxX",
  "XcCxCxXCCCCCCCCCCCCCCxXcCxCxX",
  "XoOoOoOoOoOoOoOoOoOoOoOoOoOoX",
  "XxxxxxxxxxxxxxxxxxxxxxxxxxxxX",
  ".XXXXXXXXXXXXXXXXXXXXXXXXXXX.",
  ".dwWd...................dwWd.",
  ".dWWd...................dWWd.",
  "..dd.....................dd..",
], CHAIR_KEY);

/** A mid-century lounge chair: a cushioned back and seat in a frame of
 *  light wood, with flat wooden arms and splayed legs. */
const LOUNGE = sheet(29, [
  ".............................",
  "......XXXXXXXXXXXXXXXXX......",
  ".....XcccccccccccccccccX.....",
  "....DXcCCCCCCCCCCCCCCCxXD....",
  "....WXcCCCCCCCCCCCCCCCxXW....",
  "....WXcCCCCCCCCCCCCCCCxXW....",
  "....WXcCCCCCCCCCCCCCCCxXW....",
  "....WXxxxxxxxxxxxxxxxxxXW....",
  "....WXcCCCCCCCCCCCCCCCxXW....",
  "....WXcCCCCCCCCCCCCCCCxXW....",
  "....WXcCCCCCCCCCCCCCCCxXW....",
  "....WXcCCCCCCCCCCCCCCCxXW....",
  "wwwwwwwXxxxxxxxxxxxxxXwwwwwww",
  "WWWWWWWXcCCCCCCCCCCCxXWWWWWWW",
  "ddddddWXCCCCCCCCCCCCxXWdddddd",
  ".Wd...WXcCCCCCCCCCCCxXW...Wd.",
  ".Wd...WXCCCCCCCCCCCCxXW...Wd.",
  ".WdXXXXXXXXXXXXXXXXXXXXXXXWd.",
  ".WXcccccccccccccccccccccccXd.",
  ".WXcCCCCCCCCCCCCCCCCCCCCCxXd.",
  ".WXCCCCCCCCCCCCCCCCCCCCCCxXd.",
  ".WXxxxxxxxxxxxxxxxxxxxxxxxXd.",
  ".WdXXXXXXXXXXXXXXXXXXXXXXXWd.",
  "wWWWWWWWWWWWWWWWWWWWWWWWWWWWd",
  "ddddddddddddddddddddddddddddd",
  ".Wd.......................Wd.",
  ".Wd.......................Wd.",
  "Wd.........................Wd",
  "Wd.........................Wd",
  "Wd.........................Wd",
  "D...........................D",
]);

/** A carved chair, like a throne: a tall wooden back with a crest and
 *  finials round a cushioned panel, turned arms and legs. */
const THRONE = sheet(29, [
  "....bb.......bbb.......bb....",
  "...bBBn.....bBBBn.....bBBn...",
  "....nn....DwwwwwwwD....nn....",
  "...DwwD..DwWWWWWWWdD..DwwD...",
  "...DWWDDDWWWdWWWdWWWDDDWWD...",
  "...DWWwwwwwwwwwwwwwwwwwWWD...",
  "...DWWDXXXXXXXXXXXXXXXDWWD...",
  "...DWWDXccccccccccccxXDWWD...",
  "...DWWDXcCCCCCoCCCCCxXDWWD...",
  "...DWWDXcCCCCoOoCCCCxXDWWD...",
  "...DWWDXcCCCoOCOoCCCxXDWWD...",
  "wwwwwwwXcCCoOCCCOoCCxXwwwwwww",
  "WWWWWWWXcCCCoOCOoCCCxXWWWWWWW",
  "DddddWDXcCCCCoOoCCCCxXDWddddD",
  ".DwD.WDXcCCCCCoCCCCCxXDW.DwD.",
  ".DWD.WDXcCCCCCCCCCCCxXDW.DWD.",
  ".dWd.WDXxxxxxxxxxxxxxXDW.dWd.",
  ".DwD.WDXXXXXXXXXXXXXXXDW.DwD.",
  "XXXXXXXXcccccccccccccXXXXXXXX",
  "XccccccccCCCCCCCCCCCCCCCCCCxX",
  "XcCCCCCCCCCCCCCCCCCCCCCCCCCxX",
  "XxxxxxxxxxxxxxxxxxxxxxxxxxxxX",
  "DwwwwwwwwwwwwwwwwwwwwwwwwwwwD",
  "DWWdWWWdWWWdWWWdWWWdWWWdWWWWD",
  "DdddddddddddddddddddddddddddD",
  ".DwD.....................DwD.",
  ".wWd.....................wWd.",
  ".DWD.....................DWD.",
  ".DwDdddddddddddddddddddddDwD.",
  ".DWD.....................DWD.",
  "DwWdD...................DwWdD",
]);

export const CHAIRS: Record<RoomChair, Art> = {
  wingback: armchairArt(),
  club: { w: 29, h: 31, rects: CLUB },
  chesterfield: { w: 29, h: 31, rects: CHESTERFIELD },
  lounge: { w: 29, h: 31, rects: LOUNGE },
  throne: { w: 29, h: 31, rects: THRONE },
};

// ── Rugs, lying in front ─────────────────────────────────────────────────

/** A rug of a design `w` wide (the hearth's is 56). Null for none. */
export function rugFor(rug: RoomRug, w: number): Art | null {
  switch (rug) {
    case "fringed":
      return rugArt(w);
    case "persian": {
      // A dark border round a red field, with a medallion in the middle and
      // a row of little guls either side; tassels at the ends.
      const R: Rect[] = [];
      for (let y = 1; y < 5; y += 2) R.push([0, y, 1, 1, "rug-fringe"], [w - 1, y, 1, 1, "rug-fringe"]);
      R.push([1, 0, w - 2, 6, "rug-3"], [2, 1, w - 4, 4, "rug"]);
      for (let x = 3; x < w - 3; x += 2) R.push([x, 0, 1, 1, "rug-2"], [x + 1, 5, 1, 1, "rug-2"]);
      const mid = Math.floor(w / 2);
      R.push([mid - 4, 2, 8, 2, "rug-2"], [mid - 2, 1, 4, 4, "rug-2"], [mid - 1, 2, 2, 2, "rug-3"]);
      for (let gx = mid - 9; gx > 4; gx -= 6) R.push([gx - 1, 2, 2, 2, "rug-2"], [gx - 1, 2, 1, 1, "rug-3"]);
      for (let gx = mid + 9; gx < w - 4; gx += 6) R.push([gx - 1, 2, 2, 2, "rug-2"], [gx, 3, 1, 1, "rug-3"]);
      return { w, h: 6, rects: R };
    }
    case "braided": {
      // A round rag rug, plaited in rings of three colours.
      const R: Rect[] = [];
      const rings: Paint[] = ["rug-3", "rug-2", "rug", "rug-fringe", "rug"];
      const rows = [w - 14, w - 6, w - 2, w, w - 4];
      rows.forEach((rw, y) => {
        const x0 = (w - rw) / 2;
        for (let x = 0; x < rw; x++) {
          const ring = Math.min(x, rw - 1 - x, y === 0 || y === 4 ? 0 : y === 1 ? 1 : 2);
          const paint = rings[Math.min(ring, y === 2 ? 4 : 3)];
          R.push([x0 + x, y, 1, 1, (x + y) % 3 === 0 && ring > 0 ? "rug-3" : paint]);
        }
      });
      return { w, h: 5, rects: R };
    }
    case "kilim": {
      // A flat weave of bold zigzags, red and dark on gold, fringed.
      const R: Rect[] = [];
      for (let y = 0; y < 5; y++) R.push([0, y, 1, 1, "rug-fringe"], [w - 1, y, 1, 1, y % 2 ? "rug-fringe" : "rug-2"]);
      R.push([1, 0, w - 2, 5, "rug-2"], [1, 0, w - 2, 1, "rug-3"], [1, 4, w - 2, 1, "rug-3"]);
      for (let x = 2; x < w - 2; x++) {
        const z = Math.abs((x % 6) - 3);
        R.push([x, 1 + (z > 1 ? 1 : 0), 1, 1, "rug"], [x, 2 + (z > 1 ? 1 : 0), 1, 1, z > 1 ? "rug-3" : "rug"]);
      }
      return { w, h: 5, rects: R };
    }
    case "sheepskin": {
      // A fleece lying on the floor, its edge in tufts, a leg at each end.
      const R: Rect[] = [];
      const fw = Math.min(w - 4, 40);
      const x0 = Math.floor((w - fw) / 2);
      for (let x = 0; x < fw; x++) {
        const edge = x < 3 || x >= fw - 3;
        const top = edge ? 2 : noise(x, 0, 21) < 0.45 ? 0 : 1;
        for (let y = top; y < 5; y++) {
          const n = noise(x, y, 22);
          R.push([x0 + x, y, 1, 1, y === top ? "fleece-hi" : y === 4 ? "fleece-lo" : n < 0.25 ? "fleece-lo" : "fleece"]);
        }
      }
      R.push([x0 - 2, 3, 2, 2, "fleece"], [x0 - 1, 2, 1, 1, "fleece-hi"], [x0 + fw, 3, 2, 2, "fleece"], [x0 + fw, 2, 1, 1, "fleece-hi"]);
      return { w, h: 5, rects: R };
    }
    case "none":
      return null;
  }
}

// ── Lamps ────────────────────────────────────────────────────────────────

/** A lamp by the side table: its art, `dx` from where the standard lamp
 *  stands, and its light (shown at night) from the art's top left. A lamp
 *  of candles has two frames of flames, swapped to flicker like the fire. */
export interface Lamp {
  art: Art;
  dx: number;
  glow: { x: number; y: number; r: number };
  flames?: readonly [Rect[], Rect[]];
}

const LAMP_KEY: Record<string, Paint> = {
  "1": "tiff-amber",
  "2": "tiff-green",
  "3": "tiff-red",
  "4": "tiff-blue",
  "o": "brass-hi",
  "O": "brass",
};

/** A Tiffany lamp: a dome of leaded coloured glass on a bronze stand. */
const TIFFANY = sheet(16, [
  "......KKKK......",
  "....KK1111KK....",
  "...K11222211K...",
  "..K1122332211K..",
  ".K112KK33KK211K.",
  ".K11122KK22111K.",
  "K1K1K1K1K1K1K1KK",
  "K12K33K22K11K22K",
  "KKKKKKKKKKKKKKKK",
  "1.3.2.1..1.2.3.1",
  "......nOOn......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  "......nOOn......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  "......nOOn......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".......On.......",
  ".....nOOOOn.....",
  "....nOOOOOOn....",
  "...KKKKKKKKKK...",
], LAMP_KEY);

/** An arc lamp: a heavy base beside the table, its stem curving over to
 *  hang a dome shade above the armchair. */
function arcLamp(): Art {
  const R: Rect[] = [];
  // The arc, from the base at the right up and over to the left.
  const pts: [number, number][] = [];
  for (let y = 60; y >= 14; y--) pts.push([30, y]);
  const arc = [[30, 13], [30, 12], [29, 11], [29, 10], [28, 9], [27, 8], [26, 7], [25, 6], [24, 6], [23, 5], [22, 5], [21, 5], [20, 5], [19, 5], [18, 5], [17, 6], [16, 6], [15, 7], [14, 8], [13, 9], [13, 10], [12, 11]];
  for (const [x, y] of [...pts, ...arc]) R.push([x, y, 1, 1, "metal-hi"], [x + 1, y, 1, 1, "metal-lo"]);
  // The shade, hanging off the end, lit underneath.
  R.push(...grid([
    "...=====...",
    "..=+MMMM=..",
    ".=+MMMMMM=.",
    "=+MMMMMMMM=",
    "===========",
    "..lLLLLLl..",
  ], 7, 12));
  // The base: a weighted disc.
  R.push([26, 61, 10, 1, "metal-hi"], [25, 62, 12, 2, "metal"], [25, 63, 12, 1, "metal-lo"], [24, 64, 14, 1, "ink"]);
  return { w: 38, h: 65, rects: R };
}

/** A wrought-iron candle stand, three candles in its crown. */
const CANDLES = sheet(15, [
  "...............",
  "...............",
  ".yfy..yfy..yfy.",
  "..y....y....y..",
  "..y....y....y..",
  "..Y....y....Y..",
  ".KKK...y...KKK.",
  "..K....Y....K..",
  "..K...KKK...K..",
  "...K...K...K...",
  "....KKKKKKK....",
  ".......K.......",
  "......KKK......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  "......K.K......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  "......K.K......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  ".......K.......",
  "......KKK......",
  ".....K.K.K.....",
  "....K..K..K....",
  "...K...K...K...",
  "..K....K....K..",
  ".KK...KKK...KK.",
]);

/** A paper floor lantern (an andon): paper panels in a wooden frame on
 *  four short legs. */
const LANTERN = sheet(14, [
  "DDDDDDDDDDDDDD",
  ".DwwwwwwwwwwD.",
  ".DlllllllllLD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DDDDDDDDDDDD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DDDDDDDDDDDD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DlLLLLLLLLmD.",
  ".DmmmmmmmmmmD.",
  "DDDDDDDDDDDDDD",
  ".D..........D.",
  ".D..........D.",
  ".D..........D.",
  "DD..........DD",
]);

export const LAMPS: Record<RoomLamp, Lamp> = {
  standard: { art: floorLampArt(), dx: 0, glow: { x: 6, y: 6, r: 30 } },
  tiffany: { art: { w: 16, h: 55, rects: TIFFANY }, dx: -2, glow: { x: 8, y: 6, r: 30 } },
  arc: { art: arcLamp(), dx: -20, glow: { x: 12, y: 20, r: 32 } },
  candles: {
    art: { w: 15, h: 45, rects: CANDLES },
    dx: -1,
    glow: { x: 7, y: 2, r: 26 },
    flames: [
      [1, 6, 11].flatMap((x) => grid([".F.", ".f."], x, 0)),
      [1, 6, 11].flatMap((x, i) => grid([i === 1 ? "..F" : "F..", ".f."], x, 0)),
    ],
  },
  lantern: { art: { w: 14, h: 26, rects: LANTERN }, dx: -1, glow: { x: 7, y: 11, r: 24 } },
};
