import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AVATAR_W,
  HELD_BOOK,
  SEAT_OFFSET,
  avatarArt,
  avatarBack,
  heldBookAt,
  seatedLeft,
  seatedTop,
} from "@/components/avatar-art";
import fixture from "@/components/avatar-art.fixture.json";
import { armchairArt } from "@/components/room-art";
import type { Art } from "@/components/room-art";
import {
  AVATAR_ACCESSORIES,
  AVATAR_BODIES,
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
  parseAvatar,
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
  `${l.hair}/${l.hat}/${l.top}/${l.bottom}/${l.shoes}/${l.eyes}/${l.mouth}/${l.facialHair}/${l.ears}/${l.mobility}/${l.height}/${l.body}/${l.held}`;

const cells = (a: Art) => {
  const seen = new Map<string, string>();
  for (const [x, y, w, h, paint] of a.rects) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) seen.set(`${i},${j}`, paint);
  }
  return seen;
};

/** The looks drawn in every build; the default (average) build draws
 *  them all. */
const BUILD_LOOKS = LOOKS.filter((_, i) => i % 3 === 0);

describe("avatarArt", () => {
  const drawn = [
    ...LOOKS.map((look) => [look, avatarArt(look)] as const),
    ...AVATAR_BODIES.filter((body) => body !== "average").flatMap((body) =>
      BUILD_LOOKS.map((l) => [{ ...l, body }, avatarArt({ ...l, body })] as const),
    ),
  ];

  it("keeps every pose inside its sprite, with no dot drawn twice", () => {
    const wrong: string[] = [];
    for (const [look, art] of drawn) {
      for (const [pose, a] of Object.entries(art)) {
        let area = 0;
        for (const [x, y, w, h] of a.rects) {
          if (x < 0 || y < 0 || x + w > a.w || y + h > a.h) wrong.push(`${name(look)} ${pose}`);
          area += w * h;
        }
        if ((look.body === "average" && a.w !== AVATAR_W) || cells(a).size !== area) wrong.push(`${name(look)} ${pose}`);
      }
      if (art.stand.w !== art.stride.w) wrong.push(`${name(look)} widths`);
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

  it("holds the book where the room puts its link, in both hands", () => {
    expect(heldBookAt(avatarArt(DEFAULT_AVATAR).sit)).toEqual(HELD_BOOK);
    for (const body of AVATAR_BODIES) {
      const { sit } = avatarArt({ ...DEFAULT_AVATAR, body });
      const at = heldBookAt(sit);
      const dots = [...cells(sit)];
      const book = dots.filter(([, paint]) => paint.startsWith("book") || paint.startsWith("paper"));
      expect(book.length).toBeGreaterThan(20);
      for (const [key] of book) {
        const [x, y] = key.split(",").map(Number);
        expect(x).toBeGreaterThanOrEqual(at.x);
        expect(x).toBeLessThan(at.x + at.w);
        expect(y).toBeGreaterThanOrEqual(at.y);
        expect(y).toBeLessThan(at.y + at.h);
      }
      // A hand on each half of it.
      const hands = dots
        .filter(([key, paint]) => paint.startsWith("av-skin") && Number(key.split(",")[1]) === at.y + 1)
        .map(([key]) => Number(key.split(",")[0]));
      expect(hands.filter((x) => x < at.x + at.w / 2)).toHaveLength(1);
      expect(hands.filter((x) => x >= at.x + at.w / 2)).toHaveLength(1);
    }
  });

  it("sits in the armchair with its feet on the floor, whatever it wears and its build", () => {
    // The armchair (room-art.tsx) is 29 × 31, its arms 7 dots wide.
    expect(seatedLeft(avatarArt(DEFAULT_AVATAR).sit)).toBe(SEAT_OFFSET.x);
    const wrong: string[] = [];
    for (const [look, { sit }] of drawn) {
      if (seatedTop(sit) + sit.h !== armchairArt().h) wrong.push(`${name(look)} height`);
      // Below the top of the arms, 12 dots down the chair. A fuller figure's
      // cape, robe sleeves or skirt may lie a dot over them.
      const xs = sit.rects.filter(([, y]) => y >= -seatedTop(sit) + 12).flatMap(([x, , w]) => [x, x + w]);
      const over = look.body === "broad" || look.body === "round" ? 1 : 0;
      if (seatedLeft(sit) + Math.min(...xs) < 7 - over || seatedLeft(sit) + Math.max(...xs) > 22 + over) {
        wrong.push(name(look));
      }
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
    expect(differ(AVATAR_BODIES, (body) => ({ body }))).toBe(AVATAR_BODIES.length);
    for (const mobility of AVATAR_MOBILITY) {
      expect(differ(AVATAR_BODIES, (body) => ({ body, mobility }))).toBe(AVATAR_BODIES.length);
    }
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

/** How wide the body is: the first and last columns with anything drawn
 *  below the neck, outline and all. */
const span = (a: Art) => {
  const xs = a.rects.filter(([, y]) => y >= 14 + 12).flatMap(([x, , w]) => [x, x + w]);
  return Math.max(...xs) - Math.min(...xs);
};

describe("avatar builds", () => {
  const hash = (look: AvatarLook) => createHash("sha256").update(JSON.stringify(avatarArt(look))).digest("hex");

  it("draws every look saved before there were builds exactly as it did then", () => {
    // Captured from the drawing code before builds were added. If the
    // drawing is meant to change, update each "art" with the new hash.
    const changed = fixture.filter(({ look, art }) => {
      const saved = parseAvatar({ ...DEFAULT_AVATAR, ...look, body: undefined });
      return saved.body !== "average" || !hash(saved).startsWith(art);
    });
    expect(fixture.length).toBeGreaterThan(150);
    expect(changed.map(({ look }) => look)).toEqual([]);
  });

  it("is slimmer, broader or rounder below the neck, in every pose", () => {
    for (const mobility of AVATAR_MOBILITY) {
      const w = (body: AvatarLook["body"]) => avatarArt({ ...DEFAULT_AVATAR, mobility, body });
      for (const pose of ["stand", "stride", "sit"] as const) {
        expect(span(w("slim")[pose])).toBeLessThan(span(w("average")[pose]));
        expect(span(w("broad")[pose])).toBeGreaterThan(span(w("average")[pose]));
        expect(span(w("round")[pose])).toBeGreaterThanOrEqual(span(w("broad")[pose]));
      }
    }
  });

  it("keeps the head in the middle of the standing sprite, so it turns on the spot", () => {
    const head = (a: Art) => {
      // The top of the head: the first row below the hat's headroom.
      const xs = a.rects.filter(([, y, , , p]) => y === 14 + 1 && p === "av-hair").flatMap(([x, , w]) => [x, x + w]);
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    };
    for (const body of AVATAR_BODIES) {
      const { stand } = avatarArt({ ...DEFAULT_AVATAR, body });
      expect(head(stand) - stand.w / 2).toBe(head(avatarArt(DEFAULT_AVATAR).stand) - AVATAR_W / 2);
      expect(avatarBack(stand)).toBe(body === "broad" ? 2 : body === "round" ? 3 : 0);
    }
  });
});
