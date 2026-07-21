import { describe, expect, it } from "vitest";
import { isbnVariants, normalizeIsbn } from "@/lib/isbn";

describe("normalizeIsbn", () => {
  it("strips hyphens and spaces", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(normalizeIsbn("0 306 40615 2")).toBe("0306406152");
  });

  it("uppercases a trailing x check digit", () => {
    expect(normalizeIsbn("080442957x")).toBe("080442957X");
  });
});

describe("isbnVariants", () => {
  // Canonical pair: ISBN-10 0-306-40615-2 ↔ ISBN-13 978-0-306-40615-7.
  it("derives the ISBN-10 counterpart of a 978 ISBN-13", () => {
    expect(isbnVariants("9780306406157")).toEqual(
      expect.arrayContaining(["9780306406157", "0306406152"]),
    );
    expect(isbnVariants("9780306406157")).toHaveLength(2);
  });

  it("derives the ISBN-13 counterpart of an ISBN-10", () => {
    expect(isbnVariants("0306406152")).toEqual(
      expect.arrayContaining(["0306406152", "9780306406157"]),
    );
  });

  it("handles the X check digit in both directions", () => {
    // 0-8044-2957-X has the mod-11 check digit 10 → X.
    expect(isbnVariants("080442957X")).toEqual(
      expect.arrayContaining(["080442957X", "9780804429573"]),
    );
    expect(isbnVariants("9780804429573")).toContain("080442957X");
  });

  it("normalizes before deriving (hyphens, lowercase x)", () => {
    expect(isbnVariants("978-0-306-40615-7")).toContain("0306406152");
    expect(isbnVariants("0-8044-2957-x")).toContain("9780804429573");
  });

  it("returns a 979 ISBN-13 alone — those have no ISBN-10 form", () => {
    expect(isbnVariants("9791234567896")).toEqual(["9791234567896"]);
  });

  it("returns non-ISBN input as itself, normalized", () => {
    expect(isbnVariants("not an isbn")).toEqual(["NOTANISBN"]);
    expect(isbnVariants("12345")).toEqual(["12345"]);
  });
});
