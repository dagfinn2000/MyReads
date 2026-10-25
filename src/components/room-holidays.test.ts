import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HouseGeometry, Rect } from "@/components/room-art";
import {
  BIG_LANTERN,
  BONFIRE,
  COBWEB_W,
  EASTER_TWIGS,
  MANTEL_TREE,
  MID_LANTERN,
  SMALL_LANTERN,
  TREE,
  TREE_W,
  WREATH,
  burst,
  cobweb,
  egg,
  flowerGarland,
  holidaySample,
  mantelGarland,
  streamers,
} from "@/components/room-holidays";
import { roofHeight, shellArt, type Interior } from "@/components/room-shells";
import {
  ROOM_HOLIDAYS,
  ROOM_HOLIDAY_LABELS,
  ROOM_STYLES,
  easterSunday,
  holidaysFor,
  holidaysOn,
  localDay,
  type Holiday,
} from "@/lib/room-styles";
import { PIECE_WIDTH } from "@/lib/room";

const css = readFileSync(new URL("./reading-room.css", import.meta.url), "utf8");
const HOLIDAYS: Holiday[] = ["christmas", "halloween", "easter", "midsummer", "newyear"];

/** Every rectangle inside a `w` × `h` box, in a paint the stylesheet has. */
function sound(rects: readonly Rect[], w: number, h: number) {
  for (const [x, y, rw, rh, paint] of rects) {
    expect(rw > 0 && rh > 0).toBe(true);
    expect([paint, x >= 0 && y >= 0 && x + rw <= w && y + rh <= h]).toEqual([paint, true]);
    expect(css).toContain(`.rp-${paint} {`);
  }
}

describe("holiday dates", () => {
  it("find Easter Sunday", () => {
    const known: [number, string][] = [
      [1818, "3-22"],
      [1943, "4-25"],
      [2000, "4-23"],
      [2019, "4-21"],
      [2024, "3-31"],
      [2025, "4-20"],
      [2026, "4-5"],
      [2027, "3-28"],
      [2038, "4-25"],
      [2285, "3-22"],
    ];
    for (const [year, day] of known) expect([year, easterSunday(year).join("-")]).toEqual([year, day]);
  });

  it("put each holiday up in its days and no others", () => {
    expect(holidaysOn("2026-11-30")).toEqual([]);
    expect(holidaysOn("2026-12-01")).toEqual(["christmas"]);
    expect(holidaysOn("2026-12-31")).toEqual(["christmas", "newyear"]);
    expect(holidaysOn("2027-01-01")).toEqual(["christmas", "newyear"]);
    expect(holidaysOn("2027-01-06")).toEqual(["christmas"]);
    expect(holidaysOn("2027-01-07")).toEqual([]);
    expect(holidaysOn("2026-10-23")).toEqual([]);
    expect(holidaysOn("2026-10-24")).toEqual(["halloween"]);
    expect(holidaysOn("2026-10-31")).toEqual(["halloween"]);
    expect(holidaysOn("2026-11-01")).toEqual([]);
    expect(holidaysOn("2026-06-19")).toEqual([]);
    expect(holidaysOn("2026-06-20")).toEqual(["midsummer"]);
    expect(holidaysOn("2026-06-24")).toEqual(["midsummer"]);
    expect(holidaysOn("2026-06-25")).toEqual([]);
    // Easter 2026 is 5 April: from Palm Sunday to Easter Monday.
    expect(holidaysOn("2026-03-28")).toEqual([]);
    expect(holidaysOn("2026-03-29")).toEqual(["easter"]);
    expect(holidaysOn("2026-04-06")).toEqual(["easter"]);
    expect(holidaysOn("2026-04-07")).toEqual([]);
    // Across a month: Easter 2024 was 31 March.
    expect(holidaysOn("2024-04-01")).toEqual(["easter"]);
    expect(holidaysOn("nonsense")).toEqual([]);
  });

  it("follow the setting: none, one always, or the calendar's", () => {
    expect(holidaysFor("off", "2026-12-24")).toEqual([]);
    expect(holidaysFor("halloween", "2026-12-24")).toEqual(["halloween"]);
    expect(holidaysFor("calendar", "2026-12-24")).toEqual(["christmas"]);
    expect(holidaysFor("calendar", "2026-08-01")).toEqual([]);
    expect(ROOM_HOLIDAYS.every((h) => ROOM_HOLIDAY_LABELS[h])).toBe(true);
  });

  it("read the day where the reader is", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localDay(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });
});

