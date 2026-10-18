import { describe, expect, it } from "vitest";
import type { HouseGeometry } from "@/components/room-art";
import { climberArt, climberSample, gardenArt, gardenSample } from "@/components/room-garden";
import { ROOM_CLIMBERS, ROOM_GARDEN } from "@/lib/room-styles";

/** A two-storey house `houseW` wide with `yard` of garden either side. */
function house(houseW: number, yard: number): { g: HouseGeometry; earth: number } {
  const g: HouseGeometry = {
    sceneW: houseW + 2 * yard,
    houseX: yard,
    houseW,
    roofTop: 10,
    roofH: 40,
    floorsTop: 50,
    floorCount: 2,
    storey: 144,
    roomH: 139,
    beam: 5,
    wall: 5,
    foundation: 6,
    ground: 6,
    chimneyX: yard + 26,
  };
  return { g, earth: g.floorsTop + g.floorCount * g.storey + g.beam + g.foundation };
}

const CLIMBERS = ROOM_CLIMBERS.filter((c) => c !== "none");

describe("climbers", () => {
  it.each(CLIMBERS)("grows %s up both outside walls and no further into the rooms than a dot", (kind) => {
    const { g, earth } = house(300, 24);
    const rects = climberArt(kind, g, earth);
    const right = g.houseX + g.houseW;
    for (const [x, y, w, h] of rects) {
      expect(w > 0 && h > 0).toBe(true);
      expect(y >= g.floorsTop && y + h <= earth).toBe(true);
      const left = x + w <= g.houseX + g.wall + 1 && x >= g.houseX - 6;
      const far = x >= right - g.wall - 1 && x + w <= right + 6;
      expect(left || far).toBe(true);
    }
    // Both walls, from near the ground to well up them.
    expect(rects.some(([x]) => x < g.houseX + g.wall)).toBe(true);
    expect(rects.some(([x]) => x >= right - g.wall - 1)).toBe(true);
    expect(Math.min(...rects.map(([, y]) => y))).toBeLessThan(earth - 60);
    expect(Math.max(...rects.map(([, y, , h]) => y + h))).toBe(earth);
    expect(climberArt(kind, g, earth)).toEqual(rects);
  });

  it("draws a Decorate tile for each, inside the tile", () => {
    for (const kind of ROOM_CLIMBERS) {
      const art = climberSample(kind, 27, 44);
      expect(art.rects.every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 27 && y + h <= 44)).toBe(true);
      expect(art.rects.some(([, , , , p]) => p.startsWith("leaf") || p.startsWith("ivy"))).toBe(kind !== "none");
    }
  });
});

describe("the garden", () => {
  it("draws each thing inside the scene, standing on the grass", () => {
    for (const yard of [14, 24, 40]) {
      const { g, earth } = house(260, yard);
      for (const item of ROOM_GARDEN) {
        const rects = gardenArt([item], g, earth);
        expect(rects.length).toBeGreaterThan(0);
        for (const [x, y, w, h] of rects) {
          expect(w > 0 && h > 0).toBe(true);
          expect(x >= 0 && x + w <= g.sceneW && y >= 0 && y + h <= earth + g.ground).toBe(true);
        }
        expect(gardenArt([item], g, earth)).toEqual(rects);
      }
    }
  });

  it("keeps the trees' crowns inside the scene, never cut off at its edge", () => {
    for (const yard of [14, 24, 32, 40]) {
      const { g, earth } = house(260, yard);
      const crowns = gardenArt(["trees"], g, earth).filter(([, y]) => y < earth);
      expect(crowns.some(([x, , w]) => x === 0 || x + w === g.sceneW)).toBe(false);
    }
  });

  it("draws a Decorate tile for each, inside the tile", () => {
    for (const item of ROOM_GARDEN) {
      const art = gardenSample(item, 27, 27);
      expect(art.rects.length).toBeGreaterThan(5);
      expect(art.rects.every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 27 && y + h <= 27)).toBe(true);
    }
  });
});
