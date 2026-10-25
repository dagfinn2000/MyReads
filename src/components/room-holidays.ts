/**
 * Holiday decorations in the reading room (Decorate › House, lib/room-
 * styles.ts: ROOM_HOLIDAYS), none unless chosen: a Christmas tree hung
 * with lights beside the hearth, a garland along the mantelpiece and a
 * wreath on every door; carved pumpkins and cobwebs at Halloween; a vase
 * of birch twigs with feathers and painted eggs in the grass at Easter; a
 * garland of flowers along the eaves and a bonfire in the garden at
 * Midsummer; paper streamers and fireworks on New Year's Eve.
 *
 * Drawn like the rest of the house (room-art.tsx), in the house's own
 * paints where it can; the lights and candles take colours of their own
 * that glow at night (reading-room.css). Nothing here goes over the books
 * or in the avatar's way: the tree stands where a piece of furniture
 * would (lib/room.ts: planHouse), the rest hangs from the ceilings and the
 * mantelpiece or stands outside.
 */
import { grid, type Art, type HouseGeometry, type Paint, type Rect } from "@/components/room-art";
import type { Shell } from "@/components/room-shells";
import type { Holiday, RoomHoliday } from "@/lib/room-styles";

/** A steady pseudo-random number in [0, 1) for a place (as room-shells.ts). */
function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** The characters the drawings below use, over room-art.tsx's own. */
const KEY: Record<string, Paint> = {
  // Pumpkins, and the candlelight through their faces.
  h: "pumpkin-hi",
  P: "pumpkin",
  p: "pumpkin-lo",
  O: "pumpkin-deep",
  F: "lantern-hi",
  f: "lantern",
  // Evergreens.
  ",": "pine-hi",
  "{": "pine",
  "}": "pine-lo",
  // Baubles, bows and parcels.
  o: "red-hi",
  R: "red",
  r: "red-lo",
  u: "delft-lo",
  U: "delft",
  e: "felt-hi",
  E: "felt",
  // The cobwebs.
  "/": "web",
};

const draw = (rows: readonly string[], key: Record<string, Paint> = {}): Art => ({
  w: Math.max(...rows.map((r) => r.length)),
  h: rows.length,
  rects: grid(rows, 0, 0, { ...KEY, ...key }),
});

const shift = (rects: readonly Rect[], dx: number, dy: number): Rect[] =>
  rects.map(([x, y, w, h, p]): Rect => [x + dx, y + dy, w, h, p]);

// ── Christmas ────────────────────────────────────────────────────────────

/** How wide the Christmas tree stands, with its presents (lib/room.ts:
 *  PIECE_WIDTH.tree). */
export const TREE_W = 36;

export interface Tree {
  art: Art;
  /** Its lights in three sets, which twinkle in turn at night, as the
   *  fairy lights do. */
  lights: Rect[][];
  /** Where its star is, for a glow at night. */
  star: { x: number; y: number };
}

/**
 * A spruce in tiers of drooping boughs, lit from the upper left, in a red
 * tub with a brass band; a string of lights looped round it, baubles of
 * red, gold and blue, a gold star on top, and two parcels at its foot.
 * `W` wide with its parcels; a little one has fewer tiers.
 */
