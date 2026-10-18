/**
 * Windows for the back walls of the reading room's rooms (Decorate › House
 * › Windows, lib/room-styles.ts: ROOM_WINDOWS). The house puts one in each
 * stretch of wall that furniture leaves clear (lib/room.ts: windowSpots),
 * the same distance down from every ceiling. Through the glass is the sky:
 * blue by day, dark with stars at night, in the paints the window seat's
 * window uses (reading-room.css), with a cloud, a bough or far hills, as
 * they are in the season outside (room-seasons.ts).
 *
 * Each is drawn dot by dot on a little canvas and then gathered into
 * rectangles. Light comes from the upper left, as everywhere in the house:
 * frames are lit on their top and left edges, outlined in their darkest
 * shade, and cast a faint shadow down and to the right.
 */
import type { Art, Paint, Rect } from "@/components/room-art";
import type { RoomWindow, Season } from "@/lib/room-styles";

/** Every window, frame, sill, curtains or shutters and all, fits a box
 *  this size, with its top this far under the room's ceiling: below what
 *  hangs along the ceilings (room-shells.ts: ceiling), and above most
 *  furniture (lib/room.ts: HIGH_PART is measured against this band). */
export const WINDOW_W = 22;
export const WINDOW_H = 36;
export const WINDOW_DROP = 32;
/** Each kind comes in this many views out, used in turn along the house so
 *  the windows don't look stamped out: the same frame, a different sky. */
export const WINDOW_VIEWS = 3;

type Kind = Exclude<RoomWindow, "none">;

/** A steady pseudo-random number in [0, 1) for a place (as room-shells.ts). */
function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ── The canvas ───────────────────────────────────────────────────────────

/** A window's dots while it's drawn: one paint each (or none, where the
 *  wall shows), and over them the see-through paints, a glint or a star or
 *  a shadow, which tint what's under them. The window is symmetrical about
 *  x = MID; the last column and row take the shadow it casts. */
const MID = 10;

class Canvas {
  readonly base: (Paint | null)[] = Array(WINDOW_W * WINDOW_H).fill(null);
  readonly over: (Paint | null)[] = Array(WINDOW_W * WINDOW_H).fill(null);

  private inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < WINDOW_W && y < WINDOW_H;
  }

  at(x: number, y: number): Paint | null {
    return this.inside(x, y) ? this.base[y * WINDOW_W + x] : null;
  }

  dot(x: number, y: number, paint: Paint) {
    if (this.inside(x, y)) this.base[y * WINDOW_W + x] = paint;
  }

  fill(x: number, y: number, w: number, h: number, paint: Paint) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.dot(i, j, paint);
  }

  /** The same dots either side of the middle. */
  pair(x: number, y: number, w: number, h: number, paint: Paint, other: Paint = paint) {
    this.fill(x, y, w, h, paint);
    this.fill(2 * MID - x - w + 1, y, w, h, other);
  }

  /** Text rows, one character a dot, painted by `key` ("." is left be). */
  sprite(rows: readonly string[], ox: number, oy: number, key: Record<string, Paint>) {
    rows.forEach((row, y) => [...row].forEach((ch, x) => key[ch] && this.dot(ox + x, oy + y, key[ch])));
  }

  /** A see-through paint over what's drawn there, or over the bare wall
   *  (a shadow cast on it) if `bare`. */
  tint(x: number, y: number, paint: Paint, bare = false) {
    if (this.inside(x, y) && (bare || this.at(x, y))) this.over[y * WINDOW_W + x] = paint;
  }

  tinted(x: number, y: number) {
    return this.inside(x, y) && this.over[y * WINDOW_W + x] !== null;
  }

  /** Runs of one paint along each row, stacked where rows repeat. */
  rects(): Rect[] {
    return [...runs(this.base), ...runs(this.over)];
  }
}

