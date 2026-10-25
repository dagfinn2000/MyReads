/**
 * The door in the wall between two rooms side by side (lib/room.ts:
 * PARTITION wide; room-shells.ts builds the wall above it like the house's
 * outside walls). Each house style has its own, drawn face-on in the wall
 * the way side-on games draw doors, so it reads as a door at a glance: a
 * panelled cottage door under a moulded head, a studded oak one in a stone
 * arch, an elven door under a pointed arch, a sliding paper screen.
 *
 * A door is shut until the avatar (or its pet) walks through it, when it
 * opens onto the back wall beyond, which room-shells.ts draws in the
 * doorway (room-avatar.tsx: Walker).
 *
 * Each is drawn dot by dot on a little canvas and then gathered into
 * rectangles. Light comes from the upper left, as everywhere in the house.
 */
import type { Paint, Rect } from "@/components/room-art";
import { PARTITION } from "@/lib/room";
import type { RoomStyle } from "@/lib/room-styles";

/** Floor to the top of the door's frame, head or arch. */
export const DOOR_H = 56;
/** How far a door's frame may reach past the wall either side, over the
 *  rooms' walls. */
export const DOOR_REACH = 2;

export interface Door {
  /** The doorway's shape, where the back wall beyond shows while the door
   *  is open (room-shells.ts draws it there, under `open`). */
  hole: Rect[];
  /** The door, shut. */
  shut: Rect[];
  /** What else shows while it's open: the door swung back against its
   *  jamb, a curtain in the doorway. */
  open: Rect[];
  /** Drawn over either: the frame, head or arch round the doorway. */
  frame: Rect[];
}

/** A steady pseudo-random number in [0, 1) for a place (as room-shells.ts). */
function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ── The canvas ───────────────────────────────────────────────────────────

const LEFT = -DOOR_REACH;
const WIDE = PARTITION + 2 * DOOR_REACH;
const P = PARTITION;

/** One layer of a door while it's drawn: a paint (or nothing) per dot,
 *  in the door's own coordinates (x from -DOOR_REACH). */
class Canvas {
  private dots: (Paint | null)[][] = Array.from({ length: DOOR_H }, () => Array<Paint | null>(WIDE).fill(null));
  dot(x: number, y: number, paint: Paint) {
    if (y >= 0 && y < DOOR_H && x >= LEFT && x < LEFT + WIDE) this.dots[y][x - LEFT] = paint;
  }
  fill(x: number, y: number, w: number, h: number, paint: Paint) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.dot(x + dx, y + dy, paint);
  }
  get(x: number, y: number): Paint | null {
    return this.dots[y]?.[x - LEFT] ?? null;
  }
  /** Each run of one paint along a row, as a rectangle. */
  rects(): Rect[] {
    const out: Rect[] = [];
    this.dots.forEach((row, y) => {
      for (let i = 0; i < row.length; ) {
        let j = i + 1;
        while (j < row.length && row[j] === row[i]) j++;
        if (row[i]) out.push([i + LEFT, y, j - i, 1, row[i]!]);
        i = j;
      }
    });
    return out;
  }
}

/** Whether a dot is inside a doorway from `x0` to `x1` whose arch starts
 *  (springs) at `spring`: "flat" has none, "round" a half circle over it,
 *  "pointed" two arcs meeting in a point. */
function inside(shape: Shape, x0: number, x1: number, spring: number, x: number, y: number) {
  if (x < x0 || x >= x1) return false;
  if (y >= spring) return true;
  if (shape === "flat") return false;
  const w = x1 - x0;
  const cx = x + 0.5;
  const up = spring - (y + 0.5);
  if (shape === "round") {
    const r = w / 2;
    return (cx - (x0 + r)) ** 2 + up * up <= r * r;
  }
  // Each side is an arc as wide as the doorway, centred on the far jamb.
  return (cx - x1) ** 2 + up * up <= w * w && (cx - x0) ** 2 + up * up <= w * w;
}

/** The top of a doorway's arch: where `inside` first holds over the middle. */
function crown(shape: Shape, x0: number, x1: number, spring: number) {
  let y = spring;
  while (y > 0 && inside(shape, x0, x1, spring, Math.floor((x0 + x1 - 1) / 2), y - 1)) y--;
  return y;
}

/** A leaf of vertical boards from `x0` to `x1`, cut to the doorway's
 *  shape, with a seam every `board` dots and a lit left edge on each. */
function boards(c: Canvas, shape: Shape, x0: number, x1: number, spring: number, board: number, paint: [Paint, Paint, Paint]) {
  const [hi, mid, lo] = paint;
  for (let y = 0; y < DOOR_H; y++) {
    for (let x = x0; x < x1; x++) {
      if (!inside(shape, x0, x1, spring, x, y)) continue;
      const k = (x - x0) % board;
      // Knots and grain, here and there.
      const grain = noise(x, y >> 2, 5) < 0.12;
      c.dot(x, y, k === board - 1 ? lo : k === 0 ? hi : grain ? lo : mid);
    }
  }
}

