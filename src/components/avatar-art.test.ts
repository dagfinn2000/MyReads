import { describe, expect, it } from "vitest";
import { AVATAR_W, HELD_BOOK, SEAT_OFFSET, avatarArt, seatedTop } from "@/components/avatar-art";
import { armchairArt } from "@/components/room-art";
import type { Art } from "@/components/room-art";
import {
  AVATAR_ACCESSORIES,
  AVATAR_BOTTOMS,
  AVATAR_CHEEKS,
  AVATAR_EARS,
  AVATAR_EYES,
  AVATAR_FACIAL_HAIR,
  AVATAR_HAIRS,
  AVATAR_HATS,
  AVATAR_HEIGHTS,
  AVATAR_HELD,
  AVATAR_MOBILITY,
  AVATAR_MOUTHS,
  AVATAR_SHOES,
  AVATAR_TOPS,
  DEFAULT_AVATAR,
  LONG_TOPS,
  type AvatarLook,
} from "@/lib/avatar";

const all = [...AVATAR_ACCESSORIES];

/** Looks that between them draw every part with every other part it
 *  could meet: each hair with each hat, with and without everything else
 *  worn; each top with each bottom and pair of shoes; each face; and
 *  each way of getting about, at each height, with each thing carried
 *  and each set of clothes. Colours are CSS only. */
const LOOKS: AvatarLook[] = [
  ...AVATAR_HAIRS.flatMap((hair) =>
    AVATAR_HATS.flatMap((hat) => [
      { ...DEFAULT_AVATAR, hair, hat },
      { ...DEFAULT_AVATAR, hair, hat, facialHair: "longbeard" as const, accessories: all },
    ]),
  ),
  ...AVATAR_TOPS.flatMap((top) =>
    AVATAR_BOTTOMS.flatMap((bottom) =>
      AVATAR_SHOES.map((shoes) => ({ ...DEFAULT_AVATAR, hair: "long" as const, top, bottom, shoes, accessories: all })),
    ),
  ),
  ...AVATAR_HATS.map((hat) => ({ ...DEFAULT_AVATAR, hair: "long" as const, hat, ears: "pointy" as const, accessories: all })),
  ...AVATAR_MOBILITY.flatMap((mobility) =>
    AVATAR_HEIGHTS.flatMap((height) => [
      ...AVATAR_HELD.flatMap((held) =>
        AVATAR_TOPS.map((top) => ({ ...DEFAULT_AVATAR, hair: "ringlets" as const, mobility, height, held, top, accessories: all })),
      ),
      ...AVATAR_BOTTOMS.flatMap((bottom) =>
        AVATAR_SHOES.map((shoes) => ({ ...DEFAULT_AVATAR, mobility, height, bottom, shoes, held: "teddy" as const })),
      ),
    ]),
  ),
  ...AVATAR_EYES.flatMap((eyes) =>
    AVATAR_MOUTHS.flatMap((mouth) =>
      AVATAR_FACIAL_HAIR.map((facialHair) => ({
        ...DEFAULT_AVATAR,
        eyes,
        mouth,
        facialHair,
        cheeks: [...AVATAR_CHEEKS],
      })),
    ),
  ),
];

const name = (l: AvatarLook) =>
  `${l.hair}/${l.hat}/${l.top}/${l.bottom}/${l.shoes}/${l.eyes}/${l.mouth}/${l.facialHair}/${l.ears}/${l.mobility}/${l.height}/${l.held}`;

const cells = (a: Art) => {
  const seen = new Map<string, string>();
  for (const [x, y, w, h, paint] of a.rects) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) seen.set(`${i},${j}`, paint);
  }
  return seen;
};