function runs(cells: readonly (Paint | null)[]): Rect[] {
  const out: [number, number, number, number, Paint][] = [];
  let open = new Map<string, number>();
  for (let y = 0; y < WINDOW_H; y++) {
    const next = new Map<string, number>();
    for (let x = 0; x < WINDOW_W; ) {
      const paint = cells[y * WINDOW_W + x];
      let end = x + 1;
      while (end < WINDOW_W && cells[y * WINDOW_W + end] === paint) end++;
      if (paint) {
        const key = `${x},${end - x},${paint}`;
        const i = open.get(key);
        if (i === undefined) {
          next.set(key, out.length);
          out.push([x, y, end - x, 1, paint]);
        } else {
          out[i][3]++;
          next.set(key, i);
        }
      }
      x = end;
    }
    open = next;
  }
  return out;
}

/** A shadow on the wall down and to the right of everything drawn. */
function castShadow(c: Canvas) {
  for (let y = WINDOW_H - 1; y > 0; y--) {
    for (let x = WINDOW_W - 1; x > 0; x--) {
      if (!c.at(x, y) && c.at(x - 1, y - 1)) c.tint(x, y, "wall-shadow", true);
    }
  }
}

// ── The view out ─────────────────────────────────────────────────────────

/** The glass of a window: its bounds (inclusive), which dots in them are
 *  glass, the row where the paler sky overhead gives way to the deeper
 *  blue (best hidden under a glazing bar), a clear pane's top left for
 *  the sun or moon, and where the bough reaches in (its top right) if not
 *  at the glass's top right corner. */
interface Glass {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  has: (x: number, y: number) => boolean;
  split: number;
  sun: [number, number];
  bough?: [number, number];
}

const SKY = new Set<Paint>(["sky", "sky-hi"]);

/** A cloud, lit from the upper left and shaded underneath, and a wisp. */
const CLOUD = ["....%%%....", "..%%%%%%.%.", ".%%%%%%%%%%", "%%%%%%%%%%c", ".ccccccccc."];
const WISP = ["..%%%%..", "%%%%%%cc", ".cccc..."];

/** The bough's leaves in each season, lit, mid and shaded: blossom in
 *  spring, turned in autumn and in winter snow on its bare twig. */
const LEAVES: Record<Season, readonly [Paint, Paint, Paint]> = {
  spring: ["blossom-hi", "blossom", "blossom-lo"],
  summer: ["leaf-hi", "leaf", "leaf-lo"],
  autumn: ["autumn-gold", "autumn-hi", "autumn"],
  winter: ["snow-hi", "snow", "snow-lo"],
};

/** Leaves in a clump round (cx, cy), rx × ry, ragged at the edge and lit
 *  from the upper left, as the birches in the garden (room-shells.ts). */
function clump(
  put: (x: number, y: number, paint: Paint) => void,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  [hi, mid, lo]: readonly [Paint, Paint, Paint] = LEAVES.summer,
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const n = noise(x, y, seed);
      if (d > 1 - n * 0.35) continue;
      const rim = d > 0.45 && x - cx + (y - cy) > 0.5;
      put(x, y, x - cx + (y - cy) < -1.2 && n < 0.55 ? hi : n > 0.8 || (rim && n > 0.35) ? lo : mid);
    }
  }
}

/** The sky through the glass with view `view`: a cloud drifting by, a
 *  bough of the tree outside, or far hills under the sun (the moon at
 *  night), which only this view shows, so a row of windows doesn't have a
 *  moon apiece. In winter, snow falling past the cloud, on the bough and
 *  over the hills. */