/** A door's top edge in shadow under its head or arch. */
function shade(c: Canvas, shape: Shape, x0: number, x1: number, spring: number, paint: Paint) {
  for (let x = x0; x < x1; x++) {
    for (let y = 0; y < DOOR_H; y++) {
      if (inside(shape, x0, x1, spring, x, y)) {
        c.dot(x, y, paint);
        break;
      }
    }
  }
}

/** A round knob or ring at (x, y), lit on its upper left. */
function knob(c: Canvas, x: number, y: number, [hi, mid, lo]: [Paint, Paint, Paint]) {
  c.fill(x, y, 2, 2, mid);
  c.dot(x, y, hi);
  c.dot(x + 1, y + 1, lo);
}

/** A door swung open towards the room on its left, hinged on that jamb:
 *  seen nearly edge-on, a narrow strip of its face from `x`. */
function swung(c: Canvas, x: number, top: number, w: number, [hi, mid, lo]: [Paint, Paint, Paint], handle?: Paint) {
  c.fill(x, top, w, DOOR_H - top, mid);
  c.fill(x, top, 1, DOOR_H - top, lo);
  c.fill(x + w - 1, top, 1, DOOR_H - top, hi);
  if (handle) c.fill(x + w - 1, 30, 1, 2, handle);
}

/** Stones round an arched or square doorway: blocks up each side,
 *  alternately long and short, and wedge-shaped ones round the arch. */
function stoneSurround(
  c: Canvas,
  shape: "round" | "pointed",
  x0: number,
  x1: number,
  spring: number,
  ring: number,
  [hi, mid, lo, deep]: [Paint, Paint, Paint, Paint],
) {
  const cx = (x0 + x1) / 2;
  for (let y = 0; y < DOOR_H; y++) {
    for (let x = LEFT + 1; x < LEFT + WIDE - 1; x++) {
      if (inside(shape, x0, x1, spring, x, y)) continue;
      const nearSide = y >= spring && (x >= x0 - ring - (Math.floor(y / 6) % 2)) && x < x1 + ring + (Math.floor(y / 6) % 2);
      const nearArch = y < spring && inside(shape, x0 - ring, x1 + ring, spring, x, y);
      if (!nearSide && !nearArch) continue;
      let paint: Paint = mid;
      if (y >= spring) {
        // Up the sides: courses six dots tall.
        const row = y % 6;
        if (row === 5) paint = deep;
        else if (row === 0) paint = hi;
      } else {
        // Round the arch: joints radiating from the springing line.
        const a = Math.atan2(spring - y, x + 0.5 - cx);
        const step = Math.PI / 7;
        if (Math.abs(((a + step / 2) % step) - step / 2) < 0.09) paint = deep;
      }
      // The keystone, lighter.
      if (y < spring && Math.abs(x + 0.5 - cx) < 1.5 && !inside(shape, x0, x1, spring, x, y + 2)) paint = hi;
      c.dot(x, y, paint);
    }
  }
  // Lit edge on the left of the doorway, shadow on the right.
  for (let y = 0; y < DOOR_H; y++) {
    for (let x = LEFT; x < LEFT + WIDE; x++) {
      if (!c.get(x, y)) continue;
      if (inside(shape, x0, x1, spring, x + 1, y) && x < cx) c.dot(x, y, lo);
      if (inside(shape, x0, x1, spring, x - 1, y) && x > cx) c.dot(x, y, deep);
    }
  }
}

// ── The doors ────────────────────────────────────────────────────────────

type Shape = "flat" | "round" | "pointed";
type Parts = { frame: Canvas; shut: Canvas; open: Canvas; hole: Canvas; opening: [number, number] };

/** Blank canvases for a door through a doorway from `x0` to `x1`, its arch
 *  (if it has one) springing at `spring`, or its top there if it's flat. */
function canvases(shape: Shape, x0: number, x1: number, spring: number): Parts {
  const hole = new Canvas();
  for (let y = 0; y < DOOR_H; y++) for (let x = x0; x < x1; x++) if (inside(shape, x0, x1, spring, x, y)) hole.dot(x, y, "wall");
  return { frame: new Canvas(), shut: new Canvas(), open: new Canvas(), hole, opening: [x0, x1] };
}

/** A painted door of four sunk panels under a moulded head, with a brass
 *  knob: the cottage's. */
