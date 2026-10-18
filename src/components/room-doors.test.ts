import { describe, expect, it } from "vitest";
import type { Rect } from "@/components/room-art";
import { DOOR_H, DOOR_REACH, doorArt, doorFor } from "@/components/room-doors";
import { PARTITION } from "@/lib/room";
import { ROOM_STYLES } from "@/lib/room-styles";

/** Every dot the rectangles cover, as "x,y". */
const dots = (rects: readonly Rect[]) =>
  new Set(rects.flatMap(([x, y, w, h]) => Array.from({ length: w * h }, (_, k) => `${x + (k % w)},${y + Math.floor(k / w)}`)));

describe("doors between rooms", () => {
  it.each(ROOM_STYLES)("draws %s's door inside the wall, standing on the floor", (style) => {
    const door = doorArt(style);
    for (const rects of [door.hole, door.shut, door.open, door.frame]) {
      expect(rects.length).toBeGreaterThan(0);
      for (const [x, y, w, h] of rects) {
        expect([x, y, w, h].every(Number.isInteger)).toBe(true);
        expect(w > 0 && h > 0).toBe(true);
        expect(x >= -DOOR_REACH && x + w <= PARTITION + DOOR_REACH).toBe(true);
        expect(y >= 0 && y + h <= DOOR_H).toBe(true);
      }
    }
    // The doorway reaches the floor and is tall enough to walk through.
    const hole = dots(door.hole);
    const ys = [...hole].map((d) => Number(d.split(",")[1]));
    expect(Math.max(...ys)).toBe(DOOR_H - 1);
    expect(DOOR_H - Math.min(...ys)).toBeGreaterThan(40);
  });

  it.each(ROOM_STYLES)("shuts %s's doorway: the leaf and frame cover every dot of it", (style) => {
    const door = doorArt(style);
    const covered = dots([...door.shut, ...door.frame]);
    expect([...dots(door.hole)].filter((d) => !covered.has(d))).toEqual([]);
  });

  it("draws each style's door the same way every time, once", () => {
    for (const style of ROOM_STYLES) {
      expect(doorArt(style)).toEqual(doorArt(style));
      expect(doorFor(style)).toBe(doorFor(style));
    }
    // And they differ from style to style.
    expect(new Set(ROOM_STYLES.map((s) => JSON.stringify(doorArt(s).shut))).size).toBe(ROOM_STYLES.length);
  });
});
