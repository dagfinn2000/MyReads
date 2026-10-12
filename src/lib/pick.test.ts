import { describe, expect, it } from "vitest";
import { BookOwnership, ReadingStatus } from "@prisma/client";
import {
  chooseRandom,
  pickButtonTitle,
  pickPool,
  tabStatus,
  type PickRow,
  type PickRules,
} from "@/lib/pick";

const { WANT_TO_READ, READING, READ, DNF } = ReadingStatus;
const { OWNED, WISHLIST, BORROWED, GIVEN_AWAY } = BookOwnership;

let n = 0;
function row(over: Partial<PickRow> = {}): PickRow {
  n += 1;
  return {
    id: `b${n}`,
    status: WANT_TO_READ,
    ownership: OWNED,
    seriesName: null,
    seriesNumber: null,
    timesRead: 0,
    lent: false,
    ...over,
  };
}

const ALL: PickRules = { tab: null, onlyHave: false, nextInSeries: false };
const ids = (rows: PickRow[]) => rows.map((r) => r.id);

describe("tabStatus", () => {
  it("knows the status tabs and nothing else", () => {
    expect(tabStatus("READ")).toBe(READ);
    expect(tabStatus("WANT_TO_READ")).toBe(WANT_TO_READ);
    expect(tabStatus("all")).toBeNull();
    expect(tabStatus("")).toBeNull();
    expect(tabStatus("read")).toBeNull();
    expect(tabStatus(undefined)).toBeNull();
  });
});

describe("pickPool tabs", () => {
  it("prefers Want to Read on the All tab", () => {
    const want = row();
    const read = row({ status: READ });
    expect(pickPool([want, read], ALL)).toEqual([want]);
  });

  it("falls back to every book on the All tab when none are Want to Read", () => {
    const rows = [row({ status: READ }), row({ status: DNF })];
    expect(pickPool(rows, ALL)).toEqual(rows);
  });

  it("never swaps a status tab for Want to Read", () => {
    // The bug: on the Read tab the old pick opened a Want to Read book. The
    // tab's own filter decides the rows; the pool must not narrow them.
    const rows = [row({ status: READ }), row({ status: READ })];
    expect(pickPool(rows, { ...ALL, tab: READ })).toEqual(rows);
  });
});

describe("pickPool: only books I have", () => {
  const rules = { ...ALL, tab: READ, onlyHave: true };

  it("keeps owned and borrowed books, drops wishlist and given away", () => {
    const owned = row({ ownership: OWNED });
    const borrowed = row({ ownership: BORROWED });
    const rows = [owned, borrowed, row({ ownership: WISHLIST }), row({ ownership: GIVEN_AWAY })];
    expect(ids(pickPool(rows, rules))).toEqual([owned.id, borrowed.id]);
  });

  it("drops a book that is lent out", () => {
    const home = row();
    expect(ids(pickPool([home, row({ lent: true })], rules))).toEqual([home.id]);
  });

  it("applies before the All tab's Want to Read preference", () => {
    // Every Want to Read book is on the wishlist, so the pick falls back to
    // the rest instead of opening one you don't have.
    const read = row({ status: READ });
    const rows = [row({ ownership: WISHLIST }), read];
    expect(pickPool(rows, { ...ALL, onlyHave: true })).toEqual([read]);
  });
});

describe("pickPool: only the next book in a series", () => {
  const rules = { ...ALL, tab: WANT_TO_READ, nextInSeries: true };
  const mist = (seriesNumber: number | null, over: Partial<PickRow> = {}) =>
    row({ seriesName: "Mistborn", seriesNumber, ...over });

  it("keeps the next unread book and holds back later ones", () => {
    const one = mist(1, { status: READ });
    const two = mist(2);
    const three = mist(3);
    expect(ids(pickPool([two, three], rules, [one, two, three]))).toEqual([two.id]);
  });

  it("works from the candidate rows alone when no series list is given", () => {
    const two = mist(2);
    const three = mist(3);
    expect(ids(pickPool([two, three], rules))).toEqual([two.id]);
  });

  it("never holds back a book that isn't Want to Read", () => {
    const one = mist(1);
    const reading = mist(3, { status: READING });
    expect(ids(pickPool([reading], { ...rules, tab: READING }, [one, reading]))).toEqual([
      reading.id,
    ]);
  });

  it("counts a re-read in progress as read, and a book being read as unread", () => {
    expect(pickPool([mist(2)], rules, [mist(1, { status: READING, timesRead: 1 })])).toHaveLength(1);
    expect(pickPool([mist(2)], rules, [mist(1, { status: READING })])).toHaveLength(0);
  });

  it("counts a number as read when any copy of it is", () => {
    const two = mist(2);
    const series = [mist(1), mist(1, { status: READ }), two];
    expect(ids(pickPool([two], rules, series))).toEqual([two.id]);
  });

  it("matches series names whatever their case or stray spaces", () => {
    const two = mist(2);
    const series = [row({ seriesName: "  mistborn ", seriesNumber: 1 }), two];
    expect(pickPool([two], rules, series)).toHaveLength(0);
  });

  it("ignores unnumbered books both ways, and compares numbers as numbers", () => {
    const loose = mist(null);
    expect(pickPool([loose], rules, [mist(1)])).toEqual([loose]);
    expect(pickPool([mist(2)], rules, [mist(null)])).toHaveLength(1);

    const prequel = mist(0);
    const half = mist(1.5);
    expect(ids(pickPool([prequel, half, mist(2)], rules))).toEqual([prequel.id]);
  });

  it("leaves other series alone", () => {
    const other = row({ seriesName: "Earthsea", seriesNumber: 2 });
    expect(pickPool([other], rules, [mist(1)])).toEqual([other]);
  });

  it("can leave nothing, with both switches on", () => {
    // #1 is only wishlisted: it isn't had, and it blocks #2.
    const one = mist(1, { ownership: WISHLIST });
    const two = mist(2);
    expect(pickPool([one, two], { ...rules, onlyHave: true }, [one, two])).toEqual([]);
  });

  it("falls back to other books on the All tab when every Want to Read waits", () => {
    const read = row({ status: READ });
    const rows = [mist(2), read];
    expect(pickPool(rows, { ...ALL, nextInSeries: true }, [mist(1)])).toEqual([read]);
  });
});

describe("chooseRandom", () => {
  it("covers the whole list and never runs off the end", () => {
    expect(chooseRandom(["a", "b", "c"], () => 0)).toBe("a");
    expect(chooseRandom(["a", "b", "c"], () => 0.999)).toBe("c");
    expect(chooseRandom(["a", "b", "c"], () => 1)).toBe("c");
  });

  it("is null for an empty list", () => {
    expect(chooseRandom([], () => 0.5)).toBeNull();
  });
});

describe("pickButtonTitle", () => {
  const off = { pickOnlyHave: false, pickNextInSeries: false };

  it("says where the pick comes from", () => {
    expect(pickButtonTitle(null, off)).toBe(
      "Open a random book, from Want to Read when there is one (respects your filters)",
    );
    expect(pickButtonTitle(READ, off)).toBe("Open a random book from Read (respects your filters)");
  });

  it("lists the switches that are on", () => {
    expect(pickButtonTitle(READING, { ...off, pickOnlyHave: true })).toBe(
      "Open a random book from Currently Reading (respects your filters and only books you have)",
    );
    expect(pickButtonTitle(null, { pickOnlyHave: true, pickNextInSeries: true })).toBe(
      "Open a random book, from Want to Read when there is one (respects your filters, " +
        "only books you have and only the next book in each series)",
    );
  });
});
