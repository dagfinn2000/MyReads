import { describe, expect, it } from "vitest";
import { WINDOW_H, WINDOW_VIEWS, WINDOW_W, windowArt, windowFor, windowSample } from "@/components/room-windows";
import { ROOM_WINDOWS } from "@/lib/room-styles";

const KINDS = ROOM_WINDOWS.filter((w) => w !== "none");

describe("windows", () => {
  it.each(KINDS)("draws the %s window inside its box, with sky through it", (kind) => {
    for (let view = 0; view < WINDOW_VIEWS; view++) {
      const art = windowArt(kind, view);
      expect([art.w, art.h]).toEqual([WINDOW_W, WINDOW_H]);
      expect(art.rects.length).toBeGreaterThan(0);
      for (const [x, y, w, h] of art.rects) {
        expect([x, y, w, h].every(Number.isInteger)).toBe(true);
        expect(w > 0 && h > 0).toBe(true);
        expect(x >= 0 && y >= 0 && x + w <= WINDOW_W && y + h <= WINDOW_H).toBe(true);
      }
      expect(art.rects.some(([, , , , p]) => p.startsWith("sky"))).toBe(true);
    }
  });

  it("shows a different view through each window, the same one every time", () => {
    for (const kind of KINDS) {
      const views = Array.from({ length: WINDOW_VIEWS }, (_, v) => JSON.stringify(windowArt(kind, v).rects));
      expect(new Set(views).size).toBe(WINDOW_VIEWS);
      expect(windowArt(kind, 1)).toEqual(windowArt(kind, 1));
      expect(windowFor(kind, 1)).toBe(windowFor(kind, 1 + WINDOW_VIEWS));
    }
  });

  it("draws the Decorate tiles inside the tile, the bare wall for none", () => {
    for (const kind of ROOM_WINDOWS) {
      const art = windowSample(kind, 27, 44);
      expect(art.rects.every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 27 && y + h <= 44)).toBe(true);
      expect(art.rects.length > 1).toBe(kind !== "none");
    }
  });
});
