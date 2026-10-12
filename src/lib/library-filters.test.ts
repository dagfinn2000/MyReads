import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@prisma/client";
import {
  activeFilterChips,
  buildBookWhere,
  finishedYearRanges,
  isbnFragment,
  parseFilters,
  searchPlaceholder,
  setTagState,
  tagList,
} from "@/lib/library-filters";

const where = (sp: Record<string, string>, ctx = {}) => buildBookWhere("u1", parseFilters(sp), ctx);

describe("parseFilters", () => {
  it("cleans tag lists: trimmed, each once, without 'all'", () => {
    expect(parseFilters({ tag: " fantasy, classic ,,fantasy,all" }).tag).toBe("fantasy,classic");
    expect(parseFilters({ tag: "all" }).tag).toBe("");
  });

  it("keeps a tag in both lists only as left out", () => {
    const f = parseFilters({ tag: "fantasy,classic", notTag: "classic" });
    expect(f.tag).toBe("fantasy");
    expect(f.notTag).toBe("classic");
  });

  it("splits a tag at its comma: the list can't hold one", () => {
    expect(tagList("science, fiction")).toEqual(["science", "fiction"]);
  });

  it("keeps 'all' tag matching only alongside tags", () => {
    expect(parseFilters({ tag: "a,b", tagMatch: "all" }).tagMatch).toBe("all");
    expect(parseFilters({ tagMatch: "all" }).tagMatch).toBe("");
    expect(parseFilters({ tag: "a", tagMatch: "any" }).tagMatch).toBe("");
  });

  it("only takes a year from 1000 on", () => {
    expect(parseFilters({ finished: "2024" }).finished).toBe("2024");
    for (const bad of ["abcd", "20245", "0099", "999", "2024 "]) {
      expect(parseFilters({ finished: bad }).finished, bad).toBe("");
    }
  });

  it("only takes known values for missing, rating and ownership", () => {
    expect(parseFilters({ missing: "pages" }).missing).toBe("pages");
    expect(parseFilters({ missing: "spine" }).missing).toBe("");
    expect(parseFilters({ minRating: "unrated" }).minRating).toBe("unrated");
    expect(parseFilters({ minRating: "8" }).minRating).toBe("8");
    expect(parseFilters({ minRating: "all" }).minRating).toBe("");
    expect(parseFilters({ minRating: "11" }).minRating).toBe("");
    expect(parseFilters({ owned: "lent" }).owned).toBe("lent");
    expect(parseFilters({ owned: "constructor" }).owned).toBe("all");
  });

  it("trims the author and caps its length", () => {
    expect(parseFilters({ author: "  Ursula K. Le Guin " }).author).toBe("Ursula K. Le Guin");
    expect(parseFilters({ author: "x".repeat(600) }).author).toHaveLength(500);
  });

  it("drops null bytes from every new parameter", () => {
    const f = parseFilters({
      author: "Le\0 Guin",
      tag: "fan\0tasy",
      notTag: "clas\0sic",
      tagMatch: "a\0ll",
      finished: "20\x0024",
      missing: "co\0ver",
      minRating: "unr\0ated",
    });
    expect(f).toMatchObject({
      author: "Le Guin",
      tag: "fantasy",
      notTag: "classic",
      tagMatch: "all",
      finished: "2024",
      missing: "cover",
      minRating: "unrated",
    });
  });
});

