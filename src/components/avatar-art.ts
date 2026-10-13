/**
 * The reader's avatar in the reading room, drawn in code like the rest of
 * the room (room-art.tsx): rectangles naming paints, coloured in
 * reading-room.css from the --av-* colours the avatar's element sets from
 * its look (lib/avatar.ts).
 *
 * A figure is painted dot by dot, then every empty dot touching it gets a
 * dark outline, so it reads against any wall. Standing and walking, it is
 * seen three-quarters on, facing right (CSS mirrors it to face left); in
 * the armchair it faces the room, reading.
 *
 * Figure dots are counted from the top of the head (row 0), so a hat or
 * hair can reach above it into the headroom.
 */
import type { Art, Paint, Rect } from "@/components/room-art";
import type { AvatarLook } from "@/lib/avatar";

/** Rows over the head for a hat, and a dot each side for the outline. */
const HEADROOM = 14;
const PAD = 1;
const FIGURE_W = 14;
export const AVATAR_W = FIGURE_W + 2 * PAD;

type View = "side" | "front";

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
  run(x0: number, x1: number, y: number, paint: Paint | null) {
    for (let x = x0; x <= x1; x++) this.set(x, y, paint);
  }
  block(x0: number, x1: number, y0: number, y1: number, paint: Paint | null) {
    for (let y = y0; y <= y1; y++) this.run(x0, x1, y, paint);
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
    c.set(4, 5, "av-skin-lo");
    c.set(4, 6, "av-skin-lo");
  }
  const eyes = side ? [7, 10] : [5, 8];
  const glasses = look.extras.includes("glasses");
  for (const x of eyes) {
    if (reading) c.set(x, 6, "av-eye");
    else c.block(x, x, 5, glasses ? 5 : 6, "av-eye");
  }
  c.run(side ? 9 : 6, side ? 9 : 7, 8, "av-mouth");
  const cheeks = side ? [6, 10] : [4, 9];
  if (look.extras.includes("freckles")) {
    for (const x of cheeks) c.set(x, 7, "av-freckle");
    c.set(cheeks[0] + 1, 8, "av-freckle");
    if (!side) c.set(cheeks[1] - 1, 8, "av-freckle");
  } else {
    for (const x of cheeks) c.set(x, 7, "av-blush");
  }
  if (look.extras.includes("beard")) {
    // Sideburns into a full beard, and a moustache over the mouth.
    c.block(3, 3, 3, 7, "av-hair");
    c.block(10, 10, 3, 7, "av-hair-lo");
    c.run(3, 10, 8, "av-hair");
    c.run(3, 10, 9, "av-hair");
    c.run(4, 9, 10, "av-hair");
    c.run(5, 8, 11, "av-hair-lo");
    c.run(side ? 8 : 5, side ? 10 : 8, 7, "av-hair-hi");
    c.run(side ? 9 : 6, side ? 9 : 7, 8, "av-mouth");
    if (side) c.block(4, 5, 7, 7, "av-hair");
  }
  if (glasses) {
    const y = reading ? 6 : 5;
    for (const x of eyes) {
      c.run(x - 1, x + 1, y - 1, "av-frame");
      c.set(x - 1, y, "av-frame");
      if (x + 1 <= (side ? 11 : 10)) c.set(x + 1, y, "av-frame");
      c.run(x - 1, x + 1, y + 1, "av-frame");
      c.set(x, y + 1, "av-lens");
    }
    if (side) c.run(3, 5, y, "av-frame");
  }
}

