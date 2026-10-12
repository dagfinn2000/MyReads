import { describe, expect, it } from "vitest";
import { BookOwnership } from "@prisma/client";
import { LENDING_NOTE, lendingMode, outFor, showsLendingCard } from "@/lib/loans";

const at = (iso: string) => new Date(iso);

describe("outFor", () => {
  it("says 'lent today' before a full day has passed", () => {
    // The case that was wrong first time round: lent in the morning, read in
    // the evening. Rounding made that "1 days" — wrong count, wrong grammar.
    expect(outFor(at("2026-07-28T08:00:00Z"), at("2026-07-28T22:00:00Z"))).toBe("lent today");
    expect(outFor(at("2026-07-28T00:00:00Z"), at("2026-07-28T00:00:00Z"))).toBe("lent today");
  });

  it("uses the singular for exactly one day", () => {
    expect(outFor(at("2026-07-27T08:00:00Z"), at("2026-07-28T08:00:00Z"))).toBe("out for 1 day");
    expect(outFor(at("2026-07-27T08:00:00Z"), at("2026-07-28T23:00:00Z"))).toBe("out for 1 day");
  });

  it("counts whole days after that", () => {
    expect(outFor(at("2026-07-01T08:00:00Z"), at("2026-07-28T08:00:00Z"))).toBe("out for 27 days");
  });

  it("never reports negative time for a future-dated loan", () => {
    expect(outFor(at("2026-08-05T00:00:00Z"), at("2026-07-28T00:00:00Z"))).toBe("lent today");
  });
});

describe("lendingMode", () => {
  it("only lets a copy you own be lent", () => {
    expect(lendingMode(BookOwnership.OWNED)).toBe("lendable");
    expect(lendingMode(BookOwnership.BORROWED)).toBe("borrowed");
    expect(lendingMode(BookOwnership.GIVEN_AWAY)).toBe("given-away");
    expect(lendingMode(BookOwnership.WISHLIST)).toBe("wishlist");
  });

  it("says why for each kind of copy", () => {
    expect(LENDING_NOTE.lendable).toBe("This copy is on your shelf.");
    expect(LENDING_NOTE.borrowed).toBe("Borrowed copy. It isn't yours to lend.");
    expect(LENDING_NOTE["given-away"]).toBe("You gave this copy away.");
    expect(LENDING_NOTE.wishlist).toBe("On your wishlist, so there's no copy to lend.");
  });
});

describe("showsLendingCard", () => {
  it("hides the card for a wishlist book with nothing on record", () => {
    expect(showsLendingCard(BookOwnership.WISHLIST, 0)).toBe(false);
  });

  it("keeps a wishlist book's loan history visible", () => {
    expect(showsLendingCard(BookOwnership.WISHLIST, 2)).toBe(true);
  });

  it("shows the card for every other copy", () => {
    for (const o of [BookOwnership.OWNED, BookOwnership.BORROWED, BookOwnership.GIVEN_AWAY]) {
      expect(showsLendingCard(o, 0)).toBe(true);
    }
  });
});
