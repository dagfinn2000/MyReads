import { describe, expect, it } from "vitest";
import { BookOwnership, ReadingStatus } from "@/lib/enums";
import {
  authorAnchor,
  authorBookState,
  buildAuthorList,
  inAuthorTab,
  matchesAuthorQuery,
  nextByAuthor,
  parseAuthorShow,
  parseAuthorSort,
  sortAuthors,
  type AuthorBook,
} from "@/lib/authors-list";

let n = 0;
function book(over: Partial<AuthorBook> = {}): AuthorBook {
  n++;
  return {
    id: `b${n}`,
    title: `Book ${n}`,
    authors: ["Ursula K. Le Guin"],
    coverUrl: null,
    status: ReadingStatus.WANT_TO_READ,
    ownership: BookOwnership.OWNED,
    rating: null,
    timesRead: 0,
    pageCount: null,
    dateFinished: null,
    seriesName: null,
    seriesNumber: null,
    upNextRank: null,
    createdAt: new Date(Date.UTC(2024, 0, n)),
    updatedAt: new Date(Date.UTC(2024, 0, n)),
    ...over,
  };
}

const read = (over: Partial<AuthorBook> = {}) =>
  book({ status: ReadingStatus.READ, timesRead: 1, ...over });

describe("authorBookState", () => {
  it("counts a re-read being read again as reading, and a past read as read", () => {
    expect(authorBookState({ status: ReadingStatus.READING, timesRead: 2 })).toBe("reading");
    expect(authorBookState({ status: ReadingStatus.WANT_TO_READ, timesRead: 1 })).toBe("read");
    expect(authorBookState({ status: ReadingStatus.DNF, timesRead: 0 })).toBe("stopped");
    expect(authorBookState({ status: ReadingStatus.WANT_TO_READ, timesRead: 0 })).toBe("waiting");
  });
});

describe("buildAuthorList", () => {
  it("counts a book for each of its authors, once each, and skips blank names", () => {
    const list = buildAuthorList([
      book({ authors: ["Neil Gaiman", "Terry Pratchett", " Neil Gaiman ", ""] }),
      book({ authors: ["Terry Pratchett"] }),
    ]);
    const byName = Object.fromEntries(list.map((a) => [a.name, a.books.length]));
    expect(byName).toEqual({ "Neil Gaiman": 1, "Terry Pratchett": 2 });
  });

  it("orders covers read first (by finish), then reading, put down and waiting", () => {
    const later = read({ title: "Later", dateFinished: new Date("2025-05-01") });
    const earlier = read({ title: "Earlier", dateFinished: new Date("2023-02-01") });
    const undated = read({ title: "Undated" });
    const reading = book({ title: "Reading", status: ReadingStatus.READING });
    const stopped = book({ title: "Stopped", status: ReadingStatus.DNF });
    const waiting = book({ title: "Waiting" });
    const [a] = buildAuthorList([waiting, later, stopped, reading, earlier, undated]);
    expect(a.books.map((b) => b.title)).toEqual([
      "Undated",
      "Earlier",
      "Later",
      "Reading",
      "Stopped",
      "Waiting",
    ]);
    expect([a.read, a.reading, a.stopped, a.waiting]).toEqual([3, 1, 1, 1]);
    expect(a.current?.title).toBe("Reading");
    expect(a.firstFinished).toEqual(new Date("2023-02-01"));
    expect(a.lastFinished).toEqual(new Date("2025-05-01"));
  });

  it("averages only rated books, and adds up the pages of books read", () => {
    const [a] = buildAuthorList([
      read({ rating: 8, pageCount: 300 }),
      read({ rating: 5, pageCount: 200 }),
      read({ pageCount: 100 }),
      book({ rating: 10, pageCount: 999, status: ReadingStatus.DNF }),
      book({ pageCount: 500 }),
    ]);
    expect(a.averageRating).toBeCloseTo((8 + 5 + 10) / 3);
    expect(a.rated).toBe(3);
    expect(a.pagesRead).toBe(600);
  });

  it("has no average with nothing rated", () => {
    const [a] = buildAuthorList([read(), book()]);
    expect(a.averageRating).toBeNull();
    expect(a.rated).toBe(0);
  });
});