function sky(c: Canvas, g: Glass, view: number, season: Season) {
  const { x0, y0, x1, y1 } = g;
  const gw = x1 - x0 + 1;
  const gh = y1 - y0 + 1;
  const glass = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && g.has(x, y);
  const put = (x: number, y: number, paint: Paint) => {
    if (glass(x, y)) c.dot(x, y, paint);
  };
  const sprite = (rows: readonly string[], ox: number, oy: number, key: Record<string, Paint>) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => key[ch] && put(ox + x, oy + y, key[ch])));
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, y < g.split ? "sky-hi" : "sky");

  if (view === 0) {
    sprite(CLOUD, x0 + Math.round(gw * 0.3), y0 + Math.round(gh * 0.12), { "%": "cloud", c: "cloud-lo" });
    sprite(WISP, x0 - 2, y0 + Math.round(gh * 0.6), { "%": "cloud", c: "cloud-lo" });
    if (season === "winter") {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) if (SKY.has(c.at(x, y) ?? "") && noise(x, y, 70) < 0.045) put(x, y, "snow-hi");
      }
    }
  } else if (view === 1) {
    // A bough reaching in from the top right: a twig, and clumps of
    // leaves along it.
    const [bx, by] = g.bough ?? [x1, y0];
    for (let i = 0; i <= 10; i++) put(bx + 1 - i, by + 3 - Math.round(i * 0.25), "bark-lo");
    for (let i = 0; i <= 3; i++) put(bx - 1, by + 4 + i, "bark-lo");
    if (season === "winter") {
      // Snow along the top of the bare twig.
      for (let i = 0; i <= 10; i++) put(bx + 1 - i, by + 2 - Math.round(i * 0.25), i % 4 === 3 ? "snow" : "snow-hi");
    } else {
      clump(put, bx - 6.5, by + 0.5, 2.6, 2.2, 61, LEAVES[season]);
      clump(put, bx - 0.5, by + 1, 4.2, 3, 62, LEAVES[season]);
      clump(put, bx - 0.5, by + 7, 2.6, 2.3, 63, LEAVES[season]);
    }
  } else {
    // Far hills, a nearer ridge with a tree or two, the sun high up.
    const far = (x: number) => y1 + 1 - Math.round(gh * 0.2 + 1.1 * Math.sin(x * 0.42 + 4));
    const near = (x: number) => y1 + 1 - Math.round(gh * 0.1 + 0.8 * Math.sin(x * 0.7 + 1) + 0.5 * Math.sin(x * 1.3));
    const [hill, hillFar] = season === "winter" ? ["snow-hi", "snow-lo"] : ["hill", "hill-far"];
    for (let x = x0; x <= x1; x++) {
      for (let y = far(x); y <= y1; y++) put(x, y, y >= near(x) ? hill : hillFar);
    }
    for (const t of [0.22, 0.7]) {
      const tx = x0 + Math.round(gw * t);
      const ty = near(tx);
      put(tx, ty - 1, "hill");
      put(tx + 1, ty - 1, "hill");
      put(tx, ty - 2, "hill");
    }
    const [sx, sy] = g.sun;
    sprite([".@@.", "@@@@", "@@@@", ".@@."], sx, sy, { "@": "sky-body" });
  }
}

/** Stars where the sky shows clear of everything else (they're only seen
 *  at night), and glints on the glass: short strokes up to the right. */
function finish(c: Canvas, g: Glass, view: number, glints: [number, number, number][]) {
  const clear = (x: number, y: number) => SKY.has(c.at(x, y) ?? "") && !c.tinted(x, y);
  for (let y = g.y0; y <= g.y1; y++) {
    for (let x = g.x0; x <= g.x1; x++) {
      if (noise(x, y, 40 + view) > 0.04) continue;
      let ok = true;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) ok &&= clear(x + i, y + j);
      if (ok) c.tint(x, y, "star");
    }
  }
  for (const [x, y, len] of glints) {
    for (let i = 0; i < len; i++) if (g.has(x + i, y - i)) c.tint(x + i, y - i, "glass-shine");
  }
}

// ── The kinds ────────────────────────────────────────────────────────────

/** A white-painted sash window, two panes over two, on a deep sill,
 *  between curtains hung from a brass rod and caught back with tasselled
 *  cords. */
