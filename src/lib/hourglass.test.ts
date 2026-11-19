import { describe, expect, it } from "vitest";
import { GLASS_MS, hourglassAt } from "@/lib/hourglass";

describe("hourglassAt", () => {
  it("runs a glass over a quarter hour, then turns it over", () => {
    expect(hourglassAt(0)).toEqual({ turn: 0, run: 0 });
    expect(hourglassAt(GLASS_MS / 2)).toEqual({ turn: 0, run: 0.5 });
    expect(hourglassAt(GLASS_MS - 1).turn).toBe(0);
    expect(hourglassAt(GLASS_MS)).toEqual({ turn: 1, run: 0 });
    expect(hourglassAt(GLASS_MS * 2.25)).toEqual({ turn: 2, run: 0.25 });
  });

  it("starts full for no time or nonsense", () => {
    expect(hourglassAt(-5000)).toEqual({ turn: 0, run: 0 });
    expect(hourglassAt(Number.NaN)).toEqual({ turn: 0, run: 0 });
  });
});
