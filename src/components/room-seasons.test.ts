import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Art, HouseGeometry, Rect } from "@/components/room-art";
import { climberArt, climberSample, gardenArt, gardenSample, seasonSample } from "@/components/room-garden";
import { flakesFor, snowCaps, snowGround, type Fall } from "@/components/room-seasons";
import { roofCrown, roofHeight, shellArt, type Interior } from "@/components/room-shells";
import { windowArt, windowSample } from "@/components/room-windows";
import { ROOM_CLIMBERS, ROOM_GARDEN, ROOM_SEASONS, ROOM_STYLES, ROOM_WINDOWS, seasonOn, type Season } from "@/lib/room-styles";

const css = readFileSync(new URL("./reading-room.css", import.meta.url), "utf8");
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** Every rectangle inside a `w` × `h` box, in a paint the stylesheet has. */
function sound(rects: readonly Rect[], w: number, h: number) {
  for (const [x, y, rw, rh, paint] of rects) {
    expect(rw > 0 && rh > 0).toBe(true);
    expect(x >= 0 && y >= 0 && x + rw <= w && y + rh <= h).toBe(true);
    expect(css).toContain(`.rp-${paint} {`);
  }
}

/** The paint at each dot, the later rectangle over the earlier. */
function paintAt(rects: readonly Rect[]) {
  const dots = new Map<string, string>();
  for (const [x, y, w, h, p] of rects) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dots.set(`${x + i},${y + j}`, p);
  return (x: number, y: number) => dots.get(`${x},${y}`);
}

const isSnow = (p: string | undefined) => !!p && /^(snow|ice)/.test(p);

describe("the seasons", () => {
  it("go by the months in the calendar", () => {
    const on = (month: number) => seasonOn(new Date(2026, month, 15));
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(on)).toEqual([
      "winter", "winter", "spring", "spring", "spring", "summer",
      "summer", "summer", "autumn", "autumn", "autumn", "winter",
    ]);
    expect(ROOM_SEASONS).toContain("calendar");
  });
});

describe("snow", () => {
  it("caps every top open to the sky, a dot above it, and never inside the shelter", () => {
    // A table: a top 9 wide on two legs, inside a shelter on the right.
    const table: Rect[] = [[2, 6, 9, 1, "wood"], [2, 7, 1, 4, "wood"], [10, 7, 1, 4, "wood"], [20, 6, 9, 1, "wood"]];
    const caps = snowCaps(table, 32, 12, { sheltered: (x) => x >= 18 });
    const at = paintAt(caps);
    for (let x = 2; x <= 10; x++) expect(isSnow(at(x, 5))).toBe(true);
    // A rounded pillow on it, its ends clear.
    expect(isSnow(at(6, 4))).toBe(true);
    expect(at(2, 4)).toBeUndefined();
    // Nothing under the top, and nothing in the shelter.
    expect(caps.every(([x, y]) => y < 6 && x < 18)).toBe(true);
    // Edged where it meets the sky, so it shows against a light page.
    expect(at(6, 3) ?? at(6, 4)).toBe("snow-edge");
  });

  it("lies deep where it's told, and stops at what shows through", () => {
    const roof: Rect[] = [[0, 0, 12, 8, "roof"], [5, 2, 2, 2, "light"]];
    const at = paintAt(snowCaps(roof, 12, 10, { deep: (p) => (p === "light" ? 0 : 4) }));
    for (let y = 0; y < 4; y++) expect(isSnow(at(0, y))).toBe(true);
    expect(at(0, 4)).toBeUndefined();
    // The window in the roof stays clear, and so does the roof under it.
    expect(at(5, 2)).toBeUndefined();
    expect(at(5, 3)).toBeUndefined();
    expect(isSnow(at(5, 1))).toBe(true);
  });

  it("hangs icicles where it may, never side by side", () => {
    const eaves: Rect[] = [[0, 0, 40, 2, "roof-deep"]];
    const caps = snowCaps(eaves, 40, 8, { hangs: () => true });
    const ice = caps.filter(([, , , , p]) => p.startsWith("ice"));
    expect(ice.length).toBeGreaterThan(3);
    const xs = new Set(ice.map(([x]) => x));
    for (const x of xs) expect(xs.has(x + 1)).toBe(false);
  });

  it("covers the ground three dots deep, drifted here and there", () => {
    const R = snowGround(0, 200, 20, 5);
    sound(R, 200, 23);
    const at = paintAt(R);
    for (let x = 0; x < 200; x++) for (const y of [20, 21, 22]) expect(isSnow(at(x, y))).toBe(true);
    expect(R.some(([, y]) => y < 20)).toBe(true);
  });
});