function sashWindow(c: Canvas, view: number, season: Season) {
  const g: Glass = { x0: 4, y0: 6, x1: 16, y1: 26, has: () => true, split: 17, sun: [12, 8], bough: [15, 6] };
  // The box, lit on its top and left, outlined.
  c.fill(2, 4, 17, 26, "sash-deep");
  c.fill(3, 5, 15, 24, "sash");
  c.fill(3, 5, 15, 1, "sash-hi");
  c.fill(3, 5, 1, 24, "sash-hi");
  c.fill(17, 6, 1, 23, "sash-lo");
  sky(c, g, view, season);
  // The meeting rail with its catch, the glazing bars, the lower sash's
  // deeper bottom rail.
  c.fill(4, 16, 13, 1, "sash-hi");
  c.fill(4, 17, 13, 1, "sash-lo");
  c.fill(MID - 1, 16, 3, 1, "brass");
  c.dot(MID - 1, 16, "brass-hi");
  c.fill(MID, 6, 1, 10, "sash");
  c.fill(MID, 18, 1, 9, "sash");
  c.fill(4, 27, 13, 1, "sash");
  c.fill(4, 28, 13, 1, "sash-lo");
  // Shadows the frame casts on the glass.
  for (let x = 4; x <= 16; x++) [6, 18].forEach((y) => c.tint(x, y, "wall-shadow"));
  for (let y = 7; y <= 26; y++) if (y !== 16 && y !== 17) [4, MID + 1].forEach((x) => c.tint(x, y, "wall-shadow"));
  // The sill, deeper than the frame and outlined.
  c.fill(0, 29, 21, 5, "sash-deep");
  c.fill(1, 30, 19, 1, "sash-hi");
  c.fill(1, 31, 19, 1, "sash");
  c.fill(1, 32, 19, 1, "sash-lo");
  finish(c, g, view, [
    [5, 12, 3],
    [7, 13, 2],
    [13, 25, 2],
  ]);
  curtains(c, 3, 20, 34);
  castShadow(c);
}

/** Curtains either side, from a rod across the top: swept back to tasselled
 *  cords at `tie` and falling loose to `bottom`, their folds gathering
 *  in to the cord and fanning out below it. */
function curtains(c: Canvas, top: number, tie: number, bottom: number) {
  for (const left of [true, false]) {
    const at = (i: number) => (left ? i : 2 * MID - i);
    for (let y = top; y <= bottom; y++) {
      const above = y <= tie;
      const t = above ? (y - top) / (tie - top) : (y - tie) / (bottom - tie);
      const inner = above ? 1 + Math.round(4.4 * (1 - t) ** 1.5) : 1 + Math.round(3.4 * Math.sqrt(t));
      // A fold down the middle, its lit ridge and the shadow beside it,
      // spaced across the curtain's width so it meets the cord; the
      // leading edge outlined, with the light catching it.
      const fold = Math.round(0.45 * inner);
      for (let i = 0; i <= inner; i++) {
        let paint: Paint = "curtain";
        if (i === inner || y === bottom) paint = "curtain-lo";
        else if (i === inner - 1) paint = "curtain-hi";
        else if (i === 0) paint = left ? "curtain-hi" : "curtain-lo";
        else if (inner >= 4 && i === fold) paint = left ? "curtain-lo" : "curtain-hi";
        else if (inner >= 4 && i === fold - 1) paint = left ? "curtain-hi" : "curtain-lo";
        c.dot(at(i), y, paint);
      }
    }
    // The cord, and its tassel.
    c.dot(at(0), tie, "brass-hi");
    c.dot(at(1), tie, "brass");
    c.dot(at(2), tie, "brass");
    c.dot(at(2), tie + 1, "brass");
    c.dot(at(2), tie + 2, "brass-lo");
  }
  // The rod and its finials, and the rings the curtains hang from.
  c.fill(1, top - 2, 2 * MID - 1, 1, "brass");
  c.fill(1, top - 1, 2 * MID - 1, 1, "brass-lo");
  for (const x of [0, 2 * MID]) {
    c.dot(x, top - 3, "brass-hi");
    c.dot(x, top - 2, "brass");
    c.dot(x, top - 1, "brass-lo");
  }
  for (const x of [2, 4, 16, 18]) c.dot(x, top - 1, "brass");
}

/** A tall round-headed window in a moulded stone surround with a
 *  keystone: a fanlight of radiating bars in the arch over six panes. */