function hair(c: Canvas, look: AvatarLook, view: View) {
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
  // A fringe across the forehead: swept to the front from the side; from
  // the front, parted to show the forehead.
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
    case "short":
      cap();
      fringe(5);
      return;
    case "spiky":
      for (const x of [3, 5, 7, 9]) c.run(x, x + 1, -2, h);
      for (const x of [3, 7]) c.set(x + 1, -3, h);
      cap();
      fringe(4);
      if (!side) c.run(5, 8, 3, "av-skin");
      for (const x of [4, 8]) c.set(x, -3, hi);
      return;
    case "bob":
      cap();
      fringe(4);
      c.block(1, 3, 4, 9, h);
      c.block(1, 1, 4, 9, hi);
      if (!side) c.block(10, 12, 4, 9, h);
      c.run(side ? 1 : 10, side ? 3 : 12, 10, lo);
      return;
    case "long":
      cap();
      fringe(4);
      c.block(1, 3, 3, side ? 15 : 14, h);
      c.block(1, 1, 4, 13, hi);
      c.run(1, 3, side ? 16 : 15, lo);
      if (!side) {
        c.block(10, 12, 3, 14, h);
        c.run(10, 12, 15, lo);
      }
      return;
    case "bun": {
      cap();
      fringe(5);
      // Up at the back from the side, on top from the front.
      const bx = side ? 2 : 5;
      c.run(bx + 1, bx + 2, -4, h);
      c.block(bx, bx + 3, -3, -2, h);
      c.set(bx + 1, -3, hi);
      c.run(bx + 1, bx + 2, -1, "av-tie");
      return;
    }
    case "ponytail":
      cap();
      fringe(5);
      if (side) {
        c.set(1, 2, "av-tie");
        c.block(0, 1, 3, 10, h);
        c.set(1, 11, lo);
        c.set(0, 11, lo);
        c.block(0, 0, 3, 7, hi);
      } else {
        // Behind the head; only the band and a little hair show.
        c.set(12, 3, "av-tie");
        c.block(12, 12, 4, 8, lo);
      }
      return;
    case "curly": {
      for (const x of [4, 7, 10]) c.run(x - 1, x, -2, h);
      c.block(2, 11, -1, 2, h);
      c.block(1, 12, 0, 3, h);
      c.block(1, 2, 4, 8, h);
      c.set(2, 9, h);
      if (side) c.run(3, 8, 3, h);
      else {
        c.run(3, 4, 3, h);
        c.run(9, 10, 3, h);
        c.block(11, 12, 4, 8, h);
        c.set(11, 9, h);
      }
      for (const [x, y] of [[3, -2], [6, -1], [9, 0], [5, 1], [2, 3], [1, 6], [11, 1], [12, 5]]) c.set(x, y, lo);
      for (const [x, y] of [[4, -1], [3, 0], [8, -1], [1, 2], [2, 5]]) c.set(x, y, hi);
      return;
    }
  }
}

function hat(c: Canvas, look: AvatarLook, view: View) {
  const side = view === "side";
  // Hair that would poke through the top of a hat is tucked under it.
  if (look.hat === "beanie" || look.hat === "cap" || look.hat === "wizard") {
    for (let y = -HEADROOM; y < -1; y++) c.run(-1, FIGURE_W, y, null);
  }
  switch (look.hat) {
    case "none":
      return;
    case "beanie":
      c.run(4, 9, -3, "av-top-lo");
      c.block(3, 10, -2, 0, "av-top-lo");
      c.run(4, 6, -2, "av-top");
      c.block(2, 11, 1, 2, "av-top");
      for (let x = 3; x <= 11; x += 2) c.block(x, x, 1, 2, "av-top-hi");
      c.run(6, 7, -5, "av-pom");
      c.run(6, 7, -4, "av-pom");
      return;
    case "cap":
      c.run(4, 9, -2, "av-cap");
      c.block(3, 10, -1, 0, "av-cap");
      c.run(2, 11, 1, "av-cap");
      c.run(4, 6, -1, "av-cap-hi");
      c.set(6, -2, "av-cap-lo");
      if (side) c.run(7, 13, 2, "av-cap-lo");
      else c.run(2, 11, 2, "av-cap-lo");
      return;
    case "crown":
      c.run(3, 10, 0, "brass");
      c.run(3, 10, 1, "brass-lo");
      c.run(3, 10, -1, "brass");
      for (const x of [3, 6, 7, 10]) c.set(x, -2, "brass");
      for (const x of [3, 6, 7, 10]) c.set(x, -3, "brass-hi");
      c.set(5, 0, "av-gem");
      c.set(8, 0, "av-gem-blue");
      return;
    case "flower": {
      const fx = side ? 4 : 10;
      c.set(fx, 0, "flower");
      c.set(fx - 1, 1, "flower");
      c.set(fx + 1, 1, "flower");
      c.set(fx, 2, "flower");
      c.set(fx, 1, "brass-hi");
      c.set(fx + 1, 2, "leaf");
      return;
    }
    case "wizard": {
      // A tall cone, its tip flopping forward, with stars on it.
      const rows: [number, number][] = [
        [7, 8], [6, 8], [6, 8], [6, 8], [5, 8], [5, 9], [5, 9], [4, 9], [4, 9], [4, 10], [3, 10], [3, 10],
      ];
      rows.forEach(([a, b], i) => {
        c.run(a, b, -13 + i, "av-wizard");
        c.set(a, -13 + i, "av-wizard-hi");
        c.set(b, -13 + i, "av-wizard-lo");
      });
      c.run(9, 10, -13, "av-wizard");
      c.set(11, -12, "av-wizard-lo");
      c.run(1, 12, 0, "av-wizard");
      c.run(0, 13, 1, "av-wizard-lo");
      c.run(3, 10, -1, "av-wizard-band");
      c.set(7, -8, "brass-hi");
      c.set(6, -4, "brass");
      c.set(8, -5, "brass-hi");
      return;
    }
  }
}