function treeArt(W: number, tierCount: number): Tree {
  const c = Math.floor((W - 4) / 2);
  const ox = 2;
  const dots: (Paint | null)[][] = [];
  /** Which tier each dot belongs to, so a tier's hem can shade the next. */
  const tierOf: number[][] = [];
  const at = (x: number, y: number, paint: Paint, tier = -1) => {
    while (dots.length <= y) {
      dots.push(Array<Paint | null>(W).fill(null));
      tierOf.push(Array<number>(W).fill(-1));
    }
    if (x < 0 || x >= W || y < 0) return;
    dots[y][x] = paint;
    tierOf[y][x] = tier;
  };
  // Each tier: its half-width at the top and at the hem, and its height.
  const tiers = (
    [
      [0, 3, 6],
      [1, 5, 7],
      [2, 7, 8],
      [3, 9, 9],
      [4, 11, 9],
      [5, 13, 10],
    ] as [number, number, number][]
  ).slice(0, tierCount);
  const top = 6;
  const starts: number[] = [];
  for (let t = 0, y = top; t < tiers.length; y += tiers[t][2] - 2, t++) starts.push(y);
  /** The bough's half-width on each row, for the lights to follow. */
  const edge: number[] = [];
  const hems: [number, number][] = [];
  // The lowest tier first, so each one's hem hangs over the next below.
  for (let t = tiers.length - 1; t >= 0; t--) {
    const [narrow, wide, height] = tiers[t];
    const y0 = starts[t];
    for (let r = 0; r < height; r++) {
      const y = y0 + r;
      const half = Math.round(narrow + ((wide - narrow) * r) / (height - 1));
      edge[y] = half;
      const hem = r === height - 1;
      for (let x = c - half; x <= c + half; x++) {
        const d = x - c;
        let paint: Paint;
        if (d === half || (hem && d > -half / 2)) paint = "pine-lo";
        else if (d === -half || hem) paint = "pine";
        else if (d < 0 && (x + y) % 3 === 0) paint = "pine-hi";
        else if (d > 0 && (y - x + 30) % 3 === 0) paint = "pine-lo";
        else if (d <= -half / 2 && r > 1) paint = (x + y) % 2 ? "pine" : "pine-hi";
        else paint = "pine";
        at(ox + x, y, paint, t);
        if (hem) hems.push([x, y]);
      }
      // The tips of the boughs droop below the hem, longest at the ends.
      if (hem) {
        for (let x = c - half; x <= c + half; x++) {
          const d = x - c;
          if (Math.abs(d) >= half - 1 || (d + half) % 3 === 0) {
            at(ox + x, y + 1, d < 0 ? "pine" : "pine-lo", t);
            hems.push([x, y + 1]);
          }
        }
        at(ox + c - half - 1, y + 1, "pine-lo", t);
        at(ox + c + half + 1, y + 1, "pine-lo", t);
      }
    }
  }
  // The shade under each hem, on the tier below it.
  for (const [x, y] of hems) {
    const below = tierOf[y + 1]?.[ox + x] ?? -1;
    const self = tierOf[y]?.[ox + x] ?? -1;
    if (below > self && dots[y + 1][ox + x] !== null) dots[y + 1][ox + x] = "pine-lo";
  }
  const foot = starts[tiers.length - 1] + tiers[tiers.length - 1][2] + 1;
  // The trunk and the tub.
  for (let y = foot - 1; y < foot + 1; y++) {
    at(ox + c, y, "wood-lo");
    at(ox + c - 1, y, "wood");
  }
  const tub = draw(["oRRRRRRRr", "bBBBBBBBn", ".RRRRRRr.", ".rrrrrrr."], { b: "brass-hi", B: "brass", n: "brass-lo" });
  for (const [x, y, w, h, p] of tub.rects) for (let k = 0; k < w; k++) for (let j = 0; j < h; j++) at(ox + c - 4 + x + k, foot + 1 + y + j, p);
  // The star, which glows at night.
  const star = draw(["..b..", ".bSb.", "bSSSb", ".bSb.", ".b.b."], { b: "brass", S: "bulb-2" });
  for (const [x, y, w, h, p] of star.rects) for (let k = 0; k < w; k++) for (let j = 0; j < h; j++) at(ox + c - 2 + x + k, y + j + 1, p);
  // Baubles hung under the hems, a dot of light on each.
  const baubles: [number, number, "red" | "gold" | "blue"][] = [
    [-2, 1, "red"],
    [3, 2, "gold"],
    [-5, 3, "blue"],
    [1, 3, "red"],
    [6, 4, "red"],
    [-8, 4, "gold"],
    [-2, 4, "blue"],
    [-10, 5, "red"],
    [3, 5, "gold"],
    [9, 5, "blue"],
  ];
  const tone = { red: ["red-hi", "red", "red-lo"], gold: ["brass-hi", "brass", "brass-lo"], blue: ["delft-lo", "delft", "delft"] } as const;
  for (const [dx, t, kind] of baubles.filter(([, t]) => t < tierCount)) {
    const [hi, mid, lo] = tone[kind];
    const y = starts[t] + tiers[t][2] - 3;
    at(ox + c + dx, y, hi);
    at(ox + c + dx + 1, y, mid);
    at(ox + c + dx, y + 1, mid);
    at(ox + c + dx + 1, y + 1, lo);
  }
  // The lights: a loop across each tier from one side to the other,
  // sagging, a bulb every other dot, in four colours and three sets.
  const lights: Rect[][] = [[], [], []];
  let n = 0;
  for (let t = 1; t < tiers.length; t++) {
    const y0 = starts[t] + 2;
    const half = (edge[y0 + 1] ?? 2) - 1;
    for (let d = -half; d <= half; d++) {
      const s = d / half;
      const y = y0 + Math.round(2.4 * (1 - s * s)) + (t % 2 ? Math.round(s) : -Math.round(s));
      if ((d + half) % 2 === 0) {
        lights[n % 3].push([ox + c + d, y, 1, 1, `bulb-${(n % 4) + 1}`]);
        n++;
      } else at(ox + c + d, y, "bulb-wire");
    }
  }
  // Two parcels at its foot, tied with ribbon.
  const parcels: [string[], number][] = [
    [["...bb..", "RRRbRRR", "oRRbRRr", "bbbbbbb", "oRRbRRr", "RRRbRRr"], 0],
    [["..y.y.", "UUUyUU", "uUUyUU", "yyyyyy", "uUUyUU"], W - 6],
  ];
  const H = foot + 5;
  for (const [rows, x0] of parcels) {
    const a = draw(rows, { b: "brass-hi", y: "paper" });
    for (const [x, y, w, h, p] of a.rects) for (let k = 0; k < w; k++) for (let j = 0; j < h; j++) at(x0 + x + k, H - a.h + y + j, p);
  }
  const rects: Rect[] = [];
  dots.forEach((row, y) => {
    for (let i = 0; i < row.length; ) {
      let j = i + 1;
      while (j < row.length && row[j] === row[i]) j++;
      if (row[i]) rects.push([i, y, j - i, 1, row[i]!]);
      i = j;
    }
  });
  return { art: { w: W, h: H, rects }, lights, star: { x: ox + c, y: 3 } };
}

