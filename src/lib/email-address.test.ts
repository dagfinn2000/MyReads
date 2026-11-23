import { describe, expect, it } from "vitest";
import { EMAIL_ADDRESS_MAX, isEmailAddress, parseEmailAddress } from "@/lib/email-address";

describe("email addresses", () => {
  it("takes plain addresses", () => {
    for (const ok of ["reader@example.com", "a.b+books@mail.example.co.uk", "x@y.no", "ÅSE@eksempel.no"]) {
      expect(isEmailAddress(ok)).toBe(true);
    }
  });

  it("refuses anything that could name a second recipient or header", () => {
    for (const bad of [
      "",
      "reader",
      "reader@example",
      "reader@@example.com",
      "a@b.com, c@d.com",
      "a@b.com; c@d.com",
      "Reader <a@b.com>",
      "a@b.com\r\nBcc: c@d.com",
      "a b@c.com",
      "a@b..com",
      "a@b.com.",
      '"a"@b.com',
    ]) {
      expect(isEmailAddress(bad)).toBe(false);
    }
    expect(isEmailAddress(`${"a".repeat(EMAIL_ADDRESS_MAX)}@b.com`)).toBe(false);
  });

  it("tidies what's typed, and drops what isn't an address", () => {
    expect(parseEmailAddress("  reader@example.com ")).toBe("reader@example.com");
    expect(parseEmailAddress("nope")).toBe("");
    expect(parseEmailAddress(42)).toBe("");
    expect(parseEmailAddress(undefined)).toBe("");
  });
});