describe("holiday art", () => {
  it("draws every piece inside itself, in paints the room has", () => {
    sound([...TREE.art.rects, ...TREE.lights.flat()], TREE.art.w, TREE.art.h);
    expect(TREE.art.w).toBe(TREE_W);
    expect(PIECE_WIDTH.tree).toBe(TREE_W);
    // The tree's lights twinkle in three sets, each with some bulbs.
    expect(TREE.lights).toHaveLength(3);
    expect(TREE.lights.every((set) => set.length >= 4)).toBe(true);
    sound(MANTEL_TREE.rects, MANTEL_TREE.w, MANTEL_TREE.h);
    sound(EASTER_TWIGS.rects, EASTER_TWIGS.w, EASTER_TWIGS.h);
    sound(WREATH.rects, WREATH.w, WREATH.h);
    for (const w of [36, 44, 52]) sound(mantelGarland(w).rects, w, 7);
    for (const l of [SMALL_LANTERN, BIG_LANTERN, MID_LANTERN]) {
      sound(l.art.rects, l.art.w, l.art.h);
      for (const frame of l.frames) sound(frame, l.art.w, l.art.h);
      // The candlelight shows through the face it lights.
      expect(l.frames[0].length).toBeGreaterThan(0);
    }
    sound(BONFIRE.art.rects, BONFIRE.art.w, BONFIRE.art.h);
    for (const frame of BONFIRE.frames) sound(frame, BONFIRE.art.w, BONFIRE.art.h);
    for (const right of [false, true]) sound(cobweb(right), COBWEB_W, 10);
    for (let i = 0; i < 6; i++) sound(egg(i), 3, 4);
    for (let i = 0; i < 4; i++) sound(burst(i).rects, burst(i).w, burst(i).h);
    for (const w of [60, 133, 400]) sound(flowerGarland(w).map(([x, y, rw, rh, p]): Rect => [x, y + 1, rw, rh, p]), w, 8);
    // Streamers never hang lower than the bookcases' tops.
    for (const w of [60, 200, 700]) sound(streamers(0, w, 0, 2), w, 14);
  });

  it("has a tile for every choice in Decorate", () => {
    for (const h of ROOM_HOLIDAYS) {
      const a = holidaySample(h, 27, 44);
      sound(a.rects, 27, 44);
    }
  });
});

/** A house the way the reading room lays one out, two storeys of two rooms
 *  side by side. */
function house(style: (typeof ROOM_STYLES)[number], houseW = 300, yard = 24): HouseGeometry {
  const roofH = roofHeight(style, houseW);
  return {
    sceneW: houseW + 2 * yard,
    houseX: yard,
    houseW,
    roofTop: 30,
    roofH,
    floorsTop: 30 + roofH,
    floorCount: 2,
    storey: 144,
    roomH: 139,
    beam: 5,
    wall: 5,
    foundation: 6,
    ground: 6,
    chimneyX: yard + 26,
  };
}

const sceneH = (g: HouseGeometry) => g.floorsTop + g.floorCount * g.storey + g.beam + g.foundation + g.ground;

const dressed = (holidays?: Holiday[]): Interior => ({
  paper: "style",
  floor: "style",
  ceiling: "none",
  rooms: [null, null],
  own: {},
  spans: [
    [
      { room: null, x: 0, w: 140 },
      { room: "music", x: 154, w: 136 },
    ],
    [{ room: null, x: 0, w: 290 }],
  ],
  holidays,
});