function panelled(): Parts {
  const d = canvases("flat", 1, P - 1, 4);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  // The architrave, lapping onto each wall, and its head.
  frame.fill(-1, 3, 2, DOOR_H - 3, "wood");
  frame.fill(-1, 3, 1, DOOR_H - 3, "wood-hi");
  frame.fill(P - 1, 3, 2, DOOR_H - 3, "wood");
  frame.fill(P, 3, 1, DOOR_H - 3, "wood-lo");
  frame.fill(-2, 0, P + 4, 1, "wood-hi");
  frame.fill(-2, 1, P + 4, 1, "wood");
  frame.fill(-1, 2, P + 2, 1, "wood-lo");
  frame.fill(-1, 3, P + 2, 1, "wood-hi");
  frame.fill(-1, DOOR_H - 4, 2, 4, "wood-lo");
  frame.fill(P - 1, DOOR_H - 4, 2, 4, "wood-lo");

  // The leaf: stiles and rails round four panels, sunk, so lit on their
  // lower right edges and shadowed on their upper left.
  const top = 4;
  shut.fill(x0, top, x1 - x0, DOOR_H - top, "wood");
  shut.fill(x0, top, x1 - x0, 1, "wood-lo");
  const panels: [number, number, number, number][] = [
    [x0 + 2, top + 3, 3, 17],
    [x0 + 7, top + 3, 3, 17],
    [x0 + 2, top + 24, 3, 21],
    [x0 + 7, top + 24, 3, 21],
  ];
  for (const [px, py, pw, ph] of panels) {
    shut.fill(px, py, pw, ph, "wood");
    shut.fill(px, py, pw, 1, "wood-lo");
    shut.fill(px, py, 1, ph, "wood-lo");
    shut.fill(px, py + ph - 1, pw, 1, "wood-hi");
    shut.fill(px + pw - 1, py + 1, 1, ph - 1, "wood-hi");
  }
  knob(shut, x1 - 3, 30, ["brass-hi", "brass", "brass-lo"]);
  shut.dot(x1 - 2, 33, "wood-deep");

  swung(open, x0, top, 3, ["wood-hi", "wood", "wood-lo"], "brass");
  return d;
}

/** Planks under a stone arch, with iron strap hinges and a ring: the
 *  castle's, and (rounder, with a round window and a knob in the middle)
 *  the wizard's. */
function arched(style: "medieval" | "fantasy"): Parts {
  const spring = style === "medieval" ? 12 : 13;
  const d = canvases("round", 2, P - 2, spring);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  const castle = style === "medieval";
  stoneSurround(frame, "round", x0, x1, spring, 2, ["stone-hi", "stone", "stone-lo", "stone-deep"]);

  const leaf: [Paint, Paint, Paint] = castle ? ["wood-hi", "wood", "wood-lo"] : ["chair-hi", "chair", "chair-lo"];
  boards(shut, "round", x0, x1, spring, castle ? 2 : 3, leaf);
  shade(shut, "round", x0, x1, spring, castle ? "wood-deep" : "chair-deep");
  if (castle) {
    // Straps of iron across it, ending in a curl, with a nail head or two.
    for (const y of [18, 44]) {
      shut.fill(x0, y, x1 - x0 - 1, 2, "metal-lo");
      shut.fill(x0, y, x1 - x0 - 2, 1, "metal");
      shut.dot(x1 - 2, y - 1, "metal-lo");
      shut.dot(x1 - 2, y + 2, "metal-lo");
      for (let x = x0 + 1; x < x1 - 2; x += 3) shut.dot(x, y, "metal-hi");
    }
    // An iron ring to pull it by.
    for (const [x, y] of [[x1 - 3, 29], [x1 - 4, 30], [x1 - 2, 30], [x1 - 4, 31], [x1 - 2, 31], [x1 - 3, 32]]) shut.dot(x, y, "metal-lo");
    shut.dot(x1 - 4, 30, "metal-hi");
  } else {
    // A round window, with a star in it at night, and a brass knob right
    // in the middle, as such doors have.
    const [wx, wy] = [(x0 + x1) / 2 - 2, 15];
    for (const [x, y, p] of [
      [1, 0, "brass"], [2, 0, "brass"], [0, 1, "brass"], [3, 1, "brass-lo"], [0, 2, "brass"], [3, 2, "brass-lo"], [1, 3, "brass-lo"], [2, 3, "brass-lo"],
      [1, 1, "glass-hi"], [2, 1, "glass"], [1, 2, "glass"], [2, 2, "glass-lo"],
    ] as const) shut.dot(wx + x, wy + y, p);
    shut.dot(wx + 2, wy + 1, "star");
    knob(shut, (x0 + x1) / 2 - 1, 32, ["brass-hi", "brass", "brass-lo"]);
  }

  swung(open, x0, spring - 3, 3, leaf, castle ? "metal-lo" : "brass");
  return d;
}

/** A tall door of pale wood under a pointed arch of birch, with a vine
 *  carved up it: the elven hall's. */