export const TREE = treeArt(TREE_W, 6);
/** A little one for Decorate's tile. */
const LITTLE_TREE = treeArt(27, 4);

/** A little tree in a pot, 9 × 13, on the mantelpiece instead of the
 *  clock when there isn't room on the floor for the big one. */
export const MANTEL_TREE = draw([
  "....b....",
  "...,{....",
  "..,{o}...",
  "...{{}...",
  "..,{{b}..",
  ".,{u{{}}.",
  "..,{{}}..",
  ".,{{{o}}.",
  ",{b{{{u}}",
  "....W....",
  "..oRRRr..",
  "..RRRRr..",
  "...rrr...",
], { b: "brass-hi", W: "wood-lo" });

/** A garland of greenery along the front of the mantelpiece, `w` wide,
 *  in two swags, tied up with red bows at its ends and middle. */
export function mantelGarland(w: number): Art {
  const R: Rect[] = [];
  const knots = [1, Math.round(w / 2), w - 2];
  for (let x = 0; x < w; x++) {
    const span = x < knots[1] ? [knots[0], knots[1]] : [knots[1], knots[2]];
    const t = Math.min(1, Math.max(0, (x - span[0]) / Math.max(1, span[1] - span[0])));
    const y = 1 + Math.round(3 * (1 - (2 * t - 1) ** 2));
    R.push([x, y, 1, 1, "pine"], [x, y + 1, 1, 1, (x + y) % 3 === 0 ? "pine-hi" : "pine-lo"]);
    if ((x * 7) % 5 === 1) R.push([x, y - 1, 1, 1, "pine-hi"]);
    if (noise(x, 2, 11) < 0.12) R.push([x, y + 1, 1, 1, "red-hi"]);
  }
  for (const k of knots) R.push(...grid(["R.R", "oRr", ".r."], Math.min(w - 3, Math.max(0, k - 1)), 0, KEY));
  return { w, h: 7, rects: R };
}

