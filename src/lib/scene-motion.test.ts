import { describe, expect, it } from "vitest";
import { onBeat } from "@/lib/scene-motion";

describe("onBeat", () => {
  it("steps a twinkle twenty times a second, through its whole loop", () => {
    expect(onBeat(4500, -1944, 236.4, 50)).toEqual({
      duration: 4500,
      delay: -1950,
      easing: "steps(90, end)",
      startTime: 250,
    });
  });

  it("puts every animation on the same ticks, however it started", () => {
    const step = 50;
    for (const [duration, delay, start] of [
      [4960, -3712.6, 236.4],
      [3100, -17.3, 1891.07],
      [7200, -6999.9, 12.5],
    ]) {
      const b = onBeat(duration, delay, start, step);
      // Each step of the loop is exactly one beat long, and the loop's
      // first step falls on a beat.
      expect(b.duration / Number(b.easing.match(/\d+/)![0])).toBe(step);
      expect(Math.abs((b.startTime + b.delay) % step)).toBe(0);
    }
  });

  it("moves an animation by no more than half a step", () => {
    const b = onBeat(4960, -3712.6, 236.4, 50);
    expect(Math.abs(b.duration - 4960)).toBeLessThanOrEqual(25);
    expect(Math.abs(b.delay - -3712.6)).toBeLessThanOrEqual(25);
    expect(Math.abs(b.startTime - 236.4)).toBeLessThanOrEqual(25);
  });

  it("never makes a loop shorter than one step", () => {
    expect(onBeat(10, 0, 0, 50)).toMatchObject({ duration: 50, easing: "steps(1, end)" });
  });
});
