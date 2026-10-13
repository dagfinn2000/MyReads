import { describe, expect, it } from "vitest";
import { ROOM_PIECE_ART } from "@/components/room-rooms";
import { PIECE_WIDTH, ROOM_HEIGHT, ROOM_PIECES, ROOMS } from "@/lib/room";

describe("room furniture art", () => {
  const pieces = ROOMS.flatMap((room) => ROOM_PIECES[room]);

  it.each(pieces)("%s is as wide as the place the plan keeps for it", (kind) => {
    expect(ROOM_PIECE_ART[kind].w).toBe(PIECE_WIDTH[kind]);
  });

  it.each(pieces)("%s is drawn inside its own box and under the ceiling", (kind) => {
    const a = ROOM_PIECE_ART[kind];
    expect(a.h).toBeLessThanOrEqual(ROOM_HEIGHT);
    for (const [x, y, w, h] of a.rects) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(a.w);
      expect(y + h).toBeLessThanOrEqual(a.h);
    }
  });
});
