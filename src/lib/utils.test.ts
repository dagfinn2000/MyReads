import { describe, expect, it } from "vitest";
import { buildSearchText } from "@/lib/utils";

describe("buildSearchText", () => {
  it("joins title, authors, and series, lowercased", () => {
    expect(
      buildSearchText("The Final Empire", ["Brandon Sanderson"], "Mistborn"),
    ).toBe("the final empire brandon sanderson mistborn");
  });

  it("handles missing series and authors without stray whitespace", () => {
    expect(buildSearchText("Dune", [], null)).toBe("dune");
    expect(buildSearchText("Dune", ["Frank Herbert"], undefined)).toBe(
      "dune frank herbert",
    );
  });
});
