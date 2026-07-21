import { describe, expect, it } from "vitest";
import {
  authorSortKey,
  groupBooks,
  sortBooks,
  type SortableBook,
} from "@/lib/library-sort";

function book(overrides: Partial<SortableBook> & { title: string }): SortableBook {
  return {
    authors: [],
    rating: null,
    seriesName: null,
    seriesNumber: null,
    dateFinished: null,
    createdAt: new Date(0),
    ...overrides,
  };
}

describe("authorSortKey", () => {
  it("files authors by surname", () => {
    expect(authorSortKey("Brandon Sanderson")).toBe("sanderson brandon");
  });

  it("keeps surname particles with the last name", () => {
    expect(authorSortKey("Ursula K. Le Guin")).toBe("le guin ursula k.");
    expect(authorSortKey("Robert van Gulik")).toBe("van gulik robert");
    expect(authorSortKey("Erik van der Berg")).toBe("van der berg erik");
  });

  it("moves suffixes to the end", () => {
    expect(authorSortKey("Martin Luther King Jr.")).toBe("king martin luther jr.");
  });

  it("uses single-word names as their own key", () => {
    expect(authorSortKey("Homer")).toBe("homer");
  });
});

describe("sortBooks by author", () => {
  const leGuin = book({ title: "A Wizard of Earthsea", authors: ["Ursula K. Le Guin"] });
  const vanGulik = book({ title: "The Chinese Maze Murders", authors: ["Robert van Gulik"] });
  const homer = book({ title: "The Odyssey", authors: ["Homer"] });
  const sanderson = book({ title: "Elantris", authors: ["Brandon Sanderson"] });

  it("orders authors surname-first: Le Guin under L, van Gulik under V", () => {
    const sorted = sortBooks([vanGulik, leGuin, sanderson, homer], "author", "asc");
    expect(sorted.map((b) => b.title)).toEqual([
      "The Odyssey", // Homer
      "A Wizard of Earthsea", // Le Guin
      "Elantris", // Sanderson
      "The Chinese Maze Murders", // van Gulik
    ]);
  });

  it("flips author order on desc but keeps shelf order within an author", () => {
    const mistborn1 = book({
      title: "The Final Empire",
      authors: ["Brandon Sanderson"],
      seriesName: "Mistborn",
      seriesNumber: 1,
    });
    const mistborn2 = book({
      title: "The Well of Ascension",
      authors: ["Brandon Sanderson"],
      seriesName: "Mistborn",
      seriesNumber: 2,
    });
    const sorted = sortBooks([mistborn2, homer, mistborn1], "author", "desc");
    expect(sorted.map((b) => b.title)).toEqual([
      "The Final Empire", // Sanderson before Homer on desc…
      "The Well of Ascension", // …but the series stays in reading order
      "The Odyssey",
    ]);
  });

  it("keeps a series together as a block, in series order, novellas slotted in", () => {
    const one = book({
      title: "The Final Empire",
      authors: ["Brandon Sanderson"],
      seriesName: "Mistborn",
      seriesNumber: 1,
    });
    const novella = book({
      title: "Zz Secret History", // title alone would sort it last
      authors: ["Brandon Sanderson"],
      seriesName: "Mistborn",
      seriesNumber: 1.5,
    });
    const two = book({
      title: "The Well of Ascension",
      authors: ["Brandon Sanderson"],
      seriesName: "Mistborn",
      seriesNumber: 2,
    });
    const standalone = book({ title: "Elantris", authors: ["Brandon Sanderson"] });
    const zzStandalone = book({ title: "Warbreaker", authors: ["Brandon Sanderson"] });

    const sorted = sortBooks([two, zzStandalone, novella, standalone, one], "author", "asc");
    expect(sorted.map((b) => b.title)).toEqual([
      "Elantris", // E before M(istborn)
      "The Final Empire", // Mistborn block: 1, 1.5, 2
      "Zz Secret History",
      "The Well of Ascension",
      "Warbreaker", // W after M
    ]);
  });
});

describe("sortBooks by field", () => {
  it("sorts by title", () => {
    const sorted = sortBooks(
      [book({ title: "Beta" }), book({ title: "Alpha" })],
      "title",
      "asc",
    );
    expect(sorted.map((b) => b.title)).toEqual(["Alpha", "Beta"]);
  });

  it("sorts by rating with unrated as 0", () => {
    const sorted = sortBooks(
      [
        book({ title: "Mid", rating: 6 }),
        book({ title: "Unrated" }),
        book({ title: "Top", rating: 10 }),
      ],
      "rating",
      "desc",
    );
    expect(sorted.map((b) => b.title)).toEqual(["Top", "Mid", "Unrated"]);
  });

  it("falls back to createdAt for unknown sorts", () => {
    const older = book({ title: "Older", createdAt: new Date(1000) });
    const newer = book({ title: "Newer", createdAt: new Date(2000) });
    expect(sortBooks([older, newer], "bogus", "desc")[0].title).toBe("Newer");
  });
});

describe("groupBooks", () => {
  it("returns null for the flat view", () => {
    expect(groupBooks([book({ title: "A" })], "none")).toBeNull();
  });

  it("groups by author in surname order, with a fallback for authorless books", () => {
    const groups = groupBooks(
      [
        book({ title: "V", authors: ["Robert van Gulik"] }),
        book({ title: "L", authors: ["Ursula K. Le Guin"] }),
        book({ title: "X" }), // no author
      ],
      "author",
    );
    expect(groups?.map((g) => g.title)).toEqual([
      // The fallback label is surname-keyed like any name ("author unknown"),
      // which files it under A — quirky but deterministic.
      "Unknown author",
      "Ursula K. Le Guin",
      "Robert van Gulik",
    ]);
  });

  it("groups by series in reading order, non-series books trailing", () => {
    const groups = groupBooks(
      [
        book({ title: "Standalone" }),
        book({ title: "Two", seriesName: "Saga", seriesNumber: 2 }),
        book({ title: "One", seriesName: "Saga", seriesNumber: 1 }),
        book({ title: "Novella", seriesName: "Saga", seriesNumber: 1.5 }),
      ],
      "series",
    );
    expect(groups?.map((g) => g.title)).toEqual(["Saga", "Not in a series"]);
    expect(groups?.[0].books.map((b) => b.title)).toEqual(["One", "Novella", "Two"]);
    expect(groups?.[1].books.map((b) => b.title)).toEqual(["Standalone"]);
  });

  it("puts unnumbered series entries after numbered ones", () => {
    const groups = groupBooks(
      [
        book({ title: "Companion", seriesName: "Saga" }),
        book({ title: "One", seriesName: "Saga", seriesNumber: 1 }),
      ],
      "series",
    );
    expect(groups?.[0].books.map((b) => b.title)).toEqual(["One", "Companion"]);
  });
});
