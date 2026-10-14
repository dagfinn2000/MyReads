/**
 * The shell of the reading room's house, in each of the house styles
 * (lib/room-styles.ts): the roof and chimney, the walls outside and in, the
 * floors, the foundations and the garden either side, plus the bits of it
 * that move (a banner, a gear, a beacon) and the pools of light it casts at
 * night. Drawn like the rest of the room (room-art.tsx): rectangles that
 * name paints, coloured for each style in reading-room.css. The bookcases
 * and furniture are the same in every style, only repainted.
 *
 * Everything is in dots, in scene coordinates (the scene's top left is 0,
 * 0). Texture comes from `noise`, a fixed function of position, so a house
 * looks the same on every visit.
 */
import { art, grid, type Art, type HouseGeometry, type Rect } from "@/components/room-art";
import type { RoomKind } from "@/lib/room";
import type { RoomCeiling, RoomFloor, RoomOwn, RoomPaper, RoomStyle, RoomWalls } from "@/lib/room-styles";

/** Something on the house that moves: frames shown in turn (or one that
 *  blinks), `x`, `y` its top left. The first frame is the still picture. */
export interface Moving {
  x: number;
  y: number;
  art: Art;
  frames: Rect[][];
  motion: "flicker" | "wave" | "turn" | "blink";
}

export interface Light {
  x: number;
  y: number;
  r: number;
}

export interface Shell {
  rects: Rect[];
  /** Each storey's walls, floor and ceiling, top first; drawn over
   *  `rects`, in the walls colour of their own if the room has one. */
  storeys: { rects: Rect[]; walls: RoomWalls }[];
  /** Fairy-light bulbs in three sets, which twinkle in turn at night. */
  twinkle: Rect[][];
  /** Drawn over the storeys, under the furniture: vines hanging from the
   *  eaves, say. */
  over: Rect[];
  moving: Moving[];
  /** Warm pools of light, at night only. */
  lights: Light[];
  /** Where smoke (or steam) leaves the chimney, if there is one. */
  smoke: { x: number; y: number; steam: boolean } | null;
  /** Garden things either side, each standing on the grass. */
  yard: { art: Art; x: number; y: number }[];
  /** Fireflies drift over these boxes at night. */
  fireflies: { x: number; y: number; w: number; h: number }[];
}

/** A steady pseudo-random number in [0, 1) for a place. */
function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Roofs ────────────────────────────────────────────────────────────────

type RoofShape = "gable" | "steep" | "low" | "metal" | "battlements" | "flat" | "dome" | "hill" | "canopy" | "pagoda";

const ROOFS: Record<RoomStyle, RoofShape> = {
  cottage: "gable",
  medieval: "battlements",
  fantasy: "steep",
  elven: "canopy",
  cave: "hill",
  scifi: "dome",
  modern: "flat",
  cabin: "low",
  japanese: "pagoda",
  steampunk: "metal",
};

/** Gables: how many dots across for each one up, and the overhang. */
const GABLES: Partial<Record<RoofShape, { slope: number; eaves: number }>> = {
  gable: { slope: 2, eaves: 4 },
  metal: { slope: 2, eaves: 4 },
  steep: { slope: 1, eaves: 5 },
  low: { slope: 3, eaves: 5 },
};

/** How tall the roof is over a house `houseW` dots wide. */
export function roofHeight(style: RoomStyle, houseW: number): number {
  switch (ROOFS[style]) {
    case "gable":
    case "metal":
      // 2 across for 1 up, flattened to a long ridge on a wide house.
      return clamp(Math.floor((houseW + 8) / 4), 14, 40);
    case "steep":
      // The main gable is pointed; a wide house gets smaller ones beside it.
      return clamp(Math.floor((houseW + 10) / 2), 20, 60);
    case "low":
      return clamp(Math.floor((houseW + 10) / 6), 12, 28);
    case "battlements":
      return 12;
    case "flat":
      return 8;
    case "dome":
      return clamp(Math.floor(houseW / 5), 16, 44);
    case "hill":
      return clamp(Math.floor(houseW / 4.5), 18, 44);
    case "canopy":
      return clamp(Math.floor(houseW / 4), 18, 46);
    case "pagoda":
      return clamp(Math.floor(houseW / 6), 14, 30);
  }
}

/** Room needed over the roof's highest point: a spire, a flag, an
 *  antenna. */
export function roofCrown(style: RoomStyle): number {
  return { steep: 22, battlements: 18, dome: 14, pagoda: 4 }[ROOFS[style] as string] ?? 0;
}

type Box = Pick<HouseGeometry, "houseX" | "houseW" | "roofTop" | "roofH">;

/** Half the width of an ellipse `rx` across and `h` tall at `dy` over its
 *  base. */
const ellipseHalf = (rx: number, h: number, dy: number) => (dy >= h ? 0 : rx * Math.sqrt(1 - (dy / h) ** 2));

/** Pagoda roofs: the ridge across the middle, and how far the eaves reach
 *  past the walls. */
const PAGODA_RIDGE = 0.12;
const PAGODA_EAVES = 9;

/**
 * The wizard's roof: a tall pointed gable in the middle and, where it
 * doesn't reach the eaves, smaller ones either side, each overlapping the
 * next. `c` is a peak's middle and `h` its height in rows.
 */
function steepPeaks(g: Box): { c: number; h: number }[] {
  const eaves = GABLES.steep!.eaves;
  const left = g.houseX - eaves;
  const right = g.houseX + g.houseW + eaves;
  const mid = (left + right) / 2;
  const H = g.roofH;
  const hs = Math.max(12, Math.round(H * 0.6));
  const sides: { c: number; h: number }[] = [];
  for (let c = left + hs; c - hs < mid - H; c += Math.round(hs * 1.5)) {
    sides.push({ c, h: hs }, { c: right - (c - left), h: hs });
  }
  // The outer ones first, so the nearer ones (and the main gable) are
  // drawn over them.
  return [...sides.reverse(), { c: mid, h: H }];
}

/** The top of the roof at scene column `x`. */
export function roofTopAt(style: RoomStyle, g: Box, x: number): number {
  const shape = ROOFS[style];
  const gable = GABLES[shape];
  const cx = g.houseX + g.houseW / 2;
  const bottom = g.roofTop + g.roofH;
  if (shape === "steep") {
    if (x < g.houseX - gable!.eaves || x >= g.houseX + g.houseW + gable!.eaves) return bottom;
    const rows = steepPeaks(g).map((p) => g.roofH - p.h + Math.floor(Math.abs(x + 0.5 - p.c)));
    return g.roofTop + clamp(Math.min(...rows), 0, g.roofH - 1);
  }
  if (gable) {
    const left = g.houseX - gable.eaves;
    const right = g.houseX + g.houseW + gable.eaves;
    const fromEdge = Math.min(x - left, right - 1 - x);
    return g.roofTop + Math.max(0, g.roofH - 1 - Math.floor(fromEdge / gable.slope));
  }
  switch (shape) {
    case "battlements":
      // Behind the parapet, for a chimney standing on the roof.
      return g.roofTop + 5;
    case "flat":
      return g.roofTop;
    case "dome":
    case "hill":
    case "canopy": {
      const rx = shape === "hill" ? g.houseX + g.houseW / 2 + 3 : g.houseW / 2 + (shape === "dome" ? 2 : 6);
      const t = Math.abs(x + 0.5 - cx) / rx;
      if (t >= 1) return bottom;
      return bottom - Math.round(g.roofH * Math.sqrt(1 - t * t));
    }
    case "pagoda": {
      const half = g.houseW / 2;
      const d = Math.abs(x + 0.5 - cx);
      const fall = g.roofH - 7;
      if (d <= half) {
        const t = Math.max(0, d / half - PAGODA_RIDGE) / (1 - PAGODA_RIDGE);
        return g.roofTop + 3 + Math.round(fall * t ** 1.6);
      }
      // Past the walls the eaves sweep up again.
      const u = Math.min(1, (d - half) / PAGODA_EAVES);
      return g.roofTop + 3 + Math.round(fall - 4 * u ** 1.5);
    }
    default:
      return g.roofTop;
  }
}

// ── Chimneys ─────────────────────────────────────────────────────────────

type Chimney = "brick" | "stone" | "crooked" | "flue" | "stack";

const CHIMNEYS: Record<RoomStyle, Chimney | null> = {
  cottage: "brick",
  medieval: "stone",
  fantasy: "crooked",
  elven: null,
  cave: "stone",
  scifi: null,
  modern: "flue",
  cabin: "stone",
  japanese: null,
  steampunk: "stack",
};

/** How far over the roof each chimney's smoke starts. */
const CHIMNEY_RISE: Record<Chimney, number> = { brick: 16, stone: 13, crooked: 18, flue: 15, stack: 22 };
/** The chimney stands over a footprint this wide at `chimneyX`. */
export const CHIMNEY_FOOT = 10;

/** How far over the roof the smoke starts, or null for a house without a
 *  chimney. */
export function chimneyRise(style: RoomStyle): number | null {
  const kind = CHIMNEYS[style];
  return kind ? CHIMNEY_RISE[kind] : null;
}

/** Where the chimney meets the roof: the higher of its two sides. */
export function chimneyFoot(style: RoomStyle, g: Box, chimneyX: number): number {
  return Math.min(roofTopAt(style, g, chimneyX), roofTopAt(style, g, chimneyX + CHIMNEY_FOOT - 1));
}

