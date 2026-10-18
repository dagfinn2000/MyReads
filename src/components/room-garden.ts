/**
 * What grows round the reading room's house (Decorate › House, lib/room-
 * styles.ts): ivy, climbing roses or wisteria up the outside walls
 * (ROOM_CLIMBERS), and flower beds, bushes, trees and a picket fence in the
 * garden (ROOM_GARDEN). Drawn in scene dots like the shell (room-shells.ts),
 * which lays them over its walls and garden. Leaves and flowers are placed
 * by `noise`, a fixed function of position, so nothing repeats like a tile
 * and a house looks the same on every visit.
 *
 * Each plant is painted dot by dot onto a sheet (`Dots`), a later dot
 * covering an earlier one, so leaves can overlap the way they grow: the
 * ones behind first, in darker greens, then the stems, then the leaves in
 * front, lit from the upper left. The sheet comes out as rectangles.
 */
import type { Art, HouseGeometry, Paint, Rect } from "@/components/room-art";
import type { RoomClimber, RoomGarden } from "@/lib/room-styles";

/** A steady pseudo-random number in [0, 1) for a place (as room-shells.ts). */
function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Noise that changes gently: `noise` at the corners of a grid `cell` dots
 *  square, blended across each square, so neighbours are alike and it
 *  makes patches rather than speckle. In [0, 1). */
function smooth(x: number, y: number, cell: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const ex = (fx - ix) ** 2 * (3 - 2 * (fx - ix));
  const ey = (fy - iy) ** 2 * (3 - 2 * (fy - iy));
  const a = noise(ix, iy, seed);
  const b = noise(ix + 1, iy, seed);
  const c = noise(ix, iy + 1, seed);
  const d = noise(ix + 1, iy + 1, seed);
  return a + (b - a) * ex + (c - a) * ey + (a - b - c + d) * ex * ey;
}

/** One of `list`, picked by a number in [0, 1). */
const pick = <T>(list: readonly T[], n: number): T => list[Math.min(list.length - 1, Math.floor(n * list.length))];

/** A sheet of dots inside a box, one paint each, a later dot covering an
 *  earlier one. `keep`, while set, says which dots may be painted. */
class Dots {
  private readonly dots = new Map<number, Paint>();
  keep: ((x: number, y: number) => boolean) | null = null;
  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly x1: number,
    readonly y1: number,
  ) {}

  dot(x: number, y: number, paint: Paint) {
    if (x < this.x0 || x >= this.x1 || y < this.y0 || y >= this.y1 || (this.keep && !this.keep(x, y))) return;
    this.dots.set((y - this.y0) * (this.x1 - this.x0) + (x - this.x0), paint);
  }

  at(x: number, y: number): Paint | undefined {
    if (x < this.x0 || x >= this.x1 || y < this.y0 || y >= this.y1) return undefined;
    return this.dots.get((y - this.y0) * (this.x1 - this.x0) + (x - this.x0));
  }

  box(x: number, y: number, w: number, h: number, paint: Paint) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.dot(x + i, y + j, paint);
  }

  /** Rows of digits as dots: "1" paints `tones[0]` (the lightest), "2"
   *  `tones[1]`, and so on; anything else is left alone. */
  stamp(rows: readonly string[], x: number, y: number, tones: readonly Paint[]) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const k = row.charCodeAt(i) - 49;
        if (k >= 0 && k < tones.length) this.dot(x + i, y + j, tones[k]);
      }
    });
  }

  /** The sheet as rectangles: each row's runs of one paint, and a run
   *  stacked on the same run in the row above made one taller rectangle. */
  rects(): Rect[] {
    const W = this.x1 - this.x0;
    const keys = [...this.dots.keys()].sort((a, b) => a - b);
    const out: [number, number, number, number, Paint][] = [];
    const open = new Map<string, number>();
    for (let i = 0; i < keys.length; ) {
      const k = keys[i];
      const paint = this.dots.get(k)!;
      const y = Math.floor(k / W);
      let j = i + 1;
      while (j < keys.length && keys[j] === keys[j - 1] + 1 && Math.floor(keys[j] / W) === y && this.dots.get(keys[j]) === paint) j++;
      const x = (k % W) + this.x0;
      const w = j - i;
      const id = `${x},${w},${paint}`;
      const below = open.get(id);
      const sy = y + this.y0;
      if (below !== undefined && out[below][1] + out[below][3] === sy) out[below][3]++;
      else {
        open.set(id, out.length);
        out.push([x, sy, w, 1, paint]);
      }
      i = j;
    }
    return out;
  }
}

// ── Climbers ─────────────────────────────────────────────────────────────

/** One outside wall as a climber sees it: `X(u)` is the scene x `u` dots in
 *  from the wall's outer face (out over the garden when negative), `U` the
 *  other way, and a seed of its own, so the two walls aren't mirror
 *  images. Leaves are never mirrored: the light comes from the upper left
 *  on both. */
interface Wall {
  X: (u: number) => number;
  U: (x: number) => number;
  seed: number;
  left: boolean;
}

/** How far a climber may spill out over the garden from the wall's face. */
const SPILL = 6;

function wallsOf(houseX: number, houseW: number): Wall[] {
  const right = houseX + houseW - 1;
  return [
    { X: (u) => houseX + u, U: (x) => x - houseX, seed: 0, left: true },
    { X: (u) => right - u, U: (x) => right - x, seed: 50, left: false },
  ];
}

/** A stem climbing from `y0` up to `y1`, starting `u` in from the wall's
 *  face: where it is (u) at each dot up. It leans one way for a while,
 *  then the other, and never strays out of [lo, hi]. */
function wander(u: number, y0: number, y1: number, lo: number, hi: number, seed: number, lean = 0.32): number[] {
  const path: number[] = [];
  let dir = noise(u, y0, seed) < 0.5 ? -1 : 1;
  for (let i = 0; y0 - i >= y1; i++) {
    path.push(u);
    if (noise(i, y0, seed) < 0.07) dir = -dir;
    if (noise(y0, i, seed + 1) < lean) u += dir;
    if (u <= lo) [u, dir] = [lo, 1];
    if (u >= hi) [u, dir] = [hi, -1];
  }
  return path;
}

