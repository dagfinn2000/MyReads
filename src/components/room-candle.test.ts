import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANDLE_MINUTES, CANDLE_STUB, CANDLE_TALL, candleArt, candleRows } from "@/components/room-candle";

const css = readFileSync(new URL("./reading-room.css", import.meta.url), "utf8");
const MIN = 60_000;

describe("candleRows", () => {
  it("burns from a new candle to a stub over the minutes given, then gutters on", () => {
    expect(candleRows(0, CANDLE_MINUTES)).toBe(CANDLE_TALL);
    expect(candleRows(30 * MIN, CANDLE_MINUTES)).toBe(6);
    expect(candleRows(60 * MIN, CANDLE_MINUTES)).toBe(CANDLE_STUB);
    expect(candleRows(5 * 60 * MIN, CANDLE_MINUTES)).toBe(CANDLE_STUB);
    // A twenty-minute goal burns it down three times as fast.
    expect(candleRows(10 * MIN, 20)).toBe(6);
  });

  it("only ever gets shorter, and never below the stub", () => {
    let last = Infinity;
    for (let m = 0; m <= 90; m++) {
      const rows = candleRows(m * MIN, 45);
      expect(rows).toBeLessThanOrEqual(last);
      expect(rows).toBeGreaterThanOrEqual(CANDLE_STUB);
      last = rows;
    }
    expect(candleRows(-5 * MIN, 45)).toBe(CANDLE_TALL);
  });
});

describe("candleArt", () => {
  it("is the flame, the wick, the wax left and the dish, standing in one place", () => {
    for (let rows = CANDLE_STUB; rows <= CANDLE_TALL; rows++) {
      const { art, flames } = candleArt(rows);
      expect(art.w).toBe(5);
      expect(art.h).toBe(4 + 1 + rows + 2);
      for (const [x, y, w, h] of [...art.rects, ...flames[0], ...flames[1]]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(art.w);
        expect(y + h).toBeLessThanOrEqual(art.h);
      }
      // The flames burn over the wick, in the rows the art leaves clear.
      for (const [, y, , h] of [...flames[0], ...flames[1]]) expect(y + h).toBeLessThanOrEqual(4);
    }
  });

  it("drips and pools as it burns down", () => {
    // Dots painted outside the candle's own three columns, and pale wax on
    // its shaded side.
    const at = (rows: number, col: number) =>
      candleArt(rows).art.rects.filter(([x, , w]) => x <= col && col < x + w);
    const beads = (rows: number) => at(rows, 0).length + at(rows, 4).length;
    expect(beads(CANDLE_TALL)).toBe(2); // just the dish's ends
    expect(beads(8)).toBeGreaterThan(2);
    expect(beads(5)).toBeGreaterThan(beads(8));
    const pale = (rows: number) => at(rows, 3).filter(([, , , , paint]) => paint === "paper").length;
    expect(pale(CANDLE_TALL)).toBe(0);
    expect(pale(8)).toBeGreaterThan(0);
    // Wax pools in the dish once it's half gone.
    const dish = (rows: number) => candleArt(rows).art.rects.filter(([, y]) => y === candleArt(rows).art.h - 2);
    expect(dish(CANDLE_TALL).some((r) => r[4] === "paper-lo")).toBe(false);
    expect(dish(5).some((r) => r[4] === "paper-lo")).toBe(true);
  });

  it("uses only paints the room has colours for", () => {
    const used = new Set<string>();
    for (let rows = CANDLE_STUB; rows <= CANDLE_TALL; rows++) {
      const { art, flames } = candleArt(rows);
      for (const r of [...art.rects, ...flames[0], ...flames[1]]) used.add(r[4]);
    }
    for (const paint of used) expect(css).toContain(`.rp-${paint} {`);
  });
});