/** A run of bricks: mortar every third row, joints staggered. */
function bricks(R: Rect[], x: number, y: number, w: number, h: number, paint = "outer", mortar = "outer-lo") {
  R.push([x, y, w, h, paint]);
  for (let row = 0; row * 3 < h; row++) {
    const ry = y + row * 3 + 2;
    if (ry < y + h) R.push([x, ry, w, 1, mortar]);
    for (let bx = x + (row % 2 ? 1 : 4); bx < x + w; bx += 6) {
      R.push([bx, y + row * 3, 1, Math.min(2, y + h - (y + row * 3)), mortar]);
    }
  }
}

/** Stones in courses, `course` rows deep, `block` dots long. */
function stones(R: Rect[], x: number, y: number, w: number, h: number, course: number, block: number, seed: number) {
  R.push([x, y, w, h, "stone"]);
  for (let row = 0; row * course < h; row++) {
    const ry = y + row * course;
    R.push([x, ry, w, 1, "stone-hi"]);
    if (ry + course - 1 < y + h) R.push([x, ry + course - 1, w, 1, "stone-lo"]);
    for (let bx = x + Math.floor(noise(row, seed) * block); bx < x + w; bx += block - 2 + Math.floor(noise(bx, row, seed) * 5)) {
      R.push([bx, ry, 1, Math.min(course, y + h - ry), "stone-lo"]);
    }
  }
}

function chimney(R: Rect[], g: HouseGeometry, style: RoomStyle): Shell["smoke"] {
  const kind = CHIMNEYS[style];
  if (!kind) return null;
  const foot = chimneyFoot(style, g, g.chimneyX);
  const top = foot - CHIMNEY_RISE[kind];
  const x = g.chimneyX;
  // Every stack runs down behind the roof to the top storey.
  switch (kind) {
    case "brick":
      bricks(R, x, top + 5, 10, g.floorsTop - top - 5, "brick", "brick-lo");
      R.push([x - 1, top + 3, 12, 1, "stone-hi"], [x - 1, top + 4, 12, 1, "stone-lo"]);
      R.push([x + 3, top, 4, 3, "pot"], [x + 3, top, 1, 3, "pot-hi"], [x + 2, top, 6, 1, "pot-lo"]);
      return { x: x + 3, y: top - 3, steam: false };
    case "stone":
      stones(R, x, top + 2, 10, g.floorsTop - top - 2, 4, 6, 3);
      R.push([x - 1, top, 12, 1, "stone-hi"], [x - 1, top + 1, 12, 1, "stone-deep"]);
      return { x: x + 3, y: top - 3, steam: false };
    case "crooked": {
      // Leaning a dot further for every few up, with a pot on top.
      for (let y = top + 4; y < g.floorsTop; y++) {
        const lean = Math.max(0, Math.floor((foot - y) / 5));
        const sx = x + 1 + Math.min(lean, 3);
        R.push([sx, y, 8, 1, (y - top) % 3 === 2 ? "stone-lo" : "stone"]);
        R.push([sx, y, 1, 1, "stone-hi"], [sx + 7, y, 1, 1, "stone-deep"]);
      }
      const px = x + 1 + Math.min(Math.max(0, Math.floor((foot - top - 4) / 5)), 3);
      R.push([px - 1, top + 3, 10, 1, "stone-deep"], [px + 2, top, 4, 3, "pot"], [px + 2, top, 1, 3, "pot-hi"]);
      return { x: px + 2, y: top - 3, steam: false };
    }
    case "flue":
      R.push([x + 3, top + 2, 4, g.floorsTop - top - 2, "metal"], [x + 3, top + 2, 1, g.floorsTop - top - 2, "metal-hi"]);
      R.push([x + 6, top + 2, 1, g.floorsTop - top - 2, "metal-lo"], [x + 1, top, 8, 2, "metal-lo"], [x + 1, top, 8, 1, "metal"]);
      return { x: x + 3, y: top - 3, steam: false };
    case "stack":
      R.push([x + 2, top + 3, 6, g.floorsTop - top - 3, "metal"], [x + 2, top + 3, 1, g.floorsTop - top - 3, "metal-hi"]);
      R.push([x + 7, top + 3, 1, g.floorsTop - top - 3, "metal-lo"]);
      for (let y = top + 7; y < foot; y += 6) R.push([x + 2, y, 6, 2, "copper"], [x + 2, y, 6, 1, "copper-hi"]);
      R.push([x, top, 10, 1, "copper-hi"], [x, top + 1, 10, 2, "copper"], [x + 1, top + 2, 8, 1, "copper-lo"]);
      return { x: x + 3, y: top - 3, steam: true };
  }
}

/** Columns from x0 to x1 (exclusive), each painted from top(x) to
 *  bottom(x), with neighbours that match merged into one rectangle. */
function columns(
  R: Rect[],
  x0: number,
  x1: number,
  top: (x: number) => number,
  bottom: (x: number) => number,
  paint: string,
) {
  let start = x0;
  let t = top(x0);
  let b = bottom(x0);
  for (let x = x0 + 1; x <= x1; x++) {
    const nt = x < x1 ? top(x) : NaN;
    const nb = x < x1 ? bottom(x) : NaN;
    if (nt !== t || nb !== b) {
      if (b > t) R.push([start, t, x - start, b - t, paint]);
      start = x;
      t = nt;
      b = nb;
    }
  }
}

const ATTIC = [
  "....DDDD....",
  "..DDwwwwDD..",
  ".DwwAAAAwwD.",
  ".DwAAAWAAwD.",
  "DwAAAAWAAAwD",
  "DwWWWWWWWWwD",
  "DwAAAAWAAAwD",
  ".DwAAAWAAwD.",
  ".DwwAAAAwwD.",
  "..DDwwwwDD..",
  "....DDDD....",
];
/** Attic windows glow at night: their glass is its own paint. */
const atticGlass = (r: Rect): Rect => (r[4] === "glass" ? [r[0], r[1], r[2], r[3], "attic"] : r);

