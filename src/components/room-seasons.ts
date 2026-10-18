/**
 * The seasons round the reading room's house (Decorate › House, lib/room-
 * styles.ts). The garden grows as the season has it (room-garden.ts); here
 * is winter's snow, laid over whatever the shell draws outside (room-
 * shells.ts): a cap on every surface open to the sky, a deeper fall on the
 * roof, icicles under the eaves and a blanket over the ground. And what
 * falls through the air, which the scene sets moving (`Fall`): snow in
 * winter, leaves in autumn, petals in spring.
 *
 * Like the rest of the house it is drawn in scene dots, and placed by
 * `noise`, a fixed function of position, so nothing repeats like a tile and
 * the snow lies the same way on every visit.
 */
import type { Paint, Rect } from "@/components/room-art";

/** A steady pseudo-random number in [0, 1) for a place (as room-shells.ts). */
function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Noise along a line that changes gently, `cell` dots from one knot to
 *  the next. In [0, 1). */
export function smooth(x: number, cell: number, seed: number): number {
  const f = x / cell;
  const i = Math.floor(f);
  const e = (f - i) ** 2 * (3 - 2 * (f - i));
  const a = noise(i, 0, seed);
  return a + (noise(i + 1, 0, seed) - a) * e;
}

/** Paints that aren't something for snow to settle on: shadows, the shine
 *  on glass, steam. */
const AIRY = new Set<Paint>(["garden-shadow", "wall-shadow", "case-shadow", "glass-shine", "pane-tint", "steam"]);
/** Too slight for snow to lie on: a snowdrop's stem. */
const SLIGHT = new Set<Paint>(["stem"]);

export interface Snowfall {
  /** How many dots down from its top a surface of this paint here is
   *  covered: the roof, under a deep fall. Elsewhere snow only sits on
   *  top. */
  deep?: (paint: Paint, x: number, y: number) => number;
  /** How high snow heaps on a long flat top, in dots: 2 makes a rounded
   *  pillow on a ridge. */
  heap?: number;
  /** How likely a top of this paint catches snow at all: a twig only
   *  sometimes. */
  catches?: (paint: Paint) => number;
  /** Whether icicles may hang under this paint, here. */
  hangs?: (paint: Paint, x: number, y: number) => boolean;
  /** Where no snow goes: inside the house. */
  sheltered?: (x: number, y: number) => boolean;
  seed?: number;
}

/** The dots of `out` as rectangles: each row's runs of one paint, and a
 *  run stacked on the same run in the row above made one taller one. */
function rectsOf(out: Map<number, Paint>, w: number): Rect[] {
  const keys = [...out.keys()].sort((a, b) => a - b);
  const rects: [number, number, number, number, Paint][] = [];
  const open = new Map<string, number>();
  for (let i = 0; i < keys.length; ) {
    const k = keys[i];
    const paint = out.get(k)!;
    const y = Math.floor(k / w);
    let j = i + 1;
    while (j < keys.length && keys[j] === keys[j - 1] + 1 && Math.floor(keys[j] / w) === y && out.get(keys[j]) === paint) j++;
    const x = k % w;
    const id = `${x},${j - i},${paint}`;
    const below = open.get(id);
    if (below !== undefined && rects[below][1] + rects[below][3] === y) rects[below][3]++;
    else {
      open.set(id, rects.length);
      rects.push([x, y, j - i, 1, paint]);
    }
    i = j;
  }
  return rects;
}

/**
 * Snow on `layer` (rectangles in a `w` × `h` box), to draw over it: on
 * every top open to the sky a cap of snow, heaped up into a rounded
 * pillow along a long flat one, lit from above and shaded at its right
 * end; deeper where `deep` says, which covers that far down the surface
 * itself, its lower edge shadowed; and icicles where `hangs` lets them.
 * Where the snow meets the sky it has an edge (`snow-edge`), which a
 * light page needs to show white snow against it. Something in front of
 * the layer, or behind it, doesn't shelter it, so each layer of the scene
 * gets its own.
 */
