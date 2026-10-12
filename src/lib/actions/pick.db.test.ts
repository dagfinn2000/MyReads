import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookOwnership, PrismaClient, ReadingStatus } from "@prisma/client";

/**
 * Pick for me against a real database. The rule itself is unit-tested in
 * lib/pick.test.ts; what's pinned down here is that the action feeds it the
 * right rows: the tab and filters on screen, the switches from the stored
 * preferences, the whole series from the library, and nothing from another
 * account.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { pickRandomBook } = await import("@/lib/actions/pick");

let userId: string;
let otherUserId: string;

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title: "Test Book", searchText: "test book", ...over },
  });
}

async function setPrefs(preferences: Record<string, boolean>) {
  await prisma.user.update({ where: { id: userId }, data: { preferences } });
}

/** Every book the pick can return, found by running it at both ends of
 *  Math.random's range (the pool is in database order, so this covers a
 *  pool of one or two exactly and shows a larger pool isn't a single book). */
async function picks(params: Record<string, string>): Promise<Set<string>> {
  const out = new Set<string>();
  const spy = vi.spyOn(Math, "random");
  try {
    for (const r of [0, 0.999]) {
      spy.mockReturnValue(r);
      const res = await pickRandomBook(params);
      out.add("id" in res ? res.id : res.reason);
    }
  } finally {
    spy.mockRestore();
  }
  return out;
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `pick-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `pick-oth-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("pickRandomBook", () => {
  it("stays on the status tab instead of opening a Want to Read book", async () => {
    const read = await makeBook({ status: ReadingStatus.READ });
    await makeBook({ status: ReadingStatus.WANT_TO_READ });

    expect(await picks({ shelf: "READ" })).toEqual(new Set([read.id]));
  });

  it("prefers Want to Read on the All tab, and falls back when there is none", async () => {
    const want = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    const read = await makeBook({ status: ReadingStatus.READ });
    expect(await picks({})).toEqual(new Set([want.id]));

    await prisma.book.delete({ where: { id: want.id } });
    expect(await picks({ shelf: "all" })).toEqual(new Set([read.id]));
  });

  it("only picks books you have when asked to", async () => {
    await setPrefs({ pickOnlyHave: true });
    const owned = await makeBook();
    const borrowed = await makeBook({ ownership: BookOwnership.BORROWED });
    await makeBook({ ownership: BookOwnership.WISHLIST });
    await makeBook({ ownership: BookOwnership.GIVEN_AWAY });
    const lent = await makeBook();
    await prisma.loan.create({ data: { bookId: lent.id, borrower: "Kari" } });
    // A loan that came back doesn't count.
    const back = await makeBook();
    await prisma.loan.create({
      data: { bookId: back.id, borrower: "Ola", returnedAt: new Date() },
    });

    const seen = new Set<string>();
    const spy = vi.spyOn(Math, "random");
    try {
      for (let i = 0; i < 6; i++) {
        spy.mockReturnValue(i / 6);
        const res = await pickRandomBook({});
        if ("id" in res) seen.add(res.id);
      }
    } finally {
      spy.mockRestore();
    }
    expect(seen).toEqual(new Set([owned.id, borrowed.id, back.id]));
  });

  it("only picks the next book in a series when asked to", async () => {
    await setPrefs({ pickNextInSeries: true });
    await makeBook({ seriesName: "Mistborn", seriesNumber: 1, status: ReadingStatus.READ });
    const two = await makeBook({ seriesName: "Mistborn", seriesNumber: 2 });
    await makeBook({ seriesName: "mistborn", seriesNumber: 3 });

    // #1 is not on the Want to Read tab, but it still counts as read.
    expect(await picks({ shelf: "WANT_TO_READ" })).toEqual(new Set([two.id]));
  });

  it("says when the switches leave nothing, and when nothing matches", async () => {
    await setPrefs({ pickOnlyHave: true });
    await makeBook({ ownership: BookOwnership.WISHLIST });

    expect(await picks({})).toEqual(new Set(["settings"]));
    expect(await picks({ shelf: "READ" })).toEqual(new Set(["none"]));
    expect(await picks({ q: "no such book" })).toEqual(new Set(["none"]));
  });

  it("never looks at another account's books", async () => {
    await setPrefs({ pickNextInSeries: true });
    await makeBook({ status: ReadingStatus.WANT_TO_READ }, otherUserId);
    // Their unread #1 in a same-named series must not hold back my #2.
    await makeBook({ seriesName: "Mistborn", seriesNumber: 1 }, otherUserId);
    const mine = await makeBook({ seriesName: "Mistborn", seriesNumber: 2 });

    expect(await picks({})).toEqual(new Set([mine.id]));
  });

  it("treats a malformed request as no filters rather than failing", async () => {
    const want = await makeBook();
    const res = await pickRandomBook(null as unknown as Record<string, string>);
    expect(res).toEqual({ id: want.id });
  });

  it("refuses without a session", async () => {
    currentUserId = null;
    await expect(pickRandomBook({})).rejects.toThrow();
  });
});