/** A wreath with a red bow, for the doors between rooms. */
export const WREATH = draw([
  "..,{{..",
  ".,{o{}.",
  ",{...{}",
  "{o...}}",
  ",{...o}",
  ".{{}}}.",
  "..RoR..",
  ".R.r.r.",
]);

// ── Halloween ────────────────────────────────────────────────────────────

/** A carved pumpkin with a candle in it: its face in two frames as the
 *  candle flickers, the first the still picture. */
export interface Lantern {
  art: Art;
  frames: [Rect[], Rect[]];
  /** Where the candle is, for its glow. */
  light: { x: number; y: number };
}

function lantern(rows: readonly string[]): Lantern {
  const body = rows.map((r) => r.replace(/[Ff]/g, "O"));
  const face = (bright: string, dim: string) =>
    grid(
      rows.map((r) => r.replace(/[^Ff]/g, ".")),
      0,
      0,
      { F: bright, f: dim },
    );
  const glowing = rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === "F" || ch === "f" ? [[x, y]] : [])));
  const cx = glowing.reduce((a, [x]) => a + x, 0) / glowing.length;
  const cy = glowing.reduce((a, [, y]) => a + y, 0) / glowing.length;
  return {
    art: draw(body),
    frames: [face("lantern-hi", "lantern"), face("lantern", "lantern-lo")],
    light: { x: Math.round(cx), y: Math.round(cy) },
  };
}

/** A small one for the mantelpiece, 7 × 7. */
export const SMALL_LANTERN = lantern([
  "...j...",
  ".hPpPp.",
  "hPFPFPp",
  "hPPfPPp",
  "hFfFfFp",
  ".hPPPp.",
  "..ppp..",
].map((r) => r.replace("j", "W")));

/** Big ones for the garden, 11 × 9 and 9 × 8. */
export const BIG_LANTERN = lantern([
  ".....W.....",
  "...hPPpPp..",
  ".hPPPPpPPp.",
  "hPFFPPpFFPp",
  "hPPFPfPFPPp",
  "hPPPPfPPPPp",
  "hFfPFfFPfFp",
  ".hPfFfFfPp.",
  "..pppOppp..",
]);
export const MID_LANTERN = lantern([
  "....W....",
  "..hPpPp..",
  ".hPPPPPp.",
  "hPFPPPFPp",
  "hPPPfPPPp",
  "hPfFfFfPp",
  ".hPPPPPp.",
  "..ppppp..",
]);

/** A cobweb in a room's top left corner, 12 × 10: threads out from the
 *  corner and two rings sagging between them. Mirrored for the right. */
const COBWEB = [
  "//...//..../",
  "/.//./..../.",
  "./..//...//.",
  "..//..////..",
  "//.....///..",
  "/..//..//...",
  "...././/....",
  "..././/.....",
  ".//////.....",
  "/...........",
];
export function cobweb(right: boolean): Rect[] {
  return grid(right ? COBWEB.map((r) => [...r].reverse().join("")) : COBWEB, 0, 0, KEY);
}
export const COBWEB_W = 12;

// ── Easter ───────────────────────────────────────────────────────────────

/** Birch twigs in a vase, hung with painted eggs and bright feathers,
 *  16 × 22: on the mantelpiece in place of the clock. */
