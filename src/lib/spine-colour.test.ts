import { describe, expect, it } from "vitest";
import { drawnSpineColour, spineColour } from "@/lib/spine-colour";

/** RGBA pixels: `count` of each colour, in order. */
function pixels(...runs: [rgb: [number, number, number], count: number, alpha?: number][]) {
  const out: number[] = [];
  for (const [[r, g, b], count, alpha = 255] of runs) {
    for (let i = 0; i < count; i++) out.push(r, g, b, alpha);
  }
  return out;
}

const lightness = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

describe("spineColour", () => {
  it("takes the cover's main colour", () => {
    expect(spineColour(pixels([[40, 70, 140], 80], [[230, 200, 90], 20]))).toBe("#28468c");
  });

  it("prefers colour over a white title of about the same size", () => {
    const colour = spineColour(pixels([[180, 30, 40], 45], [[250, 250, 250], 55]))!;
    expect(colour).toBe("#b41e28");
  });

  it("ignores see-through pixels", () => {
    expect(spineColour(pixels([[0, 200, 0], 90, 0], [[120, 60, 30], 10]))).toBe("#783c1e");
    expect(spineColour(pixels([[0, 200, 0], 10, 0]))).toBeNull();
    expect(spineColour([])).toBeNull();
  });

  it("keeps out of the very lightest and darkest shades", () => {
    expect(lightness(spineColour(pixels([[255, 255, 255], 10]))!)).toBeCloseTo(0.86, 1);
    expect(lightness(spineColour(pixels([[0, 0, 0], 10]))!)).toBeCloseTo(0.14, 1);
  });
});

describe("drawnSpineColour", () => {
  it("is the same for a title every time", () => {
    expect(drawnSpineColour("Sult")).toBe(drawnSpineColour(" sult"));
    expect(drawnSpineColour("Sult")).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
  });
});