function roof(R: Rect[], over: Rect[], g: HouseGeometry, style: RoomStyle, shell: Shell) {
  const shape = ROOFS[style];
  const gable = GABLES[shape];
  const { houseX: hx, houseW: hw, roofTop, roofH: H, floorsTop } = g;
  const cx = hx + Math.floor(hw / 2);

  if (shape === "steep") {
    // Fish-scale slates on every gable, the nearer ones outlined over the
    // ones behind. A round window in each, lit at night, and the spire.
    const left = hx - gable!.eaves;
    const right = hx + hw + gable!.eaves;
    const peaks = steepPeaks(g);
    for (const p of peaks) {
      for (let r = H - p.h; r < H; r++) {
        const half = r - (H - p.h) + 1;
        const x0 = Math.max(left, Math.round(p.c - half));
        const x1 = Math.min(right, Math.round(p.c + half));
        const y = roofTop + r;
        const row = r % 3;
        R.push([x0, y, x1 - x0, 1, row === 0 ? "roof-hi" : row === 2 ? "roof-lo" : "roof"]);
        if (row === 1) {
          const offset = Math.floor(r / 3) % 2 ? 2 : 0;
          for (let x = x0 + ((((offset - x0) % 4) + 4) % 4); x < x1; x += 4) R.push([x, y, 1, 1, "roof-lo"]);
        }
        R.push([x0, y, 2, 1, "roof-deep"], [x1 - 2, y, 2, 1, "roof-deep"]);
      }
      if (p.h < H && p.h >= 18) {
        const wx = Math.round(p.c) - 3;
        const wy = floorsTop - Math.round(p.h * 0.45);
        R.push(...grid(["..TT..", ".TAAT.", "TAAAAT", "TAAAAT", ".TAAT.", "..TT.."], wx, wy).map(atticGlass));
        shell.lights.push({ x: wx + 3, y: wy + 3, r: 9 });
      }
    }
    R.push([left, floorsTop - 1, right - left, 1, "roof-deep"]);
    const ax = cx - 6;
    const ay = floorsTop - 17;
    R.push(...grid(ATTIC, ax, ay).map(atticGlass));
    shell.lights.push({ x: cx, y: ay + 6, r: 16 });
    const spireX = Math.round(peaks[peaks.length - 1].c) - 1;
    for (let k = 0; k < 18; k++) {
      const w = Math.max(1, Math.round(7 * (1 - k / 18)));
      const y = roofTop - 1 - k;
      const x0 = spireX - Math.floor(w / 2);
      R.push([x0, y, w, 1, "roof"], [x0, y, Math.ceil(w / 2), 1, "roof-hi"]);
      if (k % 4 === 1 && w > 2) R.push([x0, y, w, 1, "roof-lo"]);
    }
    R.push(...grid(["..$..", ".$$$.", "$$b$$", ".$$$.", "..$.."], spireX - 2, roofTop - 23));
    return;
  }

  if (gable) {
    const left = hx - gable.eaves;
    const right = hx + hw + gable.eaves;
    for (let r = 0; r < H; r++) {
      const inset = (H - 1 - r) * gable.slope;
      const x0 = left + inset;
      const x1 = right - inset;
      const y = roofTop + r;
      const row = r % 3;
      const course = Math.floor(r / 3);
      if (shape === "low") {
        // Boards under a thick turf, grass along both slopes and the ridge.
        R.push([x0, y, x1 - x0, 1, "roof"]);
        for (let x = x0 + 4 + ((x0 + 1) % 4); x < x1 - 4; x += 4) R.push([x, y, 1, 1, "roof-lo"]);
        const turf = r === 0 ? x1 - x0 : Math.min(5, Math.floor((x1 - x0) / 2));
        R.push([x0, y, turf, 1, "grass"], [x1 - turf, y, turf, 1, "grass"]);
        R.push([x0, y, 1, 1, "grass-hi"], [x1 - 1, y, 1, 1, "grass-hi"]);
        if (r > 0) R.push([x0 + turf, y, 1, 1, "soil"], [x1 - turf - 1, y, 1, 1, "soil"]);
        if (r === 0) R.push([x0, y - 1, x1 - x0, 1, "grass-hi"]);
        for (const fx of [x0 + 1, x1 - 3]) {
          if (noise(fx, y, 5) < 0.18) R.push([fx + 1, y, 1, 1, "flower"]);
        }
        continue;
      }
      if (shape === "metal") {
        // Copper sheets with standing seams, rivets, and a bloom of patina.
        R.push([x0, y, x1 - x0, 1, "roof"]);
        for (let x = x0 + ((((3 - x0) % 7) + 7) % 7); x < x1 - 1; x += 7) {
          R.push([x, y, 1, 1, "roof-hi"], [x + 1, y, 1, 1, "roof-lo"]);
          if (r % 5 === 2) R.push([x + 3, y, 1, 1, "roof-deep"]);
        }
        for (let x = x0 + 2; x < x1 - 2; x += 3) if (noise(x, y, 9) < 0.07) R.push([x, y, 2, 1, "patina"]);
        R.push([x0, y, 2, 1, "roof-deep"], [x1 - 2, y, 2, 1, "roof-deep"]);
        continue;
      }
      // Shingles.
      R.push([x0, y, x1 - x0, 1, row === 0 ? "roof-hi" : row === 2 ? "roof-lo" : "roof"]);
      if (row === 1) {
        const offset = course % 2 ? 3 : 0;
        for (let x = x0 + ((((offset - x0) % 6) + 6) % 6); x < x1; x += 6) R.push([x, y, 1, 1, "roof-lo"]);
      }
      R.push([x0, y, 2, 1, "roof-deep"], [x1 - 2, y, 2, 1, "roof-deep"]);
    }
    const ridge = left + (H - 1) * gable.slope;
    const ridgeEnd = right - (H - 1) * gable.slope;
    if (shape !== "low") R.push([ridge, roofTop, ridgeEnd - ridge, 1, "roof-deep"]);
    R.push([left, floorsTop - 1, right - left, 1, "roof-deep"]);

    // A round attic window in a tall enough gable.
    if (shape === "gable" && H >= 20) {
      const ax = cx - 6;
      const ay = floorsTop - 17;
      R.push(...grid(ATTIC, ax, ay).map(atticGlass));
      shell.lights.push({ x: cx, y: ay + 6, r: 16 });
    }
    // A gear turning on the workshop's gable.
    if (shape === "metal" && H >= 18) {
      const gearArt = gear();
      R.push(...grid(["...TTTTT...", ".TTTTTTTTT.", ".TTTTTTTTT.", "TTTTTTTTTTT", "TTTTTTTTTTT", "TTTTTTTTTTT", "TTTTTTTTTTT", "TTTTTTTTTTT", ".TTTTTTTTT.", ".TTTTTTTTT.", "...TTTTT..."], cx - 5, floorsTop - 15).map((r): Rect => [r[0], r[1], r[2], r[3], "roof-deep"]));
      shell.moving.push({ x: cx - 7, y: floorsTop - 17, art: gearArt.art, frames: gearArt.frames, motion: "turn" });
    }
    return;
  }

  switch (shape) {
    case "battlements": {
      // A parapet of merlons and crenels on a band of corbels, the banner
      // flying from a pole in the middle.
      const x0 = hx - 2;
      const x1 = hx + hw + 2;
      const n = Math.max(3, Math.floor((x1 - x0 + 4) / 10));
      const pitch = (x1 - x0 - 6) / (n - 1);
      for (let i = 0; i < n; i++) {
        const mx = Math.round(x0 + i * pitch);
        R.push([mx, roofTop, 6, 5, "outer"], [mx, roofTop, 6, 1, "outer-hi"], [mx + 5, roofTop + 1, 1, 4, "outer-lo"]);
      }
      R.push([x0, roofTop + 5, x1 - x0, 5, "outer"], [x0, roofTop + 5, x1 - x0, 1, "outer-hi"]);
      for (let x = x0 + 3; x < x1; x += 7) R.push([x, roofTop + 6, 1, 4, "outer-lo"]);
      R.push([x0, roofTop + 9, x1 - x0, 1, "outer-lo"]);
      for (let x = x0 + 1; x < x1 - 1; x += 4) R.push([x, roofTop + 10, 2, 1, "outer-lo"]);
      R.push([hx, roofTop + 11, hw, 1, "roof-deep"]);
      // Flagpole and banner.
      R.push([cx, roofTop - 16, 1, 21, "metal"], [cx - 1, roofTop - 17, 3, 2, "brass"]);
      const banner = flag();
      shell.moving.push({ x: cx + 1, y: roofTop - 15, art: banner.art, frames: banner.frames, motion: "wave" });
      return;
    }
    case "flat": {
      // A thin slab overhanging the walls, with a dark band under it.
      const x0 = hx - 6;
      const x1 = hx + hw + 6;
      R.push([x0, roofTop, x1 - x0, 1, "roof-hi"], [x0, roofTop + 1, x1 - x0, 4, "roof"], [x0, roofTop + 5, x1 - x0, 1, "roof-lo"]);
      R.push([hx, roofTop + 6, hw, 2, "trim"]);
      R.push([x0, roofTop + 1, 1, 4, "roof-lo"], [x1 - 1, roofTop + 1, 1, 4, "roof-deep"]);
      return;
    }
    case "dome": {
      // Riveted panels in rings, portholes round the middle, an antenna.
      const rx = hw / 2 + 2;
      const cxf = hx + hw / 2;
      const half = (y: number) => ellipseHalf(rx, H, floorsTop - y);
      for (let y = roofTop; y < floorsTop; y++) {
        const w = half(y + 0.5);
        if (w < 0.5) continue;
        const a = Math.round(cxf - w);
        const b = Math.round(cxf + w);
        const fromBase = floorsTop - y;
        R.push([a, y, b - a, 1, fromBase % 7 === 0 ? "roof-lo" : "roof"]);
        R.push([a, y, 1, 1, "roof-deep"], [b - 1, y, 1, 1, "roof-deep"]);
        // Two meridians, and the shine on the upper left.
        for (const f of [-0.5, 0.5]) R.push([Math.round(cxf + f * w), y, 1, 1, "roof-lo"]);
        if (fromBase > H * 0.45) R.push([Math.round(cxf - w * 0.62), y, Math.max(1, Math.round(w * 0.12)), 1, "roof-hi"]);
      }
      const py = floorsTop - Math.round(H * 0.38);
      const pw = half(py) - 6;
      for (let x = Math.round(cxf - pw); x + 4 <= cxf + pw; x += 11) {
        R.push([x, py - 1, 4, 3, "roof-deep"], [x + 1, py, 2, 1, "light"]);
        shell.lights.push({ x: x + 2, y: py, r: 7 });
      }
      R.push([hx - 2, floorsTop - 1, hw + 4, 1, "roof-deep"]);
      // Antenna.
      R.push([cx, roofTop - 12, 1, 13, "metal"], [cx - 3, roofTop - 8, 7, 1, "metal-lo"], [cx - 2, roofTop - 4, 5, 1, "metal-lo"]);
      shell.moving.push({
        x: cx - 1,
        y: roofTop - 15,
        art: { w: 3, h: 3, rects: [] },
        frames: [[[1, 0, 1, 3, "light"], [0, 1, 3, 1, "light"]]],
        motion: "blink",
      });
      shell.lights.push({ x: cx, y: roofTop - 14, r: 9 });
      return;
    }
    case "hill": {
      // A slice through a grassy hill with the rooms dug into it: earth
      // over the top floor and down both sides to the ground, thick turf
      // over it all, stones and roots in the earth. Drawn over the garden
      // (and its strip of grass), so it goes in `over`; it stays clear of
      // the storeys.
      const top = (x: number) => roofTopAt(style, g, x);
      const ground = floorsTop + g.floorCount * g.storey + g.beam + g.foundation + g.ground;
      const inside = (x: number) => x >= hx && x < hx + hw;
      const under = (x: number) => (inside(x) ? floorsTop : ground);
      columns(over, 0, g.sceneW, top, under, "soil");
      for (let y = roofTop + 5; y < ground - 1; y += 3) {
        for (let x = 1 + (Math.floor(y / 3) % 2) * 2; x < g.sceneW - 3; x += 5) {
          const jx = x + Math.floor(noise(x, y, 22) * 3);
          if (jx + 3 > g.sceneW || y < top(jx) + 6 || y + 2 >= under(jx)) continue;
          const n = noise(jx, y, 23);
          if (n < 0.05) over.push([jx, y, 3, 2, "stone"], [jx, y, 2, 1, "stone-hi"], [jx + 2, y + 1, 1, 1, "stone-lo"]);
          else if (n < 0.17) over.push([jx, y, 2, 1, "soil-lo"]);
        }
      }
      // Roots hanging down from the turf.
      for (let x = 3; x < g.sceneW - 3; x += 7 + Math.floor(noise(x, 4, 24) * 9)) {
        const t = top(x) + 5;
        const len = 3 + Math.floor(noise(x, 5, 24) * 6);
        for (let k = 0; k < len && t + k < under(x) - 1; k++) over.push([x + ((k >> 2) % 2), t + k, 1, 1, "soil-lo"]);
      }
      // Turf: a bright edge, then grass four or five deep, ragged
      // underneath, with tufts and flowers on top.
      columns(over, 0, g.sceneW, top, (x) => Math.min(under(x), top(x) + 4 + (noise(x >> 1, 6, 25) < 0.4 ? 1 : 0)), "grass");
      columns(over, 0, g.sceneW, top, (x) => Math.min(under(x), top(x) + 1), "grass-hi");
      for (let x = 1; x < g.sceneW - 1; x++) {
        const t = top(x);
        const n = noise(x, 1, 21);
        if (n < 0.05) over.push([x, t - 1, 1, 1, "flower"]);
        else if (n < 0.24) over.push([x, t - 1, 1, 1, "grass-hi"]);
        if (noise(x, 7, 21) < 0.12) over.push([x, t + 2, 1, 1, "grass-hi"]);
      }
      R.push([hx - 1, floorsTop - 1, hw + 2, 1, "stone-deep"]);
      return;
    }
    case "canopy": {
      // A roof of leaves on a pale arch, blossom in it, vines trailing over
      // the walls.
      const rx = hw / 2 + 6;
      const cxf = hx + hw / 2;
      const x0 = Math.ceil(cxf - rx);
      const x1 = Math.floor(cxf + rx);
      const edge = (x: number) => roofTopAt(style, g, x) + (noise(x >> 1, 0, 33) < 0.35 ? 1 : 0);
      columns(R, x0, x1, edge, () => floorsTop - 1, "leaf-lo");
      columns(R, x0, x1, edge, (x) => Math.min(floorsTop - 1, edge(x) + Math.round(H * 0.5)), "leaf");
      for (let y = roofTop; y < floorsTop - 2; y += 2) {
        for (let x = x0 + ((y >> 1) % 3); x < x1; x += 3) {
          if (edge(x) > y) continue;
          const n = noise(x, y, 34);
          const lit = x < cxf - (y - roofTop) * 0.4;
          if (n < (lit ? 0.32 : 0.14)) R.push([x, y, 2, 1, "leaf-hi"]);
          else if (n > 0.9) R.push([x, y, 2, 1, "leaf-lo"]);
          else if (n > 0.86 && y > roofTop + 2) R.push([x, y, 1, 1, "paper"]);
        }
      }
      R.push([hx - 2, floorsTop - 2, hw + 4, 1, "bark"], [hx - 2, floorsTop - 1, hw + 4, 1, "bark-lo"]);
      for (let x = hx - 1; x < hx + hw; x += 9 + Math.floor(noise(x, 9) * 6)) {
        const len = 3 + Math.floor(noise(x, 10) * 7);
        for (let k = 0; k < len; k++) over.push([x + ((k >> 1) % 2), floorsTop + k, 1, 1, k % 3 === 2 ? "leaf-hi" : "leaf"]);
      }
      return;
    }
    case "pagoda": {
      // Curved tiles sweeping up at the eaves, a heavy ridge with upturned
      // ends, and a paper lantern hung from each corner.
      const half = hw / 2;
      const cxf = hx + half;
      const x0 = Math.floor(cxf - half - PAGODA_EAVES);
      const x1 = Math.ceil(cxf + half + PAGODA_EAVES);
      const top = (x: number) => roofTopAt(style, g, x);
      const under = (x: number) => (Math.abs(x + 0.5 - cxf) <= half ? floorsTop : top(x) + 4);
      columns(R, x0, x1, top, under, "roof");
      for (let x = x0 + 1; x < x1; x += 3) columns(R, x, x + 1, top, under, "roof-lo");
      columns(R, x0, x1, (x) => under(x) - 1, under, "roof-deep");
      columns(R, x0, x1, top, (x) => top(x) + 1, "roof-hi");
      const ridgeHalf = Math.round(half * PAGODA_RIDGE) + 3;
      R.push([Math.round(cxf - ridgeHalf), roofTop, ridgeHalf * 2, 3, "roof-deep"], [Math.round(cxf - ridgeHalf), roofTop, ridgeHalf * 2, 1, "roof-lo"]);
      for (const [ex, dir] of [[Math.round(cxf - ridgeHalf) - 2, 1], [Math.round(cxf + ridgeHalf), -1]] as const) {
        R.push([ex, roofTop - 3, 2, 6, "roof-deep"], [ex + (dir === 1 ? 0 : 1), roofTop - 4, 1, 1, "roof-deep"]);
      }
      for (const lx of [x0 + 2, x1 - 6]) {
        const ly = top(lx + 2) + 4;
        R.push([lx + 1, ly, 1, 2, "ink"], ...grid([".JJ.", "IIII", "IIII", "IIII", ".JJ."], lx - 0, ly + 2));
        shell.lights.push({ x: lx + 2, y: ly + 5, r: 10 });
      }
      return;
    }
  }
}

