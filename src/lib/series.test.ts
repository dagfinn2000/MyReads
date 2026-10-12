import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@prisma/client";
import { isNextInSeries, nextInSeries, seriesKey } from "@/lib/series";

const { WANT_TO_READ, READING, READ, DNF } = ReadingStatus;
const book = (seriesNumber: number | null, status: ReadingStatus, timesRead = 0) => ({
  seriesNumber,
  status,
  timesRead,
});

describe("nextInSeries", () => {
  it("is the lowest-numbered book not read yet", () => {
    const books = [book(3, WANT_TO_READ), book(1, READ), book(2, WANT_TO_READ)];
    expect(nextInSeries(books)).toBe(books[2]);
  });

  it("is the book being read when that comes first", () => {
    const books = [book(1, READ), book(2, READING), book(3, WANT_TO_READ)];
    expect(nextInSeries(books)).toBe(books[1]);
  });

  it("skips a book put down or read before, and numbers read in another copy", () => {
    const books = [
      book(1, WANT_TO_READ),
      book(1, READ),
      book(2, DNF),
      book(3, READING, 1), // a re-read
      book(4, WANT_TO_READ),
    ];
    expect(nextInSeries(books)).toBe(books[4]);
  });

  it("ignores unnumbered books and is null when all are done", () => {
    expect(nextInSeries([book(null, WANT_TO_READ), book(1, READ)])).toBeNull();
    expect(nextInSeries([])).toBeNull();
  });
});

describe("isNextInSeries", () => {
  const series = [book(1, READ), book(2, WANT_TO_READ), book(3, WANT_TO_READ)];

  it("lets the next book through and holds back later ones", () => {
    expect(isNextInSeries(series[1], series)).toBe(true);
    expect(isNextInSeries(series[2], series)).toBe(false);
  });

  it("never holds back an unnumbered book or one already read", () => {
    expect(isNextInSeries(book(null, WANT_TO_READ), series)).toBe(true);
    expect(isNextInSeries(book(5, READ), series)).toBe(true);
  });

  it("works when the book isn't in the list it's given", () => {
    expect(isNextInSeries(book(2, WANT_TO_READ), [book(1, READ)])).toBe(true);
    expect(isNextInSeries(book(2, WANT_TO_READ), [book(1, READING)])).toBe(false);
  });
});

describe("seriesKey", () => {
  it("ignores case and stray spaces", () => {
    expect(seriesKey(" The Expanse ")).toBe(seriesKey("the expanse"));
  });
});
