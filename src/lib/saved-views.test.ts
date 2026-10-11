import { describe, expect, it } from "vitest";
import { canonicalViewQuery, canonicalViewQueryFromString } from "@/lib/saved-views";

describe("canonicalViewQuery", () => {
  it("keeps filters in a fixed order with the view last", () => {
    expect(
      canonicalViewQuery({ sort: "title", tag: "fantasy", shelf: "READ", dir: "asc" }),
    ).toBe("shelf=READ&tag=fantasy&group=none&sort=title&dir=asc");
  });

  it("leaves out defaults and parameters the library doesn't know", () => {
    expect(canonicalViewQuery({ shelf: "all", owned: "all", limit: "500", x: "1" })).toBe(
      "group=none&sort=createdAt&dir=desc",
    );
  });

  it("gives the same string for the same view however it was written", () => {
    expect(canonicalViewQueryFromString("dir=asc&sort=title&q=+dune+&group=none")).toBe(
      canonicalViewQuery({ q: "dune", sort: "title", dir: "asc" }),
    );
  });
});
