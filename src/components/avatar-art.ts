/**
 * The reader's avatar in the reading room, drawn in code like the rest of
 * the room (room-art.tsx): rectangles naming paints, coloured in
 * reading-room.css from the --av-* colours the avatar's element sets from
 * its look (lib/avatar.ts).
 *
 * A figure is painted dot by dot in layers (what's behind it, legs, top,
 * arms, the face, hair, hats), then every empty dot touching it gets a dark
 * outline, so it reads against any wall. Standing and walking, it is seen
 * three-quarters on, facing right (CSS mirrors it to face left); in the
 * armchair it faces the room, reading.
 *
 * Figure dots are counted from the top of the head (row 0) and the left of
 * the figure (column 0; the head is columns 3 to 10), so a hat or hair can
 * reach above it into the headroom.
 */
import type { Art, Paint, Rect } from "@/components/room-art";
import { LONG_TOPS, type AvatarLook } from "@/lib/avatar";

/** Rows over the head for a hat, and a dot each side for the outline. */
const HEADROOM = 14;
const PAD = 1;
const FIGURE_W = 14;
export const AVATAR_W = FIGURE_W + 2 * PAD;

type View = "side" | "front";
type Pose = "stand" | "stride" | "sit";

class Canvas {
  private readonly cells: (Paint | null)[][];
  readonly h: number;
  constructor(rows: number) {
    this.h = HEADROOM + rows;
    this.cells = Array.from({ length: this.h }, () => Array<Paint | null>(AVATAR_W).fill(null));
  }
  set(x: number, y: number, paint: Paint | null) {
    const row = this.cells[y + HEADROOM];
    if (row && x + PAD >= 0 && x + PAD < AVATAR_W) row[x + PAD] = paint;
  }
  get(x: number, y: number): Paint | null {
    return this.cells[y + HEADROOM]?.[x + PAD] ?? null;
  }
  /** A row of dots from x0 to x1, either way round. */
  run(x0: number, x1: number, y: number, paint: Paint | null) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, paint);
  }
  block(x0: number, x1: number, y0: number, y1: number, paint: Paint | null) {
    for (let y = y0; y <= y1; y++) this.run(x0, x1, y, paint);
  }
  /** Dots from a list. */
  dots(points: readonly (readonly [number, number])[], paint: Paint | null) {
    for (const [x, y] of points) this.set(x, y, paint);
  }
  /** Repaints the dots already painted `from` (any of them) in `to`. */
  recolour(x0: number, x1: number, y0: number, y1: number, from: readonly Paint[], to: Paint) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = this.get(x, y);
        if (p && from.includes(p)) this.set(x, y, to);
      }
    }
  }
  /** Outlines the figure, then turns each row's runs into rectangles. */
  toArt(): Art {
    const { h, cells } = this;
    const w = AVATAR_W;
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && cells[y][x] !== null;
    const rects: Rect[] = [];
    for (let y = 0; y < h; y++) {
      const row = cells[y].map(
        (paint, x) =>
          paint ?? (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1) ? "av-line" : null),
      );
      let x = 0;
      while (x < w) {
        const paint = row[x];
        let end = x + 1;
        while (end < w && row[end] === paint) end++;
        if (paint) rects.push([x, y, end - x, 1, paint]);
        x = end;
      }
    }
    return { w, h, rects };
  }
}

/** The other side of the figure, from the front. */
const mirror = (x: number) => FIGURE_W - 1 - x;

/** Paints a shape and its mirror image, for the front view. */
function both(c: Canvas, x0: number, x1: number, y0: number, y1: number, paint: Paint, mirrorPaint = paint) {
  c.block(x0, x1, y0, y1, paint);
  c.block(mirror(x1), mirror(x0), y0, y1, mirrorPaint);
}

// ── Behind: a cape, a backpack ────────────────────────────────────────────

function behind(c: Canvas, look: AvatarLook, pose: Pose) {
  const sit = pose === "sit";
  if (look.accessories.includes("cape")) {
    if (sit) {
      // Over the shoulders and down behind the arms.
      both(c, 1, 1, 12, 21, "av-accent-lo");
      both(c, 2, 2, 11, 11, "av-accent");
    } else {
      // Hanging down the back; it billows out as they walk.
      const swing = pose === "stride" ? 1 : 0;
      c.block(2, 3, 11, 15, "av-accent");
      c.block(1, 3, 16, 24, "av-accent");
      c.block(1 - swing, 3, 25, 33 - swing, "av-accent");
      c.block(1, 1, 16, 24, "av-accent-lo");
      c.block(1 - swing, 1 - swing, 25, 33 - swing, "av-accent-lo");
      c.run(1 - swing, 3, 33 - swing, "av-accent-lo");
    }
  }
  if (look.accessories.includes("backpack") && !sit) {
    c.block(0, 2, 12, 21, "av-accent");
    c.block(0, 0, 12, 21, "av-accent-lo");
    c.run(0, 2, 15, "av-accent-lo");
    c.set(1, 17, "brass-hi");
  }
}

// ── Legs and what's worn on them ─────────────────────────────────────────

interface Legs {
  /** Columns of the near and far leg at the thigh and the shin. */
  near: [number, number, number];
  far: [number, number, number];
}

/** Where the legs go, standing or mid-stride: [thigh x, shin x, width-1]. */
function legsFor(stride: boolean, thick: number): Legs {
  return stride ? { near: [8, 9, thick], far: [3, 2, thick] } : { near: [8, 8, thick], far: [3, 3, thick] };
}

/** One leg, from `top` to the ankle (row 34), in `paint`. */
function leg(c: Canvas, [thigh, shin, w]: [number, number, number], top: number, paint: Paint) {
  for (let y = top; y <= 34; y++) {
    const x = y <= 30 ? thigh : shin;
    c.run(x, x + w, y, paint);
  }
}