function archedWindow(c: Canvas, view: number, season: Season) {
  const spring = 11;
  const r = 6.5;
  const dist = (x: number, y: number) => (y >= spring ? Math.abs(x - MID) : Math.hypot(x - MID, y - spring));
  const g: Glass = { x0: 4, y0: 4, x1: 16, y1: 30, has: (x, y) => dist(x, y) <= r, split: 18, sun: [12, 13] };
  // Surround and frame, from the outside in: an outline, two steps of
  // moulding, each lit where it faces up and to the left, and a wooden
  // frame round the glass. Each ring is one dot thick, stepping cleanly.
  const shape = (x: number, y: number) => y >= 0 && y <= 31 && dist(x, y) <= 10.5;
  const glassAt = (x: number, y: number) => y <= 30 && dist(x, y) <= r;
  const next = (x: number, y: number, f: (x: number, y: number) => boolean) => f(x - 1, y) || f(x + 1, y) || f(x, y - 1) || f(x, y + 1);
  const rim = (x: number, y: number) => shape(x, y) && next(x, y, (i, j) => !shape(i, j));
  for (let y = 0; y <= 31; y++) {
    for (let x = 0; x <= 2 * MID; x++) {
      if (!shape(x, y) || glassAt(x, y)) continue;
      const d = Math.max(dist(x, y), 1);
      const face = -((x - MID) / d + (y >= spring ? 0 : (y - spring) / d)) / Math.SQRT2;
      if (rim(x, y)) c.dot(x, y, "stone-deep");
      else if (next(x, y, glassAt)) c.dot(x, y, "wood-deep");
      else if (next(x, y, rim)) c.dot(x, y, face > 0.25 ? "stone-hi" : face < -0.25 ? "stone-lo" : "stone");
      else c.dot(x, y, face > 0.25 ? "stone" : "stone-lo");
    }
  }
  sky(c, g, view, season);
  // Fanlight: a transom along the springing, and three bars fanning out
  // from a little half-round hub.
  c.fill(4, spring, 13, 1, "wood");
  for (let i = 1; i <= 6; i++) c.dot(MID, spring - i, "wood");
  for (let i = 1; i <= 4; i++) [MID - i, MID + i].forEach((x) => c.dot(x, spring - i, "wood"));
  c.sprite([".h.", "hWw"], MID - 1, spring - 2, { h: "wood-hi", W: "wood", w: "wood-lo" });
  // Six panes under it.
  c.fill(MID, spring + 1, 1, 19, "wood");
  c.fill(4, 18, 13, 1, "wood");
  c.fill(4, 25, 13, 1, "wood");
  for (let x = 4; x <= 16; x++) [spring + 1, 19, 26].forEach((y) => c.tint(x, y, "wall-shadow"));
  for (let y = spring + 2; y <= 30; y++) if (y !== 18 && y !== 25) [4, MID + 1].forEach((x) => c.tint(x, y, "wall-shadow"));
  // Keystone, standing proud of the arch.
  c.sprite(["TTTTT", "TssST", "TsStT", ".TtT."], MID - 2, 1, { s: "stone-hi", S: "stone", t: "stone-lo", T: "stone-deep" });
  // Sill.
  c.fill(0, 32, 21, 1, "stone-hi");
  c.fill(0, 33, 21, 1, "stone");
  c.fill(0, 34, 21, 1, "stone-deep");
  finish(c, g, view, [
    [5, 16, 3],
    [7, 17, 2],
    [13, 30, 2],
  ]);
  castShadow(c);
}

/** A round window, smaller than the rest, in a moulded ring, with a cross
 *  of glazing bars. */
function roundWindow(c: Canvas, view: number, season: Season) {
  const cy = 17;
  const r = 5.6;
  const d = (x: number, y: number) => Math.hypot(x - MID, y - cy);
  const g: Glass = { x0: 4, y0: cy - 6, x1: 16, y1: cy + 6, has: (x, y) => d(x, y) <= r, split: cy, sun: [5, cy - 5], bough: [15, cy - 5] };
  for (let y = cy - 10; y <= cy + 10; y++) {
    for (let x = 0; x <= 2 * MID; x++) {
      const dd = d(x, y);
      if (dd > 9.5 || dd <= r) continue;
      const lit = (x - MID + (y - cy)) / Math.max(dd, 1);
      if (dd > 8.5) c.dot(x, y, "wood-deep");
      else if (dd > 7.5) c.dot(x, y, lit < -0.3 ? "wood-hi" : lit > 0.5 ? "wood-lo" : "wood");
      else if (dd > 6.6) c.dot(x, y, lit < -0.3 ? "wood" : "wood-lo");
      else c.dot(x, y, lit < -0.3 ? "wood-lo" : lit > 0.5 ? "wood-hi" : "wood-deep");
    }
  }
  sky(c, g, view, season);
  c.fill(MID, cy - 5, 1, 11, "wood");
  c.fill(MID - 5, cy, 11, 1, "wood");
  c.dot(MID, cy, "wood-hi");
  for (let y = cy - 5; y <= cy + 5; y++) if (y !== cy) c.tint(MID + 1, y, "wall-shadow");
  for (let x = MID - 5; x <= MID + 5; x++) if (x !== MID) c.tint(x, cy + 1, "wall-shadow");
  finish(c, g, view, [
    [6, cy - 2, 3],
    [7, cy - 1, 2],
  ]);
  castShadow(c);
}