describe("buildBookWhere", () => {
  it("builds exactly the old shape for the old filters", () => {
    expect(where({ shelf: "READ", tag: "fantasy", q: "dune", minRating: "8", series: "Dune" })).toEqual({
      userId: "u1",
      status: ReadingStatus.READ,
      rating: { gte: 8 },
      tags: { has: "fantasy" },
      seriesName: { equals: "Dune", mode: "insensitive" },
      AND: [{ searchText: { contains: "dune" } }],
    });
  });

  it("matches any, all or none of several tags", () => {
    expect(where({ tag: "a,b" }).tags).toEqual({ hasSome: ["a", "b"] });
    expect(where({ tag: "a,b", tagMatch: "all" }).tags).toEqual({ hasEvery: ["a", "b"] });
    expect(where({ notTag: "c" }).AND).toEqual([{ NOT: { tags: { hasSome: ["c"] } } }]);
  });

  it("matches one author exactly", () => {
    expect(where({ author: "Ursula K. Le Guin" }).authors).toEqual({ has: "Ursula K. Le Guin" });
  });

  it("leaves the status tab alone for unrated books", () => {
    const w = where({ shelf: "READ", minRating: "unrated" });
    expect(w.status).toBe(ReadingStatus.READ);
    expect(w.rating).toBeUndefined();
    expect(w.AND).toEqual([{ rating: null }, { status: { not: ReadingStatus.WANT_TO_READ } }]);
  });

  it("looks for each missing detail", () => {
    expect(where({ missing: "cover" }).AND).toEqual([{ OR: [{ coverUrl: null }, { coverUrl: "" }] }]);
    expect(where({ missing: "pages" }).AND).toEqual([
      { OR: [{ pageCount: null }, { pageCount: { lte: 0 } }] },
    ]);
    expect(where({ missing: "isbn" }).AND).toEqual([{ OR: [{ isbn: null }, { isbn: "" }] }]);
    expect(where({ missing: "tags" }).AND).toEqual([{ tags: { isEmpty: true } }]);
  });

  it("finds a year's finishes: the sure middle, and the edges looked up ahead", () => {
    const { sure } = finishedYearRanges(2024);
    expect(where({ finished: "2024" }).AND).toEqual([
      {
        OR: [
          { status: ReadingStatus.READ, dateFinished: sure },
          { reads: { some: { dateFinished: sure } } },
        ],
      },
    ]);
    const withEdges = where({ finished: "2024" }, { finishedEdgeIds: ["b1"] });
    expect(withEdges.AND).toEqual([
      {
        OR: [
          { status: ReadingStatus.READ, dateFinished: sure },
          { reads: { some: { dateFinished: sure } } },
          { id: { in: ["b1"] } },
        ],
      },
    ]);
  });

  it("covers every zone between the sure middle and the edges", () => {
    const { sure, edges } = finishedYearRanges(2024);
    expect(edges[0].lt).toEqual(sure.gte);
    expect(edges[1].gte).toEqual(sure.lt);
    // Kiritimati (UTC+14) and Baker Island (UTC−12) both fall inside.
    expect(edges[0].gte.getTime()).toBeLessThanOrEqual(Date.UTC(2024, 0, 1) - 14 * 3600_000);
    expect(edges[1].lt.getTime()).toBeGreaterThanOrEqual(Date.UTC(2025, 0, 1) + 12 * 3600_000);
  });

  it("looks in ISBNs only when asked, and only for ISBN-like words", () => {
    expect(where({ q: "0261102214" }).AND).toEqual([{ searchText: { contains: "0261102214" } }]);
    const w = where({ q: "tolkien 978-0261" }, { searchIn: ["isbn"] });
    expect(w.AND).toEqual([
      { searchText: { contains: "tolkien" } },
      {
        OR: [
          { searchText: { contains: "978-0261" } },
          { isbn: { contains: "9780261", mode: "insensitive" } },
        ],
      },
    ]);
    // A four-digit number is a year or a title far more often.
    expect(where({ q: "1984" }, { searchIn: ["isbn"] }).AND).toEqual([
      { searchText: { contains: "1984" } },
    ]);
  });

  it("matches a whole ISBN, spaced out or in its other form", () => {
    const w = where({ q: "0 261 10221 4" }, { searchIn: ["isbn"] });
    const and = w.AND as object[];
    expect(and).toHaveLength(1);
    expect(and[0]).toMatchObject({
      OR: [
        { AND: expect.any(Array) },
        { isbn: { equals: "0261102214", mode: "insensitive" } },
        { isbn: { equals: "9780261102217", mode: "insensitive" } },
      ],
    });
  });

  it("adds the tag and review matches for each word", () => {
    const w = where(
      { q: "tolkien fantasy" },
      { searchIn: ["tags", "review"], tagsByTerm: [[], ["fantasy", "dark fantasy"]] },
    );
    expect(w.AND).toEqual([
      { OR: [{ searchText: { contains: "tolkien" } }, { reviewSearchText: { contains: "tolkien" } }] },
      {
        OR: [
          { searchText: { contains: "fantasy" } },
          { tags: { hasSome: ["fantasy", "dark fantasy"] } },
          { reviewSearchText: { contains: "fantasy" } },
        ],
      },
    ]);
  });
});