function standingLegs(c: Canvas, look: AvatarLook, stride: boolean) {
  const long = LONG_TOPS.includes(look.top);
  const b = look.bottom;
  // Bare legs are thinner than trousers.
  const bareFrom = long
    ? look.top === "dress"
      ? 30
      : 35
    : b === "shorts"
      ? 29
      : b === "skirt"
        ? 30
        : b === "longskirt"
          ? 34
          : 35;
  const cloth = !long && (b === "trousers" || b === "jeans" || b === "dungarees" || b === "shorts");
  const trousers = legsFor(stride, 2);
  const bare = legsFor(stride, 1);
  if (cloth) {
    c.block(3, 10, 23, 26, "av-bottom");
    c.run(3, 10, 23, "av-bottom-lo");
    c.block(3, 3, 24, 26, "av-bottom-hi");
    const end = b === "shorts" ? 28 : 34;
    for (let y = 27; y <= end; y++) {
      for (const [l, paint] of [
        [trousers.far, "av-bottom-lo"],
        [trousers.near, "av-bottom"],
      ] as const) {
        const x = y <= 30 ? l[0] : l[1];
        c.run(x, x + l[2], y, paint);
      }
    }
    if (b === "jeans") {
      // Seams down the outside, turn-ups at the bottom, a belt.
      c.run(3, 10, 23, "av-belt");
      c.set(7, 23, "brass-hi");
      for (let y = 27; y <= 33; y++) c.set((y <= 30 ? trousers.near[0] : trousers.near[1]) + 2, y, "av-bottom-hi");
      for (const l of [trousers.far, trousers.near]) c.run(l[1], l[1] + 2, 34, "av-bottom-hi");
    }
    if (b === "shorts") {
      for (const l of [trousers.far, trousers.near]) c.run(l[0], l[0] + 2, 28, "av-bottom-lo");
    }
  }
  if (!long && (b === "skirt" || b === "longskirt")) {
    const hem = b === "skirt" ? 29 : 33;
    c.block(3, 10, 23, 24, "av-bottom");
    c.run(3, 10, 23, "av-bottom-lo");
    for (let y = 25; y <= hem; y++) {
      const flare = Math.min(2, Math.floor((y - 23) / 3));
      c.run(3 - flare, 10 + flare, y, "av-bottom");
      c.set(3 - flare, y, "av-bottom-hi");
    }
    c.run(1, 12, hem, "av-bottom-lo");
    for (const x of [5, 8]) c.block(x, x, 26, hem - 1, "av-bottom-lo");
  }
  // Bare legs below a skirt, a dress or shorts.
  if (bareFrom <= 34) {
    leg(c, bare.far, bareFrom, "av-skin-lo");
    leg(c, bare.near, bareFrom, "av-skin");
  }
}

function standingShoes(c: Canvas, look: AvatarLook, stride: boolean) {
  const feet = stride
    ? [
        [2, 5],
        [9, 12],
      ]
    : [
        [3, 6],
        [8, 11],
      ];
  const legs = legsFor(stride, 2);
  const shins = [legs.far[1], legs.near[1]];
  const kind = look.shoes;
  feet.forEach(([x0, x1], i) => {
    const shin = shins[i];
    switch (kind) {
      case "boots":
        c.block(shin, shin + 2, 31, 34, "av-boot");
        c.set(shin, 31, "av-boot-hi");
        c.block(x0, x1, 35, 36, "av-boot");
        c.run(x0, x1, 36, "av-shoe-lo");
        break;
      case "wellies":
        c.block(shin, shin + 2, 29, 34, "av-welly");
        c.block(shin, shin, 29, 34, "av-welly-hi");
        c.block(x0, x1, 35, 36, "av-welly");
        c.run(x0, x1, 36, "av-welly-lo");
        break;
      case "trainers":
        c.block(x0, x1, 35, 35, "av-accent");
        c.set(x0 + 1, 35, "av-sole");
        c.run(x0, x1, 36, "av-sole");
        break;
      case "slippers":
        c.block(x0, x1, 35, 36, "av-slipper");
        c.set(x1, 35, "av-slipper-hi");
        c.run(x0, x1, 36, "av-slipper-lo");
        break;
      case "sandals":
        c.block(x0, x1, 35, 35, "av-skin");
        c.set(x0 + 1, 35, "av-strap");
        c.run(x0, x1, 36, "av-strap");
        break;
      default:
        c.block(x0, x1, 35, 36, "av-shoe");
        c.set(x1, 35, "av-shoe-hi");
        c.run(x0, x1, 36, "av-shoe-lo");
    }
  });
}

// ── Tops ─────────────────────────────────────────────────────────────────

/** The body of a top, lit from the left, from the neck to `hem`. */
function torso(c: Canvas, hem: number) {
  c.run(6, 7, 10, "av-skin-lo");
  c.run(4, 9, 11, "av-top-hi");
  c.block(3, 10, 12, hem, "av-top");
  c.block(3, 3, 12, hem, "av-top-hi");
  c.block(10, 10, 12, hem, "av-top-lo");
}

/** The front of the body, where buttons and openings go: the middle from
 *  the front, nearer the right three-quarters on. */
const centre = (view: View) => (view === "side" ? 7 : 6);

