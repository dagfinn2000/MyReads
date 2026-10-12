import { describe, expect, it } from "vitest";
import { BookFormat, BookOwnership } from "@prisma/client";
import { checkVerdict, duplicateNotice, ownershipParam, scanMatchLabel } from "@/lib/check-verdict";

const { OWNED, WISHLIST, BORROWED, GIVEN_AWAY } = BookOwnership;
const { PHYSICAL, EBOOK, AUDIOBOOK } = BookFormat;

describe("checkVerdict on the exact edition", () => {
  it("keeps the green answer for a book you own", () => {
    expect(checkVerdict("isbn", { ownership: OWNED, format: PHYSICAL })).toEqual({
      tone: "success",
      headline: "In your library: this exact edition.",
      detail: null,
      markOwned: null,
      addAnyway: false,
    });
  });

  it("says a wishlist book isn't yours yet and offers I bought it", () => {
    // The bug: this used to be the same green "In your library".
    expect(checkVerdict("isbn", { ownership: WISHLIST, format: PHYSICAL })).toEqual({
      tone: "info",
      headline: "On your wishlist.",
      detail: "You don't own it yet.",
      markOwned: "I bought it",
      addAnyway: false,
    });
  });

  it("warns about a borrowed copy, with nothing to mark", () => {
    const v = checkVerdict("isbn", { ownership: BORROWED, format: EBOOK });
    expect(v.tone).toBe("warn");
    expect(v.headline).toBe("You borrowed this copy.");
    expect(v.detail).toBe("It's in your library, but not your own.");
    expect(v.markOwned).toBeNull();
    expect(v.addAnyway).toBe(false);
  });

  it("warns about a copy given away and offers I have it again", () => {
    const v = checkVerdict("isbn", { ownership: GIVEN_AWAY, format: PHYSICAL });
    expect(v.tone).toBe("warn");
    expect(v.headline).toBe("You gave this copy away.");
    expect(v.markOwned).toBe("I have it again");
  });
});

describe("checkVerdict on another edition", () => {
  it("names the format you own it in", () => {
    expect(checkVerdict("title", { ownership: OWNED, format: EBOOK }).headline).toBe(
      "You have this as an ebook.",
    );
    expect(checkVerdict("title", { ownership: OWNED, format: AUDIOBOOK }).headline).toBe(
      "You have this as an audiobook.",
    );
    expect(checkVerdict("title", { ownership: OWNED, format: PHYSICAL }).headline).toBe(
      "You have this title, as a different edition.",
    );
  });

  it("always offers to add this edition and never to mark the other one owned", () => {
    for (const ownership of [OWNED, WISHLIST, BORROWED, GIVEN_AWAY]) {
      for (const format of [PHYSICAL, EBOOK, AUDIOBOOK]) {
        const v = checkVerdict("title", { ownership, format });
        expect(v.addAnyway).toBe(true);
        expect(v.markOwned).toBeNull();
      }
    }
  });

  it("says which edition is on the wishlist", () => {
    expect(checkVerdict("title", { ownership: WISHLIST, format: EBOOK })).toMatchObject({
      tone: "info",
      headline: "This title is on your wishlist.",
      detail: "The one in your library is an ebook. You don't own it yet.",
    });
  });

  it("warns about borrowed and given-away copies of the title", () => {
    expect(checkVerdict("title", { ownership: BORROWED, format: PHYSICAL })).toMatchObject({
      tone: "warn",
      headline: "You borrowed a copy of this title.",
      detail: "The one in your library is a different edition.",
    });
    expect(checkVerdict("title", { ownership: GIVEN_AWAY, format: AUDIOBOOK })).toMatchObject({
      tone: "warn",
      headline: "You gave a copy of this title away.",
      detail: "The one in your library is an audiobook.",
    });
  });
});

describe("duplicateNotice", () => {
  it("keeps today's wording for a book you own", () => {
    expect(duplicateNotice("isbn", OWNED).lead).toBe(
      "This exact edition is already in your library: ",
    );
    expect(duplicateNotice("title", OWNED).lead).toBe("You already have this title: ");
  });

  it("points a wishlist match at the book instead of a second copy", () => {
    const n = duplicateNotice("isbn", WISHLIST);
    expect(n.lead).toBe("This exact edition is on your wishlist: ");
    expect(n.tail).toContain("Ownership to Owned");
  });

  it("lets another edition be added without fuss", () => {
    expect(duplicateNotice("title", GIVEN_AWAY)).toEqual({
      lead: "You gave a copy of this title away: ",
      tail: ". You can still add this edition.",
    });
  });
});

describe("scanMatchLabel", () => {
  it("keeps the short wording for a book you own", () => {
    expect(scanMatchLabel("isbn", OWNED)).toBe("Already in your library");
    expect(scanMatchLabel("title", OWNED)).toBe("Another edition in your library");
  });

  it("doesn't call a wishlist or given-away book one you have", () => {
    // The bug: every match read "Already in your library".
    expect(scanMatchLabel("isbn", WISHLIST)).toBe("On your wishlist");
    expect(scanMatchLabel("isbn", GIVEN_AWAY)).toBe("You gave this copy away");
    expect(scanMatchLabel("isbn", BORROWED)).toBe("You borrowed this copy");
    expect(scanMatchLabel("title", WISHLIST)).toBe("This title is on your wishlist");
    expect(scanMatchLabel("title", GIVEN_AWAY)).toBe("You gave a copy of this title away");
    expect(scanMatchLabel("title", BORROWED)).toBe("You borrowed a copy of this title");
  });
});

describe("ownershipParam", () => {
  it("takes an exact ownership value", () => {
    expect(ownershipParam("WISHLIST")).toBe(WISHLIST);
    expect(ownershipParam("GIVEN_AWAY")).toBe(GIVEN_AWAY);
  });

  it("ignores anything else, so the preference applies", () => {
    expect(ownershipParam("wishlist")).toBeUndefined();
    expect(ownershipParam("GIVEN")).toBeUndefined();
    expect(ownershipParam(["WISHLIST", "OWNED"])).toBeUndefined();
    expect(ownershipParam("")).toBeUndefined();
    expect(ownershipParam(undefined)).toBeUndefined();
  });
});