/** A leaf, flower or cluster to stamp: its top left and its rows (see
 *  `Dots.stamp`). */
interface Mark {
  x: number;
  y: number;
  shape: readonly string[];
  tones: readonly Paint[];
}

/** Stamps marks lowest first, so each one overlaps the one under it the way
 *  leaves hang, its dark lower edge over the lit top of the next. */
function shingle(d: Dots, marks: Mark[]) {
  marks.sort((a, b) => b.y + b.shape.length - (a.y + a.shape.length) || a.x - b.x);
  for (const m of marks) d.stamp(m.shape, m.x, m.y, m.tones);
}

/** Ivy leaves, hanging tip down, lit on the upper left, the darkest green
 *  along the lower right: big ones (five across) for old growth, then
 *  four, then three for the young shoots. Some are turned aside. */
const IVY_BIG: readonly (readonly string[])[] = [
  ["12.22", "11222", "12223", ".2334", "..4.."],
  ["..122", "11222", "12233", "2334.", "44..."],
  ["122..", "11222", "12223", ".2334", "...44"],
  [".1.2.", "11222", "12223", ".2334", "..4.."],
];
const IVY_MID: readonly (readonly string[])[] = [
  ["1.22", "1222", "1233", ".34."],
  [".12.", "1122", "1233", ".34."],
  ["112.", "1223", ".233", "..44"],
  [".122", "1223", "233.", "44.."],
];
const IVY_SMALL: readonly (readonly string[])[] = [
  ["1.2", "123", ".4."],
  ["12.", "123", ".34"],
  [".12", "123", "34."],
];
const IVY: readonly Paint[] = ["ivy-hi", "ivy", "ivy-lo", "ivy-deep"];
const IVY_BACK: readonly Paint[] = ["ivy-lo", "ivy-lo", "ivy-deep", "ivy-deep"];
const IVY_NEW: readonly Paint[] = ["ivy-new", "ivy-hi", "ivy", "ivy-lo"];

/** A mark centred on (x, y). */
const centred = (x: number, y: number, shape: readonly string[], tones: readonly Paint[]): Mark => ({
  x: x - Math.floor(shape[0].length / 2),
  y: y - Math.floor(shape.length / 2),
  shape,
  tones,
});

/** Ivy: a deep, dark, glossy mat of overlapping leaves at the foot of the
 *  wall, its top edge ragged, breaking up as it climbs into a few stems
 *  that feel their way up to the eaves, with paler new leaves near their
 *  tips and odd shoots reaching out over the garden. */
function ivy(d: Dots, w: Wall, top: number, earth: number) {
  const L = earth - top;
  const s = w.seed;
  const back: Mark[] = [];
  const front: Mark[] = [];
  // How high the mat comes, in dots, here: a ragged edge, higher in places.
  const matH = clamp(L * 0.3, 26, 70);
  const mat = (u: number, y: number) =>
    earth - 1 - y < matH * (0.45 + 0.75 * smooth(u + 20, y, 9, s + 1)) &&
    u >= -2 - Math.round(smooth(0, y, 6, s + 2) * 2) &&
    u <= 2 + Math.round(smooth(9, y, 5, s + 2));
  // Shadow deep in the mat, between the leaves.
  for (let y = earth - 1; y > earth - 1 - matH * 1.2; y--) {
    for (let u = -3; u <= 2; u++) if (mat(u - 1, y) && mat(u + 1, y) && mat(u, y - 1)) d.dot(w.X(u), y, "ivy-deep");
  }
  for (let row = 0, gy = 0; gy < matH * 1.2; row++, gy += 3) {
    for (let gu = -4 + (row % 2) * 2; gu <= 3; gu += 4) {
      const u = gu + Math.floor(noise(gu, gy, s + 3) * 2);
      const y = earth - 2 - gy - Math.floor(noise(gy, gu, s + 4) * 2);
      if (!mat(u, y)) continue;
      const n = noise(u, y, s + 5);
      const shape = gy < matH * 0.6 && n < 0.75 ? pick(IVY_BIG, noise(y, u, s + 6)) : pick(IVY_MID, noise(y, u, s + 6));
      (n < 0.35 ? back : front).push(centred(w.X(u), y, shape, IVY));
    }
  }
  // The stems: a few go all the way up, the rest give out on the way.
  const reach = [1, 0.9, 0.72, 0.58, 0.46, 0.36, 0.27];
  reach.forEach((r0, k) => {
    const r = k === 0 ? r0 : r0 + (noise(k, s, 7) - 0.5) * 0.14;
    const u0 = [1, 2, 0, 3, -1, 2, 1][k];
    const path = wander(u0, earth - 1, Math.round(earth - 1 - (L - 1) * Math.min(1, r)), -2, 3, s + k * 7, 0.28);
    path.forEach((u, i) => {
      const y = earth - 1 - i;
      if (!d.at(w.X(u), y) || i > matH) d.dot(w.X(u), y, noise(i, k, s + 8) < 0.25 ? "trunk" : "trunk-lo");
    });
    let next = Math.floor(noise(k, s, 9) * 3);
    let side = noise(k, s, 10) < 0.5 ? -1 : 1;
    path.forEach((u, i) => {
      if (i < next) return;
      const y = earth - 1 - i;
      const t = i / L;
      next = i + 3 + Math.floor(t * 3 + noise(i, k, s + 11) * 3);
      side = -side;
      const n = noise(i, k, s + 12);
      const young = path.length - i < 18;
      const shape = t < 0.35 && !young ? pick(IVY_BIG, n) : t < 0.7 && !young ? pick(IVY_MID, n) : pick(IVY_SMALL, n);
      // Leaves reach out over the garden more than in towards the room.
      const du = side < 0 ? -1 - (n < 0.5 ? 1 : 0) : 1;
      const fresh = (young && noise(i, k, s + 13) < 0.65) || noise(k, i, s + 14) < 0.05;
      front.push(centred(w.X(u + du), y, shape, fresh ? IVY_NEW : IVY));
      // Now and then a shoot strays out over the garden, a leaf or two on it.
      if (t > 0.3 && noise(k, i, s + 15) < 0.12) {
        const len = 2 + Math.floor(noise(i, k, s + 16) * 3);
        for (let j = 1; j <= len; j++) d.dot(w.X(u - j), y - (j >> 1), "trunk-lo");
        front.push(centred(w.X(u - len - 1), y - (len >> 1) - 1, pick(IVY_SMALL, n), IVY_NEW));
      }
    });
  });
  for (const m of back) d.stamp(m.shape, m.x, m.y, IVY_BACK);
  shingle(d, front);
}