describe("isbnFragment", () => {
  it("reads ISBN-like words, hyphens and a lowercase x included", () => {
    expect(isbnFragment("978-0-261")).toBe("9780261");
    expect(isbnFragment("080442957x")).toBe("080442957X");
    expect(isbnFragment("026110")).toBe("026110");
  });

  it("leaves short numbers and other words alone", () => {
    expect(isbnFragment("1984")).toBeNull();
    expect(isbnFragment("12-3")).toBeNull();
    expect(isbnFragment("x-men")).toBeNull();
    expect(isbnFragment("12345678901234")).toBeNull();
  });
});

describe("activeFilterChips", () => {
  const label = (v: string) => `≥ ${v}/10`;

  it("labels every chip and says how to remove it", () => {
    const chips = activeFilterChips(
      parseFilters({
        author: "Ursula K. Le Guin",
        tag: "fantasy,classic",
        tagMatch: "all",
        notTag: "horror",
        finished: "2024",
        minRating: "8",
        missing: "pages",
        series: "Earthsea",
      }),
      label,
    );
    expect(chips.map((c) => c.label)).toEqual([
      "Author: Ursula K. Le Guin",
      "Tag: fantasy",
      "Tag: classic",
      "Not tagged: horror",
      "Finished in 2024",
      "Rating: ≥ 8/10",
      "Missing: page count",
      "Series: Earthsea",
    ]);
    // Removing one tag keeps the others, and how they match.
    expect(chips[1].clear).toEqual({ tag: "classic", tagMatch: "all" });
    expect(chips[3].clear).toEqual({ notTag: "" });
    expect(chips[0].clear).toEqual({ author: "" });
  });

  it("drops the match rule with the last tag", () => {
    const [chip] = activeFilterChips(parseFilters({ tag: "fantasy", tagMatch: "all" }), label);
    expect(chip.clear).toEqual({ tag: "", tagMatch: "" });
  });

  it("calls unrated books Unrated, and has no chips without filters", () => {
    expect(activeFilterChips(parseFilters({ minRating: "unrated" }), label)[0].label).toBe("Unrated");
    expect(activeFilterChips(parseFilters({ q: "dune", format: "EBOOK" }), label)).toEqual([]);
  });
});

describe("setTagState", () => {
  it("never keeps a tag in both lists", () => {
    const start = { include: ["fantasy"], exclude: ["horror"] };
    expect(setTagState(start, "horror", "in")).toEqual({ include: ["fantasy", "horror"], exclude: [] });
    expect(setTagState(start, "fantasy", "not")).toEqual({ include: [], exclude: ["horror", "fantasy"] });
    expect(setTagState(start, "fantasy", "off")).toEqual({ include: [], exclude: ["horror"] });
  });
});

describe("searchPlaceholder", () => {
  it("names what the search looks in", () => {
    expect(searchPlaceholder([])).toBe("Search title or author…");
    expect(searchPlaceholder(["isbn"])).toBe("Search title, author or ISBN…");
    expect(searchPlaceholder(["review", "tags", "isbn"])).toBe(
      "Search title, author, tags, ISBN or review…",
    );
  });
});
