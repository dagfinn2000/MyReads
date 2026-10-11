import { describe, expect, it } from "vitest";
import { heatmapLegend, heatmapLevel, heatmapThresholds } from "@/lib/heatmap";

describe("heatmapThresholds", () => {
  it("uses fixed steps for the named scales", () => {
    expect(heatmapThresholds("standard", [])).toEqual([20, 50, 100]);
    expect(heatmapThresholds("gentle", [500])).toEqual([10, 25, 50]);
    expect(heatmapThresholds("heavy", [])).toEqual([50, 100, 200]);
  });

  it("centres auto on the typical reading day", () => {
    // Median of the days with reading is 40; zero days don't count.
    expect(heatmapThresholds("auto", [0, 0, 10, 40, 40, 90, 200])).toEqual([20, 40, 80]);
  });

  it("keeps auto steps distinct for tiny totals", () => {
    const [a, b, c] = heatmapThresholds("auto", [1, 1, 1]);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("falls back to standard when there is no reading yet", () => {
    expect(heatmapThresholds("auto", [0, 0])).toEqual([20, 50, 100]);
  });
});

describe("heatmapLevel", () => {
  const t = [20, 50, 100] as [number, number, number];

  it("maps pages to the five shades", () => {
    expect([0, 5, 20, 50, 99, 100, 400].map((p) => heatmapLevel(p, t))).toEqual([
      0, 1, 2, 3, 3, 4, 4,
    ]);
  });

  it("describes each shade's range", () => {
    expect(heatmapLegend(t)).toEqual([
      "No reading",
      "Under 20 pages",
      "20–49 pages",
      "50–99 pages",
      "100+ pages",
    ]);
  });
});