/** Rose leaves: sprays of small rounded leaflets. */
const ROSE_LEAVES: readonly (readonly string[])[] = [
  ["12.", "123", ".33"],
  [".1.", "122", ".33"],
  ["11.", "122", ".34"],
  [".11", "221", "43."],
  ["12.2", "1223", ".34."],
  ["11", "23"],
];
const ROSE_GREEN: readonly Paint[] = ["leaf", "leaf-lo", "ivy-lo", "ivy-deep"];
const ROSE_LIT: readonly Paint[] = ["leaf-hi", "leaf", "leaf-lo", "ivy-lo"];
/** Roses: a full bloom with its dark heart, one half open, a small one. */
const ROSE_BIG: readonly string[] = [".12.", "1342", "2344", ".44."];
const ROSE_OPEN: readonly string[] = ["112", "143", "233"];
const ROSE_SMALL: readonly string[] = ["12", "34"];
/** A bud, its green calyx under it. */
const BUD: readonly string[] = ["1", "2"];
const PINK: readonly Paint[] = ["rose-pale", "rose-hi", "rose", "rose-lo"];
const RED: readonly Paint[] = ["rose-hi", "rose", "rose-lo", "rose-deep"];

/** Climbing roses: thorny canes up the wall, old and brown at the foot and
 *  green higher up, leafy low down, with roses pink and red in twos and
 *  threes all the way up and buds on the youngest shoots. */
function roses(d: Dots, w: Wall, top: number, earth: number) {
  const L = earth - top;
  const s = w.seed + 3;
  const leaves: Mark[] = [];
  const blooms: Mark[] = [];
  const canes: [u: number, reach: number][] = [[1, 1], [3, 0.9], [0, 0.76], [2, 0.6], [-1, 0.47], [1, 0.36], [3, 0.26]];
  canes.forEach(([u0, r0], k) => {
    const r = k === 0 ? r0 : r0 + (noise(k, s, 1) - 0.5) * 0.12;
    const path = wander(u0, earth - 1, Math.round(earth - 1 - (L - 1) * Math.min(1, r)), -2, 3, s + k * 5, 0.24);
    path.forEach((u, i) => {
      const y = earth - 1 - i;
      const t = i / L;
      const x = w.X(u);
      if (i < 12 && k < 3) {
        // An old cane is thick at the foot, lit on its left.
        d.dot(Math.min(x, w.X(u + 1)), y, "trunk-hi");
        d.dot(Math.max(x, w.X(u + 1)), y, "trunk-lo");
      } else d.dot(x, y, t < 0.3 + k * 0.03 ? (noise(i, k, s) < 0.3 ? "trunk" : "trunk-lo") : "leaf-lo");
      // Thorns, now one side, now the other.
      if (noise(i, k, s + 2) < 0.2) d.dot(x + (noise(k, i, s + 2) < 0.5 ? -1 : 1), y, t < 0.3 ? "trunk-lo" : "ivy-lo");
    });
    let next = Math.floor(noise(k, s, 3) * 3);
    let bloomAt = 3 + Math.floor(noise(k, s, 4) * 8);
    let side = noise(k, s, 5) < 0.5 ? -1 : 1;
    path.forEach((u, i) => {
      const y = earth - 1 - i;
      const t = i / L;
      const young = path.length - i < 12;
      if (i >= next) {
        next = i + 3 + Math.floor(t * 3 + noise(i, k, s + 6) * 3);
        side = -side;
        const n = noise(i, k, s + 7);
        const shape = young ? ROSE_LEAVES[5] : pick(ROSE_LEAVES, n);
        leaves.push(centred(w.X(u + (side < 0 ? -1 - (n < 0.4 ? 1 : 0) : 1)), y, shape, n < 0.3 || young ? ROSE_LIT : ROSE_GREEN));
        // The rose is leafiest low down.
        if (t < 0.3 && noise(i, k, s + 8) < 0.75 - t * 2) leaves.push(centred(w.X(u - side * 2), y - 1, pick(ROSE_LEAVES, noise(k, i, s + 9)), ROSE_GREEN));
      }
      if (i < bloomAt) return;
      // As many roses high up as low down, where there are fewer canes.
      bloomAt = i + 12 + Math.floor(noise(i, k, s + 10) * 10 + (1 - t) * 20);
      const n = noise(k, i, s + 11);
      const tones = n < 0.55 ? PINK : RED;
      const bx = w.X(u + (noise(i, k, s + 12) < 0.6 ? -1 : 1));
      if (young) {
        blooms.push({ x: bx, y: y - 1, shape: BUD, tones: [tones[2], "leaf-lo"] });
        return;
      }
      blooms.push(centred(bx, y, t < 0.5 && n > 0.3 && n < 0.8 ? ROSE_BIG : ROSE_OPEN, tones));
      // Roses come in twos and threes: a smaller one beside, a bud above.
      const dx = noise(i, k, s + 13) < 0.5 ? -3 : 3;
      if (noise(i, k, s + 14) < 0.6) blooms.push(centred(bx + dx, y + 2, ROSE_SMALL, tones));
      if (noise(i, k, s + 15) < 0.45) blooms.push({ x: bx - dx / 3, y: y - 3, shape: BUD, tones: [tones[2], "leaf-lo"] });
    });
  });
  shingle(d, leaves);
  shingle(d, blooms);
}

