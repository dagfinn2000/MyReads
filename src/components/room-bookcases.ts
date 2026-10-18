/**
 * The bookcases' designs (Decorate › House › Bookcases, lib/room-
 * styles.ts). Every one keeps the shelves where the classic bookcase has
 * them (lib/room.ts: CASE_CROWN, SHELF_SLOT, SHELF_BOARD), so the spines
 * stand on the boards whichever is chosen. A design may rise above the
 * case (`rise` dots, a pediment or pinnacles, into the space under the
 * ceiling) and may have a `front` drawn over the books: the glazed doors.
 */
import type { RoomBookcase, RoomOrnaments } from "@/lib/room-styles";
import {
  CASE_CROWN,
  CASE_HEIGHT,
  CASE_WIDTH,
  ORNAMENT_WIDTH,
  SHELF_BOARD,
  SHELF_SLOT,
  SHELVES_PER_CASE,
  dressShelf,
} from "@/lib/room";
import { BOOKEND, ORNAMENT_ART, bookcaseArt, type Art, type Rect } from "@/components/room-art";

export interface BookcaseDesign {
  /** CASE_WIDTH × (CASE_HEIGHT + rise); the case itself starts `rise`
   *  dots down. */
  art: Art;
  rise: number;
  /** Drawn over the books, as tall as the case. */
  front: Art | null;
}

const W = CASE_WIDTH;
const slotTop = (j: number) => CASE_CROWN + j * (SHELF_SLOT + SHELF_BOARD);

const shift = (rects: readonly Rect[], dx: number, dy: number): Rect[] =>
  rects.map(([x, y, w, h, p]): Rect => [x + dx, y + dy, w, h, p]);
const lift = (rects: readonly Rect[], dy: number) => shift(rects, 0, dy);

/** Open shelves: boards between slim uprights on little feet, with no
 *  back, so the wallpaper shows behind the books. */
function open(): BookcaseDesign {
  const R: Rect[] = [];
  const board = (y: number) => {
    R.push([0, y, 46, 1, "wood-hi"], [0, y + 1, 46, 1, "wood"], [0, y + 2, 46, 1, "wood-lo"]);
    // Its shadow on the wall below.
    if (y < 117) R.push([2, y + 3, 42, 1, "case-shadow"], [2, y + 4, 42, 1, "wall-shadow"]);
  };
  R.push([0, 2, 2, 120, "wood"], [0, 2, 1, 120, "wood-hi"], [44, 2, 2, 120, "wood"], [45, 2, 1, 120, "wood-lo"]);
  board(2);
  for (let j = 0; j < SHELVES_PER_CASE; j++) board(slotTop(j) + SHELF_SLOT);
  R.push([1, 122, 3, 3, "wood-deep"], [42, 122, 3, 3, "wood-deep"], [1, 122, 1, 3, "wood-lo"], [44, 122, 1, 3, "wood-lo"]);
  return { art: { w: W, h: CASE_HEIGHT, rects: R }, rise: 0, front: null };
}

/** The classic case under a pediment: a triangle with a brass medallion
 *  in its sunk panel, finials at its three points. */
function pediment(): BookcaseDesign {
  const rise = 9;
  const R: Rect[] = [];
  for (let y = 1; y < rise; y++) {
    const half = Math.round((y / (rise - 1)) * 21);
    const x0 = 23 - half;
    const x1 = 23 + half;
    R.push([x0, y, x1 - x0, 1, y === rise - 1 ? "wood-lo" : "wood"]);
    R.push([x0, y, 2, 1, "wood-hi"], [x1 - 2, y, 2, 1, "wood-deep"]);
  }
  // The sunk panel, with a medallion in the middle.
  for (let y = 4; y < rise - 1; y++) {
    const half = Math.round(((y - 3) / (rise - 4)) * 13);
    R.push([23 - half, y, 2 * half, 1, "wood-lo"]);
  }
  R.push([21, 4, 4, 1, "brass-lo"], [20, 5, 6, 2, "brass"], [21, 5, 2, 1, "brass-hi"], [21, 7, 4, 1, "brass-lo"]);
  // Finials: an urn at the top, a ball at each corner.
  R.push([22, 0, 2, 1, "brass-hi"], [21, 1, 4, 1, "brass"], [22, 2, 2, 1, "brass-lo"]);
  R.push([0, rise - 3, 3, 3, "brass"], [0, rise - 3, 1, 1, "brass-hi"], [43, rise - 3, 3, 3, "brass"], [43, rise - 3, 1, 1, "brass-hi"]);
  R.push(...lift(bookcaseArt().rects, rise));
  return { art: { w: W, h: CASE_HEIGHT + rise, rects: R }, rise, front: null };
}

/** How wide a Gothic gable is, row by row from its point down: tall and
 *  steep, over the middle of the crown. */
const GABLE = [1, 2, 4, 5, 7, 8, 10, 11];

/** A Gothic case: a steep gable knobbed with crockets and pierced by a
 *  lancet, a cresting along the crown, pinnacles at the corners and
 *  buttressed sides. */
