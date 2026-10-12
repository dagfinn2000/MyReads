import { describe, expect, it } from "vitest";
import { arrangeBookCards, descriptionMayOverflow } from "@/lib/book-page";
import { DEFAULT_PREFERENCES, type BookPageCard } from "@/lib/preferences";

const prefs = (
  bookPageCards: BookPageCard[] = DEFAULT_PREFERENCES.bookPageCards,
  hiddenBookPageCards: BookPageCard[] = [],
) => ({ bookPageCards, hiddenBookPageCards });

describe("arrangeBookCards", () => {
  it("shows every card in today's order by default", () => {
    expect(arrangeBookCards(prefs(), {})).toEqual([
      { key: "shelves", forced: false },
      { key: "reading", forced: false },
      { key: "history", forced: false },
      { key: "lending", forced: false },
      { key: "quotes", forced: false },
    ]);
  });

  it("follows the reader's order", () => {
    const order: BookPageCard[] = ["reading", "quotes", "shelves", "lending", "history"];
    expect(arrangeBookCards(prefs(order), {}).map((c) => c.key)).toEqual(order);
  });

  it("places a card the stored order leaves out, after the listed ones", () => {
    expect(arrangeBookCards(prefs(["quotes", "reading"]), {}).map((c) => c.key)).toEqual([
      "quotes",
      "reading",
      "shelves",
      "history",
      "lending",
    ]);
  });

  it("leaves out hidden cards with nothing in them", () => {
    const arranged = arrangeBookCards(prefs(undefined, ["lending", "quotes"]), {
      lending: false,
    });
    expect(arranged.map((c) => c.key)).toEqual(["shelves", "reading", "history"]);
  });

  it("keeps a hidden Lending card with an open loan, in its place", () => {
    const order: BookPageCard[] = ["reading", "lending", "shelves", "history", "quotes"];
    const arranged = arrangeBookCards(prefs(order, ["lending"]), { lending: true });
    expect(arranged).toEqual([
      { key: "reading", forced: false },
      { key: "lending", forced: true },
      { key: "shelves", forced: false },
      { key: "history", forced: false },
      { key: "quotes", forced: false },
    ]);
  });

  it("keeps hidden Quotes, Read history and My reading that have content", () => {
    const arranged = arrangeBookCards(
      prefs(undefined, ["reading", "history", "quotes", "lending", "shelves"]),
      { reading: true, history: true, quotes: true, lending: false },
    );
    expect(arranged).toEqual([
      { key: "reading", forced: true },
      { key: "history", forced: true },
      { key: "quotes", forced: true },
    ]);
  });

  it("never forces the Shelves card", () => {
    const arranged = arrangeBookCards(prefs(undefined, ["shelves"]), { shelves: true });
    expect(arranged.map((c) => c.key)).not.toContain("shelves");
  });

  it("can leave the page with no cards at all", () => {
    expect(arrangeBookCards(prefs(undefined, [...DEFAULT_PREFERENCES.bookPageCards]), {})).toEqual(
      [],
    );
  });
});

describe("descriptionMayOverflow", () => {
  it("is false for a short description", () => {
    expect(descriptionMayOverflow("A short book about a long walk.")).toBe(false);
    expect(descriptionMayOverflow("x".repeat(300))).toBe(false);
  });

  it("is true past 300 characters", () => {
    expect(descriptionMayOverflow("x".repeat(301))).toBe(true);
  });

  it("is true for more than four lines", () => {
    expect(descriptionMayOverflow("a\nb\nc\nd")).toBe(false);
    expect(descriptionMayOverflow("a\nb\nc\nd\ne")).toBe(true);
  });
});
