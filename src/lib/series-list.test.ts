import { describe, expect, it } from "vitest";
import type { ReadingStatus } from "@/lib/enums";
import {
  buildSeriesList,
  parseSeriesShow,
  seriesAnchor,
  seriesState,
  showSeries,
  type SeriesBook,
} from "@/lib/series-list";

let n = 0;
function book(
  seriesName: string | null,
  seriesNumber: number | null,
  status: ReadingStatus = "WANT_TO_READ",
  over: Partial<SeriesBook> = {},
): SeriesBook {
  n++;
  return {
    id: `b${n}`,
    title: `Book ${n}`,
    authors: ["A. Writer"],
    coverUrl: null,
    seriesName,
    seriesNumber,
    status,
    timesRead: 0,
    dateFinished: status === "READ" ? new Date("2026-01-01T00:00:00Z") : null,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

describe("buildSeriesList", () => {
  it("groups by series name however it's spelled, in series order", () => {
    const list = buildSeriesList([
      book("The Expanse", 2, "READ"),
      book("the expanse ", 1, "READ"),
      book("The Expanse", null),
      book("The Expanse", 4),
      book(null, null),
      book("  ", 3),
    ]);
    expect(list).toHaveLength(1);
    const [s] = list;
    expect(s.name).toBe("The Expanse");
    expect(s.books.map((b) => b.seriesNumber)).toEqual([1, 2, 4, null]);
    expect(s.progress).toMatchObject({ total: 4, read: 2, missing: [3] });
    expect(s.next?.seriesNumber).toBe(4);
    expect(s.state).toBe("underway");
  });

  it("puts each gap in its place among the books", () => {
    const [s] = buildSeriesList([
      book("Discworld", 1),
      book("Discworld", 1.5),
      book("Discworld", 4),
      book("Discworld", 6),
    ]);
    expect(
      s.slots.map((slot) => (slot.kind === "gap" ? `gap ${slot.number}` : slot.book.seriesNumber)),
    ).toEqual([1, 1.5, "gap 2", "gap 3", 4, "gap 5", 6]);
    expect(s.slots.filter((slot) => slot.kind === "book" && slot.next)).toHaveLength(1);
  });

  it("marks no next book while one is being read", () => {
    const [s] = buildSeriesList([
      book("Wolf Hall", 1, "READ"),
      book("Wolf Hall", 2),
      book("Wolf Hall", 3, "READING"),
    ]);
    expect(s.next?.seriesNumber).toBe(2);
    expect(s.slots.some((slot) => slot.kind === "book" && slot.next)).toBe(false);
  });

  it("names a series after most of its books, and lists first authors by count", () => {
    const [s] = buildSeriesList([
      book("Mistborn", 1, "READ", { authors: ["Brandon Sanderson"] }),
      book("mistborn", 2, "READ", { authors: ["Brandon Sanderson", "Isaac Stewart"] }),
      book("mistborn", 3, "WANT_TO_READ", { authors: ["Someone Else"] }),
    ]);
    expect(s.name).toBe("mistborn");
    expect(s.authors).toEqual(["Brandon Sanderson", "Someone Else"]);
  });
});

describe("seriesState", () => {
  it("is finished once every book is read or put down, gaps or not", () => {
    expect(seriesState([book("S", 1, "READ"), book("S", 3, "DNF")])).toBe("finished");
    // Re-reading a finished series keeps it finished.
    expect(seriesState([book("S", 1, "READING", { timesRead: 1 })])).toBe("finished");
  });

  it("is under way once one is read or being read, else not started", () => {
    expect(seriesState([book("S", 1, "READING"), book("S", 2)])).toBe("underway");
    expect(seriesState([book("S", 1, "READ"), book("S", 2)])).toBe("underway");
    expect(seriesState([book("S", 1), book("S", 2)])).toBe("unstarted");
  });
});

describe("showSeries", () => {
  const list = buildSeriesList([
    book("Zeta", 1, "READ"),
    book("Zeta", 2),
    book("Alpha", 1, "READING", { updatedAt: new Date("2026-05-01T00:00:00Z") }),
    book("Beta", 1),
    book("Gamma", 1, "READ"),
  ]);

  it("shows series under way first, most recently read on top, then by name", () => {
    expect(showSeries(list, "all").map((s) => s.name)).toEqual(["Alpha", "Zeta", "Beta", "Gamma"]);
  });

  it("keeps to one kind on a tab", () => {
    expect(showSeries(list, "underway").map((s) => s.name)).toEqual(["Alpha", "Zeta"]);
    expect(showSeries(list, "unstarted").map((s) => s.name)).toEqual(["Beta"]);
    expect(showSeries(list, "finished").map((s) => s.name)).toEqual(["Gamma"]);
  });
});

describe("parseSeriesShow and seriesAnchor", () => {
  it("reads the tab, falling back to All", () => {
    expect(parseSeriesShow("finished")).toBe("finished");
    expect(parseSeriesShow(["unstarted", "x"])).toBe("unstarted");
    expect(parseSeriesShow("bogus")).toBe("all");
    expect(parseSeriesShow(undefined)).toBe("all");
  });

  it("makes the same anchor for any spelling of a name", () => {
    expect(seriesAnchor("The Expanse")).toBe("series-the-expanse");
    expect(seriesAnchor(" the  expanse ")).toBe("series-the-expanse");
    expect(seriesAnchor("Mumin & Co.")).toBe("series-mumin-co");
    expect(seriesAnchor("Ørnenes høst")).toBe("series-ørnenes-høst");
  });
});
