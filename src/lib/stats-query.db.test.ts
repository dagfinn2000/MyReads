import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { dailyPageTotals } from "@/lib/progress";
import {
  bookDayPageTotalsForUser,
  dayMinuteTotals,
  dayPageTotals,
  loadStatsInputs,
  minutesByDayForUser,
  timedEntriesForUser,
} from "@/lib/stats-query";

/**
 * The per-book log totals behind "Pages I logged" and the reading calendar
 * must follow the delta rule in lib/progress.ts: per book they equal
 * dailyPageTotals on that book's entries, and summed per day they equal it
 * on all of them. If the rule changes there and not in the SQL, this fails.
 */
const prisma = new PrismaClient();
const USER = "stats-query-user";
const OTHER = "stats-query-other";
const ZONES = ["UTC", "Europe/Oslo", "America/New_York", "Asia/Tokyo"];

const at = (iso: string) => new Date(iso);

const books = [
  // A normal run, with times that fall on different days east and west.
  { id: "sq-a", status: "READ" as const, dateStarted: null },
  // Overlapping days with a backwards correction.
  { id: "sq-b", status: "READING" as const, dateStarted: null },
  // A lone entry: credits nothing.
  { id: "sq-c", status: "READING" as const, dateStarted: null },
  // Read, then read again from a page-0 anchor on the same day.
  { id: "sq-d", status: "READING" as const, dateStarted: at("2026-03-02T21:00:00Z") },
  // No anchor: the current pass starts at the start date.
  { id: "sq-f", status: "READING" as const, dateStarted: at("2026-04-10T00:00:00Z") },
  // Stopped.
  { id: "sq-e", status: "DNF" as const, dateStarted: null },
];

const entries: { bookId: string; page: number; date: Date }[] = [
  { bookId: "sq-a", page: 0, date: at("2026-03-01T09:00:00Z") },
  { bookId: "sq-a", page: 40, date: at("2026-03-01T23:30:00Z") },
  { bookId: "sq-a", page: 90, date: at("2026-03-02T03:30:00Z") },
  { bookId: "sq-a", page: 150, date: at("2026-03-03T12:00:00Z") },

  { bookId: "sq-b", page: 0, date: at("2026-03-02T10:00:00Z") },
  { bookId: "sq-b", page: 25, date: at("2026-03-02T21:00:00Z") },
  { bookId: "sq-b", page: 10, date: at("2026-03-04T12:00:00Z") },
  { bookId: "sq-b", page: 60, date: at("2026-03-05T12:00:00Z") },

  { bookId: "sq-c", page: 300, date: at("2026-03-06T12:00:00Z") },

  { bookId: "sq-d", page: 0, date: at("2026-03-01T09:00:00Z") },
  { bookId: "sq-d", page: 100, date: at("2026-03-01T20:00:00Z") },
  { bookId: "sq-d", page: 300, date: at("2026-03-02T12:00:00Z") },
  { bookId: "sq-d", page: 0, date: at("2026-03-02T21:00:00Z") },
  { bookId: "sq-d", page: 40, date: at("2026-03-02T22:00:00Z") },
  { bookId: "sq-d", page: 90, date: at("2026-03-03T12:00:00Z") },

  { bookId: "sq-f", page: 10, date: at("2026-04-01T12:00:00Z") },
  { bookId: "sq-f", page: 50, date: at("2026-04-02T12:00:00Z") },
  // The morning of 10 April in Tokyo, still 9 April in UTC.
  { bookId: "sq-f", page: 65, date: at("2026-04-09T20:00:00Z") },
  { bookId: "sq-f", page: 80, date: at("2026-04-11T12:00:00Z") },

  { bookId: "sq-e", page: 0, date: at("2026-05-01T12:00:00Z") },
  { bookId: "sq-e", page: 120, date: at("2026-05-03T12:00:00Z") },
  { bookId: "sq-e", page: 218, date: at("2026-05-09T18:00:00Z") },
];

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER, OTHER] } } });
  await prisma.user.create({
    data: { id: USER, username: `statsq-${Date.now()}`, passwordHash: "x" },
  });
  await prisma.user.create({
    data: { id: OTHER, username: `statsq-other-${Date.now()}`, passwordHash: "x" },
  });
  for (const b of books) {
    await prisma.book.create({
      data: { ...b, userId: USER, title: b.id, searchText: b.id },
    });
  }
  await prisma.progressEntry.createMany({ data: entries });
  await prisma.read.create({ data: { bookId: "sq-a", dateFinished: at("2025-05-01T00:00:00Z") } });

  // Someone else's reading, which must never show up.
  await prisma.book.create({
    data: { id: "sq-other", userId: OTHER, title: "theirs", searchText: "theirs", status: "DNF" },
  });
  await prisma.progressEntry.createMany({
    data: [
      { bookId: "sq-other", page: 0, date: at("2026-03-02T09:00:00Z") },
      { bookId: "sq-other", page: 500, date: at("2026-03-02T20:00:00Z") },
    ],
  });
  await prisma.read.create({ data: { bookId: "sq-other", dateFinished: at("2025-01-01T00:00:00Z") } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER, OTHER] } } });
  await prisma.$disconnect();
});

