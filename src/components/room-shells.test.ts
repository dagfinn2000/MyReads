import { describe, expect, it } from "vitest";
import type { HouseGeometry, Rect } from "@/components/room-art";
import {
  CHIMNEY_FOOT,
  ceilingSample,
  chimneyFoot,
  chimneyRise,
  floorSample,
  roofCrown,
  roofHeight,
  roofTopAt,
  shellArt,
  storeyLooks,
  wallSample,
  type Interior,
} from "@/components/room-shells";
import { ROOM_CEILINGS, ROOM_FLOORS, ROOM_PAPERS, ROOM_STYLES, type RoomStyle } from "@/lib/room-styles";

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
        expect(shell.storeys).toHaveLength(floors);
        expect(shell.storeys.every((s) => s.rects.every(inScene))).toBe(true);
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

  it("papers, floors and hangs every storey inside the scene", () => {
    for (const style of ROOM_STYLES) {
      const g = house(style, 345, 3);
      const H = sceneH(g);
      const inScene = ([x, y, rw, rh]: Rect) =>
        Number.isFinite(x + y + rw + rh) && rw >= 0 && rh >= 0 && x >= -1 && y >= 0 && x + rw <= g.sceneW + 1 && y + rh <= H;
      ROOM_PAPERS.forEach((paper, i) => {
        const interior: Interior = {
          paper,
          floor: ROOM_FLOORS[i % ROOM_FLOORS.length],
          ceiling: ROOM_CEILINGS[i % ROOM_CEILINGS.length],
          rooms: [],
          own: {},
        };
        const shell = shellArt(g, style, interior);
        expect(shell.storeys.every((s) => s.rects.every(inScene))).toBe(true);
        expect(shell.twinkle.flat().every(inScene)).toBe(true);
      });
    }
  });

  it("hangs things along the ceiling no lower than the bookcases' tops", () => {
    const g = house("cottage", 345, 2);
    const plain = new Set(shellArt(g, "cottage").storeys.flatMap((s) => s.rects).map(String));
    for (const ceiling of ROOM_CEILINGS) {
      const shell = shellArt(g, "cottage", { paper: "style", floor: "style", ceiling, rooms: [], own: {} });
      const hung = [...shell.storeys.flatMap((s) => s.rects), ...shell.twinkle.flat()].filter((r) => !plain.has(String(r)));
      if (ceiling === "none") expect(hung).toHaveLength(0);
      else expect(hung.length).toBeGreaterThan(0);
      for (const [x, y, w, h] of hung) {
        const f = Math.floor((y + 1 - g.floorsTop) / g.storey);
        const top = g.floorsTop + f * g.storey + g.beam;
        expect(y).toBeGreaterThanOrEqual(top - 1);
        expect(y + h).toBeLessThanOrEqual(top + 14);
        expect(x).toBeGreaterThanOrEqual(g.houseX + g.wall);
        expect(x + w).toBeLessThanOrEqual(g.houseX + g.houseW - g.wall);
      }
      // Only fairy lights twinkle.
      expect(shell.twinkle.flat().length > 0).toBe(ceiling === "fairylights");
    }
  });

  it("does up an added room its own way, and the rest like the house", () => {
    const interior: Interior = {
      paper: "stripes",
      floor: "parquet",
      ceiling: "ivy",
      rooms: ["bedroom", "music", null],
      own: { bedroom: { walls: "rose", paper: "flowers", floor: "carpet" }, music: { walls: "sky", paper: "style", floor: "style" } },
    };
    const looks = storeyLooks("medieval", interior, 3);
    expect(looks.map((l) => [l.walls, l.paper, l.floor, l.ownFloor])).toEqual([
      ["rose", "flowers", "carpet", true],
      ["sky", "stripes", "parquet", true],
      ["style", "stripes", "parquet", true],
    ]);
    expect(looks.every((l) => l.ceiling === "ivy")).toBe(true);
    // "style" is the style's own: the castle's stone and flags.
    const castle = storeyLooks("medieval", { ...interior, paper: "style", floor: "style" }, 3);
    expect(castle.map((l) => [l.paper, l.floor, l.ownFloor])).toEqual([
      ["flowers", "carpet", true],
      ["stones", "flags", false],
      ["stones", "flags", false],
    ]);
    const shell = shellArt(house("medieval", 345, 3), "medieval", interior);
    expect(shell.storeys.map((s) => s.walls)).toEqual(["rose", "sky", "style"]);
  });

  it("draws a sample of every wallpaper, floor and ceiling inside its picture", () => {
    const samples = [
      ...ROOM_PAPERS.filter((p) => p !== "style").map((p) => wallSample(p, 27, 27)),
      ...ROOM_FLOORS.filter((f) => f !== "style").flatMap((f) => [floorSample(f, 18), floorSample(f, 18, false)]),
      ...ROOM_CEILINGS.map((c) => ceilingSample(c, 27, 20)),
    ];
    for (const a of samples) {
      expect(a.rects.length).toBeGreaterThan(0);
      expect(a.rects.every(([x, y, w, h]) => x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= a.w && y + h <= a.h)).toBe(true);
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