// ── Bodies ───────────────────────────────────────────────────────────────

/** A jumper, lit from the left, from the neck to `hem`. */
function jumper(c: Canvas, hem: number) {
  c.run(6, 7, 10, "av-skin-lo");
  c.run(4, 9, 11, "av-top");
  c.block(3, 10, 12, hem, "av-top");
  c.block(3, 3, 12, hem, "av-top-hi");
  c.block(10, 10, 12, hem, "av-top-lo");
  c.run(4, 9, 11, "av-top-hi");
  c.run(3, 10, hem, "av-top-lo");
}

function standing(c: Canvas, look: AvatarLook, stride: boolean) {
  jumper(c, 22);
  // Arms: the far one in shadow. Walking, they swing.
  if (stride) {
    c.block(2, 2, 12, 18, "av-top-lo");
    c.block(1, 1, 18, 19, "av-top-lo");
    c.block(1, 1, 20, 21, "av-skin-lo");
    c.block(11, 11, 12, 18, "av-top");
    c.block(12, 12, 18, 19, "av-top");
    c.block(12, 12, 20, 21, "av-skin");
  } else {
    c.block(2, 2, 12, 20, "av-top-lo");
    c.block(11, 11, 12, 20, "av-top");
    c.block(2, 2, 21, 22, "av-skin-lo");
    c.block(11, 11, 21, 22, "av-skin");
  }

  const skirt = look.bottom === "skirt";
  let legsFrom: number;
  if (skirt) {
    c.block(3, 10, 23, 24, "av-legs");
    c.block(2, 11, 25, 27, "av-legs");
    c.block(1, 12, 28, 29, "av-legs");
    c.run(1, 12, 29, "av-legs-lo");
    c.run(3, 10, 23, "av-legs-lo");
    c.block(2, 2, 25, 27, "av-legs-hi");
    c.block(1, 1, 28, 28, "av-legs-hi");
    for (const x of [5, 8]) c.block(x, x, 26, 28, "av-legs-lo");
    legsFrom = 30;
  } else {
    c.block(3, 10, 23, 26, "av-legs");
    c.run(3, 10, 23, "av-legs-lo");
    c.block(3, 3, 24, 26, "av-legs-hi");
    legsFrom = 27;
  }
  // Two legs, the far one darker; bare legs are thinner than trousers.
  const leg = skirt ? "av-skin" : "av-legs";
  const legLo = skirt ? "av-skin-lo" : "av-legs-lo";
  const thick = skirt ? 1 : 2;
  if (stride) {
    // The near leg forward and the far leg back.
    c.block(8, 8 + thick, legsFrom, 30, leg);
    c.block(9, 9 + thick, 31, 34, leg);
    c.block(3, 3 + thick, legsFrom, 30, legLo);
    c.block(2, 2 + thick, 31, 34, legLo);
    c.block(9, 12, 35, 36, "av-shoe");
    c.block(2, 5, 35, 36, "av-shoe");
  } else {
    c.block(3, 3 + thick, legsFrom, 34, legLo);
    c.block(8, 8 + thick, legsFrom, 34, leg);
    c.block(3, 6, 35, 36, "av-shoe");
    c.block(8, 11, 35, 36, "av-shoe");
  }
  for (let x = 0; x < FIGURE_W; x++) if (c.get(x, 36)) c.set(x, 36, "av-shoe-lo");
}

