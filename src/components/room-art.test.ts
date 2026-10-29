import { describe, expect, it } from "vitest";
import { pathsOf, type Rect } from "@/components/room-art";
import { doorArt } from "@/components/room-doors";
import { ROOM_STYLES } from "@/lib/room-styles";

/** The rectangles a path's `d` is made of (pathsOf's own form). */
function rectsOf(d: string): [number, number, number, number][] {
  return [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)h-?[\d.]+z/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
  ]);
}

const covers = ([x, y, w, h]: readonly number[], px: number, py: number) =>
  px >= x && px < x + w && py >= y && py < y + h;

/** For each dot, the paints laid on it, bottom first. */
function stacks(layers: { paint: string; boxes: (readonly number[])[] }[], w: number, h: number): string[] {
  const out: string[] = [];
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      out.push(layers.filter((l) => l.boxes.some((b) => covers(b, px, py))).map((l) => l.paint).join(","));
    }
  }
  return out;
}

const asRects = (rects: readonly Rect[]) => rects.map(([x, y, w, h, paint]) => ({ paint, boxes: [[x, y, w, h]] }));
const asPaths = (rects: readonly Rect[]) => pathsOf(rects).map(([paint, d]) => ({ paint, boxes: rectsOf(d) }));

/** A small deterministic random picture, overlaps and all. */
function picture(seed: number, count: number, size: number): Rect[] {
  let s = seed;
  const next = (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % n;
  };
  const paints = ["a", "b", "c", "glass"];
  return Array.from({ length: count }, () => {
    const x = next(size);
    const y = next(size);
    return [x, y, 1 + next(4), 1 + next(3), paints[next(paints.length)]] as Rect;
  });
}

describe("pixel art as paths", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("lays the same paints on every dot, in the same order (picture %i)", (seed) => {
    const rects = picture(seed, 60, 12);
    expect(stacks(asPaths(rects), 16, 16)).toEqual(stacks(asRects(rects), 16, 16));
  });

  it.each(ROOM_STYLES)("draws the %s door the same, in fewer pieces", (style) => {
    const door = doorArt(style);
    const all = [...door.frame, ...door.shut, ...door.open];
    const w = Math.max(...all.map(([x, , dw]) => x + dw));
    const h = Math.max(...all.map(([, y, , dh]) => y + dh));
    for (const rects of [door.frame, door.shut, door.open, all]) {
      expect(stacks(asPaths(rects), w, h)).toEqual(stacks(asRects(rects), w, h));
    }
    expect(pathsOf(all).length).toBeLessThan(all.length);
  });

  it("leaves out what a <rect> wouldn't draw, without losing the rest", () => {
    const rects: Rect[] = [
      [0, 0, 2, 2, "a"],
      [1, 1, 0, 3, "a"],
      [3, 0, -1, 1, "a"],
      [4, 0, Number.NaN, 1, "a"],
      [5, 0, 1, 1, "a"],
    ];
    expect(rectsOf(pathsOf(rects)[0][1])).toEqual([
      [0, 0, 2, 2],
      [5, 0, 1, 1],
    ]);
  });

  it("works each art out once", () => {
    const rects = picture(9, 20, 8);
    expect(pathsOf(rects)).toBe(pathsOf(rects));
  });
});