/** Wisteria leaves: sprays of fresh leaflets either side of a stalk. */
const WISTERIA_LEAVES: readonly (readonly string[])[] = [
  ["1.1.", ".21.", "2.23", "..3."],
  ["11.", "122", ".23"],
  [".11", "12.", "223"],
  ["1.1", "121", ".3."],
  ["1.1.", "1222", ".3.3"],
];
const FRESH: readonly Paint[] = ["leaf-hi", "leaf", "leaf-lo"];
const LILAC: readonly Paint[] = ["wis-hi", "wis", "wis-lo", "wis-deep"];

/** A wisteria raceme `len` long hanging from (x, y): three florets across
 *  at the top, open and pale, narrowing to a tip of dark buds, wandering a
 *  little as the florets alternate, lit on its left. */
function raceme(d: Dots, x: number, y: number, len: number, seed: number) {
  let cx = x;
  for (let r = 0; r < len; r++) {
    const f = r / (len - 1);
    const width = f < 0.34 ? 3 : f < 0.72 ? 2 : 1;
    if (width < 3 && noise(r, x, seed) < 0.4) cx = clamp(cx + (noise(x, r + y, seed) < 0.5 ? -1 : 1), x - 1, x + 1);
    const base = f < 0.25 ? 0 : f < 0.55 ? 1 : f < 0.86 ? 2 : 3;
    const x0 = width === 3 ? cx - 1 : width === 2 ? cx - (r % 2) : cx;
    for (let c = 0; c < width; c++) {
      const tone = width === 1 ? base : clamp(base + (c === 0 ? -1 : c === width - 1 ? 1 : 0), 0, 3);
      d.dot(x0 + c, y + r, LILAC[tone]);
    }
    // A floret standing out at the side here and there.
    if (width === 3 && r % 2 && noise(r, x, seed + 1) < 0.5) d.dot(noise(x, r, seed + 2) < 0.5 ? x0 - 1 : x0 + 3, y + r, LILAC[base + 1]);
  }
}

/** Wisteria: an old trunk, thick and gnarled at the foot, its wood twisted
 *  in a spiral, parting about halfway up into two stems that twine round
 *  each other to the eaves. From the upper third, branches hung with
 *  racemes of lilac flowers among fresh leaves, and a row of them along
 *  the eaves. */
function wisteria(d: Dots, w: Wall, top: number, earth: number) {
  const L = earth - top;
  const s = w.seed + 7;
  const phase = noise(s, 1) * 6;
  const twist = Math.floor(noise(s, 2) * 7);
  // Where the trunk is, `i` dots up: wandering a little about the wall.
  const mid = (i: number) => 1 + Math.round(1.1 * Math.sin(i / 23 + phase) + 0.5 * Math.sin(i / 8 + phase * 2));
  const fork = Math.round(L * (0.4 + noise(s, 3) * 0.12));
  /** A run of trunk across from u0 to u1 at y: lit on its left, shaded on
   *  its right, with the spiral grooves of old wood. */
  const wood = (u0: number, u1: number, y: number, i: number) => {
    const a = Math.min(w.X(u0), w.X(u1));
    const b = Math.max(w.X(u0), w.X(u1));
    for (let x = a; x <= b; x++) {
      const groove = b - a > 1 && x > a && (i + 2 * (x - a) + twist) % 7 === 0;
      d.dot(x, y, x === a ? "trunk-hi" : x === b || groove ? "trunk-lo" : "trunk");
    }
  };
  for (let i = 0; i < fork; i++) {
    const t = i / L;
    const th = i < 3 ? 7 - i * 1.5 : t < 0.12 ? 4 : t < 0.26 ? 3 : 2;
    const u0 = mid(i) - Math.floor((th - 1) / 2);
    wood(u0, u0 + Math.ceil(th) - 1, earth - 1 - i, i);
    // A knot here and there.
    if (i > 4 && noise(i, s, 4) < 0.05) {
      const k = noise(s, i, 4) < 0.5 ? u0 - 1 : u0 + Math.ceil(th);
      d.dot(w.X(k), earth - 1 - i, "trunk");
      d.dot(w.X(k), earth - i, "trunk-lo");
    }
  }
  // Above the fork, two stems twining round each other: the one behind in
  // shadow where they cross.
  const stems: [number, number][] = [];
  for (let i = fork; i < L; i++) {
    const a = (i - fork) / 6 + phase;
    const off = Math.round(1.2 * Math.sin(a));
    const y = earth - 1 - i;
    const pair = [mid(i) + off, mid(i) - off];
    const front = Math.cos(a) > 0 ? 0 : 1;
    pair.forEach((u, j) => {
      if (j === front) return;
      d.dot(w.X(u), y, "trunk-lo");
    });
    d.dot(w.X(pair[front]), y, i - fork < 8 ? "trunk-hi" : "trunk");
    if (i - fork < 8) d.dot(w.X(pair[front] + 1), y, "trunk-lo");
    stems.push([pair[0], pair[1]]);
  }
  const leaves: Mark[] = [];
  const hang: [x: number, y: number, len: number][] = [];
  // A few leaves along the lower trunk.
  for (let i = Math.floor(L * 0.2); i < fork + 10; i += 9 + Math.floor(noise(i, s, 5) * 10)) {
    const out = noise(s, i, 6) < 0.6;
    leaves.push(centred(w.X(mid(i) + (out ? -3 : 3)), earth - 1 - i, pick(WISTERIA_LEAVES, noise(i, s, 7)), FRESH));
  }
  // Branches from the upper third, each hung with racemes.
  for (let i = Math.max(fork + 6, Math.floor(L * 0.6)); i < L - 12; i += 7 + Math.floor(noise(i, s, 8) * 7)) {
    const out = noise(i, s, 9) < 0.7 ? -1 : 1;
    const from = stems[i - fork][noise(s, i, 10) < 0.5 ? 0 : 1];
    const len = out < 0 ? 3 + Math.floor(noise(s, i, 11) * 4) : 2 + Math.floor(noise(s, i, 11) * 2);
    let u = from;
    let y = earth - 1 - i;
    for (let k = 1; k <= len && u + out >= -5 && u + out <= 4; k++) {
      u += out;
      if (k % 3 === 2) y--;
      d.dot(w.X(u), y, "trunk");
      if (k >= 2 && (k === len || noise(k, i, s + 12) < 0.45)) hang.push([w.X(u), y + 1, 5 + Math.floor(noise(u, i, s + 13) * 5)]);
    }
    leaves.push(centred(w.X(u), y - 2, pick(WISTERIA_LEAVES, noise(i, u, s + 14)), FRESH));
    leaves.push(centred(w.X(from - out), y - 1, pick(WISTERIA_LEAVES, noise(u, i, s + 15)), FRESH));
  }
  // Along the eaves: a branch under the wall plate, hung all along.
  const ey = top + 3;
  for (let u = -5; u <= 4; u++) d.dot(w.X(u), ey + (noise(u, s, 16) < 0.3 ? 1 : 0), u === mid(L) ? "trunk-lo" : "trunk");
  for (let u = -5 + Math.floor(noise(s, 17) * 2); u <= 3; u += 2 + Math.floor(noise(u, s, 18) * 2)) {
    hang.push([w.X(u), ey + 2, 5 + Math.floor(noise(s, u, 19) * 5)]);
    leaves.push(centred(w.X(u + 1), ey - 1, pick(WISTERIA_LEAVES, noise(u, s, 20)), FRESH));
  }
  shingle(d, leaves);
  // The racemes, the ones behind first.
  hang.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  for (const [x, y, len] of hang) raceme(d, x, y, len, s);
}