describe("avatarArt", () => {
  const drawn = LOOKS.map((look) => [look, avatarArt(look)] as const);

  it("keeps every pose inside its sprite, with no dot drawn twice", () => {
    const wrong: string[] = [];
    for (const [look, art] of drawn) {
      for (const [pose, a] of Object.entries(art)) {
        let area = 0;
        for (const [x, y, w, h] of a.rects) {
          if (x < 0 || y < 0 || x + w > a.w || y + h > a.h) wrong.push(`${name(look)} ${pose}`);
          area += w * h;
        }
        if (a.w !== AVATAR_W || cells(a).size !== area) wrong.push(`${name(look)} ${pose}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("outlines the figure all round", () => {
    const gaps: string[] = [];
    for (const [look, art] of drawn) {
      for (const [pose, a] of Object.entries(art)) {
        const dots = cells(a);
        for (const [key, paint] of dots) {
          if (paint === "av-line") continue;
          const [x, y] = key.split(",").map(Number);
          if (
            ![
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].every(([dx, dy]) => dots.has(`${x + dx},${y + dy}`))
          ) {
            gaps.push(`${name(look)} ${pose} at ${x},${y}`);
          }
        }
      }
    }
    expect(gaps.slice(0, 10)).toEqual([]);
  });

  it("stands on the floor: the bottom row of every pose is an outline", () => {
    const wrong: string[] = [];
    for (const [look, { stand, stride, sit }] of drawn) {
      if (stand.h !== stride.h) wrong.push(`${name(look)} heights`);
      for (const pose of [stand, stride, sit]) {
        const bottom = pose.rects.filter(([, y, , h]) => y + h === pose.h);
        if (bottom.length === 0 || bottom.some(([, , , , paint]) => paint !== "av-line")) wrong.push(name(look));
      }
    }
    expect(wrong).toEqual([]);
  });

  it("holds the book where the room puts its link", () => {
    const { sit } = avatarArt(DEFAULT_AVATAR);
    const book = [...cells(sit)].filter(([, paint]) => paint.startsWith("book") || paint.startsWith("paper"));
    expect(book.length).toBeGreaterThan(20);
    for (const [key] of book) {
      const [x, y] = key.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(HELD_BOOK.x);
      expect(x).toBeLessThan(HELD_BOOK.x + HELD_BOOK.w);
      expect(y).toBeGreaterThanOrEqual(HELD_BOOK.y);
      expect(y).toBeLessThan(HELD_BOOK.y + HELD_BOOK.h);
    }
  });

  it("sits in the armchair with its feet on the floor, whatever it wears", () => {
    // The armchair (room-art.tsx) is 29 × 31, its arms 7 dots wide.
    const wrong: string[] = [];
    for (const [look, { sit }] of drawn) {
      if (seatedTop(sit) + sit.h !== armchairArt().h) wrong.push(`${name(look)} height`);
      // Below the top of the arms, 12 dots down the chair.
      const xs = sit.rects.filter(([, y]) => y >= -seatedTop(sit) + 12).flatMap(([x, , w]) => [x, x + w]);
      if (SEAT_OFFSET.x + Math.min(...xs) < 7 || SEAT_OFFSET.x + Math.max(...xs) > 22) wrong.push(name(look));
    }
    expect(wrong).toEqual([]);
  });

  it("draws every choice differently, so each one shows", () => {
    const art = (look: Partial<AvatarLook>) => JSON.stringify(avatarArt({ ...DEFAULT_AVATAR, ...look }));
    const differ = <T extends string>(options: readonly T[], look: (o: T) => Partial<AvatarLook>) =>
      new Set(options.map((o) => art(look(o)))).size;
    expect(differ(AVATAR_EYES, (eyes) => ({ eyes }))).toBe(AVATAR_EYES.length);
    expect(differ(AVATAR_MOUTHS, (mouth) => ({ mouth }))).toBe(AVATAR_MOUTHS.length);
    expect(differ(AVATAR_CHEEKS, (c) => ({ cheeks: [c] }))).toBe(AVATAR_CHEEKS.length);
    expect(differ(AVATAR_FACIAL_HAIR, (facialHair) => ({ facialHair }))).toBe(AVATAR_FACIAL_HAIR.length);
    expect(differ(AVATAR_HAIRS, (hair) => ({ hair }))).toBe(AVATAR_HAIRS.length);
    expect(differ(AVATAR_TOPS, (top) => ({ top }))).toBe(AVATAR_TOPS.length);
    expect(differ(AVATAR_BOTTOMS, (bottom) => ({ bottom }))).toBe(AVATAR_BOTTOMS.length);
    expect(differ(AVATAR_SHOES, (shoes) => ({ shoes }))).toBe(AVATAR_SHOES.length);
    expect(differ(AVATAR_HATS, (hat) => ({ hat }))).toBe(AVATAR_HATS.length);
    expect(differ(AVATAR_ACCESSORIES, (a) => ({ accessories: [a] }))).toBe(AVATAR_ACCESSORIES.length);
    expect(differ(AVATAR_EARS, (ears) => ({ ears }))).toBe(AVATAR_EARS.length);
    expect(differ(AVATAR_HEIGHTS, (height) => ({ height }))).toBe(AVATAR_HEIGHTS.length);
    expect(differ(AVATAR_MOBILITY, (mobility) => ({ mobility }))).toBe(AVATAR_MOBILITY.length);
    expect(differ(AVATAR_HELD, (held) => ({ held }))).toBe(AVATAR_HELD.length);
  });

  it("grows and shrinks with its height, on its feet and in the armchair", () => {
    const h = (height: AvatarLook["height"], mobility: AvatarLook["mobility"] = "walk") =>
      avatarArt({ ...DEFAULT_AVATAR, height, mobility });
    for (const mobility of AVATAR_MOBILITY) {
      expect(h("short", mobility).stand.h).toBeLessThan(h("medium", mobility).stand.h);
      expect(h("tall", mobility).stand.h).toBeGreaterThan(h("medium", mobility).stand.h);
    }
    expect(h("short").sit.h).toBeLessThan(h("tall").sit.h);
  });

  it("puts down what it carries to read", () => {
    const sit = (held: AvatarLook["held"]) => JSON.stringify(avatarArt({ ...DEFAULT_AVATAR, held }).sit);
    expect(new Set(AVATAR_HELD.map(sit)).size).toBe(1);
  });

  it("hides the hair under a headscarf, a turban or a head wrap", () => {
    for (const hat of ["headscarf", "turban", "headwrap"] as const) {
      const looks = AVATAR_HAIRS.map((hair) => JSON.stringify(avatarArt({ ...DEFAULT_AVATAR, hat, hair })));
      expect(new Set(looks).size).toBe(1);
    }
  });

  it("hides the bottoms under a dress or a robe", () => {
    for (const top of LONG_TOPS) {
      const looks = AVATAR_BOTTOMS.map((bottom) => JSON.stringify(avatarArt({ ...DEFAULT_AVATAR, top, bottom })));
      expect(new Set(looks).size).toBe(1);
    }
  });
});