function top(c: Canvas, look: AvatarLook, view: View, pose: Pose) {
  const sit = pose === "sit";
  const waist = sit ? 19 : 22;
  const mid = centre(view);
  switch (look.top) {
    case "jumper":
    case "stripes":
      torso(c, waist);
      c.run(3, 10, waist, "av-top-lo");
      if (look.top === "stripes")
        for (let y = 13; y < waist; y += 3) c.recolour(3, 10, y, y, ["av-top", "av-top-hi", "av-top-lo"], "av-stripe");
      break;
    case "tshirt":
      torso(c, waist);
      c.run(mid, mid + 1, 11, "av-skin");
      break;
    case "hoodie":
      torso(c, waist);
      c.run(3, 10, waist, "av-top-lo");
      if (view === "side") {
        // The hood bunched behind the neck.
        c.block(2, 4, 9, 11, "av-top-lo");
        c.block(3, 4, 9, 9, "av-top");
      } else {
        c.run(3, 10, 10, "av-top-lo");
        c.run(6, 7, 10, "av-skin-lo");
      }
      c.block(mid - 1, mid - 1, 12, 15, "av-under");
      c.block(mid + 2, mid + 2, 12, 15, "av-under");
      if (!sit) {
        c.run(4, 9, 18, "av-top-lo");
        c.block(4, 4, 18, 21, "av-top-lo");
        c.block(9, 9, 18, 21, "av-top-lo");
      }
      break;
    case "cardigan":
      torso(c, waist);
      c.block(mid, mid + 1, 11, waist, "av-under");
      c.run(3, 10, waist, "av-top-lo");
      c.run(mid, mid + 1, waist, "av-under");
      for (let y = 14; y < waist; y += 3) c.set(mid - 1, y, "brass-hi");
      break;
    case "shirt":
      torso(c, waist);
      c.dots(
        [
          [mid - 1, 11],
          [mid + 2, 11],
        ],
        "av-under",
      );
      c.run(mid, mid + 1, 11, "av-skin");
      for (let y = 13; y < waist; y += 3) c.set(mid, y, "av-top-lo");
      c.run(4, 5, 14, "av-top-lo");
      break;
    case "vest": {
      // A shirt under a waistcoat.
      c.run(6, 7, 10, "av-skin-lo");
      c.run(4, 9, 11, "av-under");
      c.block(3, 10, 12, waist, "av-top");
      c.block(3, 3, 12, waist, "av-top-hi");
      c.block(10, 10, 12, waist, "av-top-lo");
      // The V of the shirt, and a tie.
      c.block(mid - 1, mid + 2, 12, 13, "av-under");
      c.block(mid, mid + 1, 14, 15, "av-under");
      c.block(mid, mid + 1, 12, 16, "av-accent");
      c.set(mid, 12, "av-accent-lo");
      for (let y = 17; y < waist; y += 2) c.set(mid + 1, y, "brass-hi");
      if (!sit)
        c.dots(
          [
            [mid, waist + 1],
            [mid + 1, waist + 1],
          ],
          "av-top-lo",
        );
      break;
    }
    case "coat": {
      const hem = sit ? waist : 30;
      torso(c, Math.min(hem, waist));
      if (!sit) {
        for (let y = 23; y <= hem; y++) {
          const flare = y >= 27 ? 1 : 0;
          c.run(3 - flare, 10 + flare, y, "av-top");
          c.set(3 - flare, y, "av-top-hi");
          c.set(10 + flare, y, "av-top-lo");
        }
        c.block(mid + 1, mid + 1, 23, hem, "av-top-lo");
        c.run(2, 11, hem, "av-top-lo");
      }
      // Lapels and buttons.
      c.dots(
        [
          [mid - 1, 11],
          [mid + 2, 11],
          [mid - 1, 12],
          [mid + 2, 12],
          [mid, 13],
          [mid + 1, 13],
        ],
        "av-top-lo",
      );
      c.run(mid, mid + 1, 11, "av-under");
      c.run(mid, mid + 1, 12, "av-under");
      for (let y = 15; y <= Math.min(hem, 24); y += 3) c.set(mid - 1, y, "brass");
      if (!sit) c.run(3, 10, 22, "av-top-lo");
      break;
    }
    case "dress": {
      torso(c, sit ? waist : 21);
      c.run(mid, mid + 1, 11, "av-skin");
      if (!sit) {
        c.run(3, 10, 21, "av-accent");
        for (let y = 22; y <= 29; y++) {
          const flare = Math.min(2, Math.floor((y - 21) / 3));
          c.run(3 - flare, 10 + flare, y, "av-top");
          c.set(3 - flare, y, "av-top-hi");
          c.set(10 + flare, y, "av-top-lo");
        }
        c.run(1, 12, 29, "av-top-lo");
        for (const x of [5, 8]) c.block(x, x, 24, 28, "av-top-lo");
      } else {
        c.run(3, 10, waist, "av-accent");
      }
      break;
    }
    case "robe": {
      torso(c, sit ? waist : 34);
      if (!sit) {
        for (let y = 23; y <= 34; y++) {
          const flare = y >= 28 ? 1 : 0;
          c.run(3 - flare, 10 + flare, y, "av-top");
          c.set(3 - flare, y, "av-top-hi");
          c.set(10 + flare, y, "av-top-lo");
        }
        c.run(2, 11, 34, "av-top-lo");
        c.block(mid + 1, mid + 1, 22, 33, "av-top-hi");
      }
      // A sash at the waist and trim down the front.
      c.run(3, 10, sit ? 18 : 21, "av-accent");
      c.block(mid + 1, mid + 1, 11, sit ? 17 : 20, "av-top-hi");
      c.dots(
        [
          [mid, 11],
          [mid + 1, 11],
        ],
        "av-skin-lo",
      );
      break;
    }
  }
}

/** Dungarees go over the top: a bib and straps. */
function bib(c: Canvas, look: AvatarLook, view: View, pose: Pose) {
  if (look.bottom !== "dungarees" || LONG_TOPS.includes(look.top) || look.top === "coat") return;
  const sit = pose === "sit";
  const [a, b] = view === "side" ? [5, 9] : [4, 9];
  c.block(a, b, sit ? 15 : 16, sit ? 19 : 22, "av-bottom");
  c.block(a, a, sit ? 15 : 16, sit ? 19 : 22, "av-bottom-hi");
  c.block(a, a, 11, sit ? 14 : 15, "av-bottom-lo");
  c.block(b, b, 11, sit ? 14 : 15, "av-bottom-lo");
  c.dots(
    [
      [a, sit ? 15 : 16],
      [b, sit ? 15 : 16],
    ],
    "brass-hi",
  );
  if (!sit) c.run(a + 2, b - 2, 18, "av-bottom-lo");
}

/** What the arms are in: the top's sleeves, or a shirt's under a
 *  waistcoat; and how far down they go before the skin. */
function sleeves(look: AvatarLook): { paint: Paint; lo: Paint; to: number; wide: boolean } {
  switch (look.top) {
    case "tshirt":
    case "dress":
      return { paint: "av-top", lo: "av-top-lo", to: 14, wide: false };
    case "vest":
      return { paint: "av-under", lo: "av-under-lo", to: 20, wide: false };
    case "robe":
      return { paint: "av-top", lo: "av-top-lo", to: 21, wide: true };
    default:
      return { paint: "av-top", lo: "av-top-lo", to: 20, wide: false };
  }
}