/** The climber up both outside walls, from the ground (`earth`) to the
 *  eaves (g.floorsTop). Drawn over the walls, under the furniture. */
export function climberArt(kind: Exclude<RoomClimber, "none">, g: HouseGeometry, earth: number): Rect[] {
  const d = new Dots(0, 0, g.sceneW, earth + g.ground);
  const top = g.floorsTop;
  for (const w of wallsOf(g.houseX, g.houseW)) {
    // Over the wall and a little out over the garden, up to the eaves;
    // never more than a dot into a room.
    d.keep = (x, y) => {
      const u = w.U(x);
      return y >= top && y < earth && u <= g.wall && u >= -SPILL;
    };
    if (kind === "ivy") ivy(d, w, top, earth);
    else if (kind === "roses") roses(d, w, top, earth);
    else wisteria(d, w, top, earth);
  }
  d.keep = null;
  return d.rects();
}

// ── The garden ───────────────────────────────────────────────────────────

/** One side's garden as what grows in it sees it: `X(v)` is the scene x
 *  `v` dots out from the house (0 just by the wall), out to `width`, the
 *  scene's edge. As with the walls, nothing in it is mirrored. */
interface Plot {
  X: (v: number) => number;
  width: number;
  seed: number;
  left: boolean;
}

function plotsOf(g: HouseGeometry): Plot[] {
  const right = g.houseX + g.houseW;
  return [
    { X: (v) => g.houseX - 1 - v, width: g.houseX, seed: 0, left: true },
    { X: (v) => right + v, width: g.sceneW - right, seed: 40, left: false },
  ];
}

const HEDGE: readonly Paint[] = ["leaf-hi", "leaf", "leaf-lo", "ivy-lo", "ivy-deep"];
const BLOSSOM: readonly Paint[] = ["blossom-hi", "blossom", "blossom-lo", "blossom-deep", "blossom-deep"];

/** Clumps of leaves (or blossom) filling the ellipse at (cx, cy), `rx` ×
 *  `ry`: each clump lit on its upper left and darker round its lower rim,
 *  the whole lit from the upper left too. The clumps go on from the top
 *  down, each laid over the underside of the one above it. `rough` is how
 *  ragged the outline is (0 for a clipped bush). `tones` run light to dark
 *  (five). Returns the clumps, top first. */
function foliage(
  d: Dots,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tones: readonly Paint[],
  seed: number,
  rough: number,
  clump = 3,
): { x: number; y: number; r: number }[] {
  const clumps: { x: number; y: number; r: number }[] = [];
  for (let gy = -ry; gy <= ry; gy += clump) {
    for (let gx = -rx - ((gy / clump) % 2 ? clump / 2 : 0); gx <= rx; gx += clump) {
      const x = cx + Math.round(gx + (noise(gx, gy, seed + 1) - 0.5) * clump);
      const y = cy + Math.round(gy + (noise(gy, gx, seed + 2) - 0.5) * clump);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
      clumps.push({ x, y, r: clump * (0.75 + noise(x, y, seed + 3) * 0.5) });
    }
  }
  clumps.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of clumps) {
    const r = Math.ceil(c.r);
    for (let y = c.y - r; y <= c.y + r; y++) {
      for (let x = c.x - r; x <= c.x + r; x++) {
        const dx = x - c.x;
        const dy = y - c.y;
        const e = (dx * dx + dy * dy) / (c.r * c.r);
        if (e > 1 - noise(x, y, seed + 4) * 0.3) continue;
        // Keep to the outline: clipped smooth, or left ragged.
        const o = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2;
        if (o > 1 + rough * (noise(x, y, seed + 5) - 0.3)) continue;
        const whole = ((x - cx) / rx) * 0.45 + ((y - cy) / ry) * 0.8;
        const local = (dx * 0.6 + dy) / c.r;
        const v = local * 0.55 + whole * 0.7 + (noise(y, x, seed + 6) - 0.5) * 0.3;
        let tone = v < -0.55 ? 0 : v < 0.05 ? 1 : v < 0.5 ? 2 : 3;
        if (dy > 0 && e > 0.5) tone++;
        d.dot(x, y, tones[Math.min(tone, tones.length - 1)]);
      }
    }
  }
  return clumps;
}