/** A brass gear, 15 × 15, in two frames half a tooth apart. */
function gear(): { art: Art; frames: Rect[][] } {
  const a = grid([
    "......bbb......",
    "..b...BBB...b..",
    ".bBB.BBBBB.BBn.",
    "..BBBBBBBBBBn..",
    "...BBBnnnBBB...",
    ".bBBBBn..nBBBn.",
    "bBBBBn....nBBBn",
    "bBBBn..K..nBBBn",
    "bBBBBn....nBBBn",
    ".bBBBBn..nBBBn.",
    "...BBBnnnBBB...",
    "..bBBBBBBBBBB..",
    ".bnB.BBBBB.Bnn.",
    "..n...BBB...n..",
    "......nnn......",
  ]);
  const b = grid([
    "...b.......b...",
    "..bBB.BBB.BBn..",
    "...BBBBBBBBBB..",
    ".bBBBBBBBBBBBn.",
    "..BBBBnnnBBBB..",
    "..BBBn...nBBB..",
    "bBBBBn....nBBBB",
    ".BBBn..K..nBBB.",
    "bBBBBn....nBBBB",
    "..BBBn...nBBB..",
    "..BBBBnnnBBBB..",
    ".bBBBBBBBBBBBn.",
    "...BBBBBBBBBB..",
    "..bnn.BBB.nn...",
    "...n.......n...",
  ]);
  return { art: { w: 15, h: 15, rects: [] }, frames: [a, b] };
}

/** The castle's banner, 12 × 9, in two frames as it ripples. */
function flag(): { art: Art; frames: Rect[][] } {
  const a = grid([
    "CCCCCCCCCC..",
    "CcccCCCCCCCC",
    "CcbbBCCCCCCx",
    "CcbBBCCCCCxx",
    "CCbBBCCCCxx.",
    "CCCCCCCCCxx.",
    "CCCCCCCCCCxx",
    "xxCCCCCCCCCx",
    "..xxxxCCxx..",
  ]);
  const b = grid([
    "CCCCCCCC....",
    "CcccCCCCCC..",
    "CcbbBCCCCCCC",
    "CcbBBCCCCCCx",
    "CCbBBCCCCCxx",
    "CCCCCCCCCCx.",
    "CCCCCCCCCxx.",
    "xCCCCCCCCCCx",
    ".xxxCCCxxxxx",
  ]);
  return { art: { w: 12, h: 9, rects: [] }, frames: [a, b] };
}

// ── Walls and floors ─────────────────────────────────────────────────────

type Pattern = Exclude<RoomPaper, "style">;
const PATTERNS: Record<RoomStyle, Pattern> = {
  cottage: "stripes",
  medieval: "stones",
  fantasy: "stars",
  elven: "vines",
  cave: "rock",
  scifi: "panels",
  modern: "plain",
  cabin: "logs",
  japanese: "shoji",
  steampunk: "pipes",
};
/** Styles with a panelled dado round the bottom of the walls. */
const WAINSCOT = new Set<RoomStyle>(["cottage", "fantasy", "elven", "steampunk"]);

type Outside = "brick" | "ashlar" | "timber" | "birch" | "rock" | "hull" | "render" | "logs" | "posts";
const OUTSIDE: Record<RoomStyle, Outside> = {
  cottage: "brick",
  medieval: "ashlar",
  fantasy: "timber",
  elven: "birch",
  cave: "rock",
  scifi: "hull",
  modern: "render",
  cabin: "logs",
  japanese: "posts",
  steampunk: "brick",
};

type Boards = Exclude<RoomFloor, "style">;
const FLOORS: Record<RoomStyle, Boards> = {
  cottage: "boards",
  medieval: "flags",
  fantasy: "boards",
  elven: "boards",
  cave: "flags",
  scifi: "grate",
  modern: "planks",
  cabin: "boards",
  japanese: "tatami",
  steampunk: "boards",
};

/** The floor seen from the front, over a joist. The style's own floor is
 *  in the style's floor colour; a floor chosen for itself is in its own
 *  stuff: stone flags, tiles, carpet in the fabric colour, straw tatami,
 *  a metal grate, or boards in the wood. */
function floor(R: Rect[], kind: Boards, own: boolean, x: number, y: number, w: number, h: number) {
  const from = R.length;
  drawFloor(R, kind, own, x, y, w, h);
  clip(R, from, x, y, x + w, y + h);
}

