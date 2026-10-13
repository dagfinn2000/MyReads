import { describe, expect, it } from "vitest";
import type { HouseGeometry, Rect } from "@/components/room-art";
import { CHIMNEY_FOOT, chimneyFoot, chimneyRise, roofCrown, roofHeight, roofTopAt, shellArt } from "@/components/room-shells";
import { ROOM_STYLES, type RoomStyle } from "@/lib/room-styles";

const STOREY = 144;

/** A house the way the reading room lays one out (reading-room.tsx). */
function house(style: RoomStyle, houseW: number, floorCount: number, yard = 24): HouseGeometry {
  const roofH = roofHeight(style, houseW);
  const chimneyX = yard + 5 + 21;
  const box = { houseX: yard, houseW, roofTop: 0, roofH };
  const rise = chimneyRise(style);
  const roofTop = Math.max(4, roofCrown(style) + 2, rise === null ? 0 : rise + 20 - chimneyFoot(style, box, chimneyX));
  return {
    sceneW: houseW + 2 * yard,
    houseX: yard,
    houseW,
    roofTop,
    roofH,
    floorsTop: roofTop + roofH,
    floorCount,
    storey: STOREY,
    roomH: 139,
    beam: 5,
    wall: 5,
    foundation: 6,
    ground: 6,
    chimneyX,
  };
}

const sceneH = (g: HouseGeometry) => g.floorsTop + g.floorCount * g.storey + g.beam + g.foundation + g.ground;

const SIZES: [number, number, number][] = [
  [122, 1, 14],
  [172, 2, 14],
  [345, 3, 24],
  [700, 1, 24],
];

describe("shellArt", () => {
  for (const style of ROOM_STYLES) {
    it(`draws the ${style} inside the scene`, () => {
      for (const [w, floors, yard] of SIZES) {
        const g = house(style, w, floors, yard);
        const shell = shellArt(g, style);
        const H = sceneH(g);
        const inScene = ([x, y, rw, rh]: Rect) =>
          Number.isFinite(x + y + rw + rh) && rw >= 0 && rh >= 0 && x >= -1 && y >= 0 && x + rw <= g.sceneW + 1 && y + rh <= H;
        expect(shell.rects.every(inScene)).toBe(true);
        expect(shell.over.every(inScene)).toBe(true);
        for (const y of shell.yard) {
          expect(y.x).toBeGreaterThanOrEqual(0);
          expect(y.x + y.art.w).toBeLessThanOrEqual(g.sceneW);
          expect(y.y).toBeGreaterThanOrEqual(0);
        }
        for (const m of shell.moving) {
          expect(m.frames.length).toBeGreaterThan(0);
          expect(m.y).toBeGreaterThanOrEqual(0);
        }
        // Smoke has sky to rise into.
        if (shell.smoke) expect(shell.smoke.y).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("roofs the whole house in every style", () => {
    for (const style of ROOM_STYLES) {
      for (const [w, floors, yard] of SIZES) {
        const g = house(style, w, floors, yard);
        for (let x = g.houseX; x < g.houseX + g.houseW; x++) {
          const top = roofTopAt(style, g, x);
          expect(top).toBeGreaterThanOrEqual(g.roofTop);
          expect(top).toBeLessThanOrEqual(g.floorsTop);
        }
      }
    }
  });

  it("gives a wide wizard's house more than one gable, each reaching down to the eaves", () => {
    const g = house("fantasy", 345, 2);
    const tops = Array.from({ length: g.houseW }, (_, i) => roofTopAt("fantasy", g, g.houseX + i));
    const peaks = tops.filter((t, i) => i > 0 && i < tops.length - 1 && t < tops[i - 1] && t <= tops[i + 1]);
    expect(peaks.length).toBeGreaterThan(2);
    expect(Math.max(...tops)).toBeLessThan(g.floorsTop);
  });

  it("sets the chimney on the roof it stands on", () => {
    for (const style of ROOM_STYLES) {
      if (chimneyRise(style) === null) continue;
      const g = house(style, 345, 2);
      const foot = chimneyFoot(style, g, g.chimneyX);
      expect(foot).toBeLessThanOrEqual(roofTopAt(style, g, g.chimneyX + CHIMNEY_FOOT - 1));
      expect(foot).toBeGreaterThanOrEqual(g.roofTop);
    }
  });

  it("puts the cave's garden under the hill", () => {
    const g = house("cave", 345, 2);
    const shell = shellArt(g, "cave");
    expect(shell.yard).toHaveLength(0);
    // Earth all the way down the sides.
    const left = shell.over.filter(([x, , w, , p]) => p === "soil" && x === 0 && w > 0);
    expect(Math.max(...left.map(([, y, , h]) => y + h))).toBe(sceneH(g));
  });
});
