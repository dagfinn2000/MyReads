import { describe, expect, it } from "vitest";
import { dustFor, dustGrain, lastTouched, shelfWear, wornFor, type WearBook } from "@/lib/shelf-wear";

const NOW = new Date("2026-11-17T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function book(over: Partial<WearBook> = {}): WearBook {
  return {
    status: "READ",
    ownership: "OWNED",
    createdAt: daysAgo(10),
    dateStarted: null,
    dateFinished: null,
    timesRead: 1,
    rating: null,
    ...over,
  };
}

describe("lastTouched", () => {
  it("is the newest reading date, not when an old read was added", () => {
    const b = book({ createdAt: daysAgo(5), dateStarted: daysAgo(900), dateFinished: daysAgo(880) });
    expect(lastTouched(b, null)).toEqual(daysAgo(880));
  });

  it("counts a page logged after the start", () => {
    const b = book({ status: "READING", dateStarted: daysAgo(900) });
    expect(lastTouched(b, daysAgo(30))).toEqual(daysAgo(30));
  });

  it("is the day it was added for a book on the pile, or one with no dates", () => {
    expect(lastTouched(book({ status: "WANT_TO_READ", createdAt: daysAgo(400) }), null)).toEqual(daysAgo(400));
    expect(lastTouched(book({ createdAt: daysAgo(70) }), null)).toEqual(daysAgo(70));
    // A re-read waiting on the pile: whichever is newer.
    const pile = book({ status: "WANT_TO_READ", createdAt: daysAgo(2000), dateFinished: daysAgo(800) });
    expect(lastTouched(pile, null)).toEqual(daysAgo(800));
  });
});

describe("dust and wear", () => {
  it("settles at one, two and four years", () => {
    expect([0, 364, 365, 729, 730, 1460, 1461, 5000].map(dustFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("wears a book with each read after the first and with a top rating", () => {
    expect(wornFor({ timesRead: 1, rating: 8 })).toBe(0);
    expect(wornFor({ timesRead: 1, rating: 9 })).toBe(1);
    expect(wornFor({ timesRead: 2, rating: null })).toBe(1);
    expect(wornFor({ timesRead: 3, rating: 10 })).toBe(3);
    expect(wornFor({ timesRead: 9, rating: 10 })).toBe(3);
    expect(wornFor({ timesRead: 0, rating: null })).toBe(0);
  });
});

describe("shelfWear", () => {
  it("says why", () => {
    const old = book({ dateFinished: daysAgo(800), timesRead: 3 });
    expect(shelfWear(old, null, NOW)).toEqual({
      dust: 2,
      worn: 2,
      note: "Well worn: read three times · Gathering dust: untouched for two years",
    });
    expect(shelfWear(book({ dateFinished: daysAgo(400), rating: 10 }), null, NOW).note).toBe(
      "Well worn: a favourite · Gathering dust: untouched for a year",
    );
    expect(shelfWear(book({ dateFinished: daysAgo(20) }), null, NOW)).toEqual({ dust: 0, worn: 0, note: "" });
  });

  it("leaves books that aren't on the shelf alone, and doesn't wear a borrowed copy", () => {
    const old = { dateFinished: daysAgo(2000), timesRead: 4 };
    expect(shelfWear(book({ ...old, ownership: "WISHLIST" }), null, NOW).dust).toBe(0);
    expect(shelfWear(book({ ...old, ownership: "GIVEN_AWAY" }), null, NOW).worn).toBe(0);
    expect(shelfWear(book({ ...old, ownership: "BORROWED" }), null, NOW)).toMatchObject({ dust: 3, worn: 0 });
  });

  it("keeps a book being read clean while pages are logged", () => {
    const reading = book({ status: "READING", dateStarted: daysAgo(600) });
    expect(shelfWear(reading, daysAgo(3), NOW).dust).toBe(0);
    expect(shelfWear(reading, null, NOW).dust).toBe(1);
  });
});

describe("dustGrain", () => {
  it("picks one of three, the same each time", () => {
    const grains = ["Dune", "Emma", "Mort", "Circe", "Babel", "Orlando"].map(dustGrain);
    expect(grains.every((g) => g >= 0 && g < 3)).toBe(true);
    expect(new Set(grains).size).toBeGreaterThan(1);
    expect(dustGrain("Dune")).toBe(dustGrain("Dune"));
  });
});
