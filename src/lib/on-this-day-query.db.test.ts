import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { onThisDay } from "@/lib/on-this-day";
import { onThisDayCandidates } from "@/lib/on-this-day-query";

/**
 * "On this day" from a real database: the query's rough cut by date has to
 * let through everything that falls on today in the reader's zone, and
 * leave out other readers' books and books not started.
 */
const prisma = new PrismaClient();
const OSLO = "Europe/Oslo";
const TODAY = "2026-10-19";

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `otd-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `otdo-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

const at = (iso: string) => new Date(iso);

describe("onThisDayCandidates", () => {
  it("finds finishes, starts and quotes on today's date in the reader's zone", async () => {
    // Finished a year ago today (a typed date), read once before as well.
    const dune = await prisma.book.create({
      data: {
        userId,
        title: "Dune",
        status: "READ",
        dateStarted: at("2025-10-01T00:00:00.000Z"),
        dateFinished: at("2025-10-19T00:00:00.000Z"),
        reads: { create: [{ dateStarted: at("2019-10-19T00:00:00.000Z"), dateFinished: at("2019-11-02T00:00:00.000Z") }] },
        quotes: {
          // Saved at 00:30 on the 19th in Oslo, 22:30 the day before in UTC.
          create: [{ text: "Fear is the mind-killer.", createdAt: at("2023-10-18T22:30:00.000Z") }],
        },
      },
    });
    // Started three years ago today with "Start reading": a moment, not a typed date.
    await prisma.book.create({
      data: { userId, title: "Circe", status: "READING", dateStarted: at("2023-10-19T18:00:00.000Z") },
    });
    // Not memories: a started date on a book still on the wish list, a
    // finish on a stopped book, and someone else's library.
    await prisma.book.create({
      data: { userId, title: "Wish", status: "WANT_TO_READ", dateStarted: at("2024-10-19T00:00:00.000Z") },
    });
    await prisma.book.create({
      data: { userId, title: "Stopped", status: "DNF", dateFinished: at("2024-10-19T00:00:00.000Z") },
    });
    await prisma.book.create({
      data: { userId: otherUserId, title: "Theirs", status: "READ", dateFinished: at("2025-10-19T00:00:00.000Z") },
    });

    const { events, quotes } = await onThisDayCandidates(userId, TODAY);
    const result = onThisDay(events, quotes, TODAY, OSLO);
    expect(result.lines).toEqual([
      { kind: "finished", bookId: dune.id, title: "Dune", years: 1 },
      { kind: "started", bookId: expect.any(String), title: "Circe", years: 3 },
      { kind: "started", bookId: dune.id, title: "Dune", years: 7 },
    ]);
    expect(result.quote).toMatchObject({ text: "Fear is the mind-killer.", title: "Dune", years: 3 });
  });

  it("finds nothing on a day nothing happened", async () => {
    await prisma.book.create({
      data: { userId, title: "Dune", status: "READ", dateFinished: at("2025-06-01T00:00:00.000Z") },
    });
    expect(await onThisDayCandidates(userId, TODAY)).toEqual({ events: [], quotes: [] });
  });
});
