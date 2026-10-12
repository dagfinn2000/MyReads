import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * The reading goal action against a real database: each year is its own
 * goal, removing one leaves the others, bad input says so and writes
 * nothing, and nobody can touch someone else's goals.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
const revalidated: string[] = [];
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidated.push(path) }));

const { setReadingGoal } = await import("@/lib/actions/goals");

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `goal-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `goal-oth-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  revalidated.length = 0;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

function goalForm(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function goals(id = userId) {
  return prisma.readingGoal.findMany({
    where: { userId: id },
    orderBy: { year: "asc" },
    select: { year: true, target: true, unit: true, countRereads: true },
  });
}

describe("setReadingGoal", () => {
  it("sets next year's goal and leaves this year's alone", async () => {
    await prisma.readingGoal.create({ data: { userId, year: 2026, target: 24 } });

    const result = await setReadingGoal(
      goalForm({ year: "2027", target: "26", unit: "BOOKS", countRereads: "on" }),
    );

    expect(result).toEqual({ saved: { year: 2027, removed: false } });
    expect(await goals()).toEqual([
      { year: 2026, target: 24, unit: "BOOKS", countRereads: true },
      { year: 2027, target: 26, unit: "BOOKS", countRereads: true },
    ]);
    expect(revalidated).toEqual(["/stats", "/stats/year/2027"]);
  });

  it("edits a past year's goal", async () => {
    await prisma.readingGoal.create({ data: { userId, year: 2024, target: 18 } });
    await setReadingGoal(goalForm({ year: "2024", target: "8000", unit: "PAGES" }));
    expect(await goals()).toEqual([
      { year: 2024, target: 8000, unit: "PAGES", countRereads: false },
    ]);
  });

  it("removes only that year's goal with 0 or an empty target", async () => {
    await prisma.readingGoal.createMany({
      data: [
        { userId, year: 2026, target: 24 },
        { userId, year: 2027, target: 26 },
        { userId: otherUserId, year: 2027, target: 10 },
      ],
    });

    expect(await setReadingGoal(goalForm({ year: "2027", target: "0" }))).toEqual({
      saved: { year: 2027, removed: true },
    });
    expect((await goals()).map((g) => g.year)).toEqual([2026]);
    expect(await goals(otherUserId)).toHaveLength(1);

    expect(await setReadingGoal(goalForm({ year: "2026", target: "" }))).toEqual({
      saved: { year: 2026, removed: true },
    });
    expect(await goals()).toEqual([]);
  });

  it("says what's wrong with a bad target and writes nothing", async () => {
    await prisma.readingGoal.create({ data: { userId, year: 2026, target: 24 } });
    for (const target of ["abc", "2000000", "-1", "2.5"]) {
      expect(await setReadingGoal(goalForm({ year: "2026", target })), target).toEqual({
        error: "Enter a whole number from 0 to 1,000,000.",
      });
    }
    expect(await setReadingGoal(goalForm({ year: "1800", target: "5" }))).toHaveProperty("error");
    expect(await goals()).toEqual([
      { year: 2026, target: 24, unit: "BOOKS", countRereads: true },
    ]);
    expect(revalidated).toEqual([]);
  });

  it("only ever writes the signed-in reader's goal", async () => {
    await prisma.readingGoal.create({ data: { userId: otherUserId, year: 2026, target: 10 } });
    await setReadingGoal(goalForm({ year: "2026", target: "30" }));
    expect((await goals(otherUserId))[0].target).toBe(10);
    expect((await goals())[0].target).toBe(30);
  });

  it("refuses without a session", async () => {
    currentUserId = null;
    await expect(setReadingGoal(goalForm({ year: "2026", target: "12" }))).rejects.toThrow(
      "Not authenticated",
    );
  });
});