export const EASTER_TWIGS = draw([
  "..........c.....",
  ".....k....c.....",
  ".k...k....k.....",
  ".k...k...k...y..",
  "..k..k.c.k..k.y.",
  "..k.k..c.k.k....",
  "..kk...k.k.k....",
  "..k.y..k.kk.....",
  "...ky.k..k.....",
  "...k..k.k.k.....",
  "...k..k.k..kk...",
  "..okk.k.k..k.G..",
  "..Rr.kkk.k.k.g..",
  "..rr..k.kk..kG..",
  ".......kk...k...",
  "......UuuU......",
  ".......uU.......",
  "......UuuU......",
  ".....UuwuuU.....",
  ".....UuuwuU.....",
  ".....UuwuuU.....",
  "......UuuU......",
], {
  k: "trunk",
  y: "bird",
  c: "parrot-blue",
  G: "brass-hi",
  g: "brass",
  w: "petal-white",
});

/** A painted egg in the grass, 3 × 4, in one of five colours with a band
 *  round it. */
export function egg(n: number): Rect[] {
  const tones: [Paint, Paint][] = [
    ["blossom", "petal-white"],
    ["petal-gold", "red-hi"],
    ["delft-lo", "petal-white"],
    ["felt-hi", "petal-gold"],
    ["red-hi", "petal-gold"],
  ];
  const [shell, band] = tones[n % tones.length];
  return [[1, 0, 1, 1, shell], [0, 1, 3, 1, shell], [0, 2, 3, 1, band], [0, 3, 3, 1, shell], [1, 3, 1, 1, "garden-shadow"]];
}

// ── Midsummer ────────────────────────────────────────────────────────────

/** A garland of leaves and flowers, `w` wide, swagged between hooks every
 *  forty dots or so; its top along y = 0. */
export function flowerGarland(w: number): Rect[] {
  const R: Rect[] = [];
  const swags = Math.max(1, Math.round(w / 40));
  const flowers: Paint[] = ["flower", "petal-white", "petal-gold", "wis", "blossom"];
  for (let x = 0; x < w; x++) {
    const i = Math.min(swags - 1, Math.floor((x * swags) / w));
    const a = (i * w) / swags;
    const b = ((i + 1) * w) / swags;
    const t = (x - a) / (b - a);
    const y = Math.round(4 * (1 - (2 * t - 1) ** 2));
    R.push([x, y, 1, 1, (x + y) % 3 === 0 ? "leaf-hi" : "leaf"], [x, y + 1, 1, 1, "leaf-lo"]);
    if (x % 3 === 1) R.push([x, y - 1, 1, 1, "leaf"]);
    if (x % 4 === 2) {
      const f = flowers[Math.floor(noise(x, 1, 21) * flowers.length)];
      R.push([x, y, 1, 1, f], [x - 1, y, 1, 1, f], [x, y - 1, 1, 1, f], [x, y + 1, 1, 1, "petal-gold"]);
    }
  }
  for (let i = 0; i <= swags; i++) R.push([Math.max(0, Math.min(w - 2, Math.round((i * w) / swags) - 1)), 0, 2, 2, "leaf-lo"]);
  return R;
}

/** A bonfire, 13 × 14: crossed logs, and flames in two frames. */
export const BONFIRE = {
  art: draw([
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".....e.e.....",
    "..d.eeeee.D..",
    "..dWe...eWD..",
    ".wWWdW.WdWWd.",
    "wWdD.dWd.DdWd",
    ".SsS.....tSs.",
  ], { e: "ember" }),
  frames: [
    grid(["......F......", ".....FfF.....", "....fFFrF....", "...rfFFfFr...", "...fFFFFFf...", "..rfFFFFFfr..", "..fFFFFFFFf..", "...rfFFFfr...", "....rfrfr...."], 0, 0, { F: "flame-1", f: "flame-2", r: "flame-3" }),
    grid([".....F.......", "....FfF..F...", "....fFFfFr...", "...rfFFFFf...", "..rfFFFFFfr..", "..fFFFFFFfr..", "..rfFFFFFFf..", "...rfFFFfr...", "....rfrfr...."], 0, 0, { F: "flame-1", f: "flame-2", r: "flame-3" }),
  ] as [Rect[], Rect[]],
};