function elven(): Parts {
  const spring = 16;
  const d = canvases("pointed", 2, P - 2, spring);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  // The surround: birch, white with dark marks, round the pointed arch.
  for (let y = 0; y < DOOR_H; y++) {
    for (let x = x0 - 2; x < x1 + 2; x++) {
      if (inside("pointed", x0, x1, spring, x, y)) continue;
      if (!inside("pointed", x0 - 2, x1 + 2, spring, x, y)) continue;
      const mark = noise(x, y >> 1, 41) < 0.16;
      frame.dot(x, y, mark ? "bark-lo" : "bark");
    }
  }
  for (let y = 0; y < DOOR_H; y++) {
    for (let x = x0 - 2; x < x1 + 2; x++) {
      if (!frame.get(x, y)) continue;
      if (!inside("pointed", x0 - 2, x1 + 2, spring, x - 1, y) || !inside("pointed", x0 - 2, x1 + 2, spring, x + 1, y)) frame.dot(x, y, "trim");
    }
  }
  // Leaves sprouting at the point of the arch and at the springing.
  const top = crown("pointed", x0 - 2, x1 + 2, spring);
  const cx = (x0 + x1) / 2;
  for (const [x, y, p] of [
    [-2, 1, "leaf"], [-3, 2, "leaf-lo"], [-1, 0, "leaf-hi"], [1, 1, "leaf"], [2, 2, "leaf-lo"], [0, 0, "leaf-hi"],
  ] as const) frame.dot(cx + x, top + y, p);
  for (const [x, y, p] of [[x0 - 3, spring, "leaf"], [x0 - 3, spring + 1, "leaf-lo"], [x1 + 2, spring - 1, "leaf"], [x1 + 2, spring, "leaf-lo"]] as const) frame.dot(x, y, p);

  boards(shut, "pointed", x0, x1, spring, 5, ["wood-hi", "wood", "wood-lo"]);
  shade(shut, "pointed", x0, x1, spring, "wood-lo");
  // The vine, winding up the middle, with a leaf at each turn.
  for (let y = spring - 6; y < DOOR_H - 4; y++) {
    const x = Math.round(cx - 0.5 + Math.sin(y / 3.2) * 2);
    shut.dot(x, y, "wood-lo");
    if (y % 6 === 0) shut.dot(x + (Math.sin(y / 3.2) > 0 ? -1 : 1), y - 1, "leaf");
  }
  shut.fill(x1 - 2, 31, 1, 3, "brass");
  shut.dot(x1 - 2, 31, "brass-hi");

  swung(open, x0, spring - 2, 3, ["wood-hi", "wood", "wood-lo"], "brass");
  return d;
}

/** Rough boards in a rocky doorway, held by two battens, with a rope to
 *  pull: the cave's. */
