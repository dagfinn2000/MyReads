import { describe, expect, it } from "vitest";
import { MAX_STICKERS, STICKERS, cleanStickers, stickerOf, stickerTilt } from "@/lib/stickers";

describe("cleanStickers", () => {
  it("keeps known stickers once each, in the order given", () => {
    expect(cleanStickers(["gift", "signed", "gift", "loved"])).toEqual(["gift", "signed", "loved"]);
  });

  it("drops anything it doesn't know", () => {
    expect(cleanStickers(["signed", "glitter", 7, null, { key: "gift" }, "SIGNED"])).toEqual(["signed"]);
  });

  it("makes anything that isn't a list into none", () => {
    expect(cleanStickers("signed")).toEqual([]);
    expect(cleanStickers(undefined)).toEqual([]);
    expect(cleanStickers({ 0: "signed" })).toEqual([]);
  });

  it("can hold every sticker at once and no more", () => {
    const all = STICKERS.map((s) => s.key);
    expect(cleanStickers([...all, ...all])).toEqual(all);
    expect(MAX_STICKERS).toBe(all.length);
  });
});

describe("stickerOf", () => {
  it("finds a sticker by its key", () => {
    expect(stickerOf("reread")).toMatchObject({ name: "Re-read", stamp: true });
    expect(stickerOf("nope")).toBeUndefined();
  });

  it("has a name for every sticker and no key twice", () => {
    expect(new Set(STICKERS.map((s) => s.key)).size).toBe(STICKERS.length);
    for (const s of STICKERS) expect(s.name).not.toBe("");
  });
});

describe("stickerTilt", () => {
  it("is the same every time for a book and sticker", () => {
    expect(stickerTilt("Dune", "signed")).toBe(stickerTilt("Dune", "signed"));
  });

  it("differs between books, so a shelf isn't pinned in step", () => {
    const tilts = new Set(["Dune", "Emma", "Ulysses", "Beloved", "Middlemarch", "Kindred"].map((t) => stickerTilt(t, "gift")));
    expect(tilts.size).toBeGreaterThan(3);
  });

  it("keeps a sticker within 9 degrees and a stamp within 13", () => {
    for (let i = 0; i < 400; i++) {
      expect(Math.abs(stickerTilt(`Book ${i}`, "gift"))).toBeLessThanOrEqual(9);
      expect(Math.abs(stickerTilt(`Book ${i}`, "reread"))).toBeLessThanOrEqual(13);
    }
  });
});
