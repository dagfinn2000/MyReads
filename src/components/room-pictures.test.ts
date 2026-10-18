import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PICTURE_H, PICTURE_VIEWS, PICTURE_W, pictureAt, pictureFor, pictureSample } from "@/components/room-pictures";
import { WINDOW_DROP, WINDOW_H } from "@/components/room-windows";
import { ROOM_PICTURES } from "@/lib/room-styles";

const css = readFileSync(new URL("./reading-room.css", import.meta.url), "utf8");
const KINDS = ROOM_PICTURES.filter((p) => p !== "none");

describe("the pictures on the walls", () => {
  it.each(KINDS)("every one of the %s fits its box, in paints the stylesheet has", (kind) => {
    for (let n = 0; n < 15; n++) {
      const p = pictureFor(kind, n);
      expect(p.w).toBeLessThanOrEqual(PICTURE_W);
      expect(p.h).toBeLessThanOrEqual(PICTURE_H);
      for (const [x, y, w, h, paint] of p.rects) {
        expect(x >= 0 && y >= 0 && x + w <= p.w && y + h <= p.h).toBe(true);
        expect(css).toContain(`.rp-${paint} {`);
      }
    }
  });

  it.each(KINDS)("the %s hang in the windows' band, clear of the ceiling's decorations and the furniture", (kind) => {
    for (let n = 0; n < 15; n++) {
      const p = pictureFor(kind, n);
      const { dx, dy } = pictureAt(p);
      expect(dx).toBeGreaterThanOrEqual(0);
      expect(dy).toBeGreaterThanOrEqual(WINDOW_DROP);
      expect(dy + p.h).toBeLessThanOrEqual(WINDOW_DROP + WINDOW_H);
    }
  });

  it("varies along the house, and a mix takes every kind", () => {
    for (const kind of KINDS.filter((k) => k !== "mixed")) {
      const seen = new Set(Array.from({ length: PICTURE_VIEWS }, (_, n) => pictureFor(kind, n)));
      expect(seen.size).toBe(PICTURE_VIEWS);
    }
    const mix = new Set(Array.from({ length: 15 }, (_, n) => pictureFor("mixed", n)));
    expect(mix.size).toBe(15);
  });

  it("shows bare wall for none on its tile", () => {
    expect(pictureSample("none", 44, 36).rects).toEqual([[0, 0, 44, 36, "wall"]]);
    for (const kind of KINDS) expect(pictureSample(kind, 44, 36).rects.length).toBeGreaterThan(1);
  });
});