function drawFloor(R: Rect[], kind: Boards, own: boolean, x: number, y: number, w: number, h: number) {
  const [hi, mid, lo] = own
    ? (
        {
          boards: ["floor-hi", "floor", "floor-lo"],
          planks: ["floor-hi", "floor", "floor-lo"],
          parquet: ["floor-hi", "floor", "floor-lo"],
          flags: ["stone-hi", "stone", "stone-lo"],
          tiles: ["tile", "tile", "tile-lo"],
          carpet: ["rug", "rug", "rug-3"],
          tatami: ["wicker-hi", "wicker", "wicker-lo"],
          grate: ["metal-hi", "metal", "metal-lo"],
        } as const
      )[kind]
    : (["floor-hi", "floor", "floor-lo"] as const);
  R.push([x, y, w, 1, hi], [x, y + 1, w, h - 3, mid], [x, y + h - 2, w, 2, "wood-deep"]);
  switch (kind) {
    case "boards":
    case "planks":
      for (let bx = x + 7; bx < x + w; bx += kind === "boards" ? 14 : 22) R.push([bx, y + 1, 1, h - 3, lo]);
      return;
    case "parquet":
      // Herringbone, end on: short blocks that step up and down.
      for (let bx = x + 1; bx < x + w - 2; bx += 6) R.push([bx, y + 1, 3, 1, lo], [bx + 3, y + 2, 3, 1, lo]);
      return;
    case "flags":
      for (let bx = x + 5; bx < x + w; bx += 11 + Math.floor(noise(bx, y) * 6)) R.push([bx, y, 1, h - 2, lo]);
      return;
    case "tiles":
      // Chequered, two rows of squares.
      for (let bx = x, i = 0; bx < x + w; bx += 4, i++) {
        const tw = Math.min(4, x + w - bx);
        R.push([bx, y + (i % 2 ? 1 : 2), tw, 1, lo]);
        if (i % 2 === 0) R.push([bx, y, tw, 1, lo]);
      }
      return;
    case "carpet":
      for (let bx = x + 3; bx < x + w - 1; bx += 6) R.push([bx, y + 1, 2, 1, "rug-2"]);
      R.push([x, y, w, 1, "rug-fringe"]);
      return;
    case "grate":
      for (let bx = x + 1; bx < x + w; bx += 2) R.push([bx, y + 1, 1, h - 3, lo]);
      return;
    case "tatami":
      for (let bx = x + 12; bx < x + w; bx += 30) R.push([bx, y, 2, h - 2, lo]);
      return;
  }
}

/** Trims the rects pushed onto `R` since `from` to the box from `x0`,`y0`
 *  to `x1`,`y1`, so a pattern never spills over what's beside it. */
function clip(R: Rect[], from: number, x0: number, y0: number, x1: number, y1: number) {
  const kept = R.splice(from).flatMap(([x, y, w, h, paint]): Rect[] => {
    const cx = Math.max(x, x0);
    const cy = Math.max(y, y0);
    const cw = Math.min(x + w, x1) - cx;
    const ch = Math.min(y + h, y1) - cy;
    return cw > 0 && ch > 0 ? [[cx, cy, cw, ch, paint]] : [];
  });
  R.push(...kept);
}

/** The pattern on the inside walls, between `y0` and `y1`. */
function wallPattern(R: Rect[], pattern: Pattern, x0: number, w: number, y0: number, y1: number) {
  const from = R.length;
  drawPattern(R, pattern, x0, w, y0, y1);
  clip(R, from, x0, y0, x0 + w, y1);
}

function drawPattern(R: Rect[], pattern: Pattern, x0: number, w: number, y0: number, y1: number) {
  const x1 = x0 + w;
  const h = y1 - y0;
  switch (pattern) {
    case "damask":
      // Lozenges, tone on tone, in a half-drop.
      for (let row = 0, y = y0 + 3; y < y1 - 6; row++, y += 11) {
        for (let x = x0 + 4 + (row % 2) * 7; x < x1 - 5; x += 14) {
          R.push(
            ...grid(["..K..", ".K.K.", "K.K.K", ".K.K.", "..K.."], x, y).map((r): Rect => [r[0], r[1], r[2], r[3], "wall-2"]),
          );
          R.push([x + 2, y + 2, 1, 1, "wall-hi"]);
        }
      }
      return;
    case "flowers":
      // Sprigs scattered over the wall: four petals round a bright eye.
      for (let row = 0, y = y0 + 4; y < y1 - 4; row++, y += 10) {
        for (let x = x0 + 4 + (row % 2) * 6; x < x1 - 4; x += 12) {
          const fx = x + Math.floor(noise(x, y, 91) * 3) - 1;
          const fy = y + Math.floor(noise(y, x, 92) * 3) - 1;
          R.push([fx, fy - 1, 1, 1, "wall-2"], [fx - 1, fy, 1, 1, "wall-2"], [fx + 1, fy, 1, 1, "wall-2"], [fx, fy + 1, 1, 1, "wall-2"]);
          R.push([fx, fy, 1, 1, "flower"]);
          if (noise(fx, fy, 93) < 0.6) R.push([fx + 1, fy + 2, 1, 1, "leaf-lo"], [fx + 2, fy + 3, 1, 1, "leaf-lo"]);
        }
      }
      return;
    case "trellis":
      // A diamond lattice, with a dot where the laths cross.
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const a = (((x - x0 + y - y0) % 12) + 12) % 12;
          const b = (((x - x0 - (y - y0)) % 12) + 12) % 12;
          if (a === 0 && b === 0) R.push([x, y, 1, 1, "wall-hi"]);
          else if (a === 0 || b === 0) R.push([x, y, 1, 1, "wall-2"]);
        }
      }
      return;
    case "tiles":
      // Brick-laid tiles, each lit along its top.
      for (let row = 0, y = y0; y < y1; row++, y += 6) {
        const th = Math.min(6, y1 - y);
        R.push([x0, y, w, 1, "wall-2"]);
        if (th > 2) R.push([x0, y + 1, w, 1, "wall-hi"]);
        for (let x = x0 + (row % 2 ? 6 : 0); x < x1; x += 12) R.push([x, y + 1, 1, th - 1, "wall-2"]);
      }
      return;
    case "stripes":
      for (let x = x0 + 5; x < x1; x += 10) R.push([x, y0, 1, h, "wall-2"], [x + 2, y0, 1, h, "wall-2"]);
      for (let x = x0 + 10; x < x1; x += 10) for (let y = y0 + 5; y < y1 - 3; y += 12) R.push([x, y, 1, 1, "wall-2"]);
      return;
    case "stones":
      for (let row = 0, y = y0 + 6; y < y1; row++, y += 9) {
        R.push([x0, y, w, 1, "wall-2"], [x0, y + 1, w, 1, "wall-hi"]);
        for (let x = x0 + (row % 2 ? 9 : 2); x < x1; x += 16) R.push([x, y - 8 < y0 ? y0 : y - 8, 1, y - 8 < y0 ? y - y0 : 8, "wall-2"]);
      }
      return;
    case "stars":
      for (let y = y0 + 4; y < y1 - 4; y += 13) {
        for (let x = x0 + 4 + ((y >> 2) % 2) * 6; x < x1 - 4; x += 12) {
          const n = noise(x, y, 41);
          if (n < 0.3) R.push([x, y - 1, 1, 3, "wall-2"], [x - 1, y, 3, 1, "wall-2"]);
          else if (n < 0.45) R.push(...grid([".KK", "K..", "K..", ".KK"], x - 1, y - 2).map((r): Rect => [r[0], r[1], r[2], r[3], "wall-2"]));
          else if (n < 0.8) R.push([x, y, 1, 1, "wall-2"]);
        }
      }
      return;
    case "vines":
      for (let vx = x0 + 9; vx < x1 - 3; vx += 26) {
        for (let y = y0; y < y1; y++) {
          const sway = Math.round(1.5 * Math.sin((y + vx) / 5));
          R.push([vx + sway, y, 1, 1, "wall-2"]);
          if ((y + vx) % 7 === 0) R.push([vx + sway + ((y >> 3) % 2 ? 1 : -2), y, 2, 1, "wall-2"]);
        }
      }
      return;
    case "rock":
      // Rough-hewn rock: lumps lit from the upper left, and cracks.
      for (let row = 0, y = y0 + 2; y < y1 - 4; row++, y += 7) {
        for (let x = x0 + 1 + (row % 2) * 5; x < x1 - 7; x += 10) {
          const n = noise(x, y, 51);
          const jx = x + Math.floor(noise(y, x, 52) * 3);
          const jy = y + Math.floor(noise(x, y, 53) * 2);
          if (n < 0.55) {
            const rw = 4 + Math.floor(noise(jx, jy, 54) * 4);
            const rh = 3 + Math.floor(noise(jy, jx, 55) * 2);
            R.push([jx + 1, jy, rw - 2, 1, "wall-hi"], [jx, jy + 1, 1, rh - 2, "wall-hi"]);
            R.push([jx + 1, jy + rh - 1, rw - 2, 1, "wall-2"], [jx + rw - 1, jy + 1, 1, rh - 2, "wall-2"]);
          } else if (n < 0.7) {
            R.push([jx, jy, 1, 2, "wall-2"], [jx + 1, jy + 2, 1, 2, "wall-2"], [jx + 2, jy + 4, 1, 1, "wall-2"]);
          }
        }
      }
      return;
    case "panels":
      R.push([x0, y0 + 1, w, 1, "light"], [x0, y0 + 2, w, 1, "wall-hi"]);
      for (let x = x0 + 12; x < x1 - 2; x += 24) {
        R.push([x, y0 + 4, 1, h - 4, "wall-2"]);
        for (const y of [y0 + 6, y1 - 3]) R.push([x - 3, y, 1, 1, "wall-2"], [x + 3, y, 1, 1, "wall-2"]);
      }
      R.push([x0, y0 + Math.floor(h / 2), w, 1, "wall-2"]);
      return;
    case "plain":
      // A cove of light along the ceiling, and a picture rail.
      R.push([x0, y0, w, 1, "trim"], [x0, y0 + 1, w, 1, "light"], [x0, y0 + 2, w, 1, "wall-hi"]);
      R.push([x0, y0 + 10, w, 1, "wall-2"]);
      return;
    case "logs":
      for (let y = y0 - 1; y < y1; y += 6) {
        R.push([x0, y, w, 1, "wall-hi"], [x0, y + 4, w, 2, "wall-2"]);
        for (let x = x0 + 3; x < x1; x += 9) if (noise(x, y, 61) < 0.25) R.push([x, y + 2, 3, 1, "wall-2"]);
      }
      return;
    case "shoji":
      for (let x = x0 + 2; x < x1 - 1; x += 40) {
        const px = Math.min(x + 40, x1 - 2);
        R.push([x, y0, 2, h, "trim"]);
        for (let bx = x + 9; bx < px - 2; bx += 8) R.push([bx, y0, 1, h, "trim"]);
        for (let by = y0 + 8; by < y1 - 2; by += 10) R.push([x, by, px - x, 1, "trim"]);
      }
      R.push([x1 - 2, y0, 2, h, "trim"]);
      return;
    case "pipes": {
      for (let y = y0 + 14; y < y1 - 2; y += 8) {
        for (let x = x0 + 4 + ((y >> 3) % 2) * 4; x < x1 - 2; x += 8) R.push([x, y, 1, 1, "wall-2"], [x - 1, y + 1, 3, 1, "wall-2"], [x, y + 2, 1, 1, "wall-2"]);
      }
      R.push([x0, y0 + 4, w, 1, "copper-hi"], [x0, y0 + 5, w, 2, "copper"], [x0, y0 + 7, w, 1, "copper-lo"]);
      for (let x = x0 + 14; x < x1 - 3; x += 30) R.push([x, y0 + 3, 2, 6, "copper-lo"]);
      for (let x = x0 + 40; x < x1 - 8; x += 70) R.push(...grid([".nBn.", "nyyyn", "nyKyn", "nyyyn", ".nBn."], x, y0 + 12));
      return;
    }
  }
}