// ── New Year's Eve ───────────────────────────────────────────────────────

/** Paper streamers hung from a room's ceiling at `y`, across `w` from
 *  `x0`: loops between hooks, and curls hanging down from them, never
 *  lower than the tops of the bookcases. */
export function streamers(x0: number, w: number, y: number, seed = 0): Rect[] {
  const R: Rect[] = [];
  const colours: Paint[] = ["red", "petal-gold", "delft", "felt-hi", "blossom-lo"];
  const span = 26;
  for (let hook = x0 + 2, i = 0; hook < x0 + w - 3; hook += span, i++) {
    const end = Math.min(hook + span, x0 + w - 2);
    const paint = colours[(i + seed) % colours.length];
    for (let x = hook; x < end; x++) {
      const t = (x - hook) / (end - hook);
      // A twisted ribbon: it shows its edge every few dots.
      const yy = y + Math.round(3 * (1 - (2 * t - 1) ** 2));
      R.push([x, yy, 1, (x - hook) % 4 === 0 ? 1 : 2, paint]);
    }
    // A curl hanging from the hook.
    const curl = colours[(i + seed + 2) % colours.length];
    const len = 5 + Math.floor(noise(hook, y, seed) * 4);
    for (let k = 0; k < len; k++) R.push([hook + (k % 3 === 1 ? 1 : 0), y + k, 1, 1, curl]);
  }
  return R;
}

/** Where fireworks may burst, in turn: across the scene, and how far down
 *  the clear sky there. */
const FIREWORKS: readonly [number, number][] = [
  [0.07, 0.25],
  [0.9, 0.55],
  [0.24, 0.7],
  [0.76, 0.15],
  [0.38, 0.4],
  [0.62, 0.6],
];

/** A burst of fireworks, 15 × 15 or 11 × 11: rays of a colour out from
 *  its heart, sparks along them and glitter at their tips. */
export function burst(n: number): Art {
  const r = n % 2 === 0 ? 7 : 5;
  const rays = n % 2 === 0 ? 12 : 8;
  const colour = (["spark-gold", "spark-red", "spark-blue", "spark-green"] as const)[n % 4];
  const dots = new Map<string, Paint>();
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * 2 * Math.PI + (n % 3) * 0.2;
    for (let d = 2; d <= r; d++) {
      // A gap before the glitter at the tip of a long ray.
      if (r > 5 && d === r - 1) continue;
      const key = `${r + Math.round(Math.cos(a) * d)},${r + Math.round(Math.sin(a) * d)}`;
      dots.set(key, d === r ? "spark-lo" : d === 3 && k % 2 === 0 ? "spark-white" : colour);
    }
  }
  const rects = [...dots].map(([key, p]): Rect => {
    const [x, y] = key.split(",").map(Number);
    return [x, y, 1, 1, p];
  });
  return { w: 2 * r + 1, h: 2 * r + 1, rects };
}

// ── On the house ─────────────────────────────────────────────────────────

/** Where things go on the house: each room's inside (scene dots: its left,
 *  width and ceiling), where the ground is at `x` outside (on a hill, for a
 *  cave), and how far down the sky is clear there, over the roof. */
export interface HouseFrame {
  rooms: readonly { x: number; w: number; top: number }[];
  ground: (x: number) => number;
  sky: (x: number) => number;
}

/**
 * Puts the holidays' decorations on `shell` (room-shells.ts: shellArt),
 * the later over the earlier: what hangs in the rooms goes over their
 * walls, what stands outside in the garden by the house, and what moves
 * or glows with the house's own moving parts and lights. The fireside's
 * share is the reading room's (reading-room.tsx), and the tree planHouse's.
 */