function standingArms(c: Canvas, look: AvatarLook, stride: boolean) {
  const sl = sleeves(look);
  // Each arm as dots from the shoulder to the hand: the far arm in shadow.
  const far = stride ? [2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1] : [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
  const near = stride ? [11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12] : [11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11];
  const rows = stride ? 10 : 11; // a swinging arm looks shorter
  for (const [xs, lit] of [
    [far, false],
    [near, true],
  ] as const) {
    for (let i = 0; i < rows; i++) {
      const y = 12 + i;
      const x = xs[i];
      const hand = y >= 21 || (stride && y >= 20);
      const sleeve = !hand && y <= sl.to;
      const paint = hand || !sleeve ? (lit ? "av-skin" : "av-skin-lo") : lit ? sl.paint : sl.lo;
      c.set(x, y, paint);
      if (sl.wide && sleeve && y >= 18) c.set(lit ? x + 1 : x - 1, y, lit ? sl.paint : sl.lo);
    }
  }
  if (look.top === "stripes") {
    for (let y = 13; y <= 20; y += 3) c.recolour(1, 12, y, y, ["av-top", "av-top-lo"], "av-stripe");
  }
}

function seatedArms(c: Canvas, look: AvatarLook) {
  const sl = sleeves(look);
  for (let y = 12; y <= 16; y++) {
    const covered = y <= sl.to;
    c.set(2, y, covered ? sl.paint : "av-skin");
    c.set(11, y, covered ? sl.lo : "av-skin-lo");
  }
  const forearm = 17 <= sl.to;
  c.run(2, 3, 17, forearm ? sl.paint : "av-skin");
  c.run(10, 11, 17, forearm ? sl.lo : "av-skin-lo");
  if (sl.wide) {
    c.block(1, 1, 15, 17, sl.paint);
    c.block(12, 12, 15, 17, sl.lo);
  }
  if (look.top === "stripes") c.recolour(1, 12, 13, 13, ["av-top", "av-top-lo"], "av-stripe");
}

/** In the armchair: the lap, then shins down to the floor. */
function seatedLegs(c: Canvas, look: AvatarLook) {
  const long = LONG_TOPS.includes(look.top);
  const b = look.bottom;
  const lap = long ? "av-top" : "av-bottom";
  c.block(2, 11, 20, 22, lap);
  c.run(2, 11, 20, `${lap}-hi`);
  c.run(2, 11, 22, `${lap}-lo`);
  c.dots(
    [
      [6, 21],
      [7, 21],
    ],
    `${lap}-lo`,
  );
  if (look.top === "coat") {
    both(c, 2, 2, 20, 23, "av-top", "av-top-lo");
  }
  if (look.top === "dress") c.run(1, 12, 23, "av-top-lo");
  if (!long && b === "skirt") c.run(1, 12, 23, "av-bottom-lo");
  // What covers the shins: a robe or a long skirt to the ankles.
  const covered = look.top === "robe" ? "av-top" : !long && b === "longskirt" ? "av-bottom" : null;
  if (covered) {
    c.block(2, 11, 23, 28, covered);
    c.block(2, 2, 23, 28, `${covered}-hi`);
    c.run(2, 11, 28, `${covered}-lo`);
    for (const x of [5, 8]) c.block(x, x, 24, 27, `${covered}-lo`);
    both(c, 4, 5, 29, 29, "av-skin", "av-skin-lo");
  } else {
    const trousers = !long && (b === "trousers" || b === "jeans" || b === "dungarees");
    const shin = trousers ? "av-bottom" : "av-skin";
    const [x0, x1] = trousers ? [3, 5] : [4, 5];
    for (let y = 23; y <= 29; y++) {
      c.run(x0, x1, y, shin);
      c.run(mirror(x1), mirror(x0), y, trousers ? "av-bottom" : "av-skin");
      c.set(mirror(x0), y, trousers ? "av-bottom-lo" : "av-skin-lo");
    }
    if (b === "jeans" && !long) {
      c.run(3, 5, 29, "av-bottom-hi");
      c.run(8, 10, 29, "av-bottom-hi");
    }
    if (b === "shorts" && !long) {
      c.run(2, 11, 23, "av-bottom-lo");
    }
  }
  // Shoes on the floor; boots and wellies up the shins, unless covered.
  for (const [x0, x1] of [
    [2, 5],
    [8, 11],
  ]) {
    switch (look.shoes) {
      case "boots":
        if (!covered) c.block(x0 + 1, x1, 26, 29, "av-boot");
        c.block(x0, x1, 30, 31, "av-boot");
        c.run(x0, x1, 31, "av-shoe-lo");
        break;
      case "wellies":
        if (!covered) c.block(x0 + 1, x1, 25, 29, "av-welly");
        c.block(x0, x1, 30, 31, "av-welly");
        c.run(x0, x1, 31, "av-welly-lo");
        break;
      case "trainers":
        c.block(x0, x1, 30, 30, "av-accent");
        c.run(x0, x1, 31, "av-sole");
        break;
      case "slippers":
        c.block(x0, x1, 30, 31, "av-slipper");
        c.run(x0, x1, 31, "av-slipper-lo");
        break;
      case "sandals":
        c.block(x0, x1, 30, 30, "av-skin");
        c.set(x0 + 1, 30, "av-strap");
        c.run(x0, x1, 31, "av-strap");
        break;
      default:
        c.block(x0, x1, 30, 31, "av-shoe");
        c.run(x0, x1, 31, "av-shoe-lo");
    }
  }
}

/** Around the neck: a scarf, a necklace, a bow tie. */
function neck(c: Canvas, look: AvatarLook, view: View, pose: Pose) {
  const side = view === "side";
  const has = (a: string) => look.accessories.includes(a as never);
  if (has("necklace")) {
    const pts: [number, number][] = side
      ? [
          [5, 11],
          [6, 12],
          [7, 12],
          [8, 12],
          [9, 11],
        ]
      : [
          [4, 11],
          [5, 12],
          [8, 12],
          [9, 11],
        ];
    c.dots(pts, "brass-hi");
    c.dots(
      side
        ? [[7, 13]]
        : [
            [6, 13],
            [7, 13],
          ],
      "av-accent",
    );
  }
  if (has("bowtie")) {
    const m = centre(view);
    c.dots(
      [
        [m - 1, 11],
        [m + 2, 11],
        [m - 1, 12],
        [m + 2, 12],
      ],
      "av-accent",
    );
    c.dots(
      [
        [m, 11],
        [m + 1, 11],
      ],
      "av-accent-lo",
    );
  }
  if (has("scarf")) {
    c.run(3, 10, 10, "av-accent");
    c.run(3, 10, 11, "av-accent-lo");
    c.run(4, 9, 10, "av-accent");
    if (side) {
      // The ends fly out behind as they walk.
      const swing = pose === "stride" ? 1 : 0;
      c.block(2 - swing, 3 - swing, 11, 15, "av-accent");
      c.set(2 - swing, 15, "av-accent-lo");
    } else {
      c.block(8, 9, 12, 16, "av-accent");
      c.run(8, 9, 16, "av-accent-lo");
    }
  }
}

// ── The head ─────────────────────────────────────────────────────────────

function face(c: Canvas, look: AvatarLook, view: View, reading: boolean) {
  const side = view === "side";
  c.run(4, 9, 1, "av-skin");
  c.block(3, 10, 2, 8, "av-skin");
  c.run(4, 9, 9, "av-skin");
  // Lit from the left.
  c.block(10, 10, 2, 8, "av-skin-lo");
  c.set(9, 9, "av-skin-lo");
  if (side) {
    // A nose, so it's clear which way they face, and an ear.
    c.set(11, 6, "av-skin");
    c.dots(
      [
        [4, 5],
        [4, 6],
      ],
      "av-skin-lo",
    );
  }

  // Cheeks first: the eyes and mouth go over them.
  const cheeks = side ? [6] : [4, 9];
  if (look.cheeks.includes("freckles")) {
    c.dots(
      side
        ? [
            [5, 7],
            [7, 8],
            [6, 8],
          ]
        : [
            [3, 7],
            [4, 8],
            [10, 7],
            [9, 8],
          ],
      "av-freckle",
    );
  }
  if (look.cheeks.includes("blush")) for (const x of cheeks) c.set(x, 7, "av-blush");
  if (look.cheeks.includes("spot")) c.set(side ? 8 : 9, side ? 8 : 6, "av-freckle");

  eyes(c, look, view, reading);
  mouth(c, look, view);
}

function eyes(c: Canvas, look: AvatarLook, view: View, reading: boolean) {
  const side = view === "side";
  // The near eye and the far one: three-quarters on, the far one is at the
  // edge of the face.
  const at = side ? [7, 10] : [5, 8];
  // Behind glasses, open eyes are a dot.
  const tall = !look.accessories.includes("glasses") && !look.accessories.includes("sunglasses");
  // Shut, smiling: from the front, each arc leans out, so the two don't
  // run together.
  const closed = (x: number, i: number) => {
    c.set(x, 5, "av-eye");
    if (side) {
      if (x - 1 >= 3 && !at.includes(x - 1)) c.set(x - 1, 6, "av-eye");
      if (x + 1 <= 10) c.set(x + 1, 6, "av-eye");
    } else c.set(i === 0 ? x - 1 : x + 1, 6, "av-eye");
  };
  const open = (x: number) => {
    if (reading) c.set(x, 6, "av-eye");
    else c.block(x, x, 5, tall ? 6 : 5, "av-eye");
  };
  at.forEach((x, i) => {
    switch (look.eyes) {
      case "happy":
        closed(x, i);
        break;
      case "sleepy":
        c.set(x, 5, "av-skin-lo");
        c.set(x, 6, "av-eye");
        if (!side) c.set(i === 0 ? x - 1 : x + 1, 6, "av-eye");
        break;
      case "sparkly": {
        // Big eyes with a glint.
        const x0 = side ? x - 1 : i === 0 ? x - 1 : x;
        c.block(x0, x0 + 1, 5, 6, "av-eye");
        c.set(x0, reading ? 6 : 5, "av-eye-hi");
        break;
      }
      case "lashes":
        open(x);
        c.set(side || i === 1 ? x + 1 : x - 1, 4, "av-eye");
        break;
      case "wink":
        if (i === (side ? 0 : 1)) closed(x, i);
        else open(x);
        break;
      default:
        open(x);
    }
  });
}

function mouth(c: Canvas, look: AvatarLook, view: View) {
  const side = view === "side";
  // The mouth's middle two dots from the front; from the side, the dots
  // towards the face's edge.
  const [a, b] = side ? [9, 10] : [6, 7];
  const corners: [number, number][] = side
    ? [[8, 7]]
    : [
        [5, 7],
        [8, 7],
      ];
  switch (look.mouth) {
    case "small":
      c.run(a, b, 8, "av-mouth");
      break;
    case "grin":
      c.run(a, b, 8, "av-teeth");
      c.dots(
        side
          ? [[8, 8]]
          : [
              [5, 8],
              [8, 8],
            ],
        "av-mouth",
      );
      c.dots(corners, "av-mouth");
      break;
    case "open":
      c.block(a, b, 8, 9, "av-mouth-in");
      break;
    case "tongue":
      c.run(a, b, 8, "av-mouth");
      c.dots(corners, "av-mouth");
      c.set(b, 9, "av-tongue");
      break;
    default:
      c.run(a, b, 8, "av-mouth");
      c.dots(corners, "av-mouth");
  }
}

function facialHair(c: Canvas, look: AvatarLook, view: View, pose: Pose) {
  const side = view === "side";
  const h = "av-hair";
  const [a, b] = side ? [9, 10] : [6, 7];
  switch (look.facialHair) {
    case "none":
      return;
    case "stubble":
      for (let y = 7; y <= 9; y++) {
        for (let x = 3; x <= 10; x++) {
          if (y === 7 && x > 3 && x < 10) continue;
          const p = c.get(x, y);
          if (p === "av-skin" || p === "av-skin-lo" || p === "av-blush" || p === "av-freckle")
            c.set(x, y, "av-stubble");
        }
      }
      return;
    case "moustache":
      c.run(side ? 8 : 5, side ? 10 : 8, 7, h);
      c.set(side ? 8 : 5, 8, h);
      if (!side) c.set(8, 8, h);
      return;
    case "goatee":
      c.run(side ? 8 : 5, side ? 10 : 8, 7, h);
      c.run(side ? 8 : 5, side ? 10 : 8, 9, h);
      c.run(side ? 8 : 6, side ? 9 : 7, 10, "av-hair-lo");
      return;
    default: {
      // Sideburns into a full beard, a moustache over the mouth.
      c.block(3, 3, 3, 7, h);
      c.block(10, 10, 3, 7, "av-hair-lo");
      c.run(3, 10, 8, h);
      c.run(3, 10, 9, h);
      c.run(4, 9, 10, h);
      c.run(5, 8, 11, "av-hair-lo");
      c.run(side ? 8 : 5, side ? 10 : 8, 7, "av-hair-hi");
      c.run(a, b, 8, "av-mouth");
      if (side) c.block(4, 5, 7, 7, h);
      if (look.facialHair === "longbeard") {
        // Down over the chest, tapering, a little shorter sitting down.
        const end = pose === "sit" ? 14 : 18;
        for (let y = 11; y <= end; y++) {
          const t = Math.floor((y - 11) / 3);
          c.run(4 + t, 9 - t, y, h);
          c.set(4 + t, y, "av-hair-hi");
        }
        c.run(6, 7, end + 1, "av-hair-lo");
      }
    }
  }
}

// ── Hair ─────────────────────────────────────────────────────────────────

/** Hair behind the head and body (long hair, an afro, pigtails), drawn
 *  first so the face and clothes show in front of it. */
function hairBack(c: Canvas, look: AvatarLook, view: View) {
  const h = "av-hair";
  const lo = "av-hair-lo";
  const hi = "av-hair-hi";
  const side = view === "side";
  // From the side, long hair falls down the back; from the front, both
  // sides frame the face.
  const curtain = (bottom: number, wavy = false) => {
    const [x0, x1] = side ? [1, 8] : [1, 12];
    c.block(x0, x1, 0, bottom, h);
    for (let y = 2; y <= bottom; y++) {
      // Waves push the edges in and out every other pair of rows.
      const out = wavy && Math.floor(y / 2) % 2 === 0;
      if (out) {
        c.set(x0, y, null);
        if (!side) c.set(x1, y, null);
      }
      c.set(out ? x0 + 1 : x0, y, hi);
      if (!side) c.set(out ? x1 - 1 : x1, y, lo);
    }
    c.run(x0, x1, bottom, lo);
  };
  switch (look.hair) {
    case "bob":
      curtain(10);
      break;
    case "long":
      curtain(side ? 16 : 15);
      break;
    case "wavy":
      curtain(side ? 15 : 14, true);
      break;
    case "locs": {
      const [x0, x1] = side ? [1, 8] : [1, 12];
      c.block(x0, x1, 0, 14, h);
      for (let x = x0; x <= x1; x += 2) c.block(x, x, 3, 14, lo);
      for (let x = x0 + 1; x <= x1; x += 4) c.set(x, 15, h);
      break;
    }
    case "afro": {
      const cx = side ? 5.5 : 6.5;
      for (let y = -4; y <= 9; y++) {
        for (let x = 0; x <= 13; x++) {
          const dx = (x - cx) / 6.6;
          const dy = (y - 2.5) / 6.9;
          if (dx * dx + dy * dy <= 1) c.set(x, y, h);
        }
      }
      for (const [x, y] of [
        [3, -2],
        [8, -3],
        [1, 3],
        [12, 2],
        [5, 8],
        [2, 7],
        [10, -1],
      ] as const) {
        if (c.get(x, y) === h) c.set(x, y, lo);
      }
      for (const [x, y] of [
        [4, -3],
        [2, 0],
        [6, -2],
      ] as const)
        if (c.get(x, y) === h) c.set(x, y, hi);
      break;
    }
    case "curly":
      c.block(1, 2, 4, 8, h);
      c.set(2, 9, h);
      if (!side) {
        c.block(11, 12, 4, 8, h);
        c.set(11, 9, h);
      }
      c.dots(
        [
          [1, 6],
          [2, 8],
        ],
        lo,
      );
      if (!side)
        c.dots(
          [
            [12, 5],
            [11, 8],
          ],
          lo,
        );
      break;
    case "pigtails": {
      const tails = side ? [0] : [0, 12];
      for (const x of tails) {
        c.block(x, x + 1, 4, 11, h);
        c.set(x, 12, lo);
        c.set(x + 1, 12, lo);
        c.run(x, x + 1, 4, "av-accent");
        c.block(x, x, 5, 10, x === 0 ? hi : lo);
      }
      break;
    }
    case "ponytail":
      if (side) {
        c.block(0, 1, 3, 10, h);
        c.dots(
          [
            [1, 11],
            [0, 11],
          ],
          lo,
        );
        c.block(0, 0, 3, 7, hi);
      }
      break;
    default:
  }
}

/** Hair over the head: the crown, a fringe, buns and braids. */
function hairFront(c: Canvas, look: AvatarLook, view: View) {
  const h = "av-hair";
  const hi = "av-hair-hi";
  const lo = "av-hair-lo";
  const side = view === "side";
  const cap = () => {
    c.run(4, 9, -1, h);
    c.run(3, 10, 0, h);
    c.block(2, 11, 1, 2, h);
    c.run(4, 6, 0, hi);
    c.run(3, 4, 1, hi);
    c.set(11, 2, lo);
  };
  // A fringe across the forehead: swept forward from the side; from the
  // front, parted to show the forehead.
  const fringe = (back: number) => {
    if (side) {
      c.run(2, 9, 3, h);
      c.block(2, 3, 4, back, h);
      c.set(10, 3, lo);
    } else {
      c.run(2, 5, 3, h);
      c.run(8, 11, 3, h);
      c.block(2, 2, 4, back, h);
      c.block(11, 11, 4, back, lo);
    }
  };
  switch (look.hair) {
    case "bald":
      c.run(4, 5, 2, "av-skin-hi");
      c.set(4, 3, "av-skin-hi");
      return;
    case "buzz":
      c.run(4, 9, 0, "av-buzz");
      c.block(3, 10, 1, 2, "av-buzz");
      c.dots(
        side
          ? [
              [3, 3],
              [3, 4],
            ]
          : [
              [3, 3],
              [10, 3],
            ],
        "av-buzz",
      );
      c.run(4, 5, 1, "av-skin");
      return;
    case "short":
      cap();
      fringe(5);
      return;
    case "swept":
      cap();
      fringe(5);
      // A quiff swept up at the front.
      c.dots(
        side
          ? [
              [8, -2],
              [9, -2],
              [10, -1],
              [11, 0],
              [11, 1],
            ]
          : [
              [6, -2],
              [7, -2],
              [8, -2],
              [9, -1],
            ],
        h,
      );
      c.dots(
        side
          ? [
              [9, -1],
              [8, -1],
            ]
          : [
              [7, -1],
              [8, -1],
            ],
        hi,
      );
      if (!side) c.run(5, 7, 4, h);
      return;
    case "spiky":
      for (const x of [3, 5, 7, 9]) c.run(x, x + 1, -2, h);
      for (const x of [3, 7]) c.set(x + 1, -3, h);
      cap();
      fringe(4);
      if (!side) c.run(5, 8, 3, "av-skin");
      for (const x of [4, 8]) c.set(x, -3, hi);
      return;
    case "mohawk":
      c.run(4, 9, 0, "av-buzz");
      c.block(3, 10, 1, 2, "av-buzz");
      c.dots(
        side
          ? [
              [3, 3],
              [3, 4],
            ]
          : [
              [3, 3],
              [10, 3],
            ],
        "av-buzz",
      );
      if (side) {
        c.block(3, 10, -2, 0, h);
        for (const x of [4, 6, 8, 10]) c.block(x, x, -4, -3, h);
        c.dots(
          [
            [5, -3],
            [7, -3],
            [9, -3],
          ],
          h,
        );
        c.run(4, 9, -2, hi);
      } else {
        c.block(6, 7, -5, 1, h);
        c.block(6, 6, -5, 1, hi);
      }
      return;
    case "curly": {
      for (const x of [4, 7, 10]) c.run(x - 1, x, -2, h);
      c.block(2, 11, -1, 2, h);
      c.block(1, 12, 0, 3, h);
      if (side) c.run(3, 8, 3, h);
      else {
        c.run(3, 4, 3, h);
        c.run(9, 10, 3, h);
      }
      c.dots(
        [
          [3, -2],
          [6, -1],
          [9, 0],
          [5, 1],
          [2, 3],
          [11, 1],
        ],
        lo,
      );
      c.dots(
        [
          [4, -1],
          [3, 0],
          [8, -1],
          [1, 2],
        ],
        hi,
      );
      return;
    }
    case "afro":
      // A low hairline under all that.
      c.block(3, 10, 1, 2, h);
      c.dots(
        [
          [3, 3],
          [10, 3],
        ],
        h,
      );
      c.dots(
        [
          [5, 1],
          [8, 2],
        ],
        lo,
      );
      return;
    case "bob":
      cap();
      if (side) fringe(4);
      else {
        // A straight fringe right across.
        c.run(2, 11, 3, h);
        c.run(3, 10, 3, h);
        c.set(6, 3, lo);
      }
      return;
    case "long":
    case "wavy":
      cap();
      fringe(4);
      return;
    case "locs":
      cap();
      fringe(4);
      for (let x = 3; x <= 10; x += 2) c.set(x, 2, lo);
      return;
    case "bun": {
      cap();
      fringe(5);
      // Up at the back from the side, on top from the front.
      const bx = side ? 2 : 5;
      c.run(bx + 1, bx + 2, -4, h);
      c.block(bx, bx + 3, -3, -2, h);
      c.set(bx + 1, -3, hi);
      c.run(bx + 1, bx + 2, -1, "av-accent");
      return;
    }
    case "spacebuns":
      cap();
      fringe(5);
      for (const bx of side ? [2, 7] : [1, 9]) {
        c.run(bx + 1, bx + 2, -3, h);
        c.block(bx, bx + 3, -2, -1, h);
        c.set(bx + 1, -2, hi);
      }
      return;
    case "ponytail":
      cap();
      fringe(5);
      if (side) c.set(1, 2, "av-accent");
      else {
        // Behind the head; only the band and a little hair show.
        c.set(12, 3, "av-accent");
        c.block(12, 12, 4, 8, lo);
      }
      return;
    case "pigtails":
      cap();
      fringe(4);
      return;
    case "braids": {
      cap();
      fringe(4);
      // Plaits over the shoulders, tied at the ends.
      for (const x of side ? [1] : [2, 10]) {
        for (let y = 3; y <= 15; y++) {
          c.run(x, x + 1, y, h);
          c.set(x + (y % 2), y, lo);
        }
        c.run(x, x + 1, 16, "av-accent");
        c.set(x, 17, h);
      }
      return;
    }
  }
}

// ── Glasses, hats, headphones, earrings ─────────────────────────────────

function glasses(c: Canvas, look: AvatarLook, view: View, reading: boolean) {
  const side = view === "side";
  const at = side ? [7, 10] : [5, 8];
  if (look.accessories.includes("sunglasses")) {
    for (const x of at) {
      c.block(x - (side ? 1 : x === 5 ? 1 : 0), x + (side ? 0 : x === 5 ? 0 : 1), 5, 6, "av-shades");
      c.set(x - (side ? 1 : x === 5 ? 1 : 0), 5, "av-shades-hi");
    }
    c.run(side ? 3 : 6, side ? 5 : 7, 5, "av-shades");
    return;
  }
  if (!look.accessories.includes("glasses")) return;
  const y = reading ? 6 : 5;
  for (const x of at) {
    c.run(x - 1, x + 1, y - 1, "av-frame");
    c.set(x - 1, y, "av-frame");
    if (x + 1 <= (side ? 11 : 10)) c.set(x + 1, y, "av-frame");
    c.run(x - 1, x + 1, y + 1, "av-frame");
    c.set(x, y + 1, "av-lens");
  }
  if (side) c.run(3, 5, y, "av-frame");
}

function hat(c: Canvas, look: AvatarLook, view: View) {
  const side = view === "side";
  // Hair that would poke through the top of a hat is tucked under it.
  const tuck = (above: number) => {
    for (let y = -HEADROOM; y < above; y++) c.run(-1, FIGURE_W, y, null);
  };
  switch (look.hat) {
    case "none":
      return;
    case "beanie":
      tuck(-1);
      c.run(4, 9, -3, "av-accent-lo");
      c.block(3, 10, -2, 0, "av-accent-lo");
      c.run(4, 6, -2, "av-accent");
      c.block(2, 11, 1, 2, "av-accent");
      for (let x = 3; x <= 11; x += 2) c.block(x, x, 1, 2, "av-accent-hi");
      c.block(6, 7, -5, -4, "av-pom");
      return;
    case "baseball":
      tuck(-1);
      c.run(4, 9, -2, "av-accent");
      c.block(3, 10, -1, 1, "av-accent");
      c.run(4, 6, -1, "av-accent-hi");
      c.dots(
        [
          [6, -3],
          [7, -3],
        ],
        "av-accent-lo",
      );
      if (side) c.run(8, 13, 2, "av-accent-lo");
      else c.run(2, 11, 2, "av-accent-lo");
      return;
    case "cap":
      tuck(-1);
      c.run(4, 9, -2, "av-cap");
      c.block(3, 10, -1, 0, "av-cap");
      c.run(2, 11, 1, "av-cap");
      c.run(4, 6, -1, "av-cap-hi");
      c.set(6, -2, "av-cap-lo");
      if (side) c.run(7, 13, 2, "av-cap-lo");
      else c.run(2, 11, 2, "av-cap-lo");
      return;
    case "beret":
      tuck(-1);
      if (side) {
        c.run(3, 10, -2, "av-accent");
        c.run(1, 11, -1, "av-accent");
        c.run(1, 10, 0, "av-accent-lo");
        c.dots([[1, 1]], "av-accent-lo");
      } else {
        c.run(3, 11, -2, "av-accent");
        c.run(2, 12, -1, "av-accent");
        c.run(2, 11, 0, "av-accent-lo");
      }
      c.set(7, -3, "av-accent-lo");
      c.run(4, 6, -2, "av-accent-hi");
      return;
    case "tophat":
      tuck(0);
      c.block(3, 10, -9, -1, "av-tophat");
      c.block(3, 3, -9, -1, "av-tophat-hi");
      c.run(3, 10, -3, "av-accent");
      c.run(1, 12, 0, "av-tophat");
      return;
    case "wizard": {
      tuck(-1);
      // A tall cone, its tip flopping forward, with stars on it.
      const rows: [number, number][] = [
        [7, 8],
        [6, 8],
        [6, 8],
        [6, 8],
        [5, 8],
        [5, 9],
        [5, 9],
        [4, 9],
        [4, 9],
        [4, 10],
        [3, 10],
        [3, 10],
      ];
      rows.forEach(([a, b], i) => {
        c.run(a, b, -13 + i, "av-accent");
        c.set(a, -13 + i, "av-accent-hi");
        c.set(b, -13 + i, "av-accent-lo");
      });
      c.run(9, 10, -13, "av-accent");
      c.set(11, -12, "av-accent-lo");
      c.run(1, 12, 0, "av-accent");
      c.run(0, 13, 1, "av-accent-lo");
      c.run(3, 10, -1, "brass");
      c.dots(
        [
          [7, -8],
          [8, -5],
        ],
        "brass-hi",
      );
      c.set(6, -4, "brass");
      return;
    }
    case "witch": {
      tuck(-1);
      // A black cone bent back, a wide brim and a buckled band.
      const rows: [number, number][] = [
        [3, 4],
        [4, 5],
        [4, 6],
        [5, 7],
        [5, 8],
        [5, 8],
        [4, 9],
        [4, 9],
        [4, 10],
        [3, 10],
        [3, 10],
      ];
      rows.forEach(([a, b], i) => c.run(a, b, -12 + i, "av-witch"));
      rows.forEach(([a], i) => c.set(a, -12 + i, "av-witch-hi"));
      c.dots(
        [
          [2, -12],
          [1, -11],
        ],
        "av-witch",
      );
      c.run(3, 10, -2, "av-accent");
      c.set(6, -2, "brass-hi");
      c.run(0, 13, 0, "av-witch");
      c.run(1, 12, 1, "av-witch-hi");
      return;
    }
    case "crown":
      tuck(-2);
      c.run(3, 10, -1, "brass");
      c.run(3, 10, 0, "brass");
      c.run(3, 10, 1, "brass-lo");
      for (const x of [3, 6, 7, 10]) c.set(x, -2, "brass");
      for (const x of [3, 6, 7, 10]) c.set(x, -3, "brass-hi");
      c.set(5, 0, "av-gem");
      c.set(8, 0, "av-accent");
      return;
    case "tiara":
      c.run(3, 10, 0, "av-silver");
      c.dots(
        [
          [5, -1],
          [8, -1],
          [6, -2],
          [7, -2],
        ],
        "av-silver",
      );
      c.dots(
        [
          [6, -1],
          [7, -1],
        ],
        "av-accent",
      );
      c.set(6, -3, "av-silver-hi");
      return;
    case "flower": {
      const fx = side ? 4 : 10;
      c.dots(
        [
          [fx, 0],
          [fx - 1, 1],
          [fx + 1, 1],
          [fx, 2],
        ],
        "av-accent",
      );
      c.set(fx, 1, "brass-hi");
      c.set(fx + 1, 2, "leaf");
      return;
    }
    case "bow": {
      // A big bow at the top of the head, to the back from the side.
      const bx = side ? 2 : 8;
      c.block(bx, bx + 1, -2, 0, "av-accent");
      c.block(bx + 3, bx + 4, -2, 0, "av-accent");
      c.set(bx + 2, -1, "av-accent-lo");
      c.dots(
        [
          [bx, -2],
          [bx + 4, -2],
        ],
        "av-accent-hi",
      );
      return;
    }
    case "headband":
      c.run(2, side ? 10 : 11, 1, "av-accent");
      c.run(3, 10, 0, "av-accent-hi");
      if (side)
        c.dots(
          [
            [1, 1],
            [1, 2],
          ],
          "av-accent-lo",
        );
      return;
    case "catears":
      // Two triangles, pointing out from the front.
      for (const [x, d] of side
        ? ([
            [3, 1],
            [7, 1],
          ] as const)
        : ([
            [2, 1],
            [11, -1],
          ] as const)) {
        c.dots(
          [
            [x, -3],
            [x, -2],
            [x + d, -2],
            [x, -1],
            [x + d, -1],
            [x + 2 * d, -1],
          ],
          "av-hair",
        );
        c.set(x + d, -1, "av-ear-in");
      }
      return;
    case "bunnyears":
      // From the side, the far ear flops forward.
      for (const [x, flop] of [
        [4, false],
        [8, side],
      ] as const) {
        if (flop) {
          c.block(x, x + 1, -5, -1, "av-bunny");
          c.dots(
            [
              [x + 2, -6],
              [x + 3, -6],
              [x + 4, -5],
              [x + 2, -5],
              [x + 3, -5],
            ],
            "av-bunny",
          );
          c.set(x + 1, -3, "av-ear-in");
        } else {
          c.block(x, x + 1, -9, -1, "av-bunny");
          c.block(x + 1, x + 1, -8, -2, "av-ear-in");
        }
      }
      return;
    case "horns":
      // Stubby horns curling outwards.
      // The left one is drawn from its base at x; the right one is the
      // same horn flipped, its base ending at `r`.
      for (const [x, r] of side ? ([[4, 10]] as const) : ([[3, 10]] as const)) {
        const horn = (f: (dx: number) => number) => {
          c.run(f(0), f(2), -1, "av-horn-lo");
          c.run(f(0), f(1), -2, "av-horn");
          c.run(f(-1), f(0), -3, "av-horn");
          c.set(f(-1), -4, "av-horn");
        };
        horn((dx) => x + dx);
        horn((dx) => r - dx);
      }
      return;
    case "halo":
      // A gold ring seen edge on, floating well clear of the hair.
      c.run(4, 9, -8, "av-halo");
      c.run(3, 10, -7, "av-halo-lo");
      c.run(5, 8, -8, "av-halo-hi");
      return;
  }
}

function headphones(c: Canvas, look: AvatarLook, view: View) {
  if (!look.accessories.includes("headphones")) return;
  if (view === "side") {
    c.dots(
      [
        [4, -2],
        [5, -2],
        [6, -2],
        [7, -2],
        [3, -1],
        [3, 0],
        [3, 1],
        [3, 2],
      ],
      "av-phones",
    );
    c.block(3, 5, 4, 7, "av-accent");
    c.block(3, 3, 4, 7, "av-accent-lo");
    c.dots(
      [
        [3, 3],
        [4, 3],
      ],
      "av-phones",
    );
  } else {
    c.run(4, 9, -2, "av-phones");
    c.dots(
      [
        [3, -1],
        [10, -1],
        [2, 0],
        [11, 0],
        [2, 1],
        [11, 1],
        [2, 2],
        [11, 2],
        [2, 3],
        [11, 3],
      ],
      "av-phones",
    );
    both(c, 1, 2, 4, 7, "av-accent", "av-accent-lo");
  }
}

function earrings(c: Canvas, look: AvatarLook, view: View) {
  if (!look.accessories.includes("earrings")) return;
  if (view === "side") c.set(4, 8, "brass-hi");
  else
    c.dots(
      [
        [2, 7],
        [11, 7],
      ],
      "brass-hi",
    );
}

/** The open book held in front, in its spine colour, and the thumbs on
 *  it. */
function heldBook(c: Canvas) {
  const rows = [".yyyy.yyyy.", "yyyyyYyyyyy", "21111111112"];
  const paints: Record<string, Paint> = { y: "paper", Y: "paper-lo", "1": "book", "2": "book-lo" };
  rows.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      if (paints[ch]) c.set(1 + dx, 15 + dy, paints[ch]);
    }),
  );
  c.set(3, 16, "av-skin");
  c.set(9, 16, "av-skin-lo");
}