describe("bookDayPageTotalsForUser", () => {
  it("matches dailyPageTotals book by book, in every zone", async () => {
    for (const zone of ZONES) {
      const rows = await bookDayPageTotalsForUser(USER, zone);
      for (const { id } of books) {
        const fromSql = new Map<string, number>();
        for (const r of rows.filter((r) => r.bookId === id)) {
          fromSql.set(r.day, (fromSql.get(r.day) ?? 0) + r.pages);
        }
        const fromJs = dailyPageTotals(
          entries.filter((e) => e.bookId === id),
          zone,
        );
        expect(Object.fromEntries([...fromSql].sort()), `${id} ${zone}`).toEqual(
          Object.fromEntries([...fromJs].sort()),
        );
      }
    }
  });

  it("sums per day to the reading calendar's totals", async () => {
    for (const zone of ZONES) {
      const summed = dayPageTotals(await bookDayPageTotalsForUser(USER, zone));
      const calendar = dailyPageTotals(entries, zone);
      expect(Object.fromEntries([...summed].sort()), zone).toEqual(
        Object.fromEntries([...calendar].sort()),
      );
    }
  });

  it("marks which pages belong to the current pass", async () => {
    const rows = await bookDayPageTotalsForUser(USER, "UTC");
    const of = (id: string, from = rows) =>
      from
        .filter((r) => r.bookId === id)
        .map(({ day, pages, current }) => ({ day, pages, current }))
        .sort((a, b) => a.day.localeCompare(b.day) || Number(a.current) - Number(b.current));

    // The re-read's anchor splits 2 March between the two passes.
    expect(of("sq-d")).toEqual([
      { day: "2026-03-01", pages: 100, current: false },
      { day: "2026-03-02", pages: 200, current: false },
      { day: "2026-03-02", pages: 40, current: true },
      { day: "2026-03-03", pages: 50, current: true },
    ]);
    // No anchor: the start date decides, by calendar day in the reader's
    // zone.
    expect(of("sq-f")).toEqual([
      { day: "2026-04-02", pages: 40, current: false },
      { day: "2026-04-09", pages: 15, current: false },
      { day: "2026-04-11", pages: 15, current: true },
    ]);
    expect(of("sq-f", await bookDayPageTotalsForUser(USER, "Asia/Tokyo"))).toEqual([
      { day: "2026-04-02", pages: 40, current: false },
      { day: "2026-04-10", pages: 15, current: true },
      { day: "2026-04-11", pages: 15, current: true },
    ]);
    // Neither: everything is the current pass.
    expect(of("sq-b").every((r) => r.current)).toBe(true);
  });

  it("only returns the reader's own books", async () => {
    const rows = await bookDayPageTotalsForUser(USER, "UTC");
    expect(rows.some((r) => r.bookId === "sq-other")).toBe(false);
  });
});