/** The outside walls of one storey, `x` the wall's left edge. */
function outside(R: Rect[], style: RoomStyle, x: number, top: number, w: number, h: number, left: boolean) {
  const outer = left ? x : x + w - 1;
  switch (OUTSIDE[style]) {
    case "brick":
      bricks(R, x, top, w, h);
      R.push([outer, top, 1, h, "outer-lo"]);
      return;
    case "ashlar":
      R.push([x, top, w, h, "outer"]);
      for (let row = 0, y = top; y < top + h; row++, y += 5) {
        R.push([x, y, w, 1, "outer-hi"], [x, Math.min(y + 4, top + h - 1), w, 1, "outer-lo"]);
        R.push([x + (row % 2 ? 1 : 3), y, 1, Math.min(5, top + h - y), "outer-lo"]);
      }
      return;
    case "timber":
      R.push([x, top, w, h, "outer"], [outer, top, 2, h, "trim"]);
      if (!left) R[R.length - 1] = [outer - 1, top, 2, h, "trim"];
      for (let y = top + 8; y < top + h - 4; y += 30) R.push([x, y, w, 2, "trim"]);
      return;
    case "posts":
      R.push([x, top, w, h, "outer"], [left ? x : x + w - 3, top, 3, h, "trim"]);
      for (let y = top + 12; y < top + h - 4; y += 34) R.push([x, y, w, 2, "trim"]);
      return;
    case "birch":
      R.push([x, top, w, h, "bark"], [outer, top, 1, h, "bark-lo"]);
      for (let y = top + 2; y < top + h; y += 3) {
        if (noise(x, y, 71) < 0.45) R.push([x + 1 + Math.floor(noise(y, x, 72) * (w - 3)), y, 2, 1, "bark-lo"]);
      }
      return;
    case "rock":
      R.push([x, top, w, h, "outer"]);
      for (let y = top; y < top + h; y += 4) {
        const n = noise(x, y, 81);
        if (n < 0.5) R.push([x + Math.floor(n * 8), y, 3, 1, "outer-lo"]);
        else R.push([x + Math.floor((n - 0.5) * 8), y + 1, 2, 2, "outer-hi"]);
      }
      R.push([outer, top, 1, h, "outer-lo"]);
      return;
    case "hull":
      R.push([x, top, w, h, "outer"], [outer, top, 1, h, "outer-lo"], [left ? x + w - 1 : x, top, 1, h, "outer-hi"]);
      for (let y = top + 10; y < top + h; y += 20) R.push([x, y, w, 1, "outer-lo"], [x + 2, y + 3, 1, 1, "outer-hi"]);
      R.push([x + 2, top + 4, 1, h - 8, "light"]);
      return;
    case "render":
      R.push([x, top, w, h, "outer"], [outer, top, 1, h, "outer-lo"], [left ? x + w - 1 : x, top, 1, h, "outer-hi"]);
      return;
    case "logs":
      R.push([x, top, w, h, "outer"]);
      for (let y = top; y < top + h; y += 6) {
        R.push([x, y, w, 1, "outer-hi"], [x, y + 4, w, 2, "outer-lo"]);
        R.push([outer, y + 1, 1, 3, "wood-hi"]);
      }
      return;
  }
}

/** How one storey is done up inside: its wallpaper, its floor (the
 *  boards it stands on), its walls colour, and what hangs along the top.
 *  `own` marks a floor chosen for itself rather than the style's. */
export interface StoreyLook {
  paper: Pattern;
  floor: Boards;
  ownFloor: boolean;
  walls: RoomWalls;
  ceiling: RoomCeiling;
}

/** How the inside of the house is done up (Decorate): wallpaper and floor
 *  for the house, what hangs along the ceilings, and each added room's
 *  own, by floor (`rooms`, top first, as in HousePlan). */
export interface Interior {
  paper: RoomPaper;
  floor: RoomFloor;
  ceiling: RoomCeiling;
  rooms: readonly (RoomKind | null)[];
  own: Partial<Record<RoomKind, RoomOwn>>;
}

export const PLAIN_INTERIOR: Interior = { paper: "style", floor: "style", ceiling: "none", rooms: [], own: {} };

/** Each storey's look, top first. */
export function storeyLooks(style: RoomStyle, interior: Interior, count: number): StoreyLook[] {
  return Array.from({ length: count }, (_, f) => {
    const room = interior.rooms[f];
    const own = room ? interior.own[room] : undefined;
    const paper = own && own.paper !== "style" ? own.paper : interior.paper;
    const floorKind = own && own.floor !== "style" ? own.floor : interior.floor;
    return {
      paper: paper === "style" ? PATTERNS[style] : paper,
      floor: floorKind === "style" ? FLOORS[style] : floorKind,
      ownFloor: floorKind !== "style",
      walls: own?.walls ?? "style",
      ceiling: interior.ceiling,
    };
  });
}

/** One storey's walls, its ceiling and what hangs from it; the beam over
 *  it is the floor of the storey above, `above`. */
function storey(R: Rect[], g: HouseGeometry, style: RoomStyle, f: number, look: StoreyLook, above: StoreyLook | null, twinkle: Rect[][]) {
  const { houseX: hx, houseW: hw, wall } = g;
  const inner = hw - 2 * wall;
  const beam = g.floorsTop + f * g.storey;
  const top = beam + g.beam;
  const floorLine = top + g.roomH;
  // The beam over this storey: under the roof it is the wall plate, else
  // it is the floor of the storey above.
  if (!above) R.push([hx, beam, hw, g.beam, "wood-deep"], [hx, beam + 1, hw, 2, "wood-lo"]);
  else floor(R, above.floor, above.ownFloor, hx, beam, hw, g.beam);

  const x0 = hx + wall;
  R.push([x0, top, inner, g.roomH, "wall"]);
  const dado = WAINSCOT.has(style);
  const kick = style === "japanese" ? 9 : 3;
  const patternEnd = dado ? floorLine - 28 : floorLine - kick;
  wallPattern(R, look.paper, x0, inner, top + 3, patternEnd);
  R.push([x0, top, inner, 1, "wood-lo"], [x0, top + 1, inner, 2, "wall-shadow"]);

  if (dado) {
    const rail = floorLine - 28;
    R.push([x0, rail, inner, 25, "wainscot"]);
    R.push([x0, rail, inner, 1, "wood-hi"], [x0, rail + 1, inner, 1, "wood"], [x0, rail + 2, inner, 1, "wood-lo"]);
    for (let x = x0 + 4; x + 16 <= x0 + inner - 2; x += 20) {
      R.push([x, rail + 6, 16, 1, "wainscot-lo"], [x, rail + 6, 1, 15, "wainscot-lo"]);
      R.push([x + 1, rail + 20, 15, 1, "wainscot-hi"], [x + 15, rail + 7, 1, 13, "wainscot-hi"]);
      if (style === "steampunk") R.push([x + 2, rail + 8, 1, 1, "brass"], [x + 13, rail + 8, 1, 1, "brass"], [x + 2, rail + 18, 1, 1, "brass"], [x + 13, rail + 18, 1, 1, "brass"]);
    }
  } else if (style === "japanese") {
    R.push([x0, floorLine - 9, inner, 6, "wainscot"], [x0, floorLine - 9, inner, 1, "trim"]);
  } else if (style === "scifi") {
    R.push([x0, floorLine - 6, inner, 3, "wainscot"], [x0, floorLine - 6, inner, 1, "light"]);
  }
  R.push([x0, floorLine - 3, inner, 2, "wood"], [x0, floorLine - 3, inner, 1, "wood-hi"], [x0, floorLine - 1, inner, 1, "wood-deep"]);
  ceiling(R, look.ceiling, x0, inner, top + 3, twinkle);

  outside(R, style, hx, top, wall, g.roomH, true);
  outside(R, style, hx + hw - wall, top, wall, g.roomH, false);
}