describe("nextByAuthor", () => {
  it("prefers the reader's own Up next list", () => {
    const old = book({ title: "Old" });
    const ranked = book({ title: "Ranked", upNextRank: 2 });
    const first = book({ title: "First", upNextRank: 1 });
    expect(nextByAuthor([old, ranked, first])?.title).toBe("First");
  });

  it("follows a series: the next number, not a later one", () => {
    const one = read({ seriesName: "Earthsea", seriesNumber: 1 });
    const three = book({ title: "Three", seriesName: "Earthsea", seriesNumber: 3 });
    const two = book({ title: "Two", seriesName: "earthsea ", seriesNumber: 2 });
    expect(nextByAuthor([one, three, two])?.title).toBe("Two");
  });

  it("takes a book on hand over one on the wishlist, then the one waiting longest", () => {
    const wished = book({ title: "Wished", ownership: BookOwnership.WISHLIST });
    const newer = book({ title: "Newer" });
    const older = book({ title: "Older", createdAt: new Date("2020-01-01") });
    expect(nextByAuthor([wished, newer, older])?.title).toBe("Older");
    expect(nextByAuthor([wished])?.title).toBe("Wished");
  });

  it("never suggests a book given away, read or being read", () => {
    expect(
      nextByAuthor([
        book({ ownership: BookOwnership.GIVEN_AWAY }),
        read(),
        book({ status: ReadingStatus.READING }),
      ]),
    ).toBeNull();
  });
});

describe("sorting, tabs and search", () => {
  const le = buildAuthorList([
    read({ authors: ["Ursula K. Le Guin"], rating: 8, dateFinished: new Date("2022-01-01") }),
    read({ authors: ["Ursula K. Le Guin"], rating: 6, dateFinished: new Date("2021-01-01") }),
    book({ authors: ["Ursula K. Le Guin"] }),
  ])[0];
  const ab = buildAuthorList([
    read({ authors: ["Douglas Adams"], rating: 7, dateFinished: new Date("2025-01-01") }),
  ])[0];
  const zz = buildAuthorList([book({ authors: ["Émile Zola"] })])[0];

  it("puts the most read first, then A to Z by surname", () => {
    expect(sortAuthors([zz, ab, le], "most").map((a) => a.name)).toEqual([
      "Ursula K. Le Guin",
      "Douglas Adams",
      "Émile Zola",
    ]);
    expect(sortAuthors([zz, le, ab], "name").map((a) => a.name)).toEqual([
      "Douglas Adams",
      "Ursula K. Le Guin",
      "Émile Zola",
    ]);
    expect(
      sortAuthors([zz, le, ab], "name", { authorOrder: "as-written" }).map((a) => a.name),
    ).toEqual(["Douglas Adams", "Émile Zola", "Ursula K. Le Guin"]);
  });

  it("puts the best rated first and the unrated last; Lately by last activity", () => {
    expect(sortAuthors([zz, le, ab], "rating").map((a) => a.name)).toEqual([
      "Ursula K. Le Guin",
      "Douglas Adams",
      "Émile Zola",
    ]);
    expect(sortAuthors([le, zz, ab], "recent")[0].name).toBe("Douglas Adams");
  });

  it("sorts tabs", () => {
    expect(inAuthorTab(le, "waiting")).toBe(true);
    expect(inAuthorTab(ab, "waiting")).toBe(false);
    expect(inAuthorTab(zz, "unread")).toBe(true);
    expect(inAuthorTab(le, "unread")).toBe(false);
  });

  it("finds a name by every word, accents and case aside", () => {
    expect(matchesAuthorQuery("Émile Zola", "emile")).toBe(true);
    expect(matchesAuthorQuery("Ursula K. Le Guin", "le guin")).toBe(true);
    expect(matchesAuthorQuery("Ursula K. Le Guin", "guin adams")).toBe(false);
    expect(matchesAuthorQuery("Anyone", "  ")).toBe(true);
  });

  it("reads the address, falling back to the defaults", () => {
    expect(parseAuthorSort("rating")).toBe("rating");
    expect(parseAuthorSort("constructor")).toBe("most");
    expect(parseAuthorShow(["unread", "all"])).toBe("unread");
    expect(parseAuthorShow(undefined)).toBe("all");
  });
});

describe("authorAnchor", () => {
  it("is readable, stable, and different for names that differ only in case", () => {
    expect(authorAnchor("Ursula K. Le Guin")).toMatch(/^author-ursula-k-le-guin-[0-9a-z]+$/);
    expect(authorAnchor(" Ursula K. Le Guin ")).toBe(authorAnchor("Ursula K. Le Guin"));
    expect(authorAnchor("bell hooks")).not.toBe(authorAnchor("Bell Hooks"));
    expect(authorAnchor("???")).toMatch(/^author-[0-9a-z]+$/);
  });
});