function rough(): Parts {
  const top = 6;
  const d = canvases("flat", 2, P - 2, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  // The rock round it: ragged, a dot or two thick, darker into the doorway.
  for (let y = 0; y < DOOR_H; y++) {
    const l = x0 - 1 - Math.floor(noise(1, y >> 1, 61) * 3);
    const r = x1 + Math.floor(noise(2, y >> 1, 62) * 3);
    if (y < top) {
      const ragged = top - 1 - Math.floor(noise(3, y, 63) * 2);
      if (y < ragged - 2) continue;
      for (let x = l; x <= r; x++) frame.dot(x, y, noise(x, y, 64) < 0.3 ? "outer-hi" : "outer");
      continue;
    }
    for (let x = l; x < x0; x++) frame.dot(x, y, x === x0 - 1 ? "outer-lo" : noise(x, y, 65) < 0.25 ? "outer-hi" : "outer");
    for (let x = x1; x <= r; x++) frame.dot(x, y, x === x1 ? "outer-lo" : noise(x, y, 66) < 0.25 ? "outer-hi" : "outer");
  }
  frame.fill(x0, top - 1, x1 - x0, 1, "outer-lo");

  // Boards of uneven length, gaps dark between them and over the short ones.
  for (let x = x0; x < x1; x++) {
    const plank = Math.floor((x - x0) / 3);
    const lift = Math.floor(noise(plank, 0, 67) * 2);
    if (lift) shut.dot(x, top, "wall-shadow");
    for (let y = top + lift; y < DOOR_H; y++) {
      const k = (x - x0) % 3;
      shut.dot(x, y, k === 2 ? "wood-deep" : k === 0 ? "wood" : noise(x, y >> 2, 68) < 0.15 ? "wood-lo" : "wood");
    }
  }
  for (const y of [14, 44]) {
    shut.fill(x0, y, x1 - x0, 3, "wood-lo");
    shut.fill(x0, y, x1 - x0, 1, "wood");
    shut.dot(x0 + 1, y + 1, "metal-lo");
    shut.dot(x1 - 2, y + 1, "metal-lo");
  }
  // A loop of rope for a handle.
  for (const [x, y] of [[x1 - 3, 28], [x1 - 4, 29], [x1 - 4, 30], [x1 - 3, 31], [x1 - 2, 30]]) shut.dot(x, y, "rug-fringe");

  swung(open, x0, top, 3, ["wood", "wood", "wood-lo"]);
  return d;
}

/** A metal door in two halves that slide apart into the frame, with a lit
 *  strip over it: the space station's. */
function sliding(): Parts {
  const top = 5;
  const d = canvases("flat", 2, P - 2, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  // The frame: a thick metal surround, lit along its head.
  frame.fill(-1, 0, P + 2, top, "metal");
  frame.fill(-1, 0, P + 2, 1, "metal-hi");
  frame.fill(x0, top - 2, x1 - x0, 1, "light");
  frame.fill(-1, top - 1, P + 2, 1, "metal-lo");
  for (const x of [-1, x1]) {
    frame.fill(x, top, x0 + 1, DOOR_H - top, "metal");
    frame.fill(x, top, 1, DOOR_H - top, "metal-hi");
  }
  frame.fill(x0 - 1, top, 1, DOOR_H - top, "metal-lo");
  frame.fill(P, top, 1, DOOR_H - top, "metal-lo");
  // A little panel by the door, its light lit.
  frame.fill(x1, 26, 2, 4, "metal-lo");
  frame.dot(x1, 27, "light");

  const half = (x1 - x0) / 2;
  for (const [hx, edge] of [[x0, x0 + half - 1], [x0 + half, x0 + half]] as const) {
    shut.fill(hx, top, half, DOOR_H - top, "metal");
    shut.fill(hx, top, half, 1, "metal-hi");
    shut.fill(edge, top, 1, DOOR_H - top, "metal-lo");
    for (let y = top + 8; y < DOOR_H - 4; y += 12) shut.fill(hx + 1, y, half - 2, 1, "metal-lo");
  }
  shut.fill(x0 + half - 1, 28, 2, 3, "light");

  // Open: just the edges of the halves show, slid into the frame.
  open.fill(x0, top, 1, DOOR_H - top, "metal");
  open.fill(x1 - 1, top, 1, DOOR_H - top, "metal");
  return d;
}

/** A plain flush door in light wood with a slim steel handle, in a crisp
 *  white frame: the modern house's. */
function flush(): Parts {
  const top = 3;
  const d = canvases("flat", 1, P - 1, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  frame.fill(-1, 0, P + 2, top, "outer");
  frame.fill(-1, 0, P + 2, 1, "wall-hi");
  frame.fill(-1, top - 1, P + 2, 1, "outer-lo");
  frame.fill(-1, top, 2, DOOR_H - top, "outer");
  frame.fill(-1, top, 1, DOOR_H - top, "wall-hi");
  frame.fill(P - 1, top, 2, DOOR_H - top, "outer");
  frame.fill(P, top, 1, DOOR_H - top, "outer-lo");

  shut.fill(x0, top, x1 - x0, DOOR_H - top, "wood");
  shut.fill(x0, top, x1 - x0, 1, "wood-lo");
  shut.fill(x0, top, 1, DOOR_H - top, "wood-hi");
  for (let x = x0 + 2; x < x1 - 1; x += 3) {
    for (let y = top + 2; y < DOOR_H - 2; y++) if (noise(x, y >> 3, 31) < 0.35) shut.dot(x, y, "wood-hi");
  }
  shut.fill(x1 - 4, 30, 3, 1, "brass");
  shut.dot(x1 - 4, 30, "brass-hi");
  shut.fill(x1 - 2, 29, 1, 3, "brass-lo");

  swung(open, x0, top, 2, ["wood-hi", "wood", "wood-lo"]);
  return d;
}

/** Boards held by a ledge top and bottom and a brace between, in a frame
 *  of round logs, with an iron latch: the log cabin's. */
function ledged(): Parts {
  const top = 6;
  const d = canvases("flat", 2, P - 2, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  // A log over the door, its cut ends showing their rings.
  frame.fill(-2, 1, P + 4, 4, "outer");
  frame.fill(-2, 1, P + 4, 1, "outer-hi");
  frame.fill(-2, 4, P + 4, 1, "outer-lo");
  frame.fill(-2, 5, P + 4, 1, "wood-deep");
  for (const x of [-2, P + 1]) {
    frame.fill(x, 1, 1, 4, "wood-hi");
  }
  // And a post either side.
  for (const [x, lit] of [[-1, true], [x1, false]] as const) {
    frame.fill(x, top, x0 + 1, DOOR_H - top, "outer");
    frame.fill(lit ? x : x + x0, top, 1, DOOR_H - top, lit ? "outer-hi" : "outer-lo");
    for (let y = top + 7; y < DOOR_H - 3; y += 11) frame.dot(x + 1, y, "outer-lo");
  }

  boards(shut, "flat", x0, x1, top, 3, ["wood-hi", "wood", "wood-lo"]);
  shut.fill(x0, top, x1 - x0, 1, "wood-deep");
  // The ledges and the brace that runs up from the hinge side.
  const [a, b] = [14, 44];
  for (const y of [a, b]) {
    shut.fill(x0, y, x1 - x0, 3, "wood-lo");
    shut.fill(x0, y, x1 - x0, 1, "wood");
  }
  for (let y = a + 3; y < b; y++) {
    const x = Math.round(x0 + ((b - 1 - y) / (b - a - 3)) * (x1 - x0 - 2));
    shut.fill(x, y, 2, 1, "wood-lo");
    shut.dot(x, y, "wood");
  }
  // The latch.
  shut.fill(x1 - 4, 30, 3, 1, "metal-lo");
  shut.dot(x1 - 2, 29, "metal-lo");
  shut.dot(x1 - 2, 31, "metal-lo");

  swung(open, x0, top, 3, ["wood-hi", "wood", "wood-lo"], "metal-lo");
  return d;
}

/** A sliding screen of paper in a grid of laths, and when it's open, a
 *  split curtain hanging in the doorway: the tea house's. */
function shoji(): Parts {
  const top = 4;
  const d = canvases("flat", 1, P - 1, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  // The lintel and posts, dark timber.
  frame.fill(-1, 0, P + 2, top, "trim");
  frame.fill(-1, 0, P + 2, 1, "wood");
  frame.fill(-1, top, 2, DOOR_H - top, "trim");
  frame.fill(P - 1, top, 2, DOOR_H - top, "trim");
  frame.fill(-1, DOOR_H - 2, P + 2, 2, "trim");

  shut.fill(x0, top, x1 - x0, DOOR_H - top - 2, "paper");
  shut.fill(x0, top, 1, DOOR_H - top - 2, "wood");
  shut.fill(x1 - 1, top, 1, DOOR_H - top - 2, "wood");
  shut.fill(x0, top, x1 - x0, 1, "wood");
  shut.fill(x0, DOOR_H - 6, x1 - x0, 4, "wood");
  for (let x = x0 + 4; x < x1 - 2; x += 4) shut.fill(x, top + 1, 1, DOOR_H - top - 7, "wood-lo");
  for (let y = top + 7; y < DOOR_H - 7; y += 7) shut.fill(x0 + 1, y, x1 - x0 - 2, 1, "wood-lo");
  // Paper glows a little warmer low down, where the light comes through.
  for (let y = top + 1; y < DOOR_H - 6; y++) if (y % 7 === 6) shut.fill(x0 + 1, y, x1 - x0 - 2, 1, "paper-lo");
  shut.fill(x1 - 3, 29, 1, 3, "wood-lo");

  // Open: the screen has slid into the wall; a noren hangs in the doorway,
  // split up the middle, in the fabric colour.
  const mid = (x0 + x1) / 2;
  open.fill(x0, top, x1 - x0, 1, "wood");
  for (let y = top + 1; y < top + 15; y++) {
    open.fill(x0, y, mid - x0 - 1, 1, "curtain");
    open.fill(mid + 1, y, x1 - mid - 1, 1, "curtain");
  }
  open.fill(x0, top + 1, x1 - x0, 1, "curtain-hi");
  open.fill(mid - 2, top + 1, 1, 14, "curtain-lo");
  open.fill(x1 - 1, top + 1, 1, 14, "curtain-lo");
  open.dot(mid - 4, top + 6, "paper");
  open.dot(mid + 3, top + 6, "paper");
  return d;
}

/** A copper door studded with rivets, with a porthole and a wheel to turn
 *  it by, in an iron frame: the workshop's. */
function riveted(): Parts {
  const top = 5;
  const d = canvases("flat", 2, P - 2, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  frame.fill(-1, 0, P + 2, top, "metal-lo");
  frame.fill(-1, 0, P + 2, 1, "metal");
  for (const x of [-1, x1]) frame.fill(x, top, x0 + 1, DOOR_H - top, "metal-lo");
  frame.fill(-1, 0, 1, DOOR_H, "metal");
  for (let x = 0; x < P; x += 3) frame.dot(x, 2, "brass");
  for (let y = top + 3; y < DOOR_H - 2; y += 5) {
    frame.dot(0, y, "brass");
    frame.dot(P - 1, y, "brass");
  }

  shut.fill(x0, top, x1 - x0, DOOR_H - top, "copper");
  shut.fill(x0, top, x1 - x0, 1, "copper-lo");
  shut.fill(x0, top, 1, DOOR_H - top, "copper-hi");
  shut.fill(x1 - 1, top, 1, DOOR_H - top, "copper-lo");
  for (const y of [top + 2, 24, DOOR_H - 3]) {
    shut.fill(x0 + 1, y + 1, x1 - x0 - 2, 1, "copper-lo");
    for (let x = x0 + 1; x < x1 - 1; x += 2) shut.dot(x, y, "brass-hi");
  }
  // The porthole, a brass ring round the glass.
  const [px, py] = [(x0 + x1) / 2 - 3, 11];
  const port = ["..BB..", ".BaAB.", "BaAAvB", "BAAvvB", ".BvvB.", "..BB.."];
  const key: Record<string, Paint> = { B: "brass", a: "glass-hi", A: "glass", v: "glass-lo" };
  port.forEach((row, y) => [...row].forEach((ch, x) => key[ch] && shut.dot(px + x, py + y, key[ch])));
  shut.dot(px + 1, py, "brass-hi");
  shut.dot(px, py + 1, "brass-hi");
  // The wheel.
  const [wx, wy] = [(x0 + x1) / 2 - 3, 31];
  const wheel = [".BBBB.", "Bn.n.B", "B.nn.B", "B.nn.B", "Bn..nB", ".BBBB."];
  const wkey: Record<string, Paint> = { B: "brass", n: "brass-lo" };
  wheel.forEach((row, y) => [...row].forEach((ch, x) => wkey[ch] && shut.dot(wx + x, wy + y, wkey[ch])));
  shut.dot(wx + 1, wy, "brass-hi");

  swung(open, x0, top, 3, ["copper-hi", "copper", "copper-lo"], "brass");
  return d;
}

/** A door painted red under a fanlight, in a round-arched surround of
 *  whitewashed stone: the lighthouse's. */
function keeper(): Parts {
  const spring = 13;
  const d = canvases("round", 2, P - 2, spring);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  stoneSurround(frame, "round", x0, x1, spring, 2, ["outer-hi", "outer", "outer-lo", "outer-lo"]);
  // The fanlight: glass filling the arch, its white bars fanning out from
  // the middle of the transom.
  const cx = (x0 + x1) / 2;
  for (let y = 0; y <= spring; y++) {
    for (let x = x0; x < x1; x++) {
      if (!inside("round", x0, x1, spring, x, y)) continue;
      const dx = x + 0.5 - cx;
      const up = spring + 0.5 - y;
      const bar = y === spring || Math.abs(dx) < 0.6 || Math.abs(Math.abs(dx) - up) < 0.6;
      frame.dot(x, y, bar ? "outer" : dx < 0 && up > 2 ? "glass-hi" : "glass");
    }
  }
  const top = spring + 1;
  boards(shut, "flat", x0, x1, top, 3, ["red-hi", "red", "red-lo"]);
  shut.fill(x0, top, x1 - x0, 1, "red-lo");
  for (const y of [22, 44]) {
    shut.fill(x0, y, x1 - x0, 1, "red-lo");
    shut.fill(x0, y + 1, x1 - x0, 1, "red-hi");
  }
  knob(shut, x1 - 3, 32, ["brass-hi", "brass", "brass-lo"]);

  swung(open, x0, top, 3, ["red-hi", "red", "red-lo"], "brass");
  return d;
}

/** A stable door in two halves, painted like the boards outside, the top
 *  one glazed and the bottom one braced, in a white frame: the
 *  windmill's. */
function stable(): Parts {
  const top = 5;
  const d = canvases("flat", 2, P - 2, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  frame.fill(-2, 0, P + 4, 2, "trim");
  frame.fill(-2, 2, P + 4, 1, "outer-lo");
  frame.fill(-1, 3, P + 2, top - 3, "trim");
  frame.fill(-1, top, x0 + 1, DOOR_H - top, "trim");
  frame.fill(x1, top, P + 1 - x1, DOOR_H - top, "trim");
  frame.fill(x1, top, 1, DOOR_H - top, "outer-lo");

  const split = 29;
  boards(shut, "flat", x0, x1, top, 3, ["outer-hi", "outer", "outer-lo"]);
  shut.fill(x0, top, x1 - x0, 1, "outer-lo");
  // The top half's window: four panes in white bars.
  shut.fill(x0 + 1, top + 4, x1 - x0 - 2, 14, "trim");
  for (const [px, py] of [[x0 + 2, top + 5], [x0 + 6, top + 5], [x0 + 2, top + 11], [x0 + 6, top + 11]]) {
    shut.fill(px, py, 3, 5, "glass");
    shut.dot(px, py, "glass-hi");
  }
  // The ledge where the halves meet, and the bottom half's brace.
  shut.fill(x0, split, x1 - x0, 1, "outer-lo");
  shut.fill(x0 - 1, split + 1, x1 - x0 + 2, 2, "trim");
  for (const y of [split + 6, DOOR_H - 5]) {
    shut.fill(x0, y, x1 - x0, 2, "outer-lo");
    shut.fill(x0, y, x1 - x0, 1, "outer-hi");
  }
  for (let y = split + 8; y < DOOR_H - 5; y++) {
    const x = Math.round(x0 + ((DOOR_H - 6 - y) / (DOOR_H - split - 14)) * (x1 - x0 - 2));
    shut.fill(Math.max(x0, Math.min(x1 - 2, x)), y, 2, 1, "outer-lo");
  }
  knob(shut, x1 - 3, split + 3, ["brass-hi", "brass", "brass-lo"]);

  swung(open, x0, top, 3, ["outer-hi", "outer", "outer-lo"], "brass");
  return d;
}

/** A carved door of thick boards, studded with iron, under a log lintel
 *  in a doorway of soft plaster; open, a striped blanket hangs in it:
 *  the adobe's. */
function carved(): Parts {
  const top = 6;
  const d = canvases("flat", 2, P - 2, top);
  const { frame, shut, open } = d;
  const [x0, x1] = d.opening;
  // The plaster either side, rounded into the doorway.
  for (const [x, lit] of [[-1, true], [x1, false]] as const) {
    frame.fill(x, top, x0 + 1, DOOR_H - top, "outer");
    frame.fill(lit ? x0 - 1 : x1, top, 1, DOOR_H - top, lit ? "outer-lo" : "outer-hi");
    for (let y = top + 3; y < DOOR_H - 2; y += 5) if (noise(x, y, 71) < 0.5) frame.dot(x + (lit ? 1 : 0), y, "outer-hi");
  }
  // The lintel, a peeled log, its ends showing their rings.
  frame.fill(-2, 1, P + 4, 5, "trunk");
  frame.fill(-2, 1, P + 4, 1, "trunk-hi");
  frame.fill(-2, 5, P + 4, 1, "trunk-lo");
  for (let x = 0; x < P; x += 4) frame.dot(x + (x % 8 ? 1 : 0), 3, "trunk-lo");
  for (const x of [-2, P + 1]) {
    frame.fill(x, 2, 1, 3, "trunk-lo");
  }
  frame.fill(-1, 0, P + 2, 1, "outer");

  boards(shut, "flat", x0, x1, top, 5, ["wood-hi", "wood", "wood-lo"]);
  shut.fill(x0, top, x1 - x0, 1, "wood-deep");
  // Two carved panels, and studs in rows.
  for (const [py, ph] of [[top + 4, 18], [top + 27, 18]]) {
    shut.fill(x0 + 2, py, x1 - x0 - 4, ph, "wood-lo");
    shut.fill(x0 + 3, py + 1, x1 - x0 - 6, ph - 2, "wood");
    shut.fill(x0 + 3, py + ph - 2, x1 - x0 - 6, 1, "wood-hi");
    shut.fill((x0 + x1) / 2 - 1, py + 4, 2, ph - 8, "wood-lo");
  }
  for (const y of [top + 2, top + 24, DOOR_H - 3]) for (let x = x0 + 1; x < x1 - 1; x += 3) shut.dot(x, y, "metal-lo");
  shut.fill(x1 - 3, 30, 1, 3, "metal-lo");
  shut.dot(x1 - 4, 31, "metal-lo");

  // Open: the blanket, in stripes of the rug's colours, with a fringe.
  const stripes: Paint[] = ["rug", "rug", "rug-2", "rug-3", "rug-3", "rug-fringe", "rug", "rug", "rug", "rug-2", "rug-2"];
  for (let y = top; y < DOOR_H - 9; y++) open.fill(x0, y, x1 - x0, 1, stripes[(y - top) % stripes.length]);
  for (let x = x0; x < x1; x += 2) open.fill(x, DOOR_H - 9, 1, 3, "rug-fringe");
  open.fill(x0, top, x1 - x0, 1, "trunk-lo");
  open.fill(x1 - 1, top + 1, 1, DOOR_H - top - 10, "rug-3");
  return d;
}

const DOORS: Record<RoomStyle, () => Parts> = {
  cottage: panelled,
  medieval: () => arched("medieval"),
  fantasy: () => arched("fantasy"),
  elven,
  cave: rough,
  scifi: sliding,
  modern: flush,
  cabin: ledged,
  japanese: shoji,
  steampunk: riveted,
  lighthouse: keeper,
  windmill: stable,
  adobe: carved,
};

/** The door in a style, in a box from (-DOOR_REACH, 0) to (PARTITION +
 *  DOOR_REACH, DOOR_H), with the floor along its bottom. */
export function doorArt(style: RoomStyle): Door {
  const d = DOORS[style]();
  return { hole: d.hole.rects(), shut: d.shut.rects(), open: d.open.rects(), frame: d.frame.rects() };
}

const cache = new Map<RoomStyle, Door>();
/** The door in a style, drawn once. */
export function doorFor(style: RoomStyle): Door {
  let door = cache.get(style);
  if (!door) cache.set(style, (door = doorArt(style)));
  return door;
}
