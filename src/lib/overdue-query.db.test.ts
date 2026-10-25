import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * The overdue reminder against a real database: only the reader's own open
 * loans past their day, named in order, and quiet when snoozed or switched
 * off.
 */

let snoozedBy: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "myreads-overdue-snooze" && snoozedBy ? { value: snoozedBy } : undefined,
  }),
}));

const { overdueReminder } = await import("@/lib/overdue-query");

let userId: string;
let otherUserId: string;
const prefs = { overdueReminder: true, timeZone: "UTC", dateFormat: "d-mmm-y" as const };

const day = (offset: number) =>
  new Date(new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10));

async function lend(title: string, borrower: string, dueAt: Date | null, owner = userId) {
  const book = await prisma.book.create({
    data: { userId: owner, title, searchText: title.toLowerCase() },
  });
  await prisma.loan.create({
    data: { bookId: book.id, borrower, lentAt: new Date("2026-09-03T00:00:00.000Z"), dueAt },
  });
  return book;
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `ovd-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `ov2-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  snoozedBy = undefined;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("overdueReminder", () => {
  it("is quiet while nothing is overdue", async () => {
    await lend("Dune", "Kari", day(0));
    await lend("Emma", "Ola", null);
    await lend("Theirs", "Per", day(-5), otherUserId);
    expect(await overdueReminder(userId, prefs)).toBeNull();
  });

  it("names a single overdue book and links to it", async () => {
    const dune = await lend("Dune", "Kari", day(-2));
    expect(await overdueReminder(userId, prefs)).toEqual({
      message: "Dune is overdue. Kari has had it since 3 Sep 2026.",
      href: `/books/${dune.id}`,
    });
  });

  it("lists several, longest overdue first, and links to the filter", async () => {
    await lend("Emma", "Ola", day(-1));
    await lend("Dune", "Kari", day(-10));
    await lend("Ulysses", "Per", day(-4));
    expect(await overdueReminder(userId, prefs)).toEqual({
      message: "3 lent books are overdue: Dune (Kari), Ulysses (Per) and 1 more.",
      href: "/books?owned=overdue",
    });
  });

  it("stays away when switched off or snoozed", async () => {
    await lend("Dune", "Kari", day(-2));
    expect(await overdueReminder(userId, { ...prefs, overdueReminder: false })).toBeNull();
    snoozedBy = userId;
    expect(await overdueReminder(userId, prefs)).toBeNull();
    // Another account's snooze in the same browser doesn't count.
    snoozedBy = otherUserId;
    expect(await overdueReminder(userId, prefs)).not.toBeNull();
  });
});