export function dressHouse(shell: Shell, holidays: readonly Holiday[], g: HouseGeometry, frame: HouseFrame) {
  const { houseX: hx, houseW: hw, sceneW } = g;
  const right = hx + hw;
  /** Something standing in the garden, `x` its left. */
  const stand = (a: Art, x: number) => {
    const y = frame.ground(x + Math.floor(a.w / 2)) + 1 - a.h;
    shell.yard.push({ art: a, x, y });
    return y;
  };
  for (const holiday of HOLIDAY_ORDER) {
    if (!holidays.includes(holiday)) continue;
    switch (holiday) {
      case "christmas": {
        // Lights strung along the fascia under the eaves, and a wreath on
        // every door between rooms.
        let n = 0;
        for (let hook = hx; hook < right; hook += 12) {
          const end = Math.min(hook + 12, right);
          for (let x = hook; x < end; x++) {
            const y = g.floorsTop + 1 + Math.round(2 * (1 - ((2 * (x - hook)) / (end - hook) - 1) ** 2));
            if ((x - hook) % 3 === 1) {
              shell.twinkle[n % 3].push([x, y, 1, 1, `bulb-${(n % 4) + 1}`]);
              n++;
            } else shell.over.push([x, y, 1, 1, "bulb-wire"]);
          }
        }
        for (const door of shell.doors) {
          const xs = door.shut.map((r) => r[0]);
          const left = Math.min(...xs);
          const w = Math.max(...door.shut.map((r) => r[0] + r[2])) - left;
          const top = Math.min(...door.shut.map((r) => r[1]));
          door.shut.push(...shift(WREATH.rects, left + Math.floor((w - WREATH.w) / 2), top + 6));
        }
        break;
      }
      case "halloween": {
        // Cobwebs in the corners of every room, and lanterns by the house.
        for (const room of frame.rooms) {
          shell.over.push(...shift(cobweb(false), room.x, room.top + 1));
          if (room.w >= 2 * COBWEB_W + 20) shell.over.push(...shift(cobweb(true), room.x + room.w - COBWEB_W, room.top + 1));
        }
        for (const [l, x] of [
          [BIG_LANTERN, Math.max(0, hx - BIG_LANTERN.art.w - 1)],
          [MID_LANTERN, Math.min(sceneW - MID_LANTERN.art.w, right + 1)],
        ] as const) {
          const y = stand(l.art, x);
          shell.moving.push({ x, y, art: { w: l.art.w, h: l.art.h, rects: [] }, frames: l.frames, motion: "flicker" });
          shell.lights.push({ x: x + l.light.x, y: y + l.light.y, r: 12 });
        }
        break;
      }
      case "easter": {
        // Painted eggs hidden in the grass either side.
        const spots = [0.18, 0.5, 0.8].flatMap((t) => [Math.floor(t * (hx - 3)), right + 1 + Math.floor(t * (sceneW - right - 4))]);
        spots.forEach((x, i) => stand({ w: 3, h: 4, rects: egg(i) }, x));
        break;
      }
      case "midsummer": {
        // A garland of flowers along the fascia, and a bonfire in the
        // garden, in place of what stood there.
        shell.over.push(...shift(flowerGarland(hw), hx, g.floorsTop));
        shell.yard = shell.yard.filter((y) => y.x < right);
        shell.moving = shell.moving.filter((m) => m.x < right);
        shell.lights = shell.lights.filter((l) => l.x < right);
        const x = right + Math.max(0, Math.floor((sceneW - right - BONFIRE.art.w) / 2));
        const y = stand(BONFIRE.art, x);
        shell.moving.push({ x, y, art: { w: BONFIRE.art.w, h: BONFIRE.art.h, rects: [] }, frames: BONFIRE.frames, motion: "flicker" });
        shell.lights.push({ x: x + 6, y: y + 6, r: 20 });
        break;
      }
      case "newyear": {
        // Streamers in every room, and fireworks in the sky, one after
        // another, wherever there's sky enough for them.
        frame.rooms.forEach((room, i) => shell.over.push(...streamers(room.x, room.w, room.top + 3, i)));
        let n = 0;
        for (const [t, height] of FIREWORKS) {
          if (n === 4) break;
          const b = burst(n);
          const x = Math.max(0, Math.min(sceneW - b.w, Math.round(t * sceneW - b.w / 2)));
          let clear = Infinity;
          for (let k = x; k < x + b.w; k++) clear = Math.min(clear, frame.sky(k));
          // The lowest it can burst and stay clear of the roof.
          const low = clear - b.h - 3;
          if (low < 2) continue;
          shell.moving.push({
            x,
            y: 2 + Math.round((low - 2) * height),
            art: { w: b.w, h: b.h, rects: [] },
            frames: [b.rects],
            motion: "burst",
            delay: n * 1.3,
          });
          n++;
        }
        break;
      }
    }
  }
}

