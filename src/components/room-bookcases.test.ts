import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOKCASES, bookcaseSample } from "@/components/room-bookcases";
import { ORNAMENT_ART, bookcaseArt, type Art, type Rect } from "@/components/room-art";
import {
  CASE_CROWN,
  CASE_HEIGHT,
  CASE_WIDTH,
  ORNAMENT_WIDTH,
  ROOM_HEIGHT,
  SHELF_BOARD,
  SHELF_SLOT,
  SHELVES_PER_CASE,
  type Ornament,
} from "@/lib/room";
import { ROOM_BOOKCASES, ROOM_ORNAMENTS } from "@/lib/room-styles";

const css = readFileSync(new URL("./reading-room.css", import.meta.url), "utf8");

/** Every rectangle inside the art's box, in a paint the stylesheet has. */
function sound(a: Art) {
  for (const [x, y, w, h, paint] of a.rects) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(a.w);
    expect(y + h).toBeLessThanOrEqual(a.h);
    expect(css).toContain(`.rp-${paint} {`);
  }
}

const slotTop = (j: number) => CASE_CROWN + j * (SHELF_SLOT + SHELF_BOARD);
/** Whether a rectangle reaches into where shelf j's books stand, below
 *  the two rows they leave free. */
const overBooks = ([x, y, w, h]: Rect, j: number, rise = 0) =>
  x < 43 && x + w > 3 && y < rise + slotTop(j) + SHELF_SLOT && y + h > rise + slotTop(j) + 2;

describe("the bookcases' designs", () => {
  it.each(ROOM_BOOKCASES)("the %s bookcase is the classic one's size, plus what rises over it", (kind) => {
    const { art, rise, front } = BOOKCASES[kind];
    expect([art.w, art.h]).toEqual([CASE_WIDTH, CASE_HEIGHT + rise]);
    sound(art);
    // Clear of the ceiling, and its decorations' strings.
    expect(rise).toBeLessThanOrEqual(ROOM_HEIGHT - CASE_HEIGHT - 3);
    if (front) {
      expect([front.w, front.h]).toEqual([CASE_WIDTH, CASE_HEIGHT]);
      sound(front);
    }
  });

  it.each(ROOM_BOOKCASES)("the %s bookcase has its boards where the books stand, and nothing over them but glass", (kind) => {
    const { art, rise, front } = BOOKCASES[kind];
    for (let j = 0; j < SHELVES_PER_CASE; j++) {
      const board = rise + slotTop(j) + SHELF_SLOT;
      expect(art.rects.some(([x, y, w]) => y === board && x <= 3 && x + w >= 43)).toBe(true);
      for (const r of art.rects) if (overBooks(r, j, rise)) expect(r[4]).toMatch(/^(case|wall)-/);
      for (const r of front?.rects ?? []) if (overBooks(r, j)) expect(["pane-tint", "glass-shine"]).toContain(r[4]);
    }
  });

  it("keeps the house's own bookcase as the first", () => {
    expect(ROOM_BOOKCASES[0]).toBe("classic");
    expect(BOOKCASES.classic).toEqual({ art: bookcaseArt(), rise: 0, front: null });
  });

  it.each(ROOM_ORNAMENTS)("draws a sample with %s ornaments for each design", (how) => {
    for (const kind of ROOM_BOOKCASES) {
      const sample = bookcaseSample(kind, how, [34, 26]);
      sound(sample);
      expect(sample.h).toBe(BOOKCASES[kind].rise + slotTop(2));
    }
  });
});

describe("the ornaments", () => {
  it.each(Object.keys(ORNAMENT_ART) as Ornament[])("the %s fits its space on a shelf, under the shelf above", (kind) => {
    const a = ORNAMENT_ART[kind];
    sound(a);
    expect(a.w).toBeLessThanOrEqual(ORNAMENT_WIDTH[kind]);
    expect(a.h).toBeLessThanOrEqual(SHELF_SLOT - 4);
  });
});