describe("the house at the holidays", () => {
  it("adds to the house without changing any of it", () => {
    for (const style of ROOM_STYLES) {
      const g = house(style);
      const plain = shellArt(g, style, dressed());
      for (const h of HOLIDAYS) {
        const shell = shellArt(g, style, dressed([h]));
        expect(shell.rects).toEqual(plain.rects);
        expect(shell.storeys).toEqual(plain.storeys);
        expect(shell.over.slice(0, plain.over.length)).toEqual(plain.over);
        for (const [i, d] of shell.doors.entries()) expect(d.shut.slice(0, plain.doors[i].shut.length)).toEqual(plain.doors[i].shut);
      }
    }
  });

  it("keeps everything in the scene, in paints the room has", () => {
    for (const style of ROOM_STYLES) {
      for (const h of HOLIDAYS) {
        const g = house(style);
        const shell = shellArt(g, style, dressed([h]));
        const H = sceneH(g);
        sound(shell.over, g.sceneW, H);
        sound(shell.twinkle.flat(), g.sceneW, H);
        for (const y of shell.yard) {
          expect(y.x >= 0 && y.y >= 0 && y.x + y.art.w <= g.sceneW && y.y + y.art.h <= H).toBe(true);
          sound(y.art.rects, y.art.w, y.art.h);
        }
        for (const m of shell.moving) {
          expect(m.x >= 0 && m.y >= 0 && m.x + m.art.w <= g.sceneW).toBe(true);
          for (const f of m.frames) sound(f, m.art.w, m.art.h);
        }
      }
    }
  });

  it("strings lights under the eaves and hangs a wreath on each door at Christmas", () => {
    const g = house("cottage");
    const plain = shellArt(g, "cottage", dressed());
    const shell = shellArt(g, "cottage", dressed(["christmas"]));
    const bulbs = shell.twinkle.flat().length - plain.twinkle.flat().length;
    expect(bulbs).toBeGreaterThan(g.houseW / 4);
    for (const [x, y] of shell.twinkle.flat()) {
      expect(x >= g.houseX && x < g.houseX + g.houseW).toBe(true);
      expect(y >= g.floorsTop && y < g.floorsTop + g.beam).toBe(true);
    }
    expect(shell.doors).toHaveLength(1);
    expect(shell.doors[0].shut.length).toBe(plain.doors[0].shut.length + WREATH.rects.length);
  });

  it("puts cobwebs in each room's top corners and pumpkins by the house at Halloween", () => {
    const g = house("cabin");
    const plain = shellArt(g, "cabin", dressed());
    const shell = shellArt(g, "cabin", dressed(["halloween"]));
    const webs = shell.over.slice(plain.over.length);
    // Three rooms, a web in each top corner.
    expect(webs.length).toBe(6 * cobweb(false).length);
    for (const [, y] of webs) expect(y < g.floorsTop + g.storey + g.beam + 11).toBe(true);
    const pumpkins = shell.yard.slice(plain.yard.length);
    expect(pumpkins).toHaveLength(2);
    expect(shell.lights.length).toBe(plain.lights.length + 2);
    // Standing on the grass.
    const earth = g.floorsTop + g.floorCount * g.storey + g.beam + g.foundation;
    for (const p of pumpkins) expect(p.y + p.art.h).toBe(earth + 1);
  });

  it("stands what's outside on the hill over a cave", () => {
    const g = house("cave");
    const plain = shellArt(g, "cave", dressed());
    for (const h of ["halloween", "easter", "midsummer"] as const) {
      const shell = shellArt(g, "cave", dressed([h]));
      const earth = g.floorsTop + g.floorCount * g.storey + g.beam + g.foundation;
      const added = shell.yard.slice(h === "midsummer" ? 0 : plain.yard.length);
      expect(added.length).toBeGreaterThan(0);
      // Higher up than the grass in front of the house, on the hillside.
      expect(added.some((y) => y.y + y.art.h < earth)).toBe(true);
    }
  });

  it("lights a bonfire in place of what stood in the garden on the right at Midsummer", () => {
    const g = house("medieval");
    const plain = shellArt(g, "medieval", dressed());
    const shell = shellArt(g, "medieval", dressed(["midsummer"]));
    const right = g.houseX + g.houseW;
    expect(plain.moving.some((m) => m.x >= right)).toBe(true);
    const fires = shell.moving.filter((m) => m.x >= right);
    expect(fires).toHaveLength(1);
    expect(fires[0].frames).toEqual(BONFIRE.frames);
    // The garland of flowers along the fascia.
    expect(shell.over.length).toBeGreaterThan(plain.over.length + g.houseW);
  });

  it("sets off fireworks in turn in clear sky on New Year's Eve, off the roof and chimney", () => {
    for (const style of ROOM_STYLES) {
      const g = house(style);
      const shell = shellArt(g, style, dressed(["newyear"]));
      const bursts = shell.moving.filter((m) => m.motion === "burst");
      expect(bursts.length).toBeGreaterThanOrEqual(2);
      expect(bursts.map((b) => b.delay)).toEqual(bursts.map((_, i) => i * 1.3));
      for (const b of bursts) {
        expect(b.y + b.art.h).toBeLessThanOrEqual(g.floorsTop);
        expect(b.x + b.art.w <= g.chimneyX - 4 || b.x >= g.chimneyX + 14).toBe(true);
      }
    }
  });
});
