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
import { HAIR_HIDING_HATS, LONG_TOPS, type AvatarAccessory, type AvatarLook } from "@/lib/avatar";

/** Rows over the head for a hat, and a dot each side for the outline. */
const HEADROOM = 14;
const PAD = 1;
const FIGURE_W = 14;
export const AVATAR_W = FIGURE_W + 2 * PAD;

type View = "side" | "front";
type Pose = "stand" | "stride" | "sit";

class Canvas {
  private cells: (Paint | null)[][];
  /** How far down the figure is drawn: in a wheelchair, the upper body
   *  sits lower than it stands. */
  dy = 0;
  constructor(rows: number) {
    this.cells = Array.from({ length: HEADROOM + rows }, () => Array<Paint | null>(AVATAR_W).fill(null));
  }
  get h() {
    return this.cells.length;
  }
  set(x: number, y: number, paint: Paint | null) {
    const row = this.cells[y + this.dy + HEADROOM];
    if (row && x + PAD >= 0 && x + PAD < AVATAR_W) row[x + PAD] = paint;
  }
  get(x: number, y: number): Paint | null {
    return this.cells[y + this.dy + HEADROOM]?.[x + PAD] ?? null;
  }
  /** Makes the figure taller by drawing each of `rows` twice, or shorter
   *  by leaving them out: rows of legs or body that look the same a dot
   *  further down. */
  resize(rows: readonly number[], taller: boolean) {
    const at = new Set(rows.map((y) => y + HEADROOM));
    this.cells = this.cells.flatMap((row, i) => (!at.has(i) ? [row] : taller ? [row, [...row]] : []));
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

/** Paints a little grid of characters from `key`, its top left at x, y;
 *  `flip` mirrors it left to right. */
function paintGrid(
  c: Canvas,
  rows: readonly string[],
  x: number,
  y: number,
  key: Record<string, Paint>,
  flip = false,
) {
  rows.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      if (key[ch]) c.set(flip ? x + row.length - 1 - dx : x + dx, y + dy, key[ch]);
    }),
  );
}

const WING_KEY: Record<string, Paint> = { h: "av-wing-hi", w: "av-wing", l: "av-wing-lo" };

/** Fairy wings: from the side, an upper and a lower wing behind the back,
 *  flapping a little as they walk; from the front, peeping out either side
 *  over the armchair. */
function wings(c: Canvas, pose: Pose) {
  if (pose === "sit") {
    // Narrowing to the shoulders, so they stay clear of the chair's arms.
    const rows = ["h..", "wh.", "wwh", "lww", ".lw", "..l"];
    paintGrid(c, rows, 0, 8, WING_KEY);
    paintGrid(c, rows, 11, 8, WING_KEY, true);
    return;
  }
  const up = pose === "stride" ? -1 : 0;
  paintGrid(c, ["h..", "wh.", "wwh", "wwh", "lww", "lww", ".lw", "..w"], 0, 5 + up, WING_KEY);
  paintGrid(c, ["..w", ".lw", "lww", "lw.", "h.."], 0, 14 - up, WING_KEY);
}

