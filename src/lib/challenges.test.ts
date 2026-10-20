import { describe, expect, it } from "vitest";
import {
  challengeBooks,
  challengeHref,
  challengePaceText,
  challengeQuery,
  challengeSources,
} from "@/lib/challenges";
import { goalPace, yearClock } from "@/lib/goals";
import { buildPasses, countWindow, type CountBook, type CountRules } from "@/lib/stats-count";
import { yearWindow } from "@/lib/stats-period";

describe("challengeQuery", () => {
  it("keeps the filters that pick books, canonical, and drops the rest", () => {
    expect(
      challengeQuery("tag=sci-fi,classics&shelf=READ&finished=2025&sort=title&dir=asc&group=author"),
    ).toBe("tag=classics%2Csci-fi");
    expect(challengeQuery("shelfId=abc&format=EBOOK&limit=500&made=up")).toBe(
      "shelfId=abc&format=EBOOK",
    );
  });

  it("makes the same slice the same text", () => {
    expect(challengeQuery("tag=b,a")).toBe(challengeQuery("tag=a,b"));
  });
});

describe("challengeHref", () => {
  it("opens the slice in the library, finished in the challenge's year", () => {
    expect(challengeHref("tag=classics", 2026)).toBe("/books?tag=classics&finished=2026");
    expect(challengeHref("", 2026)).toBe("/books?finished=2026");
  });
});

describe("challengeSources", () => {
  it("groups views, shelves and tags, leaving out empty groups", () => {
    expect(
      challengeSources({
        tags: ["classics"],
        shelves: [],
        views: [{ id: "v1", name: "Unread sci-fi" }],
      }),
    ).toEqual([
      {
        group: "Saved views",
        sources: [{ value: "view:v1", label: "Unread sci-fi", name: "Unread sci-fi" }],
      },
      { group: "Tags", sources: [{ value: "tag:classics", label: "classics", name: "Classics" }] },
    ]);
    expect(challengeSources({ tags: [], shelves: [], views: [] })).toEqual([]);
  });
});

describe("challengeBooks", () => {
  const RULES: CountRules = {
    statsPagesRead: "finished",
    statsStoppedBooks: "none",
    statsAudiobooks: "full",
  };
  const d = (day: string) => new Date(`${day}T00:00:00Z`);
  const book = (id: string, finished: string | null, over: Partial<CountBook> = {}): CountBook => ({
    id,
    status: "READ",
    format: "PHYSICAL",
    pageCount: 300,
    currentPage: null,
    dateStarted: null,
    dateFinished: finished ? d(finished) : null,
    rating: null,
    ...over,
  });

  it("counts each matching book finished in the year once, first finished first", () => {
    const passes = buildPasses(
      {
        books: [
          book("late", "2026-09-01"),
          // Finished twice in 2026: counts once, by the first finish.
          book("twice", "2026-08-01"),
          book("early", "2026-02-01"),
          book("other", "2026-03-01"),
          book("lastYear", "2025-12-31"),
          book("reading", null, { status: "READING", currentPage: 40 }),
        ],
        reads: [{ bookId: "twice", dateStarted: null, dateFinished: d("2026-01-15"), rating: null }],
        logDays: [],
        lastLogDates: new Map(),
      },
      RULES,
      "UTC",
    );
    const items = countWindow(passes, yearWindow(2026), RULES);
    const matching = new Set(["late", "twice", "early", "lastYear", "reading"]);
    expect(challengeBooks(items, matching).map((b) => b.id)).toEqual(["twice", "early", "late"]);
  });
});

describe("challengePaceText", () => {
  const oct12 = yearClock("2026-10-12", 2026);

  it("says done, with any extra", () => {
    expect(challengePaceText(goalPace(6, 6, "BOOKS", oct12))).toBe("Done.");
    expect(challengePaceText(goalPace(8, 6, "BOOKS", oct12))).toBe(
      "Done, with 2 more than you planned.",
    );
  });

  it("otherwise reads like the goal's pace", () => {
    expect(challengePaceText(goalPace(0, 6, "BOOKS", yearClock("2026-10-12", 2027)))).toBe(
      "Starts counting on 1 January.",
    );
    expect(challengePaceText(goalPace(2, 6, "BOOKS", oct12))).toBe(
      "3 books behind. About 1 book every 20 days gets you there.",
    );
  });
});