/** How far a string hung between two hooks `span` apart sags at `t` dots
 *  along it. */
const sag = (t: number, span: number, depth: number) => Math.round(depth * (1 - ((2 * t) / span - 1) ** 2));

/** What hangs along the top of a room's walls, from just under the
 *  ceiling at `y`: never lower than the tops of the bookcases. */
function ceiling(R: Rect[], kind: RoomCeiling, x0: number, w: number, y: number, twinkle: Rect[][]) {
  const x1 = x0 + w;
  switch (kind) {
    case "none":
      return;
    case "fairylights": {
      // Loops of wire between hooks, a bulb every few dots, in four
      // colours; at night they light up and twinkle in three sets.
      const span = 34;
      for (let hook = x0 + 1; hook < x1 - 2; hook += span) {
        const end = Math.min(hook + span, x1 - 1);
        for (let x = hook; x < end; x++) {
          const t = x - hook;
          const wy = y + sag(t, end - hook, 4);
          R.push([x, wy, 1, 1, "bulb-wire"]);
          if (t % 4 === 2) {
            const n = (x - x0) >> 2;
            twinkle[n % 3].push([x, wy + 1, 1, 2, `bulb-${(n % 4) + 1}`]);
          }
        }
        R.push([hook, y - 1, 1, 1, "brass"]);
      }
      return;
    }
    case "bunting": {
      const span = 46;
      const colours = ["chair", "cushion", "paper", "curtain-hi"] as const;
      for (let hook = x0 + 1; hook < x1 - 2; hook += span) {
        const end = Math.min(hook + span, x1 - 1);
        for (let x = hook; x < end; x++) R.push([x, y + sag(x - hook, end - hook, 5), 1, 1, "bulb-wire"]);
        for (let x = hook + 3, i = 0; x + 5 < end; x += 7, i++) {
          const fy = y + 1 + sag(x + 2 - hook, end - hook, 5);
          const paint = colours[(i + Math.floor((hook - x0) / span)) % colours.length];
          R.push([x, fy, 5, 1, paint], [x, fy + 1, 5, 1, paint], [x + 1, fy + 2, 3, 1, paint], [x + 1, fy + 3, 3, 1, paint], [x + 2, fy + 4, 1, 1, paint]);
          R.push([x, fy, 5, 1, "bulb-wire"]);
        }
      }
      return;
    }
    case "lanterns": {
      // Round paper lanterns on short cords; at night they glow like the
      // lampshades.
      const lantern = grid(["..n..", ".nBn.", "lLLLl", "LmLmL", "LmLmL", "lLLLl", ".nBn."]);
      for (let x = x0 + 14, i = 0; x < x1 - 8; x += 38, i++) {
        const drop = i % 2 ? 1 : 3;
        R.push([x + 2, y, 1, drop, "bulb-wire"]);
        R.push(...lantern.map((r): Rect => [r[0] + x, r[1] + y + drop, r[2], r[3], r[4]]));
      }
      return;
    }
    case "ivy":
      // A garland along the ceiling, with sprays hanging down here and there.
      for (let x = x0; x < x1; x++) {
        const vy = y + Math.round(1 + Math.sin((x - x0) / 4.5));
        R.push([x, vy, 1, 1, "leaf-lo"]);
        const n = noise(x, y, 95);
        if ((x - x0) % 3 === 0) R.push([x, vy + (n < 0.5 ? -1 : 1), 2, 1, n < 0.3 ? "leaf-hi" : "leaf"]);
        if (n > 0.93) {
          const fall = 3 + Math.floor(noise(y, x, 96) * 5);
          for (let d = 1; d <= fall; d++) R.push([x + (d % 3 === 0 ? 1 : 0), vy + d, 1, 1, d % 2 ? "leaf" : "leaf-lo"]);
        }
      }
      return;
  }
}

/** The wallpaper and floor a house style comes with. */
export const stylePaper = (style: RoomStyle): Pattern => PATTERNS[style];
export const styleFloor = (style: RoomStyle): Boards => FLOORS[style];

/** A piece of wall `w` × `h` with `paper` on it, for the wallpaper choices. */
export function wallSample(paper: Pattern, w: number, h: number): Art {
  const R: Rect[] = [[0, 0, w, h, "wall"]];
  wallPattern(R, paper, 0, w, 1, h - 1);
  return { w, h, rects: R };
}

/** A length of floor, for the floor choices: the boards as they meet the
 *  wall, over the joist. `own` paints it in its material rather than in
 *  the style's floor colour. */
export function floorSample(kind: Boards, w: number, own = true): Art {
  const R: Rect[] = [[0, 0, w, 3, "wall"], [0, 3, w, 2, "wood"], [0, 3, w, 1, "wood-hi"], [0, 5, w, 1, "wood-deep"]];
  floor(R, kind, own, 0, 6, w, 5);
  return { w, h: 11, rects: R };
}

/** The hanging decorations along a stretch of wall `w` wide. */
export function ceilingSample(kind: RoomCeiling, w: number, h: number): Art {
  const twinkle: Rect[][] = [[], [], []];
  const R: Rect[] = [[0, 0, w, h, "wall"], [0, 0, w, 1, "wood-lo"], [0, 1, w, 2, "wall-shadow"]];
  ceiling(R, kind, 0, w, 3, twinkle);
  return { w, h, rects: [...R, ...twinkle.flat()] };
}

// ── The garden ───────────────────────────────────────────────────────────

const SHRUB = art([
  "....gGGg......",
  "..gGGGGGGg.g..",
  ".gGGjGGGGGgGg.",
  "gGGGGGjGGGGGGg",
  "GGjGGGGGGjGGGG",
  "GGGGjGGGiGGjGG",
  "jGGGGGGGGGGGjj",
  ".jjGGjjGGjjjj.",
  "..jjjjjjjjjj..",
]);

/** A torch on a post, 5 × 22; its flame is drawn apart, to flicker. */
const TORCH = art([
  ".....",
  ".....",
  ".....",
  ".....",
  ".....",
  "nBBBn",
  ".nBn.",
  "..W..",
  "..W..",
  "..W..",
  "..d..",
  "..W..",
  "..W..",
  "..d..",
  "..W..",
  "..W..",
  "..d..",
  "..W..",
  "..d..",
  ".tSt.",
  "tSSSt",
  "tttTt",
]);
const TORCH_FLAMES = [grid(["..r..", ".rfr.", ".fFf.", "rfFfr", ".fFf."]), grid([".r...", "..rr.", ".rFf.", "rfFfr", ".fFf."])];

const TOADSTOOLS = art([
  "...*****.....",
  "..**y***y....",
  ".*****y***...",
  ".**y*****y...",
  "....yyy......",
  "....yyY..**..",
  "....yyY.*y**.",
  "....yyY..yY..",
  "...yyyYY.yY..",
]);

/** A silver birch `w` dots across: a tall oval crown, lit from the upper
 *  left, over a white trunk with dark marks. */
function birchArt(w: number): Art {
  const crownH = Math.round(w * 1.7);
  const trunkH = Math.round(w * 2.2);
  const cx = (w - 1) / 2;
  const cy = (crownH - 1) / 2;
  const rows: string[] = [];
  for (let y = 0; y < crownH; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const d = ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (crownH / 2)) ** 2;
      const n = noise(x, y, 91);
      if (d > 1 - n * 0.35) row += ".";
      else if (Math.abs(x - cx) < 1 && y > crownH * 0.55 && n < 0.5) row += "<";
      else if (x + y < cx + cy - 2 && n < 0.45) row += "g";
      else if (n > 0.78 || (x > cx + 1 && y > cy && n > 0.55)) row += "j";
      else row += "G";
    }
    rows.push(row);
  }
  const t = Math.floor(cx);
  for (let y = 0; y < trunkH; y++) {
    const mark = noise(y, 3, 92) < 0.22 ? ">" : "<";
    rows.push(".".repeat(t) + mark + (noise(y, 4, 92) < 0.15 ? ">" : "<") + ".".repeat(w - t - 2));
  }
  rows.push(".".repeat(t - 1) + "<<<<" + ".".repeat(w - t - 3));
  return art(rows);
}
const BIRCH = birchArt(13);
const BIG_BIRCH = birchArt(19);

const BEACON = art([
  ".....",
  ".....",
  ".+M=.",
  "..M..",
  "..M..",
  "..M..",
  "..M..",
  "..M..",
  "..M..",
  "..M..",
  "..M..",
  ".+M=.",
  "=====",
]);
const DISH = art([
  "+.........",
  ".+M......",
  ".MMM=....",
  ".+MMM=...",
  "..+MMM=..",
  "...+MM=..",
  "....=M...",
  ".....M...",
  "....=M=..",
  "...=====.",
]);