/** A soft shadow on the grass under something `w` wide at x. */
function shadow(d: Dots, x: number, w: number, earth: number) {
  for (let i = 0; i < w; i++) {
    d.dot(x + i, earth, "garden-shadow");
    if (i > 0 && i < w - 1) d.dot(x + i, earth + 1, "garden-shadow");
  }
}

/** A line of bough from (x0, y0) up to (x1, y1), `th` thick, lit on its
 *  left. */
function bough(d: Dots, x0: number, y0: number, x1: number, y1: number, th: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / n);
    const y = Math.round(y0 + ((y1 - y0) * k) / n);
    const w = k > n * 0.6 ? 1 : th;
    for (let i = 0; i < w; i++) d.dot(x + i, y, w === 1 ? "trunk" : i === 0 ? "trunk-hi" : "trunk-lo");
  }
}

/** One mass of a tree's crown: `out` dots from the trunk (towards the
 *  scene's edge when positive), its centre `up` dots above the grass. */
interface Crown {
  out: number;
  up: number;
  rx: number;
  ry: number;
}

/** The apple tree's crown, round and full; the cherry's, low and spreading
 *  on boughs that fan out from a short trunk. For a garden 24 dots wide. */
const APPLE: readonly Crown[] = [
  { out: 0, up: 86, rx: 15, ry: 17 },
  { out: 9, up: 70, rx: 8, ry: 7 },
  { out: -8, up: 68, rx: 7, ry: 7 },
];
const CHERRY: readonly Crown[] = [
  { out: 0, up: 68, rx: 13, ry: 9 },
  { out: 11, up: 60, rx: 10, ry: 8 },
  { out: -11, up: 58, rx: 10, ry: 7 },
];

/** The tree in one side's garden: an apple tree on the left, round, its
 *  apples ripening; a cherry in blossom on the right, wider and lower, its
 *  petals falling. Each stands mid-garden, its crown above the ground
 *  floor's windows, out to the edge of the scene and over the house wall
 *  (the rooms are drawn over it, so it stands behind the house). */
function tree(d: Dots, p: Plot, earth: number) {
  const Y = p.width;
  const s = p.seed + 20;
  const wide = Y / 24;
  const tall = Y >= 20 ? 1 : 0.8;
  const cherry = !p.left;
  const tv = Math.round(Y * (cherry ? 0.48 : 0.5));
  const tx = p.X(tv);
  const fork = earth - Math.round((cherry ? 26 : 38) * tall);
  // The trunk, three dots thick, splayed at the foot.
  for (let y = earth - 1; y >= fork; y--) {
    const i = earth - y;
    for (let c = -1; c <= 1; c++) d.dot(tx + c, y, c < 0 ? "trunk-hi" : c > 0 || noise(c, y, s) < 0.12 ? "trunk-lo" : "trunk");
    if (i < 3) d.dot(tx + (i === 1 ? -2 : 2), y, "trunk-lo");
  }
  d.dot(tx - 2, earth - 1, "trunk-lo");
  d.dot(tx + 2, earth - 1, "trunk-lo");
  const parts = (cherry ? CHERRY : APPLE).map((c) => {
    // Kept inside the scene, ragged edge and all: a crown that would reach
    // past it is drawn a little smaller, then moved in over the house.
    let v = tv + Math.round(c.out * wide);
    let rx = Math.max(5, Math.round(c.rx * Math.max(wide, 0.7)));
    const over = v + Math.ceil(rx * 1.2) + 1 - Y;
    if (over > 0) {
      const less = Math.min(over, rx - Math.max(5, Math.round(rx * 0.75)));
      rx -= less;
      v -= over - less;
    }
    return { x: p.X(v), y: earth - Math.round(c.up * tall), rx, ry: Math.max(5, Math.round(c.ry * tall)) };
  });
  for (const c of parts) bough(d, tx - 1, fork, c.x, c.y + Math.round(c.ry * 0.3), 2);
  const tones = cherry ? BLOSSOM : HEDGE;
  const clumps = parts.flatMap((c, k) => foliage(d, c.x, c.y, c.rx, c.ry, tones, s + k * 10, 0.55, Y > 18 ? 4 : 3));
  // The boughs show here and there where they go up into the leaves.
  for (const c of parts) {
    const n = Math.round(c.ry * 0.7);
    for (let k = 0; k < n; k++) {
      const y = c.y + Math.round(c.ry * 0.3) + k;
      const x = Math.round(c.x + ((tx - 1 - c.x) * (y - c.y - c.ry * 0.3)) / (fork - c.y - c.ry * 0.3));
      if (noise(x, y, s + 3) < 0.55) d.dot(x, y, "trunk-lo");
    }
  }
  if (cherry) {
    // A few fresh leaves among the blossom, and petals on the grass.
    for (const c of clumps) if (noise(c.x, c.y, s + 4) < 0.16) d.dot(c.x + 1, c.y + 1, "leaf");
    const reach = parts.reduce((m, c) => Math.max(m, Math.abs(c.x - tx) + c.rx), 0);
    for (let x = tx - reach; x <= tx + reach; x++) if (noise(x, s, 5) < 0.14) d.dot(x, earth + (noise(s, x, 6) < 0.5 ? 0 : 1), "blossom");
  } else {
    // Apples where the light catches the lower clumps.
    for (const c of clumps) {
      if (noise(c.x, c.y, s + 1) > 0.2) continue;
      const ax = c.x + Math.round(noise(c.y, c.x, s + 2) * 2 - 1);
      d.dot(ax, c.y + 1, "apple-hi");
      d.dot(ax + 1, c.y + 1, "apple");
      d.dot(ax, c.y + 2, "apple");
      d.dot(ax + 1, c.y + 2, "rose-lo");
    }
  }
  shadow(d, tx - 6, 13, earth);
}