/** A casement window between open louvred shutters, painted in the
 *  fabric colour, with a box of flowers on the sill. */
function shuttersWindow(c: Canvas, view: number, season: Season) {
  const g: Glass = { x0: 6, y0: 5, x1: 14, y1: 28, has: () => true, split: 11, sun: [11, 6] };
  c.fill(4, 3, 13, 28, "sash-deep");
  c.fill(5, 4, 11, 26, "sash");
  c.fill(5, 4, 11, 1, "sash-hi");
  c.fill(5, 4, 1, 26, "sash-hi");
  c.fill(15, 5, 1, 25, "sash-lo");
  sky(c, g, view, season);
  c.fill(6, 11, 9, 1, "sash");
  c.fill(MID, 12, 1, 17, "sash");
  for (let y = 5; y <= 28; y++) if (y !== 11) c.tint(6, y, "wall-shadow");
  for (let y = 13; y <= 28; y++) c.tint(MID + 1, y, "wall-shadow");
  for (let x = 6; x <= 14; x++) [5, 12].forEach((y) => c.tint(x, y, "wall-shadow"));
  // The shutters: louvres in a frame, a rail across the middle, hinges.
  for (const x0 of [0, 17]) {
    c.fill(x0, 3, 4, 28, "curtain-lo");
    c.fill(x0 + 1, 4, 2, 26, "curtain");
    for (let y = 5; y < 29; y += 2) c.fill(x0 + 1, y, 2, 1, "curtain-hi");
    c.fill(x0 + 1, 16, 2, 1, "curtain-lo");
  }
  for (const y of [6, 27]) c.pair(3, y, 1, 1, "brass-lo");
  // Sill, and the window box on it: a terracotta trough, leaves heaped
  // over its rim, geraniums and daisies, a trail or two over the front.
  c.fill(2, 33, 17, 1, "sash-hi");
  c.fill(2, 34, 17, 1, "sash-lo");
  c.fill(4, 29, 13, 1, "pot-hi");
  c.fill(5, 30, 11, 3, "pot");
  c.fill(15, 30, 1, 3, "pot-lo");
  c.fill(5, 32, 11, 1, "pot-lo");
  const put = (x: number, y: number, paint: Paint) => c.dot(x, y, paint);
  clump(put, 6.6, 27.5, 2.4, 1.8, 71);
  clump(put, 13.6, 27.5, 2.4, 1.8, 72);
  clump(put, 10.2, 27, 2.8, 2.2, 73);
  for (const [x, y, p] of [
    [6, 25, "flower"],
    [10, 24, "flower"],
    [14, 26, "flower"],
    [8, 26, "daisy"],
    [13, 25, "daisy"],
  ] as const) {
    if (p === "flower") {
      c.fill(x, y, 2, 2, "flower");
      c.dot(x, y, "daisy");
    } else {
      c.fill(x, y, 2, 1, "daisy");
      c.dot(x, y + 1, "brass");
    }
  }
  for (const [x, len] of [
    [6, 3],
    [12, 2],
  ]) {
    for (let i = 0; i < len; i++) c.dot(x + (i % 2), 30 + i, i === len - 1 ? "leaf-lo" : "leaf");
  }
  finish(c, g, view, [
    [7, 18, 3],
    [8, 19, 2],
  ]);
  castShadow(c);
}

/** A cottage casement of diamond leaded panes, the top diamond in each
 *  light stained amber with a ruby heart, in a stone surround under a
 *  hood mould, on a stone sill. */