const PLANTER = art([
  "..g..g...g...",
  ".gG.gGg.gG.g.",
  ".GG.GG.gG.gG.",
  "..GjGG.GG.G..",
  "..jGjGjGjGj..",
  "JJJJJJJJJJJJJ",
  "J&QQQQQQQQQ#J",
  "J&QQQQQQQQQ#J",
  "J&QQQQQQQQQ#J",
  "JJJJJJJJJJJJJ",
]);
const TOPIARY = art([
  "...gGGGg...",
  "..gGGGGGGg.",
  ".gGGjGGGGGg",
  ".GGGGGjGGGG",
  ".GjGGGGGjGG",
  "..GGGjGGGG.",
  "...jjGGjj..",
  ".....d.....",
  ".....d.....",
  ".....d.....",
  ".....d.....",
  ".....d.....",
  ".....d.....",
  "...JJJJJ...",
  "...J&Q#J...",
  "...J&Q#J...",
  "...JJJJJ...",
]);

/** A spruce `w` dots across, in `tiers` of boughs, lit from the left. */
function pineArt(w: number, tiers: number): Art {
  const c = Math.floor(w / 2);
  const rows: string[] = [];
  for (let t = 0; t < tiers; t++) {
    const widest = Math.max(2, Math.round(((t + 1) / tiers) * c));
    const narrow = Math.max(1, Math.round(widest * 0.35));
    for (let r = 0; r < 9; r++) {
      const half = Math.round(narrow + ((widest - narrow) * r) / 8);
      const row = Array.from({ length: w }, (_, x) => {
        const d = Math.abs(x - c);
        if (d > half) return ".";
        if (d === half) return "}";
        return x < c && (x + r) % 4 === 0 ? "g" : x > c ? "}" : "{";
      }).join("");
      rows.push(row);
    }
  }
  const pad = (n: number) => ".".repeat(n);
  rows.push(pad(c - 1) + "dWd" + pad(w - c - 2), pad(c - 1) + "dWd" + pad(w - c - 2), pad(c - 2) + "dWWWd" + pad(w - c - 3));
  return art(rows);
}
const PINE = pineArt(13, 5);
const BIG_PINE = pineArt(19, 7);

const WOODPILE = art([
  ".......D.....",
  "......DdD....",
  ".......D.....",
  "..wd..wd.....",
  ".wwWdwwWdwd..",
  ".wWWdwWWdwWd.",
  ".dWdwwdWdwwd.",
  "wwWdwWWdwWWd.",
  "wWWdwWWdwWWdd",
  "dWdddWdddWdd.",
  "DDDDDDDDDDDDD",
]);

const STONE_LANTERN = art([
  "....ss....",
  "...sSSs...",
  ".sSSSSSSs.",
  "tttttttttt",
  "..SIIIIS..",
  "..SIIIIS..",
  "..tttttt..",
  "...sSSt...",
  "....St....",
  "....St....",
  "...sSSt...",
  "..sSSSSt..",
  ".tttttttt.",
]);
const BAMBOO = (() => {
  const rows: string[] = [];
  for (let y = 0; y < 58; y++) {
    const leaf = y % 9;
    const l = leaf === 1 ? "gG" : leaf === 2 ? ".G" : "..";
    const r = leaf === 5 ? "Gg" : leaf === 6 ? "G." : "..";
    const node = (k: number) => ((y + k) % 11 === 0 ? "j" : "g");
    rows.push(`${y > 6 ? l : ".."}.${node(0)}${node(3)}..${y > 2 ? node(7) : "."}${node(5)}.${y > 10 ? r : ".."}`);
  }
  return art(rows);
})();

const GAS_LAMP = art([
  "..nBBn..",
  ".nBBBBn.",
  "nBaIIaBn",
  "nBaIIaBn",
  "nBaIIaBn",
  ".nBBBBn.",
  "...nn...",
  "...MM...",
  "...MM...",
  "...MM...",
  "...MM...",
  "..+MM=..",
  "...MM...",
  "...MM...",
  "...MM...",
  "...MM...",
  "...MM...",
  "...MM...",
  "...MM...",
  "..+MM=..",
  ".+MMMM=.",
  "========",
]);
const BOILER = art([
  "...?!!?.....",
  "...?99?.....",
  ".?!!!!!!?...",
  "?!999999??..",
  "?!9nBBn9??..",
  "?!9nyKn9??=M",
  "?!9nBBn9??.M",
  "?!999999??.M",
  "?!!!!!!!??.M",
  "?!999999??=M",
  "?!999999??..",
  ".??????????.",
  ".==.....==..",
]);

function yard(style: RoomStyle, g: HouseGeometry, earth: number, shell: Shell) {
  const stand = (a: Art, x: number) => shell.yard.push({ art: a, x, y: earth + 1 - a.h });
  const left = (a: Art) => stand(a, Math.max(0, Math.floor((g.houseX - a.w) / 2)));
  const right = (a: Art) => stand(a, g.sceneW - a.w - Math.max(0, Math.floor((g.houseX - a.w) / 2)));
  switch (style) {
    case "cottage":
      left(SHRUB);
      right(SHRUB);
      return;
    case "medieval":
      for (const x of [Math.floor((g.houseX - TORCH.w) / 2), g.sceneW - TORCH.w - Math.floor((g.houseX - TORCH.w) / 2)]) {
        stand(TORCH, x);
        shell.moving.push({ x, y: earth + 1 - TORCH.h, art: { w: 5, h: 5, rects: [] }, frames: TORCH_FLAMES, motion: "flicker" });
        shell.lights.push({ x: x + 2, y: earth - TORCH.h + 3, r: 14 });
      }
      return;
    case "fantasy":
      left(TOADSTOOLS);
      right(TOADSTOOLS);
      return;
    case "elven": {
      const tree = g.houseX >= BIG_BIRCH.w + 2 ? BIG_BIRCH : BIRCH;
      left(tree);
      right(tree);
      // Fireflies in the garden either side.
      shell.fireflies = [
        { x: 0, y: earth - 56, w: g.houseX, h: 48 },
        { x: g.sceneW - g.houseX, y: earth - 56, w: g.houseX, h: 48 },
      ];
      return;
    }
    case "cave":
      // The garden is under the hill.
      return;
    case "scifi":
      left(BEACON);
      {
        const bx = Math.floor((g.houseX - BEACON.w) / 2);
        const light: Rect[] = [[1, 0, 1, 1, "light"], [0, 1, 3, 1, "light"], [1, 2, 1, 1, "light"]];
        shell.moving.push({ x: bx + 1, y: earth + 1 - BEACON.h, art: { w: 3, h: 3, rects: [] }, frames: [light], motion: "blink" });
        shell.lights.push({ x: bx + 2, y: earth + 2 - BEACON.h, r: 8 });
      }
      right(DISH);
      return;
    case "modern":
      left(PLANTER);
      right(TOPIARY);
      return;
    case "cabin":
      left(g.houseX >= BIG_PINE.w + 2 ? BIG_PINE : PINE);
      right(WOODPILE);
      return;
    case "japanese":
      left(STONE_LANTERN);
      shell.lights.push({ x: Math.floor((g.houseX - STONE_LANTERN.w) / 2) + 5, y: earth - STONE_LANTERN.h + 6, r: 12 });
      right(BAMBOO);
      return;
    case "steampunk":
      left(GAS_LAMP);
      shell.lights.push({ x: Math.floor((g.houseX - GAS_LAMP.w) / 2) + 4, y: earth - GAS_LAMP.h + 4, r: 16 });
      right(BOILER);
      return;
  }
}

// ── The whole house ──────────────────────────────────────────────────────

/**
 * The house in its style: chimney, roof, storeys, the floor of the ground
 * floor, foundations and the garden. Bookcases and furniture are drawn
 * over it.
 */
export function shellArt(g: HouseGeometry, style: RoomStyle, interior: Interior = PLAIN_INTERIOR): Shell {
  const R: Rect[] = [];
  const over: Rect[] = [];
  const twinkle: Rect[][] = [[], [], []];
  const shell: Shell = { rects: R, storeys: [], twinkle, over, moving: [], lights: [], smoke: null, yard: [], fireflies: [] };
  shell.smoke = chimney(R, g, style);
  roof(R, over, g, style, shell);
  const looks = storeyLooks(style, interior, g.floorCount);
  for (let f = 0; f < g.floorCount; f++) {
    const rects: Rect[] = [];
    storey(rects, g, style, f, looks[f], f > 0 ? looks[f - 1] : null, twinkle);
    shell.storeys.push({ rects, walls: looks[f].walls });
  }

  const { houseX: hx, houseW: hw } = g;
  const bottom = g.floorsTop + g.floorCount * g.storey;
  const ground = looks[g.floorCount - 1] ?? storeyLooks(style, interior, 1)[0];
  floor(R, ground.floor, ground.ownFloor, hx, bottom, hw, g.beam);
  const base = bottom + g.beam;
  R.push([hx - 2, base, hw + 4, g.foundation, "stone"]);
  R.push([hx - 2, base, hw + 4, 1, "stone-hi"], [hx - 2, base + g.foundation - 1, hw + 4, 1, "stone-lo"]);
  for (let x = hx + 4; x < hx + hw; x += 9) R.push([x, base + 1, 1, g.foundation - 2, "stone-lo"]);
  const earth = base + g.foundation;
  R.push([0, earth, g.sceneW, 1, "grass-hi"], [0, earth + 1, g.sceneW, 1, "grass"], [0, earth + 2, g.sceneW, g.ground - 2, "soil"]);
  if (style === "cave") {
    // Under the hill: earth beneath the foundations, not grass.
    R.push([hx - 2, earth, hw + 4, 2, "soil"]);
  } else {
    for (let x = 1; x < g.sceneW; x += 5) R.push([x, earth - 1, 1, 1, "grass"], [x + 2, earth + 3, 1, 1, "soil-lo"]);
  }
  yard(style, g, earth, shell);
  return shell;
}
