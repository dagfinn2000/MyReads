import { describe, expect, it } from "vitest";
import {
  BOOKPLATE_NAME_MAX,
  bookplateCountWhere,
  parseBookplateName,
  takesBookplate,
} from "@/lib/bookplate";
import { parsePreferences } from "@/lib/preferences";

describe("bookplates", () => {
  it("keeps the name on one line, trimmed and short enough", () => {
    expect(parseBookplateName("  Dagny \n  Lund  ")).toBe("Dagny Lund");
    expect(parseBookplateName(3)).toBe("");
    expect(parseBookplateName("   ")).toBe("");
    expect(parseBookplateName("x".repeat(60))).toHaveLength(BOOKPLATE_NAME_MAX);
    // Cut at a space, the space doesn't stay at the end.
    expect(parseBookplateName(`${"a".repeat(39)} b`)).toBe("a".repeat(39));
  });

  it("goes only on printed books you own", () => {
    expect(takesBookplate({ ownership: "OWNED", format: "PHYSICAL" })).toBe(true);
    expect(takesBookplate({ ownership: "OWNED", format: "EBOOK" })).toBe(false);
    expect(takesBookplate({ ownership: "OWNED", format: "AUDIOBOOK" })).toBe(false);
    expect(takesBookplate({ ownership: "WISHLIST", format: "PHYSICAL" })).toBe(false);
    expect(takesBookplate({ ownership: "BORROWED", format: "PHYSICAL" })).toBe(false);
    expect(takesBookplate({ ownership: "GIVEN_AWAY", format: "PHYSICAL" })).toBe(false);
  });

  it("numbers a book among those added before it, ties by id", () => {
    const createdAt = new Date("2024-03-01T10:00:00Z");
    expect(bookplateCountWhere("u1", { id: "b5", createdAt })).toEqual({
      userId: "u1",
      ownership: "OWNED",
      format: "PHYSICAL",
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lte: "b5" } }],
    });
  });

  it("is on by default and reads back from stored preferences", () => {
    expect(parsePreferences({}).bookplate).toBe("on");
    expect(parsePreferences({}).bookplateName).toBe("");
    expect(parsePreferences({ bookplate: "off", bookplateName: " Ex  Libris " })).toMatchObject({
      bookplate: "off",
      bookplateName: "Ex Libris",
    });
    expect(parsePreferences({ bookplate: "maybe" }).bookplate).toBe("on");
  });
});
