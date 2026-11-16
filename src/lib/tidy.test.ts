import { describe, expect, it } from "vitest";
import { BookFormat, ReadingStatus } from "@/lib/enums";
import {
  STALE_DAYS,
  duplicateGroups,
  dupKey,
  isTidyKey,
  parseTidySkips,
  tidyReport,
  titleKey,
  type TidyBook,
} from "@/lib/tidy";

const NOW = new Date("2026-11-16T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

let n = 0;
function book(over: Partial<TidyBook> = {}): TidyBook {
  n++;
  return {
    id: `b${n}`,
    title: `Book ${n}`,
    authors: [`Writer ${n}`],
    coverUrl: "/api/covers/x.jpg",
    isbn: null,
    openLibraryId: null,
    pageCount: 300,
    format: BookFormat.PHYSICAL,
    status: ReadingStatus.READ,
    dateStarted: daysAgo(30),
    dateFinished: daysAgo(10),
    createdAt: new Date(`2026-01-${String((n % 28) + 1).padStart(2, "0")}T00:00:00Z`),
    seriesName: null,
    seriesNumber: null,
    lastLogged: null,
    ...over,
  };
}

describe("titleKey", () => {
  it("drops case, accents, subtitles, a leading article and punctuation", () => {
    expect(titleKey("The Hobbit: or There and Back Again")).toBe(titleKey("Hobbit"));
    expect(titleKey("Thérèse Raquin")).toBe(titleKey("therese raquin"));
    expect(titleKey("Dune (Deluxe Edition)")).toBe(titleKey("Dune"));
    expect(titleKey("Dune")).not.toBe(titleKey("Dune Messiah"));
  });
});

describe("duplicateGroups", () => {
  it("finds the same ISBN in either form, and the same title by the same writer", () => {
    const a = book({ isbn: "9780261103344", title: "The Hobbit", authors: ["J.R.R. Tolkien"] });
    const b = book({ isbn: "0261103342", title: "Hobbit, The", authors: ["Tolkien"] });
    const c = book({ title: "The Hobbit: There and Back Again", authors: ["J. R. R. Tolkien"] });
    const other = book({ title: "The Hobbit", authors: ["Someone Else"] });
    const groups = duplicateGroups([a, b, c, other]);
    expect(groups.map((g) => g.map((x) => x.id))).toEqual([[a.id, b.id, c.id]]);
  });

  it("keeps two numbered volumes of a series apart", () => {
    const one = book({ title: "Collected Stories", authors: ["Ann Lee"], seriesName: "Stories", seriesNumber: 1 });
    const two = book({ title: "Collected Stories", authors: ["Ann Lee"], seriesName: "Stories", seriesNumber: 2 });
    expect(duplicateGroups([one, two])).toEqual([]);
  });

  it("keys a group by all its books, whatever their order", () => {
    const a = book({ id: "zz" });
    const b = book({ id: "aa" });
    expect(dupKey([a, b])).toBe("dup:aa+zz");
  });
});

describe("tidyReport", () => {
  it("lists what's missing, and which of those the catalogues can find", () => {
    const noCover = book({ coverUrl: null, isbn: "9780000000002" });
    const noPages = book({ pageCount: null });
    const audiobook = book({ pageCount: null, format: BookFormat.AUDIOBOOK });
    const noAuthor = book({ authors: [" "] });
    const undated = book({ dateFinished: null });
    const r = tidyReport([noCover, noPages, audiobook, noAuthor, undated], [], NOW);
    expect(r.cover).toEqual([noCover]);
    expect(r.pages).toEqual([noPages]);
    expect(r.author).toEqual([noAuthor]);
    expect(r.date).toEqual([undated]);
    expect(r.lookable).toEqual([noCover.id]);
  });

  it("asks about books on Currently Reading untouched for a while, longest first", () => {
    const fresh = book({ status: ReadingStatus.READING, dateStarted: daysAgo(90), lastLogged: daysAgo(3) });
    const old = book({ status: ReadingStatus.READING, dateStarted: daysAgo(200), lastLogged: daysAgo(120) });
    const older = book({ status: ReadingStatus.READING, dateStarted: daysAgo(400), lastLogged: null });
    const edge = book({ status: ReadingStatus.READING, dateStarted: daysAgo(STALE_DAYS - 1) });
    const r = tidyReport([fresh, old, older, edge], [], NOW);
    expect(r.stale.map((s) => [s.book.id, s.days])).toEqual([
      [older.id, 400],
      [old.id, 120],
    ]);
  });

  it("leaves out what the reader left alone, and counts it", () => {
    const a = book({ coverUrl: null });
    const b = book({ coverUrl: null });
    const twin = book({ title: a.title, authors: a.authors });
    const r = tidyReport([a, b, twin], [`cover:${a.id}`, dupKey([a, twin]), "cover:gone"], NOW);
    expect(r.cover).toEqual([b]);
    expect(r.dup).toEqual([]);
    expect(r.skipped).toBe(2);
  });
});

describe("parseTidySkips", () => {
  it("keeps known shapes once each, and drops the rest", () => {
    expect(parseTidySkips(["cover:a1", "cover:a1", "dup:a+b", "nope:x", "cover:", 7, "cover:a b"])).toEqual([
      "cover:a1",
      "dup:a+b",
    ]);
    expect(parseTidySkips("cover:a1")).toEqual([]);
    expect(isTidyKey("stale:cmabc123")).toBe(true);
  });

  it("takes a huge list in one pass, keeping the newest", () => {
    const many = Array.from({ length: 50_000 }, (_, i) => `cover:b${i}`);
    const started = performance.now();
    const kept = parseTidySkips(many);
    expect(performance.now() - started).toBeLessThan(500);
    expect(kept).toHaveLength(2000);
    expect(kept.at(-1)).toBe("cover:b49999");
  });
});
