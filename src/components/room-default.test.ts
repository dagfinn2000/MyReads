import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fixture from "./room-default.fixture.json";
import type { HouseGeometry } from "@/components/room-art";
import { chimneyFoot, chimneyRise, roofCrown, roofHeight, shellArt, type Interior } from "@/components/room-shells";
import { doorArt } from "@/components/room-doors";
import { windowSample } from "@/components/room-windows";
import { climberSample, gardenSample, seasonSample } from "@/components/room-garden";
import { HousePreview, PLAIN_DECOR } from "@/components/reading-room";
import { NO_ARRANGEMENT, PARTITION, planHouse, type Arrangement } from "@/lib/room";
import {
  ROOM_CLIMBERS,
  ROOM_GARDEN,
  ROOM_SEASONS,
  ROOM_WINDOWS,
  type RoomStyle,
  type Season,
} from "@/lib/room-styles";

/**
 * The room as it was drawn before holiday decorations and the newer house
 * styles: every house that could be drawn then must come out the same,
 * dot for dot. The fixture holds a hash of each, captured from the code
 * before those changes; ROOM_FIXTURE_WRITE=1 writes it afresh (only ever
 * from that code).
 */

// The room's stylesheet is for the browser; the drawing is all this checks.
vi.mock("./reading-room.css", () => ({}));

const STYLES: RoomStyle[] = [
  "cottage",
  "medieval",
  "fantasy",
  "elven",
  "cave",
  "scifi",
  "modern",
  "cabin",
  "japanese",
  "steampunk",
];

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** A house the way the reading room lays one out (reading-room.tsx). */
function house(style: RoomStyle, houseW: number, floorCount: number, yard: number): HouseGeometry {
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
    storey: 144,
    roomH: 139,
    beam: 5,
    wall: 5,
    foundation: 6,
    ground: 6,
    chimneyX,
  };
}

const SIZES: [number, number, number][] = [
  [122, 1, 14],
  [172, 2, 14],
  [345, 3, 24],
  [700, 1, 24],
];

/** The house done up every way it could be, in each season. */
function interiors(houseW: number, floors: number): [string, Interior][] {
  const inner = houseW - 10;
  const plain: Interior = { paper: "style", floor: "style", ceiling: "none", rooms: [], own: {} };
  const out: [string, Interior][] = [["plain", plain]];
  const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
  for (const [i, season] of seasons.entries()) {
    out.push([
      `dressed-${season}`,
      {
        paper: (["damask", "flowers", "trellis", "plain"] as const)[i],
        floor: (["parquet", "carpet", "flags", "tatami"] as const)[i],
        ceiling: (["fairylights", "bunting", "lanterns", "ivy"] as const)[i],
        rooms: Array.from({ length: floors }, (_, f) => (f === 0 && floors > 1 ? "bedroom" : null)),
        own: { bedroom: { walls: "sky", paper: "flowers", floor: "carpet" } },
        spans:
          inner >= 200
            ? Array.from({ length: floors }, () => [
                { room: null, x: 0, w: 100 },
                { room: "music" as const, x: 100 + PARTITION, w: inner - 100 - PARTITION },
              ])
            : undefined,
        windows: (["sash", "arched", "round", "leaded"] as const)[i],
        windowSpots: Array.from({ length: floors }, () => [10, Math.max(10, inner - 40)]),
        pictures: (["paintings", "portraits", "maps", "mixed"] as const)[i],
        pictureSpots: Array.from({ length: floors }, () => [Math.floor(inner / 2) - 10]),
        climber: (["ivy", "roses", "wisteria", "ivy"] as const)[i],
        garden: ["flowers", "bushes", "trees", "fence"].slice(0, i + 1) as Interior["garden"],
        season,
      },
    ]);
  }
  return out;
}

const PLANS: [number, number, number, Arrangement][] = [
  [1, 3, 400, NO_ARRANGEMENT],
  [4, 138, 330, NO_ARRANGEMENT],
  [4, 138, 120, NO_ARRANGEMENT],
  [9, 400, 600, NO_ARRANGEMENT],
  [3, 60, 300, { places: [{ kind: "hearth", floor: 1, slot: 0 }], away: ["clock"], rooms: ["bedroom", "music"], beside: ["music"], extras: ["sofa"] }],
];

/** Every hash, by name, from the code as it is now. */
function current(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const style of STYLES) {
    for (const [w, floors, yard] of SIZES) {
      for (const [name, interior] of interiors(w, floors)) {
        out[`shell/${style}/${w}x${floors}/${name}`] = hash(shellArt(house(style, w, floors, yard), style, interior));
      }
    }
    out[`door/${style}`] = hash(doorArt(style));
    out[`preview/${style}`] = hash(
      renderToStaticMarkup(createElement(HousePreview, { style, hanging: "painting", furnishings: PLAIN_DECOR })),
    );
  }
  for (const [i, args] of PLANS.entries()) out[`plan/${i}`] = hash(planHouse(...args));
  for (const season of ["spring", "summer", "autumn", "winter"] as const) {
    for (const w of ROOM_WINDOWS) out[`sample/window/${w}/${season}`] = hash(windowSample(w, 27, 44, season));
    for (const c of ROOM_CLIMBERS) out[`sample/climber/${c}/${season}`] = hash(climberSample(c, 27, 44, season));
    for (const g of ROOM_GARDEN) out[`sample/garden/${g}/${season}`] = hash(gardenSample(g, 27, 27, season));
  }
  for (const s of ROOM_SEASONS) out[`sample/season/${s}`] = hash(seasonSample(s, 27, 27));
  return out;
}

describe("the room as it was", () => {
  it("draws every house it drew before the same, dot for dot", () => {
    const now = current();
    if (process.env.ROOM_FIXTURE_WRITE) {
      writeFileSync(new URL("./room-default.fixture.json", import.meta.url), JSON.stringify(now, null, 1) + "\n");
      return;
    }
    expect(Object.keys(fixture).length).toBeGreaterThan(280);
    for (const [name, h] of Object.entries(fixture)) expect([name, now[name]]).toEqual([name, h]);
  });
});
