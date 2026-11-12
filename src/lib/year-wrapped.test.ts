import { describe, expect, it } from "vitest";
import { readingStreaks } from "@/lib/progress";
import {
  busiestMonth,
  daysBetween,
  daysSoFar,
  favouriteAuthor,
  hasStory,
  longestAndFastest,
  longestRun,
  pagesYardstick,
  storySlides,
  type WrappedFinish,
  type YearWrapped,
} from "@/lib/year-wrapped";

function finish(id: string, authors: string[], extra: Partial<WrappedFinish> & { pageCount?: number | null } = {}): WrappedFinish {
  const { pageCount = 300, ...rest } = extra;
  return {
    book: { id, title: `Book ${id}`, authors, coverUrl: null, pageCount },
    day: "2026-03-01",
    rating: null,
    days: null,
    ...rest,
  };
}

function year(over: Partial<YearWrapped> = {}): YearWrapped {
  return {
    year: 2026,
    current: false,
    books: 0,
    bookWord: "finished",
    rereads: 0,
    pages: 0,
    minutes: 0,
    days: [],
    months: Array(12).fill(0),
    genres: [],
    finishes: [],
    top: [],
    ratings: true,
    goal: null,
    ...over,
  };
}

describe("longestRun", () => {
  it("finds the longest run of days in a row, across a month's end", () => {
    const days = ["2026-01-02", "2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02", "2026-03-05", "2026-03-06"];
    expect(longestRun(days)).toEqual({ length: 4, start: "2026-01-30", end: "2026-02-02" });
  });

  it("gives a tie to the earlier run, and ignores order and repeats", () => {
    expect(longestRun(["2026-05-02", "2026-05-01", "2026-04-01", "2026-04-02", "2026-04-01"])).toEqual({
      length: 2,
      start: "2026-04-01",
      end: "2026-04-02",
    });
  });

  it("is null with no days, and one day long with one", () => {
    expect(longestRun([])).toBeNull();
    expect(longestRun(["2026-07-04"])).toEqual({ length: 1, start: "2026-07-04", end: "2026-07-04" });
  });

  it("counts the same as the streak on Year in review", () => {
    const days = new Set<string>();
    for (let i = 0; i < 365; i++) {
      if ((i * 7919) % 5 < 3) days.add(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
    }
    expect(longestRun(days)!.length).toBe(readingStreaks(days, new Date("2027-01-01T12:00:00Z"), "UTC").longest);
  });
});

describe("daysBetween", () => {
  it("lists every day from start to end", () => {
    expect(daysBetween("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});

describe("favouriteAuthor", () => {
  it("picks the author with the most different books", () => {
    const author = favouriteAuthor([
      finish("a", ["Jane Austen"]),
      finish("b", ["N.K. Jemisin"]),
      finish("c", ["N.K. Jemisin"]),
      finish("d", ["Jane Austen"]),
      finish("e", ["jane austen "]),
    ]);
    expect(author?.name).toBe("Jane Austen");
    expect(author?.books.map((b) => b.id)).toEqual(["a", "d", "e"]);
  });

  it("counts a book read twice once", () => {
    expect(favouriteAuthor([finish("a", ["Ursula K. Le Guin"]), finish("a", ["Ursula K. Le Guin"])])).toBeNull();
  });

  it("settles a tie by pages, then by who came first", () => {
    const byPages = favouriteAuthor([
      finish("a", ["A"], { pageCount: 100 }),
      finish("b", ["A"], { pageCount: 100 }),
      finish("c", ["B"], { pageCount: 400 }),
      finish("d", ["B"], { pageCount: 400 }),
    ]);
    expect(byPages?.name).toBe("B");
    const byFirst = favouriteAuthor([finish("a", ["A"]), finish("c", ["B"]), finish("b", ["A"]), finish("d", ["B"])]);
    expect(byFirst?.name).toBe("A");
  });

  it("credits each author of a book written together", () => {
    const author = favouriteAuthor([finish("a", ["Terry Pratchett", "Neil Gaiman"]), finish("b", ["Neil Gaiman"])]);
    expect(author?.name).toBe("Neil Gaiman");
  });
});

describe("busiestMonth", () => {
  it("is the month with the most, the earlier of a tie", () => {
    expect(busiestMonth([1, 3, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(1);
  });

  it("is null for an empty year", () => {
    expect(busiestMonth(Array(12).fill(0))).toBeNull();
  });
});

describe("daysSoFar", () => {
  it("counts today in a year under way, and whole years otherwise", () => {
    expect(daysSoFar(2026, "2026-01-01")).toBe(1);
    expect(daysSoFar(2026, "2026-11-12")).toBe(316);
    expect(daysSoFar(2024, "2026-11-12")).toBe(366);
    expect(daysSoFar(2027, "2026-11-12")).toBe(0);
  });
});

describe("pagesYardstick", () => {
  it("measures a big year in War and Peace, a smaller one in The Hobbit", () => {
    expect(pagesYardstick(12_480)).toEqual({ title: "War and Peace", times: 10 });
    expect(pagesYardstick(1_000)).toEqual({ title: "The Hobbit", times: 3 });
    expect(pagesYardstick(500)).toBeNull();
  });
});

describe("longestAndFastest", () => {
  it("finds the longest book and the quickest read", () => {
    const { longest, fastest } = longestAndFastest([
      finish("a", [], { pageCount: 200, days: 9 }),
      finish("b", [], { pageCount: 1000, days: 30 }),
      finish("c", [], { pageCount: null, days: 2 }),
    ]);
    expect(longest?.book.id).toBe("b");
    expect(fastest?.book.id).toBe("c");
  });
});

describe("storySlides", () => {
  it("opens and closes every story, with only the slides that have something to say", () => {
    expect(storySlides(year({ books: 1, finishes: [finish("a", ["A"])] }))).toEqual([
      "intro",
      "books",
      "longest",
      "picture",
    ]);
  });

  it("plays every slide for a full year", () => {
    const finishes = [finish("a", ["A"], { rating: 10 }), finish("b", ["A"], { rating: 8 })];
    const full = year({
      books: 2,
      pages: 600,
      minutes: 600,
      days: ["2026-01-01", "2026-01-02"],
      months: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      genres: [{ tag: "Fantasy", count: 2 }],
      finishes,
      top: finishes,
      goal: { done: 2, target: 2, unit: "BOOKS" },
    });
    expect(storySlides(full)).toEqual([
      "intro",
      "books",
      "pages",
      "time",
      "days",
      "months",
      "genres",
      "author",
      "top",
      "goal",
      "picture",
    ]);
  });

  it("shows the longest and quickest instead of the top books when ratings are off", () => {
    const finishes = [finish("a", ["A"], { rating: 10 })];
    const slides = storySlides(year({ books: 1, finishes, top: [], ratings: false }));
    expect(slides).toContain("longest");
    expect(slides).not.toContain("top");
  });

  it("leaves out less than an hour with the timer", () => {
    expect(storySlides(year({ books: 1, minutes: 59 }))).not.toContain("time");
  });
});

describe("hasStory", () => {
  it("is false for a year with nothing in it", () => {
    expect(hasStory(year())).toBe(false);
    expect(hasStory(year({ days: ["2026-02-02"] }))).toBe(true);
  });
});
