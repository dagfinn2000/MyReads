import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@/lib/enums";
import {
  collectAuthors,
  collectSeries,
  matchPages,
  matchScore,
  matchShelves,
  parseQuickQuery,
  quickHref,
  quickPages,
  rankBooks,
  type QuickBook,
} from "@/lib/quick-find";

let n = 0;
function book(over: Partial<QuickBook & { updatedAt: Date }> = {}): QuickBook & { updatedAt: Date } {
  n++;
  return {
    id: `b${n}`,
    title: `Book ${n}`,
    authors: [],
    coverUrl: null,
    status: ReadingStatus.READ,
    statusKey: null,
    seriesName: null,
    seriesNumber: null,
    updatedAt: new Date(2026, 0, 1),
    ...over,
  };
}

describe("matchScore", () => {
  it("ranks the whole name, its start, word starts and anywhere", () => {
    expect(matchScore("Dune", "dune")).toBe(4);
    expect(matchScore("Dune Messiah", "dune")).toBe(3);
    expect(matchScore("Children of Dune", "dune")).toBe(2);
    expect(matchScore("Children of Dune", "chil dun")).toBe(2);
    expect(matchScore("Earthsea", "arth")).toBe(1);
    expect(matchScore("Dune", "hobbit")).toBe(0);
    expect(matchScore("Dune", "")).toBe(0);
  });

  it("goes by the words, case and accents aside", () => {
    expect(matchScore("Émile Zola", "emile")).toBe(3);
    expect(matchScore("Jo Nesbø", "nesbo")).toBe(2);
    expect(matchScore("The  Hobbit", "the hobbit")).toBe(4);
  });
});

describe("rankBooks", () => {
  it("puts a title match before an author's or series' book, the closer first", () => {
    const byAuthor = book({ title: "The Left Hand of Darkness", authors: ["Ursula K. Le Guin"] });
    const inSeries = book({ title: "The Tombs of Atuan", seriesName: "Earthsea" });
    const titled = book({ title: "A Wizard of Earthsea" });
    const exact = book({ title: "Earthsea" });
    expect(rankBooks([byAuthor, inSeries, titled, exact], "earthsea").map((b) => b.title)).toEqual([
      "Earthsea",
      "A Wizard of Earthsea",
      "The Tombs of Atuan",
      "The Left Hand of Darkness",
    ]);
  });

  it("breaks ties with the book being read, then wanted, then the latest touched", () => {
    const old = book({ title: "Dune Messiah", updatedAt: new Date(2025, 0, 1) });
    const recent = book({ title: "Dune Messiah", updatedAt: new Date(2026, 5, 1) });
    const reading = book({ title: "Dune Messiah", status: ReadingStatus.READING, updatedAt: new Date(2020, 0, 1) });
    const wanted = book({ title: "Dune Messiah", status: ReadingStatus.WANT_TO_READ });
    expect(rankBooks([old, recent, wanted, reading], "dune").map((b) => b.id)).toEqual([
      reading.id,
      wanted.id,
      recent.id,
      old.id,
    ]);
  });
});

describe("collectAuthors and collectSeries", () => {
  it("lists matching authors once each, with how many books, the most first", () => {
    const books = [
      { authors: ["Ursula K. Le Guin"] },
      { authors: ["Ursula K. Le Guin", "Ursula K. Le Guin "] },
      { authors: ["Neil Gaiman", "Terry Pratchett"] },
      { authors: ["Terry Pratchett"] },
      { authors: ["Terry Pratchett"] },
    ];
    expect(collectAuthors(books, "ursula")).toEqual([{ name: "Ursula K. Le Guin", count: 2 }]);
    expect(collectAuthors(books, "pratchett gaiman")).toEqual([]);
    expect(collectAuthors(books, "e")).toEqual([
      { name: "Terry Pratchett", count: 3 },
      { name: "Ursula K. Le Guin", count: 2 },
      { name: "Neil Gaiman", count: 1 },
    ]);
  });

  it("groups a series as the Series page does, under its commonest spelling", () => {
    const books = [
      { seriesName: "The Expanse" },
      { seriesName: "the expanse" },
      { seriesName: "The Expanse" },
      { seriesName: null },
      { seriesName: "Expeditionary Force" },
    ];
    expect(collectSeries(books, "exp")).toEqual([
      { name: "Expeditionary Force", count: 1 },
      { name: "The Expanse", count: 3 },
    ]);
  });

  it("shows at most three", () => {
    const books = ["Ann A", "Ann B", "Ann C", "Ann D"].map((a) => ({ authors: [a] }));
    expect(collectAuthors(books, "ann")).toHaveLength(3);
  });
});

describe("matchShelves and pages", () => {
  it("finds shelves of both kinds by name", () => {
    const shelves = [
      { id: "1", name: "Beach reads", smart: false },
      { id: "2", name: "Short reads", smart: true },
      { id: "3", name: "Classics", smart: false },
    ];
    expect(matchShelves(shelves, "reads").map((s) => s.id)).toEqual(["1", "2"]);
    expect(matchShelves(shelves, "short")).toEqual([{ id: "2", name: "Short reads", smart: true }]);
  });

  it("finds a page by its name or what else it goes by", () => {
    const pages = quickPages(2026);
    expect(matchPages(pages, "stat").map((p) => p.key)).toEqual(["stats"]);
    expect(matchPages(pages, "settings").map((p) => p.key)).toEqual(["account"]);
    expect(matchPages(pages, "year in").map((p) => p.href)).toEqual(["/stats/year/2026"]);
    expect(matchPages(pages, "authors").map((p) => p.key)).toContain("authors");
    expect(matchPages(pages, "duplicates").map((p) => p.href)).toEqual(["/books/tidy"]);
  });
});

describe("where finds open", () => {
  it("builds each kind's address", () => {
    expect(quickHref.book("abc")).toBe("/books/abc");
    expect(quickHref.author("Émile Zola")).toMatch(/^\/authors\?q=%C3%89mile%20Zola#author-/);
    expect(quickHref.series("Earthsea")).toMatch(/^\/series#/);
    expect(quickHref.shelf("s 1")).toBe("/books?shelfId=s%201");
    expect(quickHref.search("  le guin ")).toBe("/books?q=le%20guin");
  });

  it("trims and caps the query", () => {
    expect(parseQuickQuery(null)).toBe("");
    expect(parseQuickQuery("  dune ")).toBe("dune");
    expect(parseQuickQuery("x".repeat(500))).toHaveLength(100);
  });
});