describe("what falls", () => {
  it.each(["snow", "leaves", "petals"] as const)("scatters %s through its area, the same on every visit", (kind) => {
    const area = { x: 10, y: 20, w: 60, h: 120 };
    const flakes = flakesFor(kind, area, 1);
    expect(flakes.length).toBeGreaterThan(1);
    for (const f of flakes) {
      expect(f.x >= 0 && f.x < area.w).toBe(true);
      expect(f.p >= 0 && f.p < 1 && f.q >= 0 && f.q < 1).toBe(true);
      expect(f.t > 0 && f.s > 0 && f.sway >= 1).toBe(true);
    }
    expect(flakesFor(kind, area, 1)).toEqual(flakes);
    expect(flakesFor(kind, { ...area, w: 2 }, 1)).toEqual([]);
  });

  it("keeps a big sky's snow to a sensible number", () => {
    expect(flakesFor("snow", { x: 0, y: 0, w: 2000, h: 2000 }).length).toBeLessThanOrEqual(150);
  });
});

/** A two-storey house, with a garden either side. */
function house(style: (typeof ROOM_STYLES)[number], yard = 24): { g: HouseGeometry; earth: number } {
  // Sky enough over the roof for a lighthouse tower.
  const roofTop = Math.max(30, roofCrown(style) + 2);
  const roofH = roofHeight(style, 300);
  const g: HouseGeometry = {
    sceneW: 300 + 2 * yard,
    houseX: yard,
    houseW: 300,
    roofTop,
    roofH,
    floorsTop: roofTop + roofH,
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

const interior = (season: Season): Interior => ({
  paper: "style",
  floor: "style",
  ceiling: "none",
  rooms: [null, null],
  own: {},
  windows: "sash",
  windowSpots: [[40, 120], [60]],
  garden: ROOM_GARDEN,
  climber: "ivy",
  season,
});

describe("the house through the year", () => {
  it.each(ROOM_STYLES)("draws the %s house in every season, in paints it has", (style) => {
    const { g, earth } = house(style);
    for (const season of SEASONS) {
      const shell = shellArt(g, style, interior(season));
      const all = [...shell.rects, ...shell.over, ...shell.storeys.flatMap((s) => s.rects)];
      for (const [, , , , paint] of all) expect(css).toContain(`.rp-${paint} {`);
      // What the season adds, inside the scene.
      sound(all.filter(([, , , , p]) => /^(snow|ice|autumn)/.test(p)), g.sceneW, earth + g.ground);
      for (const y of shell.yard) sound(y.art.rects, y.art.w, y.art.h);
    }
  });

  it.each(ROOM_STYLES)("lays snow on the %s house in winter, but none in its rooms", (style) => {
    const { g } = house(style);
    const summer = shellArt(g, style, interior("summer"));
    const winter = shellArt(g, style, interior("winter"));
    const snow = [...winter.rects, ...winter.over].filter(([, , , , p]) => isSnow(p));
    expect(snow.length).toBeGreaterThan(20);
    expect([...summer.rects, ...summer.over].some(([, , , , p]) => isSnow(p))).toBe(false);
    // On the roof, above the rooms.
    expect(snow.some(([x, y]) => y < g.floorsTop && x > g.houseX && x < g.houseX + g.houseW)).toBe(true);
    // Not a flake of it in the rooms, though it drifts against the
    // foundations.
    const floor = g.floorsTop + g.floorCount * g.storey;
    for (const [x, y, w, h] of snow) {
      const inside = x < g.houseX + g.houseW - g.wall && x + w > g.houseX + g.wall && y + h > g.floorsTop && y < floor;
      expect(inside).toBe(false);
    }
    // The rooms themselves are the same.
    expect(winter.storeys.map((s) => s.walls)).toEqual(summer.storeys.map((s) => s.walls));
  });

  it("lets snow fall in winter only where the outside shows", () => {
    for (const style of ROOM_STYLES) {
      const { g, earth } = house(style);
      const fall = shellArt(g, style, interior("winter")).fall as Fall;
      expect(fall.kind).toBe("snow");
      for (const a of fall.areas) {
        expect(a.x >= 0 && a.x + a.w <= g.sceneW && a.y >= 0 && a.y + a.h <= earth).toBe(true);
        const overRooms = a.x < g.houseX + g.houseW && a.x + a.w > g.houseX && a.y + a.h > g.floorsTop;
        expect(overRooms).toBe(false);
      }
      expect(shellArt(g, style, interior("summer")).fall).toBeNull();
    }
  });

  it("drops leaves in autumn and petals in spring from the trees, and nothing without them", () => {
    const { g } = house("cottage");
    expect(shellArt(g, "cottage", interior("autumn")).fall?.kind).toBe("leaves");
    expect(shellArt(g, "cottage", interior("spring")).fall?.kind).toBe("petals");
    expect(shellArt(g, "cottage", { ...interior("autumn"), garden: ["fence"] }).fall).toBeNull();
    // The elven birches turn too.
    expect(shellArt(g, "elven", { ...interior("autumn"), garden: [] }).fall?.kind).toBe("leaves");
  });

  it("is summer when no season is given", () => {
    const { g, earth } = house("cottage");
    const { season: _, ...plain } = interior("summer");
    expect(shellArt(g, "cottage", plain)).toEqual(shellArt(g, "cottage", interior("summer")));
    expect(gardenArt(ROOM_GARDEN, g, earth)).toEqual(gardenArt(ROOM_GARDEN, g, earth, "summer"));
  });
});

describe("the garden through the year", () => {
  const { g, earth } = house("cottage");
  const paints = (rects: readonly Rect[]) => new Set(rects.map((r) => r[4]));

  it("turns the leaves in autumn and bares the trees in winter", () => {
    const summer = paints(gardenArt(["trees"], g, earth, "summer"));
    const autumn = paints(gardenArt(["trees"], g, earth, "autumn"));
    const winter = paints(gardenArt(["trees"], g, earth, "winter"));
    expect(summer.has("leaf")).toBe(true);
    expect(autumn.has("autumn-hi")).toBe(true);
    expect([...winter].some((p) => p.startsWith("leaf") || p.startsWith("blossom"))).toBe(false);
  });

  it("grows each climber in every season, up the walls as ever", () => {
    for (const kind of ROOM_CLIMBERS) {
      if (kind === "none") continue;
      for (const season of SEASONS) {
        const rects = climberArt(kind, g, earth, season);
        sound(rects, g.sceneW, earth);
        expect(rects.every(([, y, , h]) => y >= g.floorsTop && y + h <= earth)).toBe(true);
      }
    }
    // Ivy turns; wisteria flowers only in spring and summer.
    expect(paints(climberArt("ivy", g, earth, "autumn")).has("autumn")).toBe(true);
    expect(paints(climberArt("wisteria", g, earth, "spring")).has("wis")).toBe(true);
    expect(paints(climberArt("wisteria", g, earth, "autumn")).has("wis")).toBe(false);
    expect(paints(climberArt("roses", g, earth, "winter")).has("leaf")).toBe(false);
  });

  it("draws every Decorate tile in every season, inside it", () => {
    const fits = (a: Art) => sound(a.rects, a.w, a.h);
    for (const season of SEASONS) {
      for (const c of ROOM_CLIMBERS) fits(climberSample(c, 27, 44, season));
      for (const item of ROOM_GARDEN) fits(gardenSample(item, 27, 27, season));
      for (const w of ROOM_WINDOWS) fits(windowSample(w, 27, 44, season));
    }
    for (const s of ROOM_SEASONS) fits(seasonSample(s, 27, 27));
  });

  it("shows the season through the windows", () => {
    for (const w of ROOM_WINDOWS) {
      if (w === "none") continue;
      expect(windowArt(w, 2, "winter")).not.toEqual(windowArt(w, 2, "summer"));
      expect(windowArt(w, 1, "autumn")).not.toEqual(windowArt(w, 1, "summer"));
    }
  });
});
