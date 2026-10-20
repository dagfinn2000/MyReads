import { describe, expect, it } from "vitest";
import {
  challengeHref,
  challengePaceText,
  challengeQuery,
  challengeSources,
  orderByFirstFinish,
} from "@/lib/challenges";
import { goalPace, yearClock } from "@/lib/goals";

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

describe("orderByFirstFinish", () => {
  const d = (day: string) => new Date(`${day}T00:00:00Z`);
  const book = (
    id: string,
    status: string,
    dateFinished: string | null,
    reads: string[] = [],
  ) => ({
    id,
    title: id,
    authors: [],
    coverUrl: null,
    status,
    dateFinished: dateFinished ? d(dateFinished) : null,
    reads: reads.map((r) => ({ dateFinished: d(r) })),
  });

  it("puts the books in order of their first finish in the year", () => {
    const books = [
      book("late", "READ", "2026-09-01"),
      // Finished twice in 2026: placed by the first.
      book("twice", "READ", "2026-08-01", ["2026-01-15", "2025-03-01"]),
      book("early", "READ", "2026-02-01", ["2024-05-05"]),
      // Being re-read: its current finish date doesn't count, its 2026 read does.
      book("rereading", "READING", "2025-12-30", ["2026-03-03"]),
    ];
    expect(orderByFirstFinish(books, 2026, "UTC").map((b) => b.id)).toEqual([
      "twice",
      "early",
      "rereading",
      "late",
    ]);
  });

  it("reads finish dates in the reader's zone", () => {
    // 23:30 on 31 December in UTC is already 1 January in Oslo.
    const nye = { ...book("nye", "READ", null), dateFinished: new Date("2025-12-31T23:30:00Z") };
    const jan = book("jan", "READ", "2026-01-01");
    expect(orderByFirstFinish([jan, nye], 2026, "Europe/Oslo").map((b) => b.id)).toEqual([
      "jan",
      "nye",
    ]);
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
