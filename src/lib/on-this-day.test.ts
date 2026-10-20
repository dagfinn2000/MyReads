import { describe, expect, it } from "vitest";
import { lastReadText, nearbyMonthDays, onThisDay, yearsAgoToday } from "@/lib/on-this-day";

const OSLO = "Europe/Oslo";
const TODAY = "2026-10-19";

describe("onThisDay", () => {
  const event = (kind: "finished" | "started", bookId: string, iso: string) => ({
    kind,
    bookId,
    title: bookId,
    date: new Date(iso),
  });

  it("keeps what happened on today's date in earlier years, most recent first", () => {
    const { lines } = onThisDay(
      [
        event("started", "hobbit", "2023-10-19T00:00:00.000Z"),
        event("finished", "dune", "2025-10-19T00:00:00.000Z"),
        event("started", "circe", "2025-10-19T00:00:00.000Z"),
        // Today itself, and other days, aren't memories.
        event("finished", "today", "2026-10-19T00:00:00.000Z"),
        event("finished", "yesterday", "2025-10-18T00:00:00.000Z"),
      ],
      [],
      TODAY,
      OSLO,
    );
    expect(lines).toEqual([
      { kind: "finished", bookId: "dune", title: "dune", years: 1 },
      { kind: "started", bookId: "circe", title: "circe", years: 1 },
      { kind: "started", bookId: "hobbit", title: "hobbit", years: 3 },
    ]);
  });

  it("reads a typed date as its calendar day and a stamp in the reader's zone", () => {
    const { lines } = onThisDay(
      [
        // 23:30 on the 18th in UTC is 01:30 on the 19th in Oslo.
        event("finished", "late", "2024-10-18T23:30:00.000Z"),
        // 22:30 on the 19th in UTC is already the 20th in Oslo.
        event("finished", "next-day", "2024-10-19T22:30:00.000Z"),
      ],
      [],
      TODAY,
      OSLO,
    );
    expect(lines.map((l) => l.bookId)).toEqual(["late"]);
  });

  it("shows a few lines at most, once each", () => {
    const events = ["a", "b", "c", "d"].map((id) => event("finished", id, "2020-10-19T00:00:00.000Z"));
    const { lines } = onThisDay([...events, events[0]], [], TODAY, OSLO);
    expect(lines.map((l) => l.bookId)).toEqual(["a", "b", "c"]);
  });

  it("picks the quote saved most recently on this date", () => {
    const quote = (id: string, iso: string) => ({ id, bookId: "b", title: "B", text: id, date: new Date(iso) });
    const { quote: picked } = onThisDay(
      [],
      [
        quote("old", "2021-10-19T12:00:00.000Z"),
        quote("recent", "2025-10-19T12:00:00.000Z"),
        quote("today", "2026-10-19T08:00:00.000Z"),
      ],
      TODAY,
      OSLO,
    );
    expect(picked).toEqual({ id: "recent", bookId: "b", title: "B", text: "recent", years: 1 });
    expect(onThisDay([], [], TODAY, OSLO)).toEqual({ lines: [], quote: null });
  });

  it("words the years", () => {
    expect(yearsAgoToday(1)).toBe("A year ago today");
    expect(yearsAgoToday(4)).toBe("4 years ago today");
  });

  it("looks a day either side for the query, across a month and a year", () => {
    expect(nearbyMonthDays(TODAY)).toEqual(["10-18", "10-19", "10-20"]);
    expect(nearbyMonthDays("2027-01-01")).toEqual(["12-31", "01-01", "01-02"]);
    expect(nearbyMonthDays("2028-03-01")).toEqual(["02-29", "03-01", "03-02"]);
  });

  it("still looks for 29 Feb when today is near it in a non-leap year", () => {
    // A book finished on 29 Feb (stored UTC 02-29) must still surface when
    // today is 28 Feb or 1 Mar of a year that has no 29 Feb.
    expect(nearbyMonthDays("2027-02-28")).toEqual(["02-27", "02-28", "03-01", "02-29"]);
    expect(nearbyMonthDays("2027-03-01")).toEqual(["02-28", "03-01", "03-02", "02-29"]);
    // A normal day is unchanged.
    expect(nearbyMonthDays("2027-06-15")).toEqual(["06-14", "06-15", "06-16"]);
  });
});

describe("lastReadText", () => {
  const now = new Date("2026-10-19T10:00:00.000Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("says nothing for two weeks", () => {
    expect(lastReadText(daysAgo(13), now, OSLO)).toBeNull();
    expect(lastReadText(null, now, OSLO)).toBeNull();
  });

  it("counts weeks, then months, then years", () => {
    expect(lastReadText(daysAgo(14), now, OSLO)).toBe("Last read 2 weeks ago");
    expect(lastReadText(daysAgo(27), now, OSLO)).toBe("Last read 3 weeks ago");
    expect(lastReadText(daysAgo(59), now, OSLO)).toBe("Last read 8 weeks ago");
    expect(lastReadText(daysAgo(95), now, OSLO)).toBe("Last read 3 months ago");
    expect(lastReadText(daysAgo(400), now, OSLO)).toBe("Last read over a year ago");
    expect(lastReadText(daysAgo(800), now, OSLO)).toBe("Last read over 2 years ago");
  });

  it("counts calendar days in the reader's zone", () => {
    // 23:30 UTC on 4 October is 01:30 on the 5th in Oslo: 14 days before the 19th.
    expect(lastReadText(new Date("2026-10-04T23:30:00.000Z"), now, OSLO)).toBe("Last read 2 weeks ago");
    expect(lastReadText(new Date("2026-10-05T22:30:00.000Z"), now, OSLO)).toBeNull();
  });
});
