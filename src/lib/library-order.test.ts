import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@prisma/client";
import { moveId, orderByIds, statusTabsToShow } from "@/lib/library-order";

const { WANT_TO_READ, READING, READ, DNF } = ReadingStatus;
const items = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("orderByIds", () => {
  it("puts the listed ids first, in list order, then the rest as they came", () => {
    const shelves = items("a", "b", "c", "d", "e");
    expect(ids(orderByIds(shelves, ["d", "b"]))).toEqual(["d", "b", "a", "c", "e"]);
  });

  it("ignores stale and repeated ids and returns every item once", () => {
    const shelves = items("a", "b", "c");
    expect(ids(orderByIds(shelves, ["gone", "c", "c", "a", "gone"]))).toEqual(["c", "a", "b"]);
  });

  it("returns the input as it is with no order", () => {
    const shelves = items("b", "a");
    expect(orderByIds(shelves, [])).toBe(shelves);
  });
});

describe("moveId", () => {
  it("swaps with the neighbour", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("does nothing at either end or for an unknown id", () => {
    expect(moveId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "x", 1)).toEqual(["a", "b", "c"]);
  });

  it("leaves its input alone", () => {
    const list = ["a", "b"];
    moveId(list, "a", 1);
    expect(list).toEqual(["a", "b"]);
  });
});

describe("statusTabsToShow", () => {
  it("drops hidden statuses and keeps the usual order", () => {
    expect(statusTabsToShow([DNF, WANT_TO_READ], "all")).toEqual([READING, READ]);
    expect(statusTabsToShow([], "all")).toEqual([WANT_TO_READ, READING, READ, DNF]);
  });

  it("keeps the tab on screen even when it is hidden", () => {
    expect(statusTabsToShow([DNF], DNF)).toEqual([WANT_TO_READ, READING, READ, DNF]);
  });

  it("shows every tab when all are hidden", () => {
    expect(statusTabsToShow([WANT_TO_READ, READING, READ, DNF], "all")).toEqual([
      WANT_TO_READ,
      READING,
      READ,
      DNF,
    ]);
  });
});