/** In the armchair, facing the room, with the open book held in front. */
function seated(c: Canvas, look: AvatarLook) {
  jumper(c, 19);
  // Arms down the sides, then in to hold the book.
  c.block(2, 2, 12, 16, "av-top");
  c.block(11, 11, 12, 16, "av-top-lo");
  c.run(2, 3, 17, "av-top");
  c.run(10, 11, 17, "av-top-lo");
  // The lap, then shins down to the floor.
  const skirt = look.bottom === "skirt";
  c.block(2, 11, 20, 22, "av-legs");
  c.run(2, 11, 20, "av-legs-hi");
  c.run(2, 11, 22, "av-legs-lo");
  c.set(6, 21, "av-legs-lo");
  c.set(7, 21, "av-legs-lo");
  const shin = skirt ? "av-skin" : "av-legs";
  const shinLo = skirt ? "av-skin-lo" : "av-legs-lo";
  const [l0, l1, r0, r1] = skirt ? [4, 5, 8, 9] : [3, 5, 8, 10];
  c.block(l0, l1, 23, 29, shin);
  c.block(r0, r1, 23, 29, shin);
  c.block(r1, r1, 23, 29, shinLo);
  c.block(2, 5, 30, 31, "av-shoe");
  c.block(8, 11, 30, 31, "av-shoe");
  c.run(2, 5, 31, "av-shoe-lo");
  c.run(8, 11, 31, "av-shoe-lo");
}

/** Where the held book is, in the seated figure's own dots: a link to the
 *  book is laid over it. */
export const HELD_BOOK = { x: 1 + PAD, y: 15 + HEADROOM, w: 11, h: 3 };

function heldBook(c: Canvas) {
  const rows = [".yyyy.yyyy.", "yyyyyYyyyyy", "21111111112"];
  const paints: Record<string, Paint> = { y: "paper", Y: "paper-lo", "1": "book", "2": "book-lo" };
  rows.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      if (paints[ch]) c.set(1 + dx, 15 + dy, paints[ch]);
    }),
  );
  // Thumbs over the pages.
  c.set(3, 16, "av-skin");
  c.set(9, 16, "av-skin-lo");
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

/** The seated figure's top left, from the armchair's top left: in the
 *  seat, between the arms, its feet on the floor. */
export const SEAT_OFFSET = { x: 8 - PAD, y: -2 - HEADROOM };

export type AvatarPose = "stand" | "stride" | "sit";

/** Rows of a standing figure from the top of its sprite to its chin, and
 *  to its waist: for showing just the head or the top half. */
export const HEAD_ROWS = HEADROOM + 12;
export const WAIST_ROWS = HEADROOM + 24;

export function avatarPose(look: AvatarLook, pose: AvatarPose): Art {
  const sit = pose === "sit";
  const c = new Canvas(sit ? 33 : 38);
  const view: View = sit ? "front" : "side";
  if (sit) seated(c, look);
  else standing(c, look, pose === "stride");
  face(c, look, view, sit);
  hair(c, look, view);
  if (sit) heldBook(c);
  hat(c, look, view);
  return c.toArt();
}

export function avatarArt(look: AvatarLook): AvatarArt {
  return { stand: avatarPose(look, "stand"), stride: avatarPose(look, "stride"), sit: avatarPose(look, "sit") };
}
