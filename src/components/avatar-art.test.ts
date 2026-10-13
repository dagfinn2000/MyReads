import { describe, expect, it } from "vitest";
import { AVATAR_W, HELD_BOOK, SEAT_OFFSET, avatarArt } from "@/components/avatar-art";
import type { Art } from "@/components/room-art";
import {
  AVATAR_BOTTOMS,
  AVATAR_EXTRAS,
  AVATAR_HAIRS,
  AVATAR_HATS,
  DEFAULT_AVATAR,
  randomLook,
  type AvatarLook,
} from "@/lib/avatar";

/** Every look that changes the drawing: each hair with each hat, each
 *  bottom, and each extra. Colours are CSS only. */
const LOOKS: AvatarLook[] = AVATAR_HAIRS.flatMap((hair) =>
  AVATAR_HATS.flatMap((hat) =>
    AVATAR_BOTTOMS.map((bottom) => ({ ...DEFAULT_AVATAR, hair, hat, bottom, extras: [...AVATAR_EXTRAS] })),
  ),
);

const cells = (a: Art) => {
  const seen = new Map<string, string>();
  for (const [x, y, w, h, paint] of a.rects) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) seen.set(`${i},${j}`, paint);
  }
  return seen;
};

describe("avatarArt", () => {
  it("keeps every pose inside its sprite, with no dot drawn twice", () => {
    const wrong: string[] = [];
    for (const look of LOOKS) {
      for (const [name, pose] of Object.entries(avatarArt(look))) {
        let area = 0;
        for (const [x, y, w, h] of pose.rects) {
          if (x < 0 || y < 0 || x + w > pose.w || y + h > pose.h) wrong.push(`${look.hair}/${look.hat} ${name}`);
          area += w * h;
        }
        if (pose.w !== AVATAR_W || cells(pose).size !== area) wrong.push(`${look.hair}/${look.hat} ${name}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("outlines the figure all round", () => {
    const gaps: string[] = [];
    for (const look of LOOKS) {
      for (const [name, pose] of Object.entries(avatarArt(look))) {
        const drawn = cells(pose);
        for (const [key, paint] of drawn) {
          if (paint === "av-line") continue;
          const [x, y] = key.split(",").map(Number);
          if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => drawn.has(`${x + dx},${y + dy}`))) {
            gaps.push(`${look.hair}/${look.hat}/${look.bottom} ${name} at ${x},${y}`);
          }
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it("stands on the floor: the bottom row of a standing pose is its shoes' outline", () => {
    const { stand, stride, sit } = avatarArt(DEFAULT_AVATAR);
    for (const pose of [stand, stride, sit]) {
      const bottom = pose.rects.filter(([, y, , h]) => y + h === pose.h);
      expect(bottom.length).toBeGreaterThan(0);
      expect(bottom.every(([, , , , paint]) => paint === "av-line")).toBe(true);
    }
    expect(stand.h).toBe(stride.h);
  });

  it("holds the book where the room puts its link", () => {
    const { sit } = avatarArt(DEFAULT_AVATAR);
    const drawn = cells(sit);
    const book = [...drawn].filter(([, paint]) => paint.startsWith("book") || paint.startsWith("paper"));
    expect(book.length).toBeGreaterThan(20);
    for (const [key] of book) {
      const [x, y] = key.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(HELD_BOOK.x);
      expect(x).toBeLessThan(HELD_BOOK.x + HELD_BOOK.w);
      expect(y).toBeGreaterThanOrEqual(HELD_BOOK.y);
      expect(y).toBeLessThan(HELD_BOOK.y + HELD_BOOK.h);
    }
  });

  it("sits in the armchair with its feet on the floor", () => {
    // The armchair (room-art.tsx) is 29 × 31, its arms 7 dots wide.
    const { sit } = avatarArt({ ...DEFAULT_AVATAR, hair: "curly", hat: "wizard" });
    expect(SEAT_OFFSET.y + sit.h).toBe(31);
    const xs = sit.rects.filter(([, y]) => y >= -SEAT_OFFSET.y + 12).flatMap(([x, , w]) => [x, x + w]);
    expect(SEAT_OFFSET.x + Math.min(...xs)).toBeGreaterThanOrEqual(7);
    expect(SEAT_OFFSET.x + Math.max(...xs)).toBeLessThanOrEqual(22);
  });

  it("draws hats and beards differently, so every choice shows", () => {
    const rects = (look: Partial<AvatarLook>) => JSON.stringify(avatarArt({ ...DEFAULT_AVATAR, ...look }).stand.rects);
    const hats = new Set(AVATAR_HATS.map((hat) => rects({ hat })));
    const hairs = new Set(AVATAR_HAIRS.map((hair) => rects({ hair })));
    const extras = new Set(AVATAR_EXTRAS.map((e) => rects({ extras: [e] })));
    expect(hats.size).toBe(AVATAR_HATS.length);
    expect(hairs.size).toBe(AVATAR_HAIRS.length);
    expect(extras.size).toBe(AVATAR_EXTRAS.length);
  });
});

describe("randomLook", () => {
  it("only picks real choices", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 50; i++) {
      const look = randomLook(random);
      expect(AVATAR_HAIRS).toContain(look.hair);
      expect(AVATAR_HATS).toContain(look.hat);
      expect(look.extras.every((e) => AVATAR_EXTRAS.includes(e))).toBe(true);
    }
  });
});