/** A white picket fence across one side's garden, from the scene's edge
 *  to a gatepost a few dots short of the house: pointed pickets lit on the
 *  left, two rails behind them. */
function fence(d: Dots, p: Plot, earth: number) {
  const H = 10;
  const top = earth - H;
  const gate = 2;
  // The gatepost, a little taller, with a ball on top.
  const gx = Math.min(p.X(gate), p.X(gate + 4));
  d.stamp([
    "..1..",
    ".122.",
    "..3..",
    "11223",
    ".123.",
    ".123.",
    ".123.",
    ".123.",
    ".123.",
    ".123.",
    ".123.",
    ".123.",
    ".344.",
  ], gx, earth - 13, ["picket-hi", "picket", "picket-lo", "picket-deep"]);
  // The rails, behind, from the post to the edge.
  for (let v = gate + 5; v < p.width; v++) {
    const x = p.X(v);
    d.dot(x, top + 2, "picket");
    d.dot(x, top + 3, "picket-deep");
    d.dot(x, top + 6, "picket");
    d.dot(x, top + 7, "picket-deep");
  }
  // The pickets, three wide, every five dots out from the post.
  for (let v = gate + 6; v < p.width + 3; v += 5) {
    const x = Math.min(p.X(v), p.X(v + 2));
    d.stamp([".1.", "122", ...Array<string>(H - 3).fill("123"), "334"], x, top, ["picket-hi", "picket", "picket-lo", "picket-deep"]);
  }
  for (let v = gate; v < p.width; v++) d.dot(p.X(v), earth, "garden-shadow");
}

/** A rounded, clipped bush `w` wide standing at x (its left edge), dark
 *  underneath, with a few berries or flowers. */
function bush(d: Dots, x: number, w: number, earth: number, seed: number) {
  const rx = w / 2;
  const ry = Math.round(w * 0.38);
  const cx = x + Math.floor(rx);
  const cy = earth - ry - 1;
  shadow(d, x - 1, w + 2, earth);
  const clumps = foliage(d, cx, cy, Math.floor(rx), ry, HEDGE, seed, 0.15, w > 12 ? 3 : 2);
  // Clipped flat at the foot, in its own shadow.
  for (let i = 1; i < w - 1; i++) if (d.at(x + i, earth - 1)) d.dot(x + i, earth - 1, "ivy-deep");
  const berry = noise(seed, w) < 0.5;
  for (const c of clumps) {
    if (c.y > earth - 3 || noise(c.x, c.y, seed + 9) > 0.22) continue;
    if (berry) d.dot(c.x, c.y, "rose-lo");
    else {
      d.dot(c.x, c.y, "petal-white");
      d.dot(c.x + 1, c.y + 1, "rose-pale");
    }
  }
}

/** Bushes at the two corners of the house, over the foot of its walls, and
 *  where the garden is wide enough a smaller one further out. */
function bushes(d: Dots, g: HouseGeometry, p: Plot, earth: number) {
  const w = clamp(Math.round(p.width * 0.5), 10, 13);
  // Over the outside wall as far as its inside face, and out over the grass.
  const x = p.left ? g.houseX + g.wall - w : g.houseX + g.houseW - g.wall;
  bush(d, x, w, earth, p.seed + 30);
  if (p.width >= 30) {
    const sw = 7 + Math.floor(noise(p.seed, 3) * 2);
    bush(d, Math.min(p.X(p.width - 3), p.X(p.width - 2 - sw)), sw, earth, p.seed + 31);
  }
}

type Flower = "tulip" | "daisy" | "lavender";
const TULIPS: readonly (readonly Paint[])[] = [
  ["apple-hi", "apple", "rose-lo"],
  ["petal-white", "petal-gold", "petal-gold-lo"],
  ["rose-pale", "rose-hi", "rose"],
];

/** One flower `h` tall, its stem at x. */
function flower(d: Dots, kind: Flower, x: number, earth: number, h: number, tones: readonly Paint[]) {
  const head = earth - h;
  for (let y = head + 2; y < earth - 1; y++) d.dot(x, y, "leaf-lo");
  switch (kind) {
    case "tulip":
      d.dot(x - 1, head, tones[0]);
      d.dot(x + 1, head, tones[1]);
      d.dot(x - 1, head + 1, tones[0]);
      d.dot(x, head + 1, tones[1]);
      d.dot(x + 1, head + 1, tones[2]);
      d.dot(x, head, tones[1]);
      d.dot(x - 1, earth - 3, "leaf");
      return;
    case "daisy":
      d.dot(x, head, "petal-white");
      d.dot(x - 1, head + 1, "petal-white");
      d.dot(x, head + 1, "petal-gold");
      d.dot(x + 1, head + 1, "picket-lo");
      d.dot(x, head + 2, "picket-lo");
      return;
    case "lavender":
      for (let y = head; y < head + 3; y++) d.dot(x, y, (y - head) % 2 ? "wis-deep" : "wis-lo");
      d.dot(x, head - 1, "wis");
      return;
  }
}

/** A bed of flowers from x0 to x1 (exclusive), none taller than `tall`:
 *  clumps of tulips (one colour to a clump), daisies and lavender over low
 *  leaves, at uneven spacings. */
