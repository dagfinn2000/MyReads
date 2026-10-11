import { describe, expect, it } from "vitest";
import { buildSearchText, escapeLike, foldForSearch, searchTerms } from "@/lib/utils";

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

describe("foldForSearch", () => {
  it("strips accents and spells out letters NFD keeps whole", () => {
    expect(foldForSearch("Brontë")).toBe("bronte");
    expect(foldForSearch("Bjørn Ærø")).toBe("bjorn aero");
    expect(foldForSearch("Åsne Seierstad")).toBe("asne seierstad");
    expect(foldForSearch("Straße, Łódź, Þór")).toBe("strasse, lodz, thor");
  });

  it("leaves scripts without Latin accents intact", () => {
    // NFD splits kana and hangul too; NFC puts them back together.
    expect(foldForSearch("がっこう 한국어")).toBe("がっこう 한국어");
  });
});

describe("buildSearchText folding", () => {
  it("stores the folded form, so accent-free searches match", () => {
    expect(buildSearchText("Jane Eyre", ["Charlotte Brontë"], "Brontë Novels")).toBe(
      "jane eyre charlotte bronte bronte novels",
    );
  });
});

describe("searchTerms", () => {
  it("trims, splits into words, folds, and dedupes", () => {
    expect(searchTerms("   Tolkien  HOBBIT tolkien ")).toEqual(["tolkien", "hobbit"]);
    expect(searchTerms("Brontë")).toEqual(["bronte"]);
    expect(searchTerms("   ")).toEqual([]);
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(searchTerms("100% a_b c\\d")).toEqual(["100\\%", "a\\_b", "c\\\\d"]);
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
  });
});
