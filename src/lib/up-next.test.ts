import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@prisma/client";
import { upNext } from "@/lib/up-next";

const { READ, READING, WANT_TO_READ } = ReadingStatus;
const book = (
  id: string,
  status: ReadingStatus,
  seriesName: string | null = null,
  seriesNumber: number | null = null,
) => ({ id, status, seriesName, seriesNumber, timesRead: status === READ ? 1 : 0 });

describe("upNext", () => {
  it("keeps the given order for books outside a series", () => {
    const want = [book("a", WANT_TO_READ), book("b", WANT_TO_READ)];
    expect(upNext(want, [], 10).map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("puts the next book of a series under way first", () => {
    const want = [book("loose", WANT_TO_READ), book("mist2", WANT_TO_READ, "Mistborn", 2)];
    const series = [book("mist1", READ, "Mistborn", 1), want[1]];
    expect(upNext(want, series, 10).map((b) => b.id)).toEqual(["mist2", "loose"]);
  });

  it("counts a book being read as under way, so the one after it is next", () => {
    const want = [book("atuan", WANT_TO_READ, "Earthsea", 2)];
    const series = [book("wizard", READING, "earthsea ", 1), want[0]];
    expect(upNext(want, series, 10).map((b) => b.id)).toEqual(["atuan"]);
  });

  it("leaves out a book waiting behind an earlier unread number", () => {
    const want = [book("three", WANT_TO_READ, "Dune", 3), book("two", WANT_TO_READ, "Dune", 2)];
    const series = [book("one", READ, "Dune", 1), ...want];
    expect(upNext(want, series, 10).map((b) => b.id)).toEqual(["two"]);
  });

  it("leaves out a second copy of a number already read", () => {
    const want = [book("copy", WANT_TO_READ, "Dune", 1)];
    const series = [book("one", READ, "Dune", 1), want[0]];
    expect(upNext(want, series, 10)).toEqual([]);
  });

  it("stops at the limit", () => {
    const want = Array.from({ length: 5 }, (_, i) => book(`b${i}`, WANT_TO_READ));
    expect(upNext(want, [], 3)).toHaveLength(3);
  });
});