function leadedWindow(c: Canvas, view: number, season: Season) {
  const light = (x: number) => (x >= 3 && x <= 8) || (x >= 12 && x <= 17);
  const g: Glass = { x0: 3, y0: 7, x1: 17, y1: 29, has: light, split: 18, sun: [4, 13] };
  // Hood mould, with its label stops.
  c.fill(0, 1, 21, 1, "stone-hi");
  c.fill(0, 2, 21, 1, "stone");
  c.fill(0, 3, 21, 1, "stone-lo");
  c.pair(0, 4, 2, 3, "stone", "stone-lo");
  c.pair(0, 7, 2, 1, "stone-lo", "stone-deep");
  c.dot(0, 4, "stone-hi");
  // Surround and mullion.
  c.fill(1, 4, 19, 27, "stone-deep");
  c.fill(2, 5, 17, 26, "stone");
  c.fill(2, 5, 1, 26, "stone-hi");
  c.fill(18, 5, 1, 26, "stone-lo");
  c.fill(2, 6, 17, 1, "stone-lo");
  c.fill(MID - 1, 7, 1, 23, "stone-hi");
  c.fill(MID + 1, 7, 1, 23, "stone-lo");
  sky(c, g, view, season);
  // Lead lattice.
  for (let y = 7; y <= 29; y++) {
    for (let x = 3; x <= 17; x++) {
      if (!light(x)) continue;
      const u = x < MID ? x - 3 : x - 12;
      const v = y - 7;
      if ((u + v) % 6 === 3 || (u - v + 600) % 6 === 3) c.dot(x, y, "lead");
      for (const ux of [6, 15]) {
        const dd = Math.abs(x - ux) + Math.abs(y - 10);
        if (dd <= 2) c.dot(x, y, dd === 0 ? "pane-ruby" : "pane-amber");
      }
    }
  }
  for (let x = 3; x <= 17; x++) c.tint(x, 7, "wall-shadow");
  for (let y = 8; y <= 29; y++) [3, 12].forEach((x) => c.tint(x, y, "wall-shadow"));
  // Sill.
  c.fill(0, 31, 21, 1, "stone-hi");
  c.fill(0, 32, 21, 1, "stone");
  c.fill(0, 33, 21, 1, "stone-deep");
  finish(c, g, view, [
    [4, 16, 3],
    [13, 16, 3],
  ]);
  castShadow(c);
}

const DRAW: Record<Kind, (c: Canvas, view: number, season: Season) => void> = {
  sash: sashWindow,
  arched: archedWindow,
  round: roundWindow,
  shutters: shuttersWindow,
  leaded: leadedWindow,
};

/** A window, WINDOW_W × WINDOW_H, with view `view` (0 to WINDOW_VIEWS - 1)
 *  through it, in the season outside. */
export function windowArt(kind: Kind, view: number, season: Season = "summer"): Art {
  const c = new Canvas();
  DRAW[kind](c, ((view % WINDOW_VIEWS) + WINDOW_VIEWS) % WINDOW_VIEWS, season);
  return { w: WINDOW_W, h: WINDOW_H, rects: c.rects() };
}

const WINDOWS = new Map<string, Art>();
/** The window drawn once per kind, view and season. */
export function windowFor(kind: Kind, view = 0, season: Season = "summer"): Art {
  const key = `${kind}-${view % WINDOW_VIEWS}-${season}`;
  if (!WINDOWS.has(key)) WINDOWS.set(key, windowArt(kind, view % WINDOW_VIEWS, season));
  return WINDOWS.get(key)!;
}

/** A tile's picture for Decorate: the window on a piece of wall, `w` × `h`
 *  (at least WINDOW_W + 4 × WINDOW_H + 4), the season outside. "none" is
 *  the bare wall. */
export function windowSample(kind: RoomWindow, w: number, h: number, season: Season = "summer"): Art {
  const R: Rect[] = [[0, 0, w, h, "wall"]];
  if (kind !== "none") {
    const ox = Math.floor((w - WINDOW_W) / 2);
    const oy = Math.floor((h - WINDOW_H) / 2);
    R.push(...windowFor(kind, 0, season).rects.map(([x, y, rw, rh, p]): Rect => [x + ox, y + oy, rw, rh, p]));
  }
  return { w, h, rects: R };
}
