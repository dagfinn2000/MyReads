import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAIRS, FIREPLACES, LAMPS, rugFor } from "@/components/room-fireside";
import { armchairArt, fireplaceArt, floorLampArt, type Art } from "@/components/room-art";
import { ROOM_CHAIRS, ROOM_FIREPLACES, ROOM_LAMPS, ROOM_RUGS } from "@/lib/room-styles";

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

describe("the fireside's pieces", () => {
  it.each(ROOM_FIREPLACES)("the %s fireplace is the stone one's size, its fire inside it", (kind) => {
    const { art, fires } = FIREPLACES[kind];
    expect([art.w, art.h]).toEqual([fireplaceArt().w, fireplaceArt().h]);
    sound(art);
    for (const f of fires) {
      // The flames are 14 × 10, the logs 3 under them.
      expect(f.x).toBeGreaterThanOrEqual(3);
      expect(f.x + 14).toBeLessThanOrEqual(art.w - 3);
      expect(f.y + 12).toBeLessThanOrEqual(art.h - 3);
    }
  });

  it.each(ROOM_CHAIRS)("the %s is the wingback's size, standing on the floor", (kind) => {
    const chair = CHAIRS[kind];
    // The avatar sits in every chair the same way (avatar-art.test.ts).
    expect([chair.w, chair.h]).toEqual([armchairArt().w, armchairArt().h]);
    sound(chair);
    expect(chair.rects.some(([, y, , h]) => y + h === chair.h)).toBe(true);
  });

  it.each(ROOM_RUGS.filter((r) => r !== "none"))("the %s rug fits the width it is given", (kind) => {
    for (const w of [24, 40, 56]) {
      const rug = rugFor(kind, w)!;
      expect(rug.w).toBe(w);
      expect(rug.h).toBeLessThanOrEqual(6);
      sound(rug);
    }
  });

  it.each(ROOM_LAMPS)("the %s stands on the floor and is lit inside its box", (kind) => {
    const { art, glow, flames } = LAMPS[kind];
    sound(art);
    for (const frame of flames ?? []) sound({ ...art, rects: frame });
    expect(art.rects.some(([, y, , h]) => y + h === art.h)).toBe(true);
    expect(glow.x).toBeGreaterThanOrEqual(0);
    expect(glow.x).toBeLessThan(art.w);
    expect(glow.y).toBeLessThan(art.h);
  });

  it("keeps the house's own pieces as the first of each", () => {
    expect(FIREPLACES.stone.art).toEqual(fireplaceArt());
    expect(CHAIRS.wingback).toEqual(armchairArt());
    expect(LAMPS.standard.art).toEqual(floorLampArt());
  });
});
