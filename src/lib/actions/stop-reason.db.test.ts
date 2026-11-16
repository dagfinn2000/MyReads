import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ReadingStatus } from "@/lib/enums";
import { importLibrary } from "@/lib/import";
import type { MoveResult } from "@/lib/reading-log";

/**
 * Why a book was put down (Book.stopReason) against a real database: it is
 * set only on the reader's own stopped books, and every way off Did Not
 * Finish lets it go, so a book stopped again later never shows an old
 * reason. Backups bring it back.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const { setStopReason, moveFromReading, undoMoveFromReading } = await import("@/lib/actions/progress");
const { updateReading } = await import("@/lib/actions/books");
const { bulkUpdateBooks } = await import("@/lib/actions/bulk");

let userId: string;
let otherUserId: string;

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title: "Test Book", searchText: "test book", pageCount: 300, ...over },
  });
}

const reasonOf = async (id: string) =>
  (await prisma.book.findUniqueOrThrow({ where: { id }, select: { stopReason: true } })).stopReason;

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `sr-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `sro-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("setStopReason", () => {
  it("names why a stopped book was put down, and clears it", async () => {
    const bk = await makeBook({ status: ReadingStatus.DNF });
    expect(await setStopReason(bk.id, "slow")).toEqual({});
    expect(await reasonOf(bk.id)).toBe("slow");
    expect(await setStopReason(bk.id, null)).toEqual({});
    expect(await reasonOf(bk.id)).toBeNull();
  });

  it("refuses an unknown reason, a book not stopped, and another reader's book", async () => {
    const reading = await makeBook({ status: ReadingStatus.READING });
    const theirs = await makeBook({ status: ReadingStatus.DNF }, otherUserId);
    const mine = await makeBook({ status: ReadingStatus.DNF });
    expect(await setStopReason(mine.id, "bored")).toEqual({ error: "Invalid input" });
    expect((await setStopReason(reading.id, "slow")).error).toBeTruthy();
    expect((await setStopReason(theirs.id, "slow")).error).toBeTruthy();
    // Not an id at all: a server action's arguments come from the browser.
    expect(await setStopReason({ not: "" } as unknown as string, "slow")).toEqual({ error: "Book not found" });
    expect(await reasonOf(reading.id)).toBeNull();
    expect(await reasonOf(theirs.id)).toBeNull();
  });
});

describe("leaving Did Not Finish", () => {
  it("Stopped starts without a reason, and Undo takes one away", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING, currentPage: 40, dateStarted: new Date() });
    const moved: MoveResult = await moveFromReading(bk.id, "DNF");
    if ("error" in moved) throw new Error(moved.error);
    expect(await reasonOf(bk.id)).toBeNull();
    await setStopReason(bk.id, "not-now");
    expect(await undoMoveFromReading(bk.id, moved.undo)).toEqual({});
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.status).toBe(ReadingStatus.READING);
    expect(after.stopReason).toBeNull();
  });

  it("the reading card keeps, changes or clears it, and drops it off Did Not Finish", async () => {
    const bk = await makeBook({ status: ReadingStatus.DNF, stopReason: "slow" });
    // Saved without the menu (a review, say): it stays.
    await updateReading(bk.id, {}, form({ status: "DNF", review: "Never mind" }));
    expect(await reasonOf(bk.id)).toBe("slow");
    await updateReading(bk.id, {}, form({ status: "DNF", stopReason: "too-long" }));
    expect(await reasonOf(bk.id)).toBe("too-long");
    await updateReading(bk.id, {}, form({ status: "DNF", stopReason: "none" }));
    expect(await reasonOf(bk.id)).toBeNull();
    await updateReading(bk.id, {}, form({ status: "DNF", stopReason: "writing" }));
    await updateReading(bk.id, {}, form({ status: "READING" }));
    expect(await reasonOf(bk.id)).toBeNull();
    // Stopped again from the card, a reason sent along from an old page
    // doesn't stick: the book is newly put down.
    await updateReading(bk.id, {}, form({ status: "DNF", stopReason: "writing" }));
    expect(await reasonOf(bk.id)).toBeNull();
  });

  it("bulk edit clears it on books moved off Did Not Finish, and keeps it on those left there", async () => {
    const [moved, stays] = await Promise.all([
      makeBook({ status: ReadingStatus.DNF, stopReason: "slow" }),
      makeBook({ status: ReadingStatus.DNF, stopReason: "not-now" }),
    ]);
    await bulkUpdateBooks({ bookIds: [moved.id], status: ReadingStatus.WANT_TO_READ });
    await bulkUpdateBooks({ bookIds: [stays.id], status: ReadingStatus.DNF });
    expect(await reasonOf(moved.id)).toBeNull();
    expect(await reasonOf(stays.id)).toBe("not-now");
  });
});

describe("backups", () => {
  it("restore brings a stopped book's reason back, and drops one that doesn't fit", async () => {
    const base = {
      authors: ["A"],
      format: "PHYSICAL",
      ownership: "OWNED",
      timesRead: 0,
      shelves: [],
      quotes: [],
      reads: [],
      progress: [],
    };
    await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [
        { ...base, title: "Put down", status: "DNF", stopReason: "too-long" },
        { ...base, title: "Unknown reason", status: "DNF", stopReason: "bored" },
        { ...base, title: "Read after all", status: "READ", stopReason: "slow" },
      ],
    });
    const books = await prisma.book.findMany({ where: { userId }, orderBy: { title: "asc" } });
    expect(books.map((b) => [b.title, b.stopReason])).toEqual([
      ["Put down", "too-long"],
      ["Read after all", null],
      ["Unknown reason", null],
    ]);
  });
});
