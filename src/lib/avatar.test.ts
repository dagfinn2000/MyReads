import { describe, expect, it } from "vitest";
import * as avatar from "@/lib/avatar";
import {
  AVATAR_LABELS,
  AVATAR_MOBILITY,
  DEFAULT_AVATAR,
  MAX_SAVED_LOOKS,
  parseAvatar,
  parseSavedLooks,
  randomLook,
  sameLook,
} from "@/lib/avatar";

describe("parseAvatar", () => {
  it("keeps a chosen look, defaulting anything unknown", () => {
    expect(
      parseAvatar({
        skin: "lilac",
        eyes: "wink",
        mouth: "fangs", // not a mouth
        cheeks: ["spot", "dimples", "blush"],
        hair: "spacebuns",
        hat: "tophat",
        accessories: ["cape", "cravat", "glasses"],
        top: "robe",
        topColour: "plum",
      }),
    ).toEqual({
      ...DEFAULT_AVATAR,
      skin: "lilac",
      eyes: "wink",
      cheeks: ["blush", "spot"],
      hair: "spacebuns",
      hat: "tophat",
      accessories: ["glasses", "cape"],
      top: "robe",
      topColour: "plum",
    });
  });

  it("brings the first avatars into the wardrobe", () => {
    // Before the wardrobe: `top` was the jumper's colour, `legs` the
    // trousers', and glasses, a beard and freckles were extras.
    expect(
      parseAvatar({
        skin: "deep",
        hair: "bun",
        hairColour: "pink",
        top: "navy",
        bottom: "skirt",
        legs: "olive",
        hat: "wizard",
        extras: ["beard", "glasses", "freckles"],
      }),
    ).toEqual({
      ...DEFAULT_AVATAR,
      skin: "deep",
      hair: "bun",
      hairColour: "pink",
      top: "jumper",
      topColour: "navy",
      bottom: "skirt",
      bottomColour: "khaki",
      hat: "wizard",
      cheeks: ["freckles"],
      facialHair: "beard",
      accessories: ["glasses"],
    });
    expect(parseAvatar({ top: "teal", legs: "denim", extras: [] })).toEqual(DEFAULT_AVATAR);
  });

  it("starts from the default for anything that isn't a look", () => {
    expect(parseAvatar("junk")).toEqual(DEFAULT_AVATAR);
    expect(parseAvatar(null)).toEqual(DEFAULT_AVATAR);
  });
});

describe("randomLook", () => {
  it("only picks real choices", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 200; i++) {
      const look = randomLook(random);
      expect(parseAvatar(look)).toEqual(look);
    }
  });
});

describe("randomLook and mobility", () => {
  it("keeps the way they get about", () => {
    for (const mobility of AVATAR_MOBILITY) {
      for (let i = 0; i < 20; i++) expect(randomLook(Math.random, mobility).mobility).toBe(mobility);
    }
  });
});

describe("parseSavedLooks", () => {
  it("keeps up to six looks, each made whole", () => {
    const looks = parseSavedLooks([{ hair: "afro" }, "junk", ...Array.from({ length: 8 }, () => ({ hat: "chef" }))]);
    expect(looks).toHaveLength(MAX_SAVED_LOOKS);
    expect(looks[0]).toEqual({ ...DEFAULT_AVATAR, hair: "afro" });
    expect(looks[1]).toEqual({ ...DEFAULT_AVATAR, hat: "chef" });
  });

  it("starts empty for anything that isn't a list", () => {
    expect(parseSavedLooks(undefined)).toEqual([]);
    expect(parseSavedLooks({ hair: "afro" })).toEqual([]);
  });
});

describe("sameLook", () => {
  it("compares every choice, whatever order the extras were put on in", () => {
    expect(sameLook(DEFAULT_AVATAR, { ...DEFAULT_AVATAR })).toBe(true);
    expect(sameLook(DEFAULT_AVATAR, { ...DEFAULT_AVATAR, held: "mug" })).toBe(false);
    expect(
      sameLook(
        { ...DEFAULT_AVATAR, accessories: ["glasses", "cape"] },
        { ...DEFAULT_AVATAR, accessories: ["cape", "glasses"] },
      ),
    ).toBe(true);
  });
});

describe("AVATAR_LABELS", () => {
  it("names every choice", () => {
    const unnamed = Object.entries(avatar)
      .filter(([key, value]) => key.startsWith("AVATAR_") && Array.isArray(value))
      .flatMap(([, options]) => (options as string[]).filter((o) => !AVATAR_LABELS[o]));
    expect(unnamed).toEqual([]);
  });
});
