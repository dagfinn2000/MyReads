import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookOwnership, PrismaClient } from "@prisma/client";

/**
 * setOwnership ("I bought it" on the Do I own this? page) against a real
 * database: it changes the one field, and only on the signed-in user's book.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { setOwnership } = await import("@/lib/actions/ownership");

let userId: string;
let otherUserId: string;

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title: "Test Book", searchText: "test book", ...over },
  });
}

async function ownershipOf(id: string) {
  return (await prisma.book.findUniqueOrThrow({ where: { id } })).ownership;
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `own-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `own-oth-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("setOwnership", () => {
  it("marks a wishlist book as owned", async () => {
    const bk = await makeBook({ ownership: BookOwnership.WISHLIST, rating: 8 });

    expect(await setOwnership(bk.id, BookOwnership.OWNED)).toEqual({ success: true });
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.ownership).toBe(BookOwnership.OWNED);
    expect(after.rating).toBe(8);
  });

  it("leaves another account's book alone", async () => {
    const theirs = await makeBook({ ownership: BookOwnership.WISHLIST }, otherUserId);

    expect(await setOwnership(theirs.id, BookOwnership.OWNED)).toEqual({
      error: "Book not found",
    });
    expect(await ownershipOf(theirs.id)).toBe(BookOwnership.WISHLIST);
  });

  it("refuses an ownership that doesn't exist", async () => {
    const bk = await makeBook({ ownership: BookOwnership.GIVEN_AWAY });

    const res = await setOwnership(bk.id, "GIVEN" as BookOwnership);
    expect(res.error).toBeTruthy();
    expect(await ownershipOf(bk.id)).toBe(BookOwnership.GIVEN_AWAY);
  });

  it("needs a session", async () => {
    const bk = await makeBook({ ownership: BookOwnership.WISHLIST });
    currentUserId = null;

    await expect(setOwnership(bk.id, BookOwnership.OWNED)).rejects.toThrow();
    expect(await ownershipOf(bk.id)).toBe(BookOwnership.WISHLIST);
  });
});
