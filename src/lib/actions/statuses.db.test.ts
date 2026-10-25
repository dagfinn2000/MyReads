import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ReadingStatus } from "@/lib/enums";
import type { CustomStatus } from "@/lib/statuses";

/**
 * The reader's own statuses against a real database. A book's status stays
 * the built-in one and Book.statusKey only names it differently, so what
 * matters is that the key is set where the reader picks a status of their
 * own, and dropped wherever the book leaves the status it is a kind of or
 * the status itself goes away. A stale key would be ignored on screen, but
 * would come back to life if the reader later moved the book back.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect to ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

const { createBook, updateReading } = await import("@/lib/actions/books");
const { moveFromReading } = await import("@/lib/actions/progress");
const { readAgain } = await import("@/lib/actions/reads");
const { bulkUpdateBooks } = await import("@/lib/actions/bulk");
const { savePreferences } = await import("@/lib/actions/preferences");
const { importLibrary } = await import("@/lib/import");

const paused: CustomStatus = { key: "p1", name: "Paused", base: ReadingStatus.READING, color: "violet" };
const owned: CustomStatus = { key: "o1", name: "Owned", base: ReadingStatus.WANT_TO_READ, color: "sky" };

let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: {
      username: `st-${Date.now()}-${Math.random()}`,
      passwordHash: "x",
      preferences: { customStatuses: [paused, owned] },
    },
  });
  userId = user.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function makeBook(over: Record<string, unknown> = {}) {
  return prisma.book.create({
    data: { userId, title: "Test Book", searchText: "test book", pageCount: 300, ...over },
  });
}

const keyOf = async (id: string) =>
  (await prisma.book.findUniqueOrThrow({ where: { id }, select: { statusKey: true } })).statusKey;

describe("picking a status of the reader's own", () => {
  it("puts a book on it from the reading card", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING, dateStarted: new Date() });
    await updateReading(bk.id, {}, form({ status: "READING:p1", review: "Slow going" }));
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.status).toBe(ReadingStatus.READING);
    expect(after.statusKey).toBe("p1");
    expect(after.review).toBe("Slow going");

    await updateReading(bk.id, {}, form({ status: "READING" }));
    expect(await keyOf(bk.id)).toBeNull();
  });

  it("keeps the status but not a key from another status, or one that's gone", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING, dateStarted: new Date() });
    await updateReading(bk.id, {}, form({ status: "READING:o1" }));
    expect(await keyOf(bk.id)).toBeNull();
    await updateReading(bk.id, {}, form({ status: "READING:zz" }));
    expect(await keyOf(bk.id)).toBeNull();
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).status).toBe(ReadingStatus.READING);
  });

  it("adds a book straight onto one", async () => {
    const fields = { title: "Dune", authors: "Frank Herbert", tags: "", format: "PHYSICAL", ownership: "OWNED" };
    await createBook({}, form({ ...fields, status: "WANT_TO_READ:o1" })).catch((e: unknown) => {
      if (!(e instanceof Redirect)) throw e;
    });
    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.status).toBe(ReadingStatus.WANT_TO_READ);
    expect(book.statusKey).toBe("o1");
  });

  it("moves picked books onto one, and off it again", async () => {
    const a = await makeBook({ status: ReadingStatus.READING });
    const b = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    const res = await bulkUpdateBooks({ bookIds: [a.id, b.id], status: ReadingStatus.READING, statusKey: "p1" });
    expect(res).not.toHaveProperty("error");
    for (const id of [a.id, b.id]) {
      const book = await prisma.book.findUniqueOrThrow({ where: { id } });
      expect(book.status).toBe(ReadingStatus.READING);
      expect(book.statusKey).toBe("p1");
    }
    await bulkUpdateBooks({ bookIds: [a.id], status: ReadingStatus.READING });
    expect(await keyOf(a.id)).toBeNull();
    expect(await keyOf(b.id)).toBe("p1");
  });

  it("won't put picked books on a key that isn't the status's", async () => {
    const a = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await bulkUpdateBooks({ bookIds: [a.id], status: ReadingStatus.READ, statusKey: "p1" });
    const book = await prisma.book.findUniqueOrThrow({ where: { id: a.id } });
    expect(book.status).toBe(ReadingStatus.READ);
    expect(book.statusKey).toBeNull();
  });
});

describe("leaving it behind", () => {
  it("drops the key when a book is finished, and when it's read again", async () => {
    const bk = await makeBook({
      status: ReadingStatus.READING,
      statusKey: "p1",
      dateStarted: new Date(Date.now() - 86_400_000),
    });
    expect(await moveFromReading(bk.id, "READ")).not.toHaveProperty("error");
    expect(await keyOf(bk.id)).toBeNull();

    await prisma.book.update({ where: { id: bk.id }, data: { statusKey: "p1" } });
    await readAgain(bk.id);
    const again = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(again.status).toBe(ReadingStatus.READING);
    expect(again.statusKey).toBeNull();
  });

  it("forgets a status's books when the status is removed", async () => {
    const a = await makeBook({ status: ReadingStatus.READING, statusKey: "p1" });
    const b = await makeBook({ status: ReadingStatus.WANT_TO_READ, statusKey: "o1" });
    await savePreferences({ customStatuses: [owned] });
    expect(await keyOf(a.id)).toBeNull();
    expect(await keyOf(b.id)).toBe("o1");
    expect((await prisma.book.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(ReadingStatus.READING);
  });

  it("keeps the books of a status that's only renamed", async () => {
    const a = await makeBook({ status: ReadingStatus.READING, statusKey: "p1" });
    await savePreferences({ customStatuses: [{ ...paused, name: "On hold", color: "rose" }, owned] });
    expect(await keyOf(a.id)).toBe("p1");
  });

  it("doesn't touch another reader's books", async () => {
    const other = await prisma.user.create({ data: { username: `sto-${Date.now()}`, passwordHash: "x" } });
    try {
      const theirs = await prisma.book.create({
        data: { userId: other.id, title: "T", searchText: "t", status: ReadingStatus.READING, statusKey: "p1" },
      });
      await savePreferences({ customStatuses: [] });
      expect(await keyOf(theirs.id)).toBe("p1");
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});

describe("restoring a backup", () => {
  const exported = (over: Record<string, unknown>) => ({
    title: "The Final Empire",
    authors: ["Brandon Sanderson"],
    format: "PHYSICAL",
    ownership: "OWNED",
    status: "READING",
    tags: [],
    shelves: [],
    quotes: [],
    reads: [],
    progress: [],
    ...over,
  });

  it("keeps a key the account has, on its own status, and drops any other", async () => {
    const res = await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [
        exported({ title: "Kept", statusKey: "p1" }),
        exported({ title: "Unknown", statusKey: "zz" }),
        exported({ title: "Wrong status", status: "READ", statusKey: "p1" }),
        exported({ title: "Older backup" }),
      ],
    });
    expect(res).not.toHaveProperty("error");
    const books = await prisma.book.findMany({ where: { userId }, select: { title: true, statusKey: true } });
    expect(Object.fromEntries(books.map((b) => [b.title, b.statusKey]))).toEqual({
      Kept: "p1",
      Unknown: null,
      "Wrong status": null,
      "Older backup": null,
    });
  });

  it("brings the statuses back with the books onto a fresh account", async () => {
    await prisma.user.update({ where: { id: userId }, data: { preferences: {} } });
    await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [exported({ statusKey: "p1" })],
      settings: { theme: null, defaultViewName: null, preferences: { customStatuses: [paused] } },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.preferences).toEqual({ customStatuses: [paused] });
    expect((await prisma.book.findFirstOrThrow({ where: { userId } })).statusKey).toBe("p1");
  });
});