function bed(d: Dots, x0: number, x1: number, earth: number, tall: number, seed: number) {
  for (let x = x0 + Math.floor(noise(x0, seed) * 3); x < x1; ) {
    const n = noise(x, seed, 1);
    const kind: Flower | null = n < 0.36 ? "tulip" : n < 0.62 ? "daisy" : n < 0.9 ? "lavender" : null;
    const w = 3 + Math.floor(noise(x, seed, 2) * 6);
    const tones = TULIPS[Math.floor(noise(seed, x, 3) * TULIPS.length)];
    for (let i = 0; i < w && x + i < x1; i++) {
      d.dot(x + i, earth - 1, noise(x + i, seed, 4) < 0.6 ? "leaf-lo" : "leaf");
      if (noise(x + i, seed, 5) < 0.5) d.dot(x + i, earth - 2, noise(seed, x + i, 6) < 0.5 ? "leaf" : "leaf-hi");
    }
    if (kind) {
      const gap = kind === "tulip" ? 3 : kind === "daisy" ? 3 : 2;
      for (let i = 1; i < w - 1 && x + i < x1 - 1; i += gap + (noise(x + i, seed, 7) < 0.3 ? 1 : 0)) {
        const h = tall - Math.floor(noise(seed, x + i, 8) * 2);
        flower(d, kind, x + i, earth, h, tones);
      }
    }
    x += w + Math.floor(noise(x, seed, 9) * 4);
  }
}

/** The garden things chosen, either side of the house and along its
 *  front, standing on the grass at `earth`. Drawn behind the style's own
 *  garden pieces (a shrub, a lantern), in front of the foundations. */
export function gardenArt(items: readonly RoomGarden[], g: HouseGeometry, earth: number): Rect[] {
  const d = new Dots(0, 0, g.sceneW, earth + g.ground);
  const plots = plotsOf(g);
  // From the back to the front.
  if (items.includes("trees")) for (const p of plots) tree(d, p, earth);
  if (items.includes("fence")) for (const p of plots) fence(d, p, earth);
  if (items.includes("flowers")) {
    // Along the front of the foundations, no higher than they are, and in
    // the garden either side.
    bed(d, g.houseX - 2, g.houseX + g.houseW + 2, earth, g.foundation, 1);
    for (const p of plots) bed(d, Math.min(p.X(1), p.X(p.width - 1)), Math.max(p.X(1), p.X(p.width - 1)) + 1, earth, 7, p.seed + 2);
  }
  if (items.includes("bushes")) for (const p of plots) bushes(d, g, p, earth);
  return d.rects();
}

/** A tile's picture for Decorate, `w` × `h`: the corner of a house, its
 *  wall on the right, with the climber grown up it from the grass. "none"
 *  is the bare wall. */
export function climberSample(kind: RoomClimber, w: number, h: number): Art {
  const face = Math.round(w * 0.42);
  const earth = h - 3;
  const R: Rect[] = [
    [face, 0, w - face, earth, "outer"],
    [face, 0, 1, earth, "outer-hi"],
    [0, earth, w, 3, "grass"],
  ];
  if (kind === "none") return { w, h, rects: R };
  const d = new Dots(0, 0, w, earth);
  const wall: Wall = { X: (u) => face + u, U: (x) => x - face, seed: 0, left: true };
  d.keep = (x) => x - face >= -SPILL;
  (kind === "ivy" ? ivy : kind === "roses" ? roses : wisteria)(d, wall, 0, earth);
  return { w, h, rects: [...R, ...d.rects()] };
}

/** A small apple tree for the garden's Decorate tile, which has no room for
 *  a whole one. */
function sapling(d: Dots, x: number, earth: number, w: number) {
  const fork = earth - Math.round(w * 0.3);
  for (let y = earth - 1; y >= fork; y--) {
    d.dot(x - 1, y, "trunk-hi");
    d.dot(x, y, "trunk");
    d.dot(x + 1, y, "trunk-lo");
  }
  d.dot(x - 2, earth - 1, "trunk-lo");
  d.dot(x + 2, earth - 1, "trunk-lo");
  const rx = Math.floor(w / 2) - 2;
  const ry = Math.round((fork - 2) / 2);
  const clumps = foliage(d, x, ry + 1, rx, ry, HEDGE, 3, 0.4, 3);
  for (const c of clumps) {
    if (noise(c.x, c.y, 21) > 0.3) continue;
    d.dot(c.x, c.y + 1, "apple-hi");
    d.dot(c.x + 1, c.y + 1, "apple");
    d.dot(c.x, c.y + 2, "apple");
  }
  shadow(d, x - 5, 11, earth);
}

/** A tile's picture for Decorate, `w` × `h`: the garden thing on a strip of
 *  grass. */
export function gardenSample(item: RoomGarden, w: number, h: number): Art {
  const earth = h - 3;
  const d = new Dots(0, 0, w, h);
  if (item === "flowers") {
    // A clump of each, the way a bed has them, over low leaves.
    for (let x = 0; x < w; x++) {
      d.dot(x, earth - 1, noise(x, 7) < 0.6 ? "leaf-lo" : "leaf");
      if (noise(x, 8) < 0.55) d.dot(x, earth - 2, noise(8, x) < 0.5 ? "leaf" : "leaf-hi");
    }
    const clumps: [Flower, number, number, readonly Paint[]][] = [
      ["tulip", 2, 9, TULIPS[0]],
      ["tulip", 5, 10, TULIPS[0]],
      ["daisy", 9, 7, TULIPS[1]],
      ["lavender", 12, 11, TULIPS[1]],
      ["lavender", 14, 9, TULIPS[1]],
      ["daisy", 17, 8, TULIPS[1]],
      ["tulip", 21, 9, TULIPS[2]],
      ["tulip", 24, 10, TULIPS[2]],
    ];
    for (const [kind, x, tall, tones] of clumps) flower(d, kind, Math.round((x * w) / 27), earth, tall, tones);
  }
  else if (item === "bushes") {
    bush(d, 1, 14, earth, 30);
    bush(d, 16, 9, earth, 31);
  } else if (item === "trees") sapling(d, Math.floor(w / 2), earth, w);
  else fence(d, { X: (v) => v, width: w, seed: 0, left: false }, earth);
  return { w, h, rects: [[0, earth, w, 3, "grass"], ...d.rects()] };
}