export function snowCaps(layer: readonly Rect[], w: number, h: number, how: Snowfall = {}): Rect[] {
  const seed = how.seed ?? 0;
  const heap = how.heap ?? 2;
  const paints: Paint[] = [];
  const index = new Map<Paint, number>();
  const grid = new Int16Array(w * h).fill(-1);
  for (const [rx, ry, rw, rh, paint] of layer) {
    if (AIRY.has(paint)) continue;
    let p = index.get(paint);
    if (p === undefined) {
      p = paints.length;
      paints.push(paint);
      index.set(paint, p);
    }
    for (let y = Math.max(0, ry); y < Math.min(h, ry + rh); y++) grid.fill(p, y * w + Math.max(0, rx), y * w + Math.min(w, rx + rw));
  }
  const at = (x: number, y: number) => (x >= 0 && x < w && y >= 0 && y < h ? grid[y * w + x] : -1);
  const sheltered = (x: number, y: number) => how.sheltered?.(x, y) ?? false;
  const open = (x: number, y: number) => at(x, y) < 0 && !sheltered(x, y);
  const top = (x: number, y: number) => at(x, y) >= 0 && open(x, y - 1);

  const out = new Map<number, Paint>();
  const put = (x: number, y: number, paint: Paint) => {
    if (x >= 0 && x < w && y >= 0 && y < h && !sheltered(x, y)) out.set(y * w + x, paint);
  };
  for (let y = 0; y < h; y++) {
    for (let x0 = 0; x0 < w; x0++) {
      if (!top(x0, y)) continue;
      let x1 = x0;
      while (x1 + 1 < w && top(x1 + 1, y)) x1++;
      const len = x1 - x0 + 1;
      const paint = paints[at(x0, y)];
      if (!SLIGHT.has(paint) && noise(x0, y, seed) < (how.catches?.(paint) ?? 1)) {
        // The heap: each row up a little shorter at both ends than the one
        // under it, so it's rounded; never taller than it is wide.
        const rows = Math.max(1, Math.min(heap, Math.floor((len + 1) / 2)));
        for (let r = 1; r <= rows; r++) {
          const inset = r === 1 ? 0 : r - 1 + Math.floor(noise(x0, y + r, seed + 1) * 2);
          const a = x0 + inset;
          const b = x1 - inset;
          if (b < a) break;
          for (let x = a; x <= b; x++) put(x, y - r, r === rows || x === a ? "snow-hi" : "snow");
          if (b > a) put(b, y - r, r === rows ? "snow" : "snow-lo");
        }
        // Down over the surface, where it lies deep.
        for (let x = x0; x <= x1; x++) {
          const depth = how.deep?.(paints[at(x, y)], x, y) ?? 0;
          for (let k = 0; k < depth; k++) {
            const p = at(x, y + k);
            if (p < 0 || (how.deep?.(paints[p], x, y + k) ?? 0) === 0) break;
            put(x, y + k, k === depth - 1 || at(x, y + k + 1) < 0 ? "snow-lo" : "snow");
          }
        }
      }
      x0 = x1;
    }
  }
  // The edge against the sky, above and either side.
  const snowy = (paint: Paint | undefined) => paint === "snow-hi" || paint === "snow" || paint === "snow-lo";
  const sky = (x: number, y: number) => !out.has(y * w + x) && at(x, y) < 0;
  for (const [k, paint] of out) {
    const x = k % w;
    const y = Math.floor(k / w);
    if (snowy(paint) && (sky(x, y - 1) || (x > 0 && sky(x - 1, y)) || (x < w - 1 && sky(x + 1, y)))) out.set(k, "snow-edge");
  }
  if (how.hangs) {
    // Icicles, never two side by side: long ones and short.
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        const p = at(x, y);
        if (p < 0 || !open(x, y + 1) || !how.hangs(paints[p], x, y) || noise(x, y, seed + 2) > 0.42) continue;
        const len = 1 + Math.floor(noise(y, x, seed + 3) ** 2 * 4);
        for (let k = 1; k <= len && open(x, y + k); k++) put(x, y + k, k === len ? "ice-lo" : "ice");
        x++;
      }
    }
  }
  return rectsOf(out, w);
}

