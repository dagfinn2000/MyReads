import { describe, expect, it } from "vitest";
import { EXTRA_ART } from "@/components/room-extras";
import { EXTRAS, PIECE_WIDTH, ROOM_HEIGHT } from "@/lib/room";

describe("catalogue furniture art", () => {
  it.each(EXTRAS)("%s is as wide as the place the plan keeps for it", (kind) => {
    expect(EXTRA_ART[kind].w).toBe(PIECE_WIDTH[kind]);
  });

  it.each(EXTRAS)("%s is drawn inside its own box and under the ceiling", (kind) => {
    const a = EXTRA_ART[kind];
    expect(a.h).toBeLessThanOrEqual(ROOM_HEIGHT);
    for (const [x, y, w, h] of a.rects) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(a.w);
      expect(y + h).toBeLessThanOrEqual(a.h);
    }
  });
});