// ── Samples for Decorate ─────────────────────────────────────────────────

/** A little picture of each choice, `w` × `h`, on a bit of wall over the
 *  floor. */
export function holidaySample(kind: RoomHoliday, w: number, h: number): Art {
  const R: Rect[] = [[0, 0, w, h, "wall"], [0, h - 3, w, 2, "floor"], [0, h - 1, w, 1, "floor-lo"]];
  const floor = h - 3;
  const put = (a: Art, x: number, y = floor - a.h) => R.push(...shift(a.rects, x, y));
  switch (kind) {
    case "off":
      break;
    case "calendar": {
      // A calendar page with a red circle round a day.
      R.push(...grid(["RRRRRRRRRRR", "RRRRRRRRRRR", "yyyyyyyyyyy", "yKyKyKyKyKy", "yyyyyyyyyyy", "yKyKyoooyKy", "yyyyyoKoyyy", "yKyKyoooyKy", "yyyyyyyyyyy", "YYYYYYYYYYY"], Math.floor((w - 11) / 2), 5, KEY));
      break;
    }
    case "christmas": {
      const t = LITTLE_TREE;
      put({ w: t.art.w, h: t.art.h, rects: [...t.art.rects, ...t.lights.flat()] }, Math.floor((w - t.art.w) / 2));
      break;
    }
    case "halloween":
      put(BIG_LANTERN.art, 2);
      R.push(...shift(BIG_LANTERN.frames[0], 2, floor - BIG_LANTERN.art.h));
      put(SMALL_LANTERN.art, w - 10);
      R.push(...shift(SMALL_LANTERN.frames[0], w - 10, floor - SMALL_LANTERN.art.h));
      R.push(...shift(cobweb(true), w - COBWEB_W, 0));
      break;
    case "easter":
      put(EASTER_TWIGS, Math.floor((w - EASTER_TWIGS.w) / 2) + 2);
      for (let i = 0; i < 3; i++) R.push(...shift(egg(i), [1, 5, 23][i], floor - 4));
      break;
    case "midsummer":
      R.push(...flowerGarland(w).map(([x, y, rw, rh, p]): Rect => [x, y + 2, rw, rh, p]));
      put(BONFIRE.art, Math.floor((w - 13) / 2));
      R.push(...shift(BONFIRE.frames[0], Math.floor((w - 13) / 2), floor - BONFIRE.art.h));
      break;
    case "newyear":
      R.push(...streamers(0, w, 1, 1));
      put(burst(0), 0, 8);
      put(burst(1), w - 12, 20);
      break;
  }
  return { w, h, rects: R };
}

/** The holidays in the order they're drawn, the later over the earlier. */
export const HOLIDAY_ORDER: readonly Holiday[] = ["christmas", "halloween", "easter", "midsummer", "newyear"];