/**
 * Snow over the ground from x0, `w` wide, where the grass begins at
 * `earth`: three dots deep, and drifted a dot or two deeper here and
 * there.
 */
export function snowGround(x0: number, w: number, earth: number, seed = 0): Rect[] {
  const R: Rect[] = [
    [x0, earth, w, 1, "snow-hi"],
    [x0, earth + 1, w, 1, "snow"],
    [x0, earth + 2, w, 1, "snow-lo"],
  ];
  const drift = (x: number) => {
    const n = smooth(x, 7, seed);
    return n > 0.8 ? 2 : n > 0.5 ? 1 : 0;
  };
  // Its top edge, a dot higher over each drift, and down at either end.
  for (let x = x0; x < x0 + w; ) {
    const d = drift(x);
    let end = x + 1;
    while (end < x0 + w && drift(end) === d) end++;
    R.push([x, earth - d, end - x, 1, "snow-edge"]);
    for (let k = 1; k <= d; k++) R.push([x, earth - d + k, end - x, 1, "snow-hi"]);
    const before = x > x0 ? drift(x - 1) : 0;
    const after = end < x0 + w ? drift(end) : 0;
    for (let y = earth - d + 1; y <= earth - before; y++) R.push([x, y, 1, 1, "snow-edge"]);
    for (let y = earth - d + 1; y <= earth - after; y++) R.push([end - 1, y, 1, 1, "snow-edge"]);
    x = end;
  }
  return R;
}

/** A box in scene dots. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What falls through the air round the house, in its season, and the
 *  boxes it falls through: snow over everything outside, or leaves or
 *  petals under the trees. */
export interface Fall {
  kind: "snow" | "leaves" | "petals";
  areas: Box[];
}

/** One thing falling: `x` dots across its area, `p` of the way down its
 *  fall when still, the seconds a fall (`t`) and a sway (`s`) take and
 *  how far it sways (`sway`, in dots), how far through its sway it starts
 *  (`q`), and its look. */
export interface Flake {
  x: number;
  p: number;
  t: number;
  s: number;
  q: number;
  sway: number;
  look: number;
}

/** How each kind falls: how many to an area of dots, how fast in dots a
 *  second, how far they sway, and how many looks it has. */
const FALLS: Record<Fall["kind"], { per: number; most: number; speed: [number, number]; sway: [number, number]; looks: number }> = {
  snow: { per: 260, most: 140, speed: [9, 17], sway: [1, 3], looks: 3 },
  leaves: { per: 520, most: 9, speed: [5, 8], sway: [3, 7], looks: 4 },
  petals: { per: 460, most: 10, speed: [4, 7], sway: [3, 6], looks: 2 },
};

/** The things falling through an area `w` × `h` dots: where they are and
 *  how they move, the same on every visit. Areas less than a few dots
 *  across have none. */
export function flakesFor(kind: Fall["kind"], area: Box, seed = 0): Flake[] {
  const f = FALLS[kind];
  if (area.w < 3 || area.h < 8) return [];
  const n = Math.min(f.most, Math.max(kind === "snow" ? 6 : 2, Math.round((area.w * area.h) / f.per)));
  return Array.from({ length: n }, (_, i) => {
    const speed = f.speed[0] + noise(i, seed, 2) * (f.speed[1] - f.speed[0]);
    return {
      // Spread evenly across, then jostled, so they don't bunch or line up.
      x: Math.min(area.w - 1, Math.floor(((i + noise(i, seed, 1)) / n) * area.w)),
      p: noise(seed, i, 3),
      t: Math.round((area.h / speed) * 10) / 10,
      s: Math.round((2.4 + noise(i, seed, 4) * 2.6) * 10) / 10,
      q: noise(i, seed, 5),
      sway: Math.round(f.sway[0] + noise(seed, i, 6) * (f.sway[1] - f.sway[0])),
      look: Math.floor(noise(i, seed, 7) * f.looks),
    };
  });
}
