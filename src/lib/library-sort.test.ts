import { describe, expect, it } from "vitest";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import {
  authorSortKey,
  groupBooks,
  publishedYear,
  ratingLabel,
  seriesHeading,
  seriesProgress,
  sliceGroups,
  sortBooks,
  titleSortKey,
  type GroupableBook,
} from "@/lib/library-sort";

function book(overrides: Partial<GroupableBook> & { title: string }): GroupableBook {
  return {
    authors: [],
    rating: null,
    seriesName: null,
    seriesNumber: null,
    dateFinished: null,
    dateStarted: null,
    pageCount: null,
    publishedDate: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    status: ReadingStatus.WANT_TO_READ,
    format: BookFormat.PHYSICAL,
    ownership: BookOwnership.OWNED,
    tags: [],
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

  it("sorts by rating, unrated last", () => {
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

  it("groups by author in surname order, authorless books last", () => {
    const groups = groupBooks(
      [
        book({ title: "V", authors: ["Robert van Gulik"] }),
        book({ title: "X" }), // no author
        book({ title: "L", authors: ["Ursula K. Le Guin"] }),
      ],
      "author",
    );
    // Last, like the author sort puts them.
    expect(groups?.map((g) => g.title)).toEqual([
      "Ursula K. Le Guin",
      "Robert van Gulik",
      "Unknown author",
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

describe("sorting rules", () => {
  const titles = (books: GroupableBook[]) => books.map((b) => b.title);

  it("files titles past a leading article when asked", () => {
    const books = [
      book({ title: "The Hobbit" }),
      book({ title: "Dune" }),
      book({ title: "A Wizard of Earthsea" }),
    ];
    expect(titles(sortBooks(books, "title", "asc"))).toEqual([
      "A Wizard of Earthsea",
      "Dune",
      "The Hobbit",
    ]);
    expect(titles(sortBooks(books, "title", "asc", { ignoreArticles: true }))).toEqual([
      "Dune",
      "The Hobbit",
      "A Wizard of Earthsea",
    ]);
  });

  it("skips the alphabet's own articles too, but never a whole title", () => {
    expect(titleSortKey("Den siste viking", { ignoreArticles: true, alphabet: "nb" })).toBe(
      "siste viking",
    );
    expect(titleSortKey("Den siste viking", { ignoreArticles: true })).toBe("Den siste viking");
    expect(titleSortKey("It", { ignoreArticles: true })).toBe("It");
  });

  it("sorts authors as written when asked", () => {
    expect(authorSortKey("Ursula K. Le Guin", { authorOrder: "as-written" })).toBe(
      "ursula k. le guin",
    );
  });

  it("puts Æ, Ø and Å after Z in the Norwegian alphabet", () => {
    const books = [
      book({ title: "Åsgårdsreien" }),
      book({ title: "Zorro" }),
      book({ title: "Ærlig talt" }),
    ];
    expect(titles(sortBooks(books, "title", "asc", { alphabet: "nb" }))).toEqual([
      "Zorro",
      "Ærlig talt",
      "Åsgårdsreien",
    ]);
  });
});

describe("books without a value, and ties", () => {
  const titles = (books: GroupableBook[]) => books.map((b) => b.title);
  const day = (s: string) => new Date(`${s}T12:00:00Z`);

  it("puts books with no value last, whichever way round", () => {
    const cases: [string, Partial<GroupableBook>, Partial<GroupableBook>][] = [
      ["rating", { rating: 4 }, { rating: 8 }],
      ["dateFinished", { dateFinished: day("2024-01-01") }, { dateFinished: day("2025-01-01") }],
      ["dateStarted", { dateStarted: day("2024-01-01") }, { dateStarted: day("2025-01-01") }],
      ["pageCount", { pageCount: 100 }, { pageCount: 900 }],
      ["published", { publishedDate: "1999" }, { publishedDate: "2003-07" }],
    ];
    for (const [sort, low, high] of cases) {
      const books = [
        book({ title: "None" }),
        book({ title: "High", ...high }),
        book({ title: "Low", ...low }),
      ];
      expect(titles(sortBooks(books, sort, "desc")), sort).toEqual(["High", "Low", "None"]);
      expect(titles(sortBooks(books, sort, "asc")), sort).toEqual(["Low", "High", "None"]);
    }
  });

  it("counts a page count of 0 as none", () => {
    const books = [book({ title: "Zero", pageCount: 0 }), book({ title: "Some", pageCount: 10 })];
    expect(titles(sortBooks(books, "pageCount", "asc"))).toEqual(["Some", "Zero"]);
  });

  it("breaks ties by author surname, then title, A to Z even when sorted descending", () => {
    const books = [
      book({ title: "B", authors: ["Zadie Smith"], rating: 8 }),
      book({ title: "Z", authors: ["Ursula K. Le Guin"], rating: 8 }),
      book({ title: "A", authors: ["Zadie Smith"], rating: 8 }),
      book({ title: "No author", rating: 8 }),
      book({ title: "Top", authors: ["Zadie Smith"], rating: 10 }),
    ];
    expect(titles(sortBooks(books, "rating", "desc"))).toEqual([
      "Top",
      "Z",
      "A",
      "B",
      "No author",
    ]);
  });

  it("puts books without an author last under Author, both ways", () => {
    const books = [
      book({ title: "Nobody's" }),
      book({ title: "Homer's", authors: ["Homer"] }),
      book({ title: "Le Guin's", authors: ["Ursula K. Le Guin"] }),
    ];
    expect(titles(sortBooks(books, "author", "asc"))).toEqual(["Homer's", "Le Guin's", "Nobody's"]);
    expect(titles(sortBooks(books, "author", "desc"))).toEqual(["Le Guin's", "Homer's", "Nobody's"]);
  });

  it("sorts by year published and by when a book was last changed", () => {
    const books = [
      book({ title: "Old", publishedDate: "c. 1950", updatedAt: new Date(3000) }),
      book({ title: "New", publishedDate: "2020-05-01", updatedAt: new Date(1000) }),
    ];
    expect(titles(sortBooks(books, "published", "desc"))).toEqual(["New", "Old"]);
    expect(titles(sortBooks(books, "updatedAt", "desc"))).toEqual(["Old", "New"]);
  });

  it("falls back to date added for a sort name from Object's prototype", () => {
    const older = book({ title: "Older", createdAt: new Date(1000) });
    const newer = book({ title: "Newer", createdAt: new Date(2000) });
    expect(titles(sortBooks([older, newer], "constructor", "desc"))).toEqual(["Newer", "Older"]);
  });
});

describe("publishedYear", () => {
  it("reads the first four-digit year", () => {
    expect(publishedYear("2003-07")).toBe(2003);
    expect(publishedYear("c. 1999")).toBe(1999);
    expect(publishedYear("May 12, 1987")).toBe(1987);
    expect(publishedYear("")).toBeNull();
    expect(publishedYear(null)).toBeNull();
    expect(publishedYear("n.d.")).toBeNull();
  });
});

describe("the newer groupings", () => {
  const titles = (g: { books: GroupableBook[] }) => g.books.map((b) => b.title);
  const read = (title: string, dateFinished?: string) =>
    book({
      title,
      status: ReadingStatus.READ,
      dateFinished: dateFinished ? new Date(dateFinished) : null,
    });

  it("files finishes by year in the reader's zone, newest first", () => {
    const books = [
      // 23:30 UTC on New Year's Eve is already 2026 in Oslo.
      read("Late", "2025-12-31T23:30:00Z"),
      // Typed into a date field: that day everywhere, New York included.
      read("Typed", "2026-01-01T00:00:00Z"),
      read("Older", "2024-06-01T10:00:00Z"),
      read("Undated"),
      // Not Read, so a leftover date doesn't count.
      book({
        title: "Reading",
        status: ReadingStatus.READING,
        dateFinished: new Date("2024-06-01T10:00:00Z"),
      }),
    ];
    const oslo = groupBooks(books, "yearFinished", { timeZone: "Europe/Oslo" })!;
    expect(oslo.map((g) => g.title)).toEqual([
      "2026",
      "2024",
      "Finished, date not known",
      "Not finished",
    ]);
    expect(titles(oslo[0])).toEqual(["Late", "Typed"]);
    const ny = groupBooks(books, "yearFinished", { timeZone: "America/New_York" })!;
    expect(ny.map((g) => g.title)).toEqual([
      "2026",
      "2025",
      "2024",
      "Finished, date not known",
      "Not finished",
    ]);
    expect(titles(ny[0])).toEqual(["Typed"]);
  });

  it("files statuses in reading order and drops empty ones", () => {
    const groups = groupBooks(
      [
        book({ title: "Done", status: ReadingStatus.READ }),
        book({ title: "Now", status: ReadingStatus.READING }),
        book({ title: "Later", status: ReadingStatus.WANT_TO_READ }),
      ],
      "status",
    )!;
    expect(groups.map((g) => g.title)).toEqual(["Currently Reading", "Want to Read", "Read"]);
  });

  it("files formats and ownership in a fixed order with their labels", () => {
    const books = [
      book({ title: "A", format: BookFormat.AUDIOBOOK, ownership: BookOwnership.GIVEN_AWAY }),
      book({ title: "E", format: BookFormat.EBOOK, ownership: BookOwnership.WISHLIST }),
      book({ title: "P", format: BookFormat.PHYSICAL, ownership: BookOwnership.BORROWED }),
      book({ title: "O", format: BookFormat.PHYSICAL, ownership: BookOwnership.OWNED }),
    ];
    expect(groupBooks(books, "format")!.map((g) => g.title)).toEqual([
      "Physical",
      "Ebook",
      "Audiobook",
    ]);
    expect(groupBooks(books, "ownership")!.map((g) => g.title)).toEqual([
      "Owned",
      "Borrowed",
      "Wishlist",
      "No longer have it",
    ]);
  });

  it("puts a book under each of its tags, in the reader's alphabet, untagged last", () => {
    const books = [
      book({ title: "Both", tags: ["ærlig", "zebra"] }),
      book({ title: "None" }),
      book({ title: "One", tags: ["zebra"] }),
    ];
    const groups = groupBooks(books, "tag", { alphabet: "nb" })!;
    expect(groups.map((g) => g.title)).toEqual(["zebra", "ærlig", "No tags"]);
    expect(titles(groups[0])).toEqual(["Both", "One"]);
    expect(titles(groups[1])).toEqual(["Both"]);
  });

  it("files shelves in the reader's shelf order, then by name, unshelved last", () => {
    const fav = { id: "s-fav", name: "Favourites" };
    const beach = { id: "s-beach", name: "Beach reads" };
    const club = { id: "s-club", name: "Book club" };
    const books = [
      book({ title: "Loose", shelves: [] }),
      book({ title: "Loved", shelves: [fav, beach] }),
      book({ title: "Club", shelves: [club] }),
    ];
    expect(groupBooks(books, "shelf")!.map((g) => g.title)).toEqual([
      "Beach reads",
      "Book club",
      "Favourites",
      "Not on a shelf",
    ]);
    const ordered = groupBooks(books, "shelf", { shelfOrder: ["s-fav", "deleted-shelf"] })!;
    expect(ordered.map((g) => g.title)).toEqual([
      "Favourites",
      "Beach reads",
      "Book club",
      "Not on a shelf",
    ]);
  });

  it("is one 'Not on a shelf' section when there are no shelves", () => {
    const groups = groupBooks([book({ title: "A" })], "shelf")!;
    expect(groups.map((g) => g.title)).toEqual(["Not on a shelf"]);
  });

  it("files ratings highest first in the reader's style, unrated last", () => {
    const books = [
      book({ title: "Half", rating: 1 }),
      book({ title: "Top", rating: 10 }),
      book({ title: "None" }),
      book({ title: "Odd", rating: 9 }),
    ];
    expect(groupBooks(books, "rating")!.map((g) => g.title)).toEqual([
      "5 stars",
      "4½ stars",
      "½ star",
      "Unrated",
    ]);
    // An odd value under whole stars still shows, as the half it is.
    expect(groupBooks(books, "rating", { ratingStyle: "whole" })![1].title).toBe("4½ stars");
    expect(groupBooks(books, "rating", { ratingStyle: "ten" })!.map((g) => g.title)).toEqual([
      "10/10",
      "9/10",
      "1/10",
      "Unrated",
    ]);
  });

  it("gives every section a unique, stable key", () => {
    const books = [
      book({ title: "A", authors: ["Ann"], seriesName: "S", tags: ["x"], rating: 8 }),
      read("B", "2024-02-02T10:00:00Z"),
    ];
    const groupings = [
      "author",
      "series",
      "yearFinished",
      "status",
      "format",
      "ownership",
      "tag",
      "shelf",
      "rating",
    ];
    for (const group of groupings) {
      const keys = groupBooks(books, group)!.map((g) => g.key);
      expect(new Set(keys).size, group).toBe(keys.length);
      expect(groupBooks(books, group)!.map((g) => g.key), group).toEqual(keys);
    }
  });

  it("treats series names that differ only in case and spaces as one series", () => {
    const groups = groupBooks(
      [
        book({ title: "Two", seriesName: "dune ", seriesNumber: 2 }),
        book({ title: "One", seriesName: "Dune", seriesNumber: 1 }),
      ],
      "series",
    )!;
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("dune");
    expect(titles(groups[0])).toEqual(["One", "Two"]);
  });
});

describe("ratingLabel", () => {
  it("words a stored rating in each style", () => {
    expect(ratingLabel(10)).toBe("5 stars");
    expect(ratingLabel(9)).toBe("4½ stars");
    expect(ratingLabel(3)).toBe("1½ stars");
    expect(ratingLabel(2)).toBe("1 star");
    expect(ratingLabel(1)).toBe("½ star");
    expect(ratingLabel(9, "ten")).toBe("9/10");
    expect(ratingLabel(9, "off")).toBe("9/10");
  });
});

describe("sliceGroups", () => {
  it("counts every entry against the budget, repeats included", () => {
    const a = book({ title: "A", tags: ["x", "y"] });
    const b = book({ title: "B", tags: ["x"] });
    const c = book({ title: "C", tags: ["y"] });
    const groups = groupBooks([a, b, c], "tag")!; // x: A B, y: A C
    const sliced = sliceGroups(groups, 3);
    expect(sliced.groups.map((g) => [g.title, g.books.map((x) => x.title), g.total])).toEqual([
      ["x", ["A", "B"], 2],
      ["y", ["A"], 2],
    ]);
    expect(sliced.shownEntries).toBe(3);
    expect(sliced.totalEntries).toBe(4);
  });

  it("leaves out sections the budget doesn't reach", () => {
    const groups = groupBooks(
      [book({ title: "A", tags: ["x"] }), book({ title: "B", tags: ["y"] })],
      "tag",
    )!;
    const sliced = sliceGroups(groups, 1);
    expect(sliced.groups.map((g) => g.title)).toEqual(["x"]);
    expect(sliced).toMatchObject({ shownEntries: 1, totalEntries: 2 });
  });
});

describe("series progress", () => {
  const { WANT_TO_READ, READING, READ, DNF } = ReadingStatus;
  const member = (seriesNumber: number | null, status: ReadingStatus, timesRead = 0) => ({
    seriesNumber,
    status,
    timesRead,
  });

  it("counts what's read and names what's next", () => {
    const p = seriesProgress([
      member(1, READ),
      member(2, READ),
      member(3, READ),
      member(4, WANT_TO_READ),
      member(5, WANT_TO_READ),
    ]);
    expect(p).toMatchObject({ total: 5, read: 3, reading: null, next: 4, missing: [] });
    expect(seriesHeading(p, 5)).toEqual({ detail: "5 books · 3 read · next #4" });
  });

  it("says which book is being read instead of what's next", () => {
    const p = seriesProgress([member(1, READ), member(2, READING), member(3, WANT_TO_READ)]);
    expect(p.reading).toBe(2);
    expect(seriesHeading(p, 3).detail).toBe("3 books · 1 read · reading #2");
  });

  it("skips books put down, as Pick for me does", () => {
    const p = seriesProgress([member(1, READ), member(2, DNF), member(3, WANT_TO_READ)]);
    expect(p.next).toBe(3);
    expect(p.read).toBe(1);
  });

  it("counts a book read before and being re-read as read", () => {
    const p = seriesProgress([member(1, READING, 1), member(2, READ)]);
    expect(p.read).toBe(2);
    expect(seriesHeading(p, 2).detail).toBe("2 books · all read");
  });

  it("lists whole numbers with no book; novellas and prequels fill no gap", () => {
    const p = seriesProgress([
      member(0, READ),
      member(1.5, READ),
      member(2, READ),
      member(6, WANT_TO_READ),
      member(null, WANT_TO_READ),
    ]);
    expect(p.missing).toEqual([1, 3, 4, 5]);
    expect(seriesHeading(p, 5).note).toBe("#1, #3, #4, #5 missing");
  });

  it("shortens a long list of gaps", () => {
    const p = seriesProgress([member(1, READ), member(10, WANT_TO_READ)]);
    expect(seriesHeading(p, 2).note).toBe("#2, #3, #4, #5, #6 and 3 more missing");
  });

  it("has no next or gaps for a series without numbers", () => {
    const p = seriesProgress([member(null, READ), member(null, WANT_TO_READ)]);
    expect(p).toMatchObject({ next: null, reading: null, missing: [] });
    expect(seriesHeading(p, 2)).toEqual({ detail: "2 books · 1 read" });
  });

  it("says when the filters on screen show only part of a series", () => {
    const p = seriesProgress([member(1, READ), member(2, READ), member(3, WANT_TO_READ)]);
    expect(seriesHeading(p, 1).detail).toBe("1 of 3 books · 2 read · next #3");
  });

  it("prints numbers as stored", () => {
    const p = seriesProgress([member(1, READ), member(1.5, WANT_TO_READ)]);
    expect(seriesHeading(p, 2).detail).toBe("2 books · 1 read · next #1.5");
  });
});