function gothic(): BookcaseDesign {
  const rise = 11;
  const R: Rect[] = [];
  // The cresting: a rail along the crown with a row of points.
  R.push([4, rise - 2, 38, 1, "wood-hi"], [4, rise - 1, 38, 1, "wood"]);
  for (let x = 5; x < 41; x += 3) R.push([x, rise - 3, 1, 1, "wood"]);
  const top = rise - GABLE.length;
  GABLE.forEach((half, i) => {
    const y = top + i;
    const x0 = 23 - half;
    const x1 = 23 + half;
    R.push([x0, y, x1 - x0, 1, "wood"], [x0, y, 1, 1, "wood-hi"], [x1 - 1, y, 1, 1, "wood-deep"]);
    if (i % 2 === 1 && i < GABLE.length - 2) R.push([x0 - 1, y, 1, 1, "wood-hi"], [x1, y, 1, 1, "wood-lo"]);
  });
  // A finial on the point, and a lancet window below it.
  R.push([22, 0, 2, 1, "wood-hi"], [21, 1, 4, 1, "wood"], [21, 1, 1, 1, "wood-hi"], [22, 2, 2, 1, "wood-lo"]);
  R.push([22, top + 3, 2, 1, "wood-deep"], [21, top + 4, 4, 4, "wood-deep"], [22, top + 4, 2, 4, "case-back"]);
  // Pinnacles at the corners, a little spire on each.
  for (const px of [0, 42]) {
    R.push([px + 1, 0, 2, 1, "wood-hi"], [px + 1, 1, 2, 2, "wood"], [px, 3, 4, rise - 3, "wood"]);
    R.push([px, 3, 1, rise - 3, "wood-hi"], [px + 3, 3, 1, rise - 3, "wood-deep"], [px + 1, 5, 2, 1, "wood-deep"]);
  }
  R.push(...lift(bookcaseArt().rects, rise));
  // Buttresses down the sides, set off at each shelf.
  for (const px of [0, 43]) {
    for (let j = 0; j < SHELVES_PER_CASE; j++) {
      const y = rise + slotTop(j) + SHELF_SLOT;
      R.push([px, y, 3, 1, "wood-hi"], [px, y + 1, 3, 1, "wood-deep"]);
    }
  }
  return { art: { w: W, h: CASE_HEIGHT + rise, rects: R }, rise, front: null };
}

/** A barrister's case: the classic one with a glass door over each
 *  shelf, which lifts up to take a book. The door's top rail runs in the
 *  space over the books, its brass pull on the board below, and its glass
 *  catches the light. */
function glazed(): BookcaseDesign {
  const F: Rect[] = [];
  for (let j = 0; j < SHELVES_PER_CASE; j++) {
    const top = slotTop(j);
    F.push([3, top, 40, 1, "wood-lo"], [3, top + 1, 40, 1, "wood-deep"]);
    F.push([3, top + 2, 40, SHELF_SLOT - 2, "pane-tint"]);
    // A broad streak of light across the glass and a thin one beside
    // it, a different place on each shelf.
    const sx = 6 + ((j * 13) % 20);
    for (let k = 0; k < 6; k++) F.push([sx + k, top + 14 - k, 2, 1, "glass-shine"]);
    for (let k = 0; k < 3; k++) F.push([sx + 5 + k, top + 13 - k, 1, 1, "glass-shine"]);
    F.push([21, top + SHELF_SLOT + 1, 4, 1, "brass"], [22, top + SHELF_SLOT + 1, 2, 1, "brass-hi"]);
  }
  return { art: bookcaseArt(), rise: 0, front: { w: W, h: CASE_HEIGHT, rects: F } };
}

export const BOOKCASES: Record<RoomBookcase, BookcaseDesign> = {
  classic: { art: bookcaseArt(), rise: 0, front: null },
  open: open(),
  pediment: pediment(),
  gothic: gothic(),
  glazed: glazed(),
};

const SPINE_PAINTS = ["spine-a", "chair", "rug-2", "spine-b", "curtain", "wood-lo", "chair-lo"] as const;

/** Books for a picture of a bookcase: about `widths[j]` dots of them on
 *  shelf j, and how wide they came to. */
export function sampleSpines(widths: readonly number[]): { rects: Rect[]; used: number[] } {
  const rects: Rect[] = [];
  const used: number[] = [];
  let n = 0;
  widths.forEach((width, j) => {
    const bottom = slotTop(j) + SHELF_SLOT;
    let x = 3;
    for (; x < 3 + width; n++) {
      const w = 3 + ((n * 7) % 3);
      const h = 13 + ((n * 5) % 6);
      rects.push([x, bottom - h, w, h, SPINE_PAINTS[(n * 3 + j) % SPINE_PAINTS.length]]);
      x += w;
    }
    used.push(x - 3);
  });
  return { rects, used };
}

/** The top of a bookcase for Decorate's tiles: its crown and the first
 *  shelves, `widths[j]` dots of books on each and its ornaments beside
 *  them. */
export function bookcaseSample(design: RoomBookcase, ornaments: RoomOrnaments, widths: readonly number[]): Art {
  const { art, rise, front } = BOOKCASES[design];
  const books = sampleSpines(widths);
  const R: Rect[] = [...art.rects, ...lift(books.rects, rise)];
  widths.forEach((_, j) => {
    const used = books.used[j];
    const bottom = rise + slotTop(j) + SHELF_SLOT;
    const dressing = dressShelf(j, used, ornaments);
    if (dressing.bookend) R.push(...shift(BOOKEND.rects, 3 + used, bottom - BOOKEND.h));
    for (const o of dressing.ornaments) {
      const a = ORNAMENT_ART[o.kind];
      R.push(...shift(a.rects, 3 + o.x + Math.floor((ORNAMENT_WIDTH[o.kind] - a.w) / 2), bottom - a.h));
    }
  });
  if (front) R.push(...lift(front.rects, rise));
  const h = rise + slotTop(widths.length);
  const cut = R.filter(([, y]) => y < h).map(([x, y, w, rh, p]): Rect => [x, y, w, Math.min(rh, h - y), p]);
  return { w: W, h, rects: cut };
}
