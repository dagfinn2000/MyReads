import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@/lib/enums";
import { upNext, upNextWithPicks } from "@/lib/up-next";

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

describe("upNextWithPicks", () => {
  const pick = (id: string, upNextRank: number | null, series: [string, number] | null = null) => ({
    ...book(id, WANT_TO_READ, series?.[0] ?? null, series?.[1] ?? null),
    upNextRank,
    title: id,
  });

  it("puts the reader's picks first, in their order, then fills up with suggestions", () => {
    const want = [pick("new", null), pick("second", 5), pick("first", 2), pick("older", null)];
    const { picks, suggested } = upNextWithPicks(want, [], 3);
    expect(picks.map((b) => b.id)).toEqual(["first", "second"]);
    expect(suggested.map((b) => b.id)).toEqual(["new"]);
  });

  it("keeps a pick the series would leave out, and every pick past the limit", () => {
    const want = [pick("dune3", 1, ["Dune", 3]), pick("a", 2), pick("b", 3)];
    const series = [book("dune1", READ, "Dune", 1), want[0]];
    const { picks, suggested } = upNextWithPicks(want, series, 2);
    expect(picks.map((b) => b.id)).toEqual(["dune3", "a", "b"]);
    expect(suggested).toEqual([]);
  });
});
