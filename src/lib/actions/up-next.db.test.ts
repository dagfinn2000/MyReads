import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ReadingStatus } from "@/lib/enums";

/**
 * The reader's own Up next list: adding to the end, putting in order,
 * taking off, and starting a book taking it off by itself. Each only ever
 * touches the signed-in reader's own books.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { addToUpNext, removeFromUpNext, setUpNextOrder } = await import("@/lib/actions/up-next");
const { updateReading } = await import("@/lib/actions/books");
const { bulkUpdateBooks } = await import("@/lib/actions/bulk");

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `un-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `uno-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

function makeBook(title: string, extra: { userId?: string; status?: ReadingStatus; upNextRank?: number } = {}) {
  return prisma.book.create({
    data: { userId, title, searchText: title.toLowerCase(), status: ReadingStatus.WANT_TO_READ, ...extra },
  });
}

async function list(owner = userId) {
  const books = await prisma.book.findMany({
    where: { userId: owner, upNextRank: { not: null } },
    orderBy: { upNextRank: "asc" },
    select: { title: true },
  });
  return books.map((b) => b.title);
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("Up next", () => {
  it("adds to the end, once", async () => {
    const a = await makeBook("A");
    const b = await makeBook("B");
    expect(await addToUpNext(b.id)).toEqual({});
    expect(await addToUpNext(a.id)).toEqual({});
    expect(await addToUpNext(b.id)).toEqual({});
    expect(await list()).toEqual(["B", "A"]);
  });

  it("only takes Want to Read books, and only the reader's own", async () => {
    const reading = await makeBook("Reading", { status: ReadingStatus.READING });
    expect(await addToUpNext(reading.id)).toEqual({ error: "Only Want to Read books go on Up next" });
    const theirs = await makeBook("Theirs", { userId: otherUserId });
    expect(await addToUpNext(theirs.id)).toEqual({ error: "Book not found" });
    expect(await addToUpNext(42)).toEqual({ error: "Book not found" });
    expect(await list()).toEqual([]);
    expect(await list(otherUserId)).toEqual([]);
  });

  it("puts the list in a new order, and drops what's left out", async () => {
    const a = await makeBook("A", { upNextRank: 1 });
    const b = await makeBook("B", { upNextRank: 2 });
    const c = await makeBook("C", { upNextRank: 3 });
    const d = await makeBook("D");
    await setUpNextOrder([c.id, d.id, a.id]);
    expect(await list()).toEqual(["C", "D", "A"]);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: b.id } })).upNextRank).toBeNull();
  });

  it("passes over other readers' books and books being read when ordering", async () => {
    const theirs = await makeBook("Theirs", { userId: otherUserId, upNextRank: 1 });
    const reading = await makeBook("Reading", { status: ReadingStatus.READING });
    const mine = await makeBook("Mine");
    await setUpNextOrder([theirs.id, reading.id, mine.id]);
    expect(await list()).toEqual(["Mine"]);
    expect(await list(otherUserId)).toEqual(["Theirs"]);
    await setUpNextOrder("nonsense");
    expect(await list()).toEqual(["Mine"]);
  });

  it("takes a book off", async () => {
    const a = await makeBook("A", { upNextRank: 1 });
    const theirs = await makeBook("Theirs", { userId: otherUserId, upNextRank: 1 });
    await removeFromUpNext(a.id);
    await removeFromUpNext(theirs.id);
    expect(await list()).toEqual([]);
    expect(await list(otherUserId)).toEqual(["Theirs"]);
  });

  it("starting a book takes it off, from its page or many at once", async () => {
    const a = await makeBook("A", { upNextRank: 1 });
    const b = await makeBook("B", { upNextRank: 2 });
    const c = await makeBook("C", { upNextRank: 3 });
    await updateReading(a.id, {}, form({ status: "READING" }));
    await bulkUpdateBooks({ bookIds: [b.id], status: ReadingStatus.READ });
    // Saving the card without changing the status keeps it on.
    await updateReading(c.id, {}, form({ status: "WANT_TO_READ" }));
    expect(await list()).toEqual(["C"]);
  });

  it("needs a session", async () => {
    currentUserId = null;
    await expect(addToUpNext("x")).rejects.toThrow("Not authenticated");
    await expect(removeFromUpNext("x")).rejects.toThrow("Not authenticated");
    await expect(setUpNextOrder([])).rejects.toThrow("Not authenticated");
  });
});