/** Where the held book is, in the seated figure's own dots: a link to the
 *  book is laid over it. */
export const HELD_BOOK = { x: 1 + PAD, y: 15 + HEADROOM, w: 11, h: 3 };

// ── Poses ────────────────────────────────────────────────────────────────

export interface AvatarArt {
  /** Standing still, facing right. */
  stand: Art;
  /** Mid-stride; walking swaps it with `stand`. */
  stride: Art;
  /** In the armchair with the book. */
  sit: Art;
}

export type AvatarPose = Pose;

/** The seated figure's top left, from the armchair's top left: in the
 *  seat, between the arms, its feet on the floor. */
export const SEAT_OFFSET = { x: 8 - PAD, y: -2 - HEADROOM };

/** Where figure dot 0, 0 (the top left of the head) is in the sprite, for
 *  showing just part of the figure. */
export const FIGURE_ORIGIN = { x: PAD, y: HEADROOM };

export function avatarPose(look: AvatarLook, pose: Pose): Art {
  const sit = pose === "sit";
  const view: View = sit ? "front" : "side";
  const c = new Canvas(sit ? 33 : 38);
  behind(c, look, pose);
  hairBack(c, look, view);
  if (sit) {
    seatedLegs(c, look);
    top(c, look, view, pose);
    bib(c, look, view, pose);
    seatedArms(c, look);
  } else {
    standingLegs(c, look, pose === "stride");
    standingShoes(c, look, pose === "stride");
    top(c, look, view, pose);
    bib(c, look, view, pose);
    standingArms(c, look, pose === "stride");
  }
  neck(c, look, view, pose);
  face(c, look, view, sit);
  facialHair(c, look, view, pose);
  hairFront(c, look, view);
  glasses(c, look, view, sit);
  earrings(c, look, view);
  if (sit) heldBook(c);
  hat(c, look, view);
  headphones(c, look, view);
  return c.toArt();
}

export function avatarArt(look: AvatarLook): AvatarArt {
  return { stand: avatarPose(look, "stand"), stride: avatarPose(look, "stride"), sit: avatarPose(look, "sit") };
}
