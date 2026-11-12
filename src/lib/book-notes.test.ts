import { describe, expect, it } from "vitest";
import {
  arrangeTimeline,
  chapterChoices,
  chapterKey,
  chapterLabel,
  chapterStarts,
  pagePastTheEnd,
  stripAt,
  stripEnd,
  tidyChapter,
  type TimelineEntry,
} from "@/lib/book-notes";

let n = 0;
function entry(over: Partial<TimelineEntry> = {}): TimelineEntry {
  n++;
  return {
    kind: "note",
    id: `e${String(n).padStart(3, "0")}`,
    page: null,
    chapter: null,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, n)),
    ...over,
  };
}

/** The sections as [label or "-", paged, ids]. */
const shape = (entries: TimelineEntry[]) =>
  arrangeTimeline(entries).map((s) => [s.label ?? "-", s.paged, s.entries.map((e) => e.id)]);

describe("chapters", () => {
  it("tidies spaces and treats an empty one as none", () => {
    expect(tidyChapter("  Part   Two ")).toBe("Part Two");
    expect(tidyChapter("   ")).toBeNull();
    expect(tidyChapter(null)).toBeNull();
  });

  it("matches a number however it's written", () => {
    const keys = ["3", "03", "Chapter 3", "chapter  3", "ch. 3", "Ch 3", "CH.3", "chap. 3"].map(chapterKey);
    expect(new Set(keys)).toEqual(new Set(["3"]));
    expect(chapterKey("Chapter IV")).toBe(chapterKey("iv"));
    expect(chapterKey("ch.iv")).toBe("iv");
    expect(chapterKey("Chi")).toBe("chi");
  });

  it("keeps a named chapter apart from its number, and ignores case", () => {
    expect(chapterKey("Chapter 3: The Letter")).not.toBe(chapterKey("3"));
    expect(chapterKey("The Shire")).toBe(chapterKey("the  shire"));
    // "Chapter" on its own is a chapter called that, not a number cut short.
    expect(chapterKey("Chapter")).toBe("chapter");
  });

  it("labels a bare number or Roman numeral as a chapter, anything else as typed", () => {
    expect(chapterLabel("3")).toBe("Chapter 3");
    expect(chapterLabel("XII")).toBe("Chapter XII");
    expect(chapterLabel("Prologue")).toBe("Prologue");
    expect(chapterLabel("Chapter 3")).toBe("Chapter 3");
    expect(chapterLabel("mix")).toBe("mix"); // lowercase: a word, not a numeral
    expect(chapterLabel("")).toBeNull();
  });
});

describe("arrangeTimeline", () => {
  it("goes by page, a quote before a note at the same page, then oldest first", () => {
    const late = entry({ page: 90 });
    const noteAt40 = entry({ page: 40 });
    const quoteAt40 = entry({ page: 40, kind: "quote" });
    const first = entry({ page: 5 });
    const again = entry({ page: 40 });
    const sections = arrangeTimeline([late, noteAt40, quoteAt40, first, again]);
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map((e) => e.id)).toEqual([first.id, quoteAt40.id, noteAt40.id, again.id, late.id]);
  });

  it("makes a section of each run of one chapter", () => {
    const a = entry({ page: 10, chapter: "1" });
    const b = entry({ page: 20, chapter: "Chapter 1" });
    const c = entry({ page: 30, chapter: "2" });
    const d = entry({ page: 35 });
    expect(shape([d, c, b, a])).toEqual([
      ["Chapter 1", true, [a.id, b.id]],
      ["Chapter 2", true, [c.id]],
      ["-", true, [d.id]],
    ]);
  });

  it("puts a chapter's unpaged notes at the end of that chapter", () => {
    const a = entry({ page: 10, chapter: "1" });
    const summary = entry({ chapter: "ch 1" });
    const b = entry({ page: 20, chapter: "1" });
    const c = entry({ page: 30, chapter: "2" });
    expect(shape([summary, c, b, a])).toEqual([
      ["Chapter 1", true, [a.id, b.id, summary.id]],
      ["Chapter 2", true, [c.id]],
    ]);
  });

  it("puts the rest after everything with a page: a chapter at a time, then those with neither", () => {
    const paged = entry({ page: 10 });
    const loose = entry();
    const epilogue1 = entry({ chapter: "Epilogue" });
    const prologue = entry({ chapter: "Prologue" });
    const epilogue2 = entry({ chapter: "epilogue" });
    expect(shape([loose, epilogue2, prologue, paged, epilogue1])).toEqual([
      ["-", true, [paged.id]],
      ["Epilogue", false, [epilogue1.id, epilogue2.id]],
      ["Prologue", false, [prologue.id]],
      ["-", false, [loose.id]],
    ]);
  });

  it("treats page 0 as no page", () => {
    const zero = entry({ page: 0 });
    expect(shape([zero])).toEqual([["-", false, [zero.id]]]);
  });

  it("returns nothing for nothing", () => {
    expect(arrangeTimeline([])).toEqual([]);
  });
});

describe("chapterStarts and chapterChoices", () => {
  it("finds where each chapter starts, in book order", () => {
    const entries = [
      entry({ page: 50, chapter: "2" }),
      entry({ page: 12, chapter: "1" }),
      entry({ page: 30, chapter: "Chapter 1" }),
      entry({ chapter: "Epilogue" }),
    ];
    expect(chapterStarts(entries)).toEqual([
      { key: "1", label: "Chapter 1", page: 12 },
      { key: "2", label: "Chapter 2", page: 50 },
    ]);
    // As first typed, in book order, the unplaced one last; one of each.
    expect(chapterChoices(entries)).toEqual(["1", "2", "Epilogue"]);
  });
});

describe("the strip of the book", () => {
  it("runs to the page count, or further when something names a later page", () => {
    expect(stripEnd(300, [entry({ page: 12 })])).toBe(300);
    expect(stripEnd(null, [entry({ page: 12 }), entry({ page: 80 })])).toBe(80);
    expect(stripEnd(null, [entry({ page: 12 })], 140)).toBe(140);
    expect(stripEnd(300, [entry()])).toBeNull();
  });

  it("puts page 1 at the start and the last page at the end", () => {
    expect(stripAt(1, 301)).toBe(0);
    expect(stripAt(151, 301)).toBe(0.5);
    expect(stripAt(301, 301)).toBe(1);
    expect(stripAt(400, 301)).toBe(1);
    expect(stripAt(1, 1)).toBe(0);
  });
});

describe("pagePastTheEnd", () => {
  it("refuses a page past the end, when the end is known", () => {
    expect(pagePastTheEnd(301, 300)).toMatch(/past the end/);
    expect(pagePastTheEnd(300, 300)).toBeNull();
    expect(pagePastTheEnd(5000, null)).toBeNull();
    expect(pagePastTheEnd(null, 300)).toBeNull();
  });
});
