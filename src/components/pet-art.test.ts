import { describe, expect, it } from "vitest";
import { PET_ART, petArt } from "@/components/pet-art";
import { CAT, CAT_TAIL } from "@/components/room-art";
import type { Art } from "@/components/room-art";
import { PETS } from "@/lib/pets";

const cells = (a: Art) => {
  const seen = new Map<string, string>();
  for (const [x, y, w, h, paint] of a.rects) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) seen.set(`${i},${j}`, paint);
  }
  return seen;
};

describe("pet art", () => {
  it("has a picture for every pet but none", () => {
    expect(petArt("none")).toBeNull();
    for (const pet of PETS.filter((p) => p !== "none")) expect(petArt(pet)).toBe(PET_ART[pet]);
  });

  it("keeps each pose inside its sprite, with no dot drawn twice", () => {
    for (const [pet, art] of Object.entries(PET_ART)) {
      for (const pose of [art.stand, art.stride, art.curl]) {
        const area = pose.rects.reduce((sum, [, , w, h]) => sum + w * h, 0);
        expect(cells(pose).size, pet).toBe(area);
        for (const [x, y, w, h] of pose.rects) {
          expect(x >= 0 && y >= 0 && x + w <= pose.w && y + h <= pose.h, pet).toBe(true);
        }
      }
    }
  });

  it("trots without hopping about: both frames the same size, feet on the floor", () => {
    for (const [pet, { stand, stride, curl }] of Object.entries(PET_ART)) {
      expect([stride.w, stride.h], pet).toEqual([stand.w, stand.h]);
      for (const pose of [stand, stride, curl]) {
        const bottom = pose.rects.filter(([, y, , h]) => y + h === pose.h);
        expect(bottom.length, pet).toBeGreaterThan(0);
      }
    }
  });

  it("outlines every pet all round", () => {
    for (const [pet, art] of Object.entries(PET_ART)) {
      for (const pose of [art.stand, art.stride, art.curl]) {
        const dots = cells(pose);
        const line = pose.rects.find(([x, y]) => x === 0 || y === 0)?.[4];
        for (const [key, paint] of dots) {
          if (paint === line) continue;
          const [x, y] = key.split(",").map(Number);
          const closed = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].every(([dx, dy]) => dots.has(`${x + dx},${y + dy}`));
          expect(closed, `${pet} at ${x},${y}`).toBe(true);
        }
      }
    }
  });

  it("walks: the two frames differ", () => {
    for (const [pet, { stand, stride }] of Object.entries(PET_ART)) {
      expect(JSON.stringify(stride.rects), pet).not.toBe(JSON.stringify(stand.rects));
    }
  });

  it("paints the cats' stripes, patches and points, for their coats", () => {
    const paints = new Set([...PET_ART.cat.stand.rects, ...CAT.rects, ...CAT_TAIL].map((r) => r[4]));
    for (const mark of ["cat-stripe", "cat-patch", "cat-patch2", "cat-point"]) expect(paints).toContain(mark);
  });
});