describe("loadStatsInputs", () => {
  it("loads only the reader's books and reads", async () => {
    const inputs = await loadStatsInputs(USER, "UTC");
    expect(inputs.books.map((b) => b.id).sort()).toEqual(books.map((b) => b.id).sort());
    expect(inputs.reads).toEqual([
      { bookId: "sq-a", dateStarted: null, dateFinished: at("2025-05-01T00:00:00Z"), rating: null },
    ]);
    expect(inputs.logDays.some((r) => r.bookId === "sq-other")).toBe(false);
  });

  it("dates stopped books by their latest log entry, and only those", async () => {
    const inputs = await loadStatsInputs(USER, "UTC");
    expect([...inputs.lastLogDates]).toEqual([["sq-e", at("2026-05-09T18:00:00Z")]]);
  });
});

describe("minutesByDayForUser", () => {
  const TIMED = "stats-query-timed";

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: TIMED } });
  });

  it("sums timed minutes by day in the reader's zone, and can leave audiobooks out", async () => {
    await prisma.user.create({
      data: { id: TIMED, username: `statsq-timed-${Date.now()}`, passwordHash: "x" },
    });
    await prisma.book.create({
      data: { id: "sq-t1", userId: TIMED, title: "t1", searchText: "t1", status: "READING" },
    });
    await prisma.book.create({
      data: {
        id: "sq-t2",
        userId: TIMED,
        title: "t2",
        searchText: "t2",
        status: "READING",
        format: "AUDIOBOOK",
      },
    });
    await prisma.progressEntry.createMany({
      data: [
        { bookId: "sq-t1", page: 0, date: at("2026-03-01T09:00:00Z") },
        { bookId: "sq-t1", page: 40, date: at("2026-03-01T23:30:00Z"), minutes: 30 },
        { bookId: "sq-t1", page: 60, date: at("2026-03-02T12:00:00Z") },
        { bookId: "sq-t2", page: 50, date: at("2026-03-02T13:00:00Z"), minutes: 45 },
      ],
    });

    // 23:30 UTC on 1 March is already 2 March in Oslo.
    const utc = await minutesByDayForUser(TIMED, "UTC");
    expect(dayMinuteTotals(utc)).toEqual(
      new Map([
        ["2026-03-01", 30],
        ["2026-03-02", 45],
      ]),
    );
    expect(dayMinuteTotals(await minutesByDayForUser(TIMED, "Europe/Oslo"))).toEqual(
      new Map([["2026-03-02", 75]]),
    );
    expect(dayMinuteTotals(utc, true)).toEqual(new Map([["2026-03-01", 30]]));
    // Nobody else's time, and none at all for a reader who never timed.
    expect(await minutesByDayForUser(USER, "UTC")).toEqual([]);
  });

  it("gives each timed entry its pages since the book's entry before", async () => {
    // Same reader and log as above, plus a stretch that went back a page
    // (a re-read's anchor would too): it adds no pages.
    await prisma.progressEntry.create({
      data: { bookId: "sq-t1", page: 55, date: at("2026-03-03T12:00:00Z"), minutes: 10 },
    });
    const rows = await timedEntriesForUser(TIMED, "Europe/Oslo");
    expect(rows.sort((a, b) => a.day.localeCompare(b.day) || a.minutes - b.minutes)).toEqual([
      { day: "2026-03-02", minutes: 30, pages: 40, audiobook: false },
      // The audiobook's first entry has nothing before it.
      { day: "2026-03-02", minutes: 45, pages: null, audiobook: true },
      { day: "2026-03-03", minutes: 10, pages: 0, audiobook: false },
    ]);
    expect(await timedEntriesForUser(USER, "UTC")).toEqual([]);
  });
});
