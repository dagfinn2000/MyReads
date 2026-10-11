import { describe, expect, it } from "vitest";
import { goalProgress, markRereads } from "@/lib/goals";

const finish = (bookId: string, date: string, pageCount: number | null = 300) => ({
  bookId,
  dateFinished: new Date(date),
  pageCount,
});

describe("markRereads", () => {
  it("marks later finishes of the same book", () => {
    const marked = markRereads(
      [finish("a", "2026-03-01"), finish("a", "2025-06-01"), finish("b", "2026-01-01")],
      new Set(),
    );
    expect(marked.map((f) => f.isReread)).toEqual([true, false, false]);
  });

  it("counts an undated earlier read as coming first", () => {
    const marked = markRereads([finish("a", "2026-03-01")], new Set(["a"]));
    expect(marked[0].isReread).toBe(true);
  });
});

describe("goalProgress", () => {
  const year = [
    { isReread: false, pageCount: 300 },
    { isReread: true, pageCount: 200 },
    { isReread: false, pageCount: null },
  ];

  it("counts books, re-reads included by default", () => {
    expect(goalProgress(year, { unit: "BOOKS", countRereads: true })).toBe(3);
    expect(goalProgress(year, { unit: "BOOKS", countRereads: false })).toBe(2);
  });

  it("adds up pages, skipping books with no page count", () => {
    expect(goalProgress(year, { unit: "PAGES", countRereads: true })).toBe(500);
    expect(goalProgress(year, { unit: "PAGES", countRereads: false })).toBe(300);
  });
});