function behind(c: Canvas, look: AvatarLook, pose: Pose) {
  const sit = pose === "sit";
  if (look.accessories.includes("wings")) wings(c, pose);
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

/** The arms, the far one in shadow. Walking, they swing, unless `steady`
 *  says which hand is carrying something. */
function standingArms(c: Canvas, look: AvatarLook, stride: boolean, steady: "near" | "far" | null = null) {
  const sl = sleeves(look);
  const still = { far: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], near: [11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11] };
  const swing = { far: [2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1], near: [11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12] };
  for (const [arm, lit] of [
    ["far", false],
    ["near", true],
  ] as const) {
    const swinging = stride && steady !== arm;
    const xs = (swinging ? swing : still)[arm];
    const rows = swinging ? 10 : 11; // a swinging arm looks shorter
    for (let i = 0; i < rows; i++) {
      const y = 12 + i;
      const x = xs[i];
      const hand = y >= 21 || (swinging && y >= 20);
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
    case "curtains":
      curtain(8);
      break;
    case "mullet":
      // Short on top, long at the back: down the neck from the side, and
      // either side of it from the front.
      if (side) {
        c.block(1, 3, 3, 13, h);
        c.block(1, 1, 4, 12, hi);
        c.run(1, 3, 13, lo);
        c.set(3, 13, null);
      } else {
        for (const x of [2, 11]) c.block(x, x, 5, 11, x === 2 ? hi : lo);
        c.block(3, 3, 10, 11, h);
        c.block(10, 10, 10, 11, h);
      }
      break;
    case "ringlets": {
      // Long spiral curls: each one a column of dots, light and dark in
      // turn, ending at its own length.
      const [x0, x1] = side ? [0, 8] : [1, 12];
      for (let x = x0; x <= x1; x++) {
        const end = 15 + (x % 2) + (x % 3 === 0 ? 1 : 0);
        for (let y = 0; y <= end; y++) c.set(x, y, (y + 2 * x) % 4 === 0 ? lo : (y + 2 * x) % 4 === 1 ? hi : h);
      }
      break;
    }
    case "cornrows":
      // The rows end in plaits down the back.
      if (side) {
        for (let y = 4; y <= 13; y++) {
          c.run(1, 2, y, h);
          c.set(1 + (y % 2), y, lo);
        }
        c.run(1, 2, 14, "av-accent");
      }
      break;
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
    case "pixie":
      // Cropped close, with a fringe swept across.
      cap();
      if (side) {
        c.run(2, 9, 3, h);
        c.set(2, 4, lo);
        c.set(9, 4, h);
        c.set(10, 3, hi);
      } else {
        c.run(2, 8, 3, h);
        c.run(2, 4, 4, h);
        c.set(2, 5, lo);
        c.set(11, 3, lo);
        c.run(5, 7, 3, hi);
      }
      return;
    case "curtains":
      // Parted in the middle, falling away either side.
      cap();
      c.dots(
        side
          ? [
              [6, -1],
              [6, 0],
            ]
          : [
              [6, -1],
              [6, 0],
              [7, 0],
            ],
        lo,
      );
      if (side) {
        c.run(2, 8, 3, h);
        c.block(2, 3, 4, 7, h);
        c.set(9, 3, lo);
      } else {
        for (const [a, b] of [
          [2, 5],
          [8, 11],
        ] as const) {
          c.run(a, b, 3, h);
        }
        c.run(2, 4, 4, h);
        c.run(9, 11, 4, lo);
        c.block(2, 2, 5, 8, h);
        c.block(11, 11, 5, 8, lo);
      }
      return;
    case "undercut": {
      // Shaved at the sides, the top grown long and swept over.
      const b = "av-buzz";
      if (side) {
        c.block(3, 10, 1, 2, b);
        c.dots(
          [
            [3, 3],
            [3, 4],
          ],
          b,
        );
        c.run(5, 10, -3, h);
        c.run(3, 11, -2, h);
        c.run(3, 11, -1, h);
        c.run(4, 11, 0, h);
        c.set(11, 1, h);
        c.set(12, 1, lo);
        c.run(5, 9, -2, hi);
      } else {
        c.block(3, 10, 1, 2, b);
        c.dots(
          [
            [3, 3],
            [10, 3],
          ],
          b,
        );
        c.run(4, 9, -2, h);
        c.run(3, 10, -1, h);
        c.run(3, 10, 0, h);
        c.run(2, 6, 1, h);
        c.run(2, 4, 2, h);
        c.set(2, 3, lo);
        c.run(5, 8, -2, hi);
        c.run(6, 9, 0, lo);
      }
      return;
    }
    case "mullet":
      cap();
      if (side) {
        c.run(2, 9, 3, h);
        c.block(2, 3, 4, 5, h);
      } else {
        c.run(2, 4, 3, h);
        c.run(9, 11, 3, h);
        c.set(5, 3, h);
        c.set(2, 4, h);
        c.set(11, 4, lo);
      }
      return;
    case "ringlets":
      cap();
      fringe(4);
      c.dots(
        [
          [4, 0],
          [7, -1],
          [9, 0],
          [5, 1],
          [10, 2],
        ],
        lo,
      );
      if (!side)
        c.dots(
          [
            [3, 4],
            [10, 4],
          ],
          h,
        );
      return;
    case "cornrows":
      // Close to the head, in rows from the hairline back.
      c.run(4, 9, 0, h);
      c.block(3, 10, 1, 2, h);
      if (side) {
        c.dots(
          [
            [3, 3],
            [3, 4],
          ],
          h,
        );
        c.run(4, 10, 1, lo);
        c.run(5, 9, -1, h);
        c.set(10, 0, lo);
      } else {
        c.dots(
          [
            [3, 3],
            [10, 3],
          ],
          h,
        );
        // Three plaits, braided down their length.
        c.run(5, 8, -1, h);
        for (const x of [5, 8]) c.block(x, x, -1, 2, lo);
        c.dots(
          [
            [4, 1],
            [6, 0],
            [7, 1],
            [6, 2],
            [9, 1],
          ],
          hi,
        );
      }
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
    case "headscarf": {
      // Over the head and ears, close round the face, and down over the
      // shoulders.
      const [a, b, hi, lo] = ["av-accent", "av-accent", "av-accent-hi", "av-accent-lo"];
      c.run(4, 9, -2, a);
      c.run(3, 10, -1, a);
      c.block(2, 11, 0, 2, a);
      c.run(4, 6, -1, hi);
      c.run(3, 4, 0, hi);
      if (side) {
        c.block(2, 5, 3, 9, a);
        c.set(6, 3, a);
        c.block(2, 2, 3, 9, hi);
        c.run(4, 10, 10, a);
        c.block(2, 9, 11, 13, b);
        c.run(2, 3, 10, a);
        c.block(2, 2, 10, 13, hi);
        c.run(3, 9, 14, lo);
        c.block(5, 5, 4, 9, lo);
        c.set(11, 2, lo);
      } else {
        c.block(2, 2, 3, 9, hi);
        c.block(11, 11, 3, 9, lo);
        c.dots(
          [
            [3, 3],
            [10, 3],
          ],
          a,
        );
        c.run(2, 11, 10, a);
        c.block(1, 12, 11, 13, b);
        c.block(1, 1, 11, 13, hi);
        c.block(12, 12, 11, 13, lo);
        c.run(2, 11, 14, lo);
        c.dots(
          [
            [3, 10],
            [10, 10],
            [4, 12],
            [4, 13],
            [9, 12],
            [9, 13],
          ],
          lo,
        );
      }
      return;
    }
    case "turban": {
      // Wound round and round: folds slanting across it.
      const a = "av-accent";
      const rows: [number, number][] = side
        ? [
            [4, 7],
            [3, 9],
            [2, 10],
            [2, 11],
            [2, 11],
            [2, 11],
            [2, 10],
          ]
        : [
            [5, 8],
            [4, 9],
            [3, 10],
            [2, 11],
            [2, 11],
            [2, 11],
            [3, 10],
          ];
      rows.forEach(([x0, x1], i) => c.run(x0, x1, -5 + i, a));
      for (let k = 0; k < 4; k++) {
        const x = (side ? 3 : 2) + 3 * k;
        c.dots(
          [
            [x, 1],
            [x + 1, 0],
            [x + 2, -1],
            [x + 3, -2],
          ].filter(([fx, fy]) => c.get(fx, fy) === a) as [number, number][],
          "av-accent-lo",
        );
      }
      c.run(side ? 4 : 5, side ? 6 : 8, -4, "av-accent-hi");
      c.set(rows[3][0], -2, "av-accent-hi");
      if (side) c.block(2, 3, 2, 3, a);
      return;
    }
    case "headwrap": {
      // Tall and full, tied at the front, in a print of dots.
      const a = "av-accent";
      const lean = side ? -1 : 0;
      c.block(2, side ? 10 : 11, 0, 2, a);
      c.run(3, side ? 9 : 10, -1, a);
      for (let y = -6; y <= -2; y++) c.run(2 + lean, (side ? 10 : 11) + lean, y, a);
      c.run(4 + lean, 9 + lean, -7, a);
      for (let y = -7; y <= 2; y++) {
        for (let x = 1; x <= 12; x++) if (c.get(x, y) === a && (x + 2 * y) % 4 === 0) c.set(x, y, "av-accent-hi");
      }
      c.run(2 + lean, (side ? 10 : 11) + lean, -1, "av-accent-lo");
      c.run(2, side ? 10 : 11, 2, "av-accent-lo");
      // The knot.
      const k = side ? 8 : 6;
      c.run(k - 1, k + 2, -8, "av-accent-lo");
      c.run(k, k + 1, -9, "av-accent");
      c.run(k, k + 1, -8, "av-accent");
      return;
    }
    case "kippah": {
      // A small round cap on the crown, over whatever hair is there.
      const cx = side ? 4 : 5;
      // From the top of the head (row 1) up through the hair.
      let top = 1;
      while (top > -HEADROOM && (c.get(cx + 1, top - 1) || c.get(cx + 2, top - 1))) top--;
      c.run(cx + 1, cx + 2, top - 1, "av-accent");
      c.run(cx, cx + 3, top, "av-accent");
      c.set(cx + 1, top - 1, "av-accent-hi");
      return;
    }
    case "sunhat":
      tuck(-1);
      c.run(4, 9, -4, "av-straw");
      c.block(3, 10, -3, -2, "av-straw");
      c.run(4, 6, -4, "av-straw-hi");
      c.run(3, 10, -1, "av-accent");
      c.run(1, 12, 0, "av-straw-hi");
      c.run(0, 13, 1, "av-straw");
      c.dots(
        [
          [0, 2],
          [13, 2],
        ],
        "av-straw-lo",
      );
      c.run(2, 11, 1, "av-straw-lo");
      if (!side) c.set(9, -1, "av-accent-hi");
      return;
    case "pirate":
      // A tricorn, its brim turned up and edged in gold.
      tuck(-1);
      c.block(4, 9, -5, -2, "av-tophat");
      c.run(5, 8, -6, "av-tophat");
      c.run(0, 13, -1, "av-tophat");
      c.run(1, 12, 0, "brass");
      for (const [x0, x1] of [
        [0, 2],
        [11, 13],
      ] as const)
        c.run(x0, x1, -2, "av-tophat");
      c.dots(
        [
          [0, -3],
          [13, -3],
        ],
        "brass",
      );
      c.dots(
        [
          [0, -2],
          [13, -2],
          [1, -2],
          [12, -2],
        ],
        "av-tophat-hi",
      );
      c.dots(
        [
          [6, -4],
          [7, -4],
          [6, -3],
        ],
        "av-pom",
      );
      c.set(7, -3, "av-pom");
      c.set(4, -5, "av-tophat-hi");
      return;
    case "viking": {
      // A round iron cap with a nose guard, and horns.
      tuck(-1);
      const m = "av-silver";
      c.run(5, 8, -3, m);
      c.run(4, 9, -2, m);
      c.run(3, 10, -1, m);
      c.block(2, 11, 0, 1, m);
      c.run(4, 6, -2, "av-silver-hi");
      c.run(3, 4, -1, "av-silver-hi");
      c.run(2, 11, 2, "brass");
      for (const x of [3, 6, 9]) c.set(x, 2, "brass-hi");
      if (side) {
        c.block(10, 10, 3, 4, m);
        c.dots(
          [
            [2, 0],
            [1, -1],
            [1, -2],
            [0, -3],
            [0, -4],
            [11, 0],
            [12, -1],
            [12, -2],
            [13, -3],
            [13, -4],
          ],
          "av-horn",
        );
        c.dots(
          [
            [2, -1],
            [1, -3],
            [11, -1],
            [12, -3],
          ],
          "av-horn-lo",
        );
      } else {
        c.block(6, 7, 3, 4, m);
        for (const [x, d] of [
          [1, -1],
          [12, 1],
        ] as const) {
          c.dots(
            [
              [x, 0],
              [x, -1],
              [x + d, -1],
              [x + d, -2],
              [x + d, -3],
              [x, -4],
            ],
            "av-horn",
          );
          c.set(x + d, -1, "av-horn-lo");
        }
      }
      return;
    }
    case "chef":
      tuck(-2);
      c.run(4, 9, -9, "av-chef");
      c.block(2, 11, -8, -4, "av-chef");
      c.run(3, 10, -3, "av-chef");
      for (const x of [5, 8]) c.block(x, x, -7, -3, "av-chef-lo");
      c.block(2, 2, -8, -4, "av-chef-hi");
      c.run(3, 10, -2, "av-chef");
      c.block(3, 10, -1, 0, "av-chef");
      c.run(3, 10, 1, "av-chef-lo");
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

/** Pointed ears, an elf's, poking out through the hair. */
function ears(c: Canvas, look: AvatarLook, view: View) {
  if (look.ears !== "pointy" || look.hat === "headscarf") return;
  if (view === "side") {
    c.dots(
      [
        [4, 4],
        [3, 4],
        [3, 5],
      ],
      "av-skin",
    );
    c.dots(
      [
        [2, 3],
        [4, 5],
        [4, 6],
      ],
      "av-skin-lo",
    );
  } else {
    c.dots(
      [
        [2, 4],
        [2, 5],
        [2, 6],
        [1, 3],
      ],
      "av-skin",
    );
    c.dots(
      [
        [11, 4],
        [11, 5],
        [11, 6],
        [12, 3],
      ],
      "av-skin-lo",
    );
  }
}

/** An eye patch, a monocle, hearing aids. */
function faceExtras(c: Canvas, look: AvatarLook, view: View) {
  const side = view === "side";
  const has = (a: AvatarAccessory) => look.accessories.includes(a);
  if (has("eyepatch")) {
    // Over the near eye (the viewer's right from the front), its strap
    // slanting up round the head.
    const x = side ? 7 : 8;
    c.block(x - 1, x + 1, 5, 6, "av-patch");
    c.set(x, 4, "av-patch");
    c.dots(
      side
        ? [
            [5, 4],
            [4, 3],
            [3, 3],
          ]
        : [
            [10, 4],
            [11, 3],
            [6, 4],
            [5, 3],
            [4, 3],
            [3, 2],
          ],
      "av-patch",
    );
  }
  if (has("monocle")) {
    const x = side ? 10 : 5;
    // A round ring of brass about the eye, and its chain.
    const ring: [number, number][] = [
      [x, 4],
      [x - 1, 5],
      [x - 1, 6],
      [x + 1, 5],
      [x + 1, 6],
      [x, 7],
    ];
    c.dots(
      ring.filter(([rx]) => rx <= (side ? 11 : 10)),
      "brass",
    );
    c.dots(
      side
        ? [
            [9, 8],
            [9, 9],
            [9, 10],
          ]
        : [
            [4, 8],
            [4, 9],
            [4, 10],
          ],
      "brass-lo",
    );
  }
  if (has("hearingaids")) {
    c.dots(
      side
        ? [
            [3, 5],
            [3, 6],
            [4, 4],
          ]
        : [
            [2, 4],
            [2, 5],
            [11, 4],
            [11, 5],
          ],
      "av-accent",
    );
    c.set(side ? 3 : 2, side ? 4 : 3, "av-accent-hi");
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

// ── Carried things, a walking stick, a wheelchair ───────────────────────

/**
 * What they carry, held in the hand whose lowest dot is `hx`, `hy`, out
 * the way `dir` points (1 to the right, -1 to the left).
 */
function held(c: Canvas, look: AvatarLook, hx: number, hy: number, dir: 1 | -1) {
  const at = (dx: number) => hx + dir * dx;
  const put = (pts: readonly (readonly [number, number])[], paint: Paint) =>
    c.dots(
      pts.map(([dx, dy]) => [at(dx), hy + dy] as const),
      paint,
    );
  switch (look.held) {
    case "mug":
      put(
        [
          [1, -1],
          [2, -1],
          [1, 0],
          [2, 0],
        ],
        "av-accent",
      );
      put(
        [
          [1, -2],
          [2, -2],
        ],
        "av-accent-hi",
      );
      put([[2, 0]], "av-accent-lo");
      return;
    case "book":
      // Carried by its top edge, hanging at the side.
      put(
        [
          [0, 1],
          [1, 1],
          [0, 2],
          [0, 3],
          [0, 4],
          [1, 4],
        ],
        "av-accent",
      );
      put(
        [
          [1, 2],
          [1, 3],
        ],
        "paper",
      );
      return;
    case "lantern":
      put([[1, 1]], "av-iron");
      put(
        [
          [0, 2],
          [1, 2],
          [2, 2],
          [0, 3],
          [2, 3],
          [0, 4],
          [2, 4],
          [0, 5],
          [1, 5],
          [2, 5],
        ],
        "av-iron",
      );
      put([[1, 3]], "av-lamp-hi");
      put([[1, 4]], "av-lamp");
      return;
    case "wand":
      put(
        [
          [1, -1],
          [1, -2],
        ],
        "av-wand",
      );
      put([[2, -3]], "av-wand");
      put([[2, -4]], "av-spark");
      put(
        [
          [1, -4],
          [2, -5],
        ],
        "av-spark-lo",
      );
      return;
    case "teddy":
      // Held by a paw, dangling.
      put(
        [
          [0, 1],
          [1, 1],
          [-1, 2],
          [0, 2],
          [1, 2],
          [2, 2],
          [0, 3],
          [1, 3],
          [-1, 4],
          [0, 4],
          [1, 4],
          [2, 4],
          [-1, 5],
          [2, 5],
        ],
        "av-teddy",
      );
      put(
        [
          [-1, 1],
          [2, 1],
          [0, 5],
          [1, 5],
        ],
        "av-teddy-lo",
      );
      put([[0, 2]], "av-line");
      put([[1, 3]], "av-teddy-hi");
      return;
    case "sunflower":
      put(
        [
          [1, -1],
          [1, -2],
          [1, -3],
        ],
        "leaf",
      );
      put([[2, -2]], "leaf-hi");
      put(
        [
          [1, -6],
          [0, -5],
          [2, -5],
          [1, -4],
          [0, -6],
          [2, -4],
        ],
        "av-petal",
      );
      put([[1, -5]], "av-seed");
      return;
  }
}

/** A walking stick in the near hand, its crook under the hand. */
function walkingStick(c: Canvas, stride: boolean) {
  if (stride) {
    c.dots(
      [
        [12, 19],
        [13, 19],
      ],
      "av-stick",
    );
    c.block(13, 13, 20, 36, "av-stick");
    c.set(13, 36, "av-stick-lo");
  } else {
    c.dots(
      [
        [11, 20],
        [12, 20],
      ],
      "av-stick",
    );
    c.block(12, 12, 21, 36, "av-stick");
    c.set(12, 36, "av-stick-lo");
  }
}

/** How far down the upper body sits in a wheelchair. */
const CHAIR_DROP = 7;

/**
 * Seated in a wheelchair, seen from the side: the chair's back behind
 * them, their lap and shins, the big wheel in front with a hand on its
 * rim, and a little wheel at the front. `rolling` is the second frame,
 * the spokes turned and the hand pushing on.
 */
function wheelchair(c: Canvas, look: AvatarLook, rolling: boolean) {
  const long = LONG_TOPS.includes(look.top);
  const b = look.bottom;
  // The back and handles, behind them.
  c.block(1, 1, 17, 30, "av-rim-lo");
  c.dots(
    [
      [0, 17],
      [1, 17],
    ],
    "av-tyre",
  );
  c.block(2, 2, 19, 29, "av-seat");

  c.dy = CHAIR_DROP;
  behind(c, { ...look, accessories: look.accessories.filter((a) => a === "wings") }, "stand");
  if (look.accessories.includes("cape")) {
    c.block(2, 3, 11, 19, "av-accent");
    c.block(2, 2, 11, 19, "av-accent-lo");
  }
  if (!HAIR_HIDING_HATS.includes(look.hat)) hairBack(c, look, "side");
  top(c, look, "side", "sit");
  bib(c, look, "side", "sit");
  // The lap, from the hips forward, then the shins down to the footrest.
  const lap = long ? "av-top" : "av-bottom";
  c.block(4, 11, 20, 22, lap);
  c.run(4, 11, 20, `${lap}-hi`);
  c.run(4, 11, 22, `${lap}-lo`);
  const covered = look.top === "robe" ? "av-top" : !long && b === "longskirt" ? "av-bottom" : null;
  const trousers = !long && (b === "trousers" || b === "jeans" || b === "dungarees");
  if (covered) {
    c.block(9, 12, 23, 25, covered);
    c.block(12, 12, 23, 25, `${covered}-lo`);
    c.run(9, 12, 25, `${covered}-lo`);
  } else {
    c.block(10, 11, 23, 25, trousers ? "av-bottom" : "av-skin");
    c.block(11, 11, 23, 25, trousers ? "av-bottom-lo" : "av-skin-lo");
    if (look.top === "dress" || (!long && b === "skirt")) c.run(9, 12, 23, long ? "av-top-lo" : "av-bottom-lo");
  }
  // Shoes on the footrest.
  const shoe: Record<string, [Paint, Paint]> = {
    boots: ["av-boot", "av-shoe-lo"],
    wellies: ["av-welly", "av-welly-lo"],
    trainers: ["av-accent", "av-sole"],
    slippers: ["av-slipper", "av-slipper-lo"],
    sandals: ["av-skin", "av-strap"],
  };
  const [upper, sole] = shoe[look.shoes] ?? ["av-shoe", "av-shoe-lo"];
  c.run(10, 13, 26, upper);
  c.run(10, 13, 27, sole);
  c.dy = 0;

  // The seat's edge, the footrest and the little front wheel.
  c.run(3, 11, 30, "av-rim-lo");
  c.block(9, 9, 31, 34, "av-rim-lo");
  c.run(9, 13, 35, "av-rim");
  c.run(11, 12, 36, "av-tyre");
  // The big wheel: tyre, rim, spokes and hub.
  const cx = 5;
  const cy = 31;
  for (let y = cy - 6; y <= cy + 6; y++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 4.6 && d <= 5.7) c.set(x, y, "av-tyre");
      else if (d > 3.7 && d <= 4.6) c.set(x, y, y < cy ? "av-rim-hi" : "av-rim");
    }
  }
  const turn = rolling ? Math.PI / 8 : 0;
  for (let k = 0; k < 4; k++) {
    const a = turn + (k * Math.PI) / 4;
    for (let r = -3; r <= 3; r++) {
      if (r === 0) continue;
      c.set(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), "av-rim-lo");
    }
  }
  c.set(cx, cy, "av-rim-hi");

  // The near arm, its hand on the rim: pushing, it reaches further on.
  c.dy = CHAIR_DROP;
  const sl = sleeves(look);
  const reach = rolling ? 1 : 0;
  for (let y = 12; y <= 19; y++) {
    const x = y < 16 ? 6 : 7 + (y >= 18 ? reach : 0);
    const sleeve = y <= Math.min(sl.to - 2, 17);
    c.set(x, y, sleeve ? sl.paint : "av-skin");
    if (y < 16 && sleeve) c.set(x + 1, y, sl.lo);
  }
  c.set(7 + reach, 19, "av-skin-lo");
  if (look.top === "stripes") c.recolour(6, 8, 13, 13, ["av-top", "av-top-lo"], "av-stripe");
  // Anything carried rests on the lap.
  held(c, look, 8, 19, 1);
}

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

/** How far in from the armchair's left the seated figure's sprite starts:
 *  in the seat, between the arms. seatedTop says how far down. */
export const SEAT_OFFSET = { x: 8 - PAD };

/** Where figure dot 0, 0 (the top left of the head) is in the sprite, for
 *  showing just part of the figure. */
export const FIGURE_ORIGIN = { x: PAD, y: HEADROOM };

/** The rows drawn twice for a tall figure, or left out for a short one:
 *  hips and shins standing, shins in the armchair, the middle of the body
 *  in a wheelchair. */
const HEIGHT_ROWS = { stand: [26, 32], sit: [25, 27], wheel: [20, 22] } as const;

export function avatarPose(look: AvatarLook, pose: Pose): Art {
  const sit = pose === "sit";
  const stride = pose === "stride";
  const wheel = !sit && look.mobility === "wheelchair";
  const view: View = sit ? "front" : "side";
  const hairless = HAIR_HIDING_HATS.includes(look.hat);
  const c = new Canvas(sit ? 33 : 38);
  if (wheel) {
    wheelchair(c, look, stride);
  } else {
    behind(c, look, pose);
    if (!hairless) hairBack(c, look, view);
    if (sit) {
      seatedLegs(c, look);
      top(c, look, view, pose);
      bib(c, look, view, pose);
      seatedArms(c, look);
    } else {
      standingLegs(c, look, stride);
      standingShoes(c, look, stride);
      top(c, look, view, pose);
      bib(c, look, view, pose);
      const stick = look.mobility === "stick";
      const carrying = look.held !== "nothing";
      // With a stick in the near hand, the far one carries things.
      standingArms(c, look, stride, carrying ? (stick ? "far" : "near") : null);
      if (stick) walkingStick(c, stride);
      if (stick) held(c, look, 2, 22, -1);
      else held(c, look, 11, 22, 1);
    }
  }
  neck(c, look, view, wheel ? "stand" : pose);
  face(c, look, view, sit);
  ears(c, look, view);
  facialHair(c, look, view, pose);
  if (!hairless) hairFront(c, look, view);
  glasses(c, look, view, sit);
  faceExtras(c, look, view);
  earrings(c, look, view);
  if (sit) heldBook(c);
  hat(c, look, view);
  headphones(c, look, view);
  c.dy = 0;
  if (look.height !== "medium") {
    c.resize(HEIGHT_ROWS[sit ? "sit" : wheel ? "wheel" : "stand"], look.height === "tall");
  }
  return c.toArt();
}

/** The armchair's height (room-art.tsx), which the seated figure's feet
 *  reach the bottom of. */
const ARMCHAIR_H = 31;

/** How far below the armchair's top the seated figure's sprite starts
 *  (above it, so negative): its feet are on the floor whatever its
 *  height. */
export const seatedTop = (sit: Art) => ARMCHAIR_H - sit.h;

export function avatarArt(look: AvatarLook): AvatarArt {
  return { stand: avatarPose(look, "stand"), stride: avatarPose(look, "stride"), sit: avatarPose(look, "sit") };
}
