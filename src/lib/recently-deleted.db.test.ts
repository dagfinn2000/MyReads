import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ReadingStatus } from "@/lib/enums";

/**
 * Recently deleted against a real database: a deleted book comes back with
 * everything that cascaded with it, only for its own reader, and goes for
 * good (cover and all) once its 30 days are up.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { binBooks, restoreBooks, forgetBooks, forgetExpired, BIN_DAYS } = await import(
  "@/lib/recently-deleted"
);
const { restoreDeletedBooks, emptyRecentlyDeleted } = await import("@/lib/actions/recently-deleted");

let userId: string;
let otherUserId: string;
let coversDir: string;
const savedCoversDir = process.env.COVERS_DIR;

beforeAll(async () => {
  coversDir = await fs.mkdtemp(path.join(os.tmpdir(), "myreads-covers-"));
  process.env.COVERS_DIR = coversDir;
});

afterAll(async () => {
  await fs.rm(coversDir, { recursive: true, force: true });
  if (savedCoversDir === undefined) delete process.env.COVERS_DIR;
  else process.env.COVERS_DIR = savedCoversDir;
});

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `rd-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `rdo-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

async function writeCover(name: string) {
  await fs.writeFile(path.join(coversDir, name), "cover");
  return `/api/covers/${name}`;
}
const coverExists = (url: string) =>
  fs.access(path.join(coversDir, path.basename(url))).then(
    () => true,
    () => false,
  );

describe("Recently deleted", () => {
  it("puts a book back with its history, notes, quotes, loans and shelves", async () => {
    const [kept, gone] = await Promise.all([
      prisma.shelf.create({ data: { userId, name: "Favourites" } }),
      prisma.shelf.create({ data: { userId, name: "Gone soon" } }),
    ]);
    const book = await prisma.book.create({
      data: {
        userId,
        title: "Piranesi",
        authors: ["Susanna Clarke"],
        searchText: "piranesi susanna clarke",
        status: ReadingStatus.READING,
        currentPage: 120,
        pageCount: 272,
        moods: ["mysterious"],
        stickers: ["signed"],
        fields: { f1: "Hall shelf" },
        dateStarted: new Date("2026-11-01T00:00:00Z"),
        shelves: { connect: [{ id: kept.id }, { id: gone.id }] },
      },
    });
    await prisma.read.create({ data: { bookId: book.id, dateFinished: new Date("2020-05-01Z"), rating: 8 } });
    const entry = await prisma.progressEntry.create({
      data: { bookId: book.id, page: 120, minutes: 30, date: new Date("2026-11-20T10:00:00Z"), clientId: "c1" },
    });
    await prisma.loan.create({ data: { bookId: book.id, borrower: "Sam" } });
    await prisma.quote.create({ data: { bookId: book.id, text: "The Beauty of the House", page: 5 } });
    await prisma.bookNote.create({ data: { bookId: book.id, text: "Who is the Other?", chapter: "1" } });

    expect(await binBooks(userId, [book.id])).toBe(1);
    expect(await prisma.book.findUnique({ where: { id: book.id } })).toBeNull();
    await prisma.shelf.delete({ where: { id: gone.id } });

    expect(await restoreBooks(userId, [book.id])).toEqual({ restored: 1 });

    const back = await prisma.book.findUniqueOrThrow({
      where: { id: book.id },
      include: { shelves: true, reads: true, progress: true, loans: true, quotes: true, notes: true },
    });
    expect(back).toMatchObject({
      userId,
      title: "Piranesi",
      status: ReadingStatus.READING,
      currentPage: 120,
      moods: ["mysterious"],
      stickers: ["signed"],
      fields: { f1: "Hall shelf" },
      dateStarted: new Date("2026-11-01T00:00:00Z"),
      createdAt: book.createdAt,
    });
    expect(back.shelves.map((s) => s.id)).toEqual([kept.id]);
    expect(back.reads).toMatchObject([{ rating: 8, dateFinished: new Date("2020-05-01Z") }]);
    expect(back.progress).toMatchObject([{ id: entry.id, page: 120, minutes: 30, clientId: "c1" }]);
    expect(back.loans).toMatchObject([{ borrower: "Sam", returnedAt: null }]);
    expect(back.quotes).toMatchObject([{ text: "The Beauty of the House", page: 5 }]);
    expect(back.notes).toMatchObject([{ text: "Who is the Other?", chapter: "1" }]);
    expect(await prisma.deletedBook.count({ where: { id: book.id } })).toBe(0);
  });

  it("only moves and puts back the reader's own books", async () => {
    const theirs = await prisma.book.create({ data: { userId: otherUserId, title: "Theirs" } });
    expect(await binBooks(userId, [theirs.id])).toBe(0);
    expect(await prisma.book.count({ where: { id: theirs.id } })).toBe(1);

    await binBooks(otherUserId, [theirs.id]);
    expect(await restoreDeletedBooks([theirs.id])).toMatchObject({ error: expect.any(String) });
    expect(await prisma.book.count({ where: { id: theirs.id } })).toBe(0);
  });

  it("keeps the cover while the book waits, and deletes it when the book goes for good", async () => {
    const cover = await writeCover("bin.jpg");
    const book = await prisma.book.create({ data: { userId, title: "Cover", coverUrl: cover } });
    await binBooks(userId, [book.id]);
    expect(await coverExists(cover)).toBe(true);

    expect(await emptyRecentlyDeleted()).toEqual({ count: 1 });
    expect(await coverExists(cover)).toBe(false);
  });

  it("forgets only the entries whose days are up", async () => {
    const [old, recent] = await Promise.all([
      prisma.book.create({ data: { userId, title: "Old" } }),
      prisma.book.create({ data: { userId, title: "Recent" } }),
    ]);
    await binBooks(userId, [old.id, recent.id]);
    const now = new Date();
    await prisma.deletedBook.update({
      where: { id: old.id },
      data: { deletedAt: new Date(now.getTime() - (BIN_DAYS + 1) * 86_400_000) },
    });

    expect(await forgetExpired(now)).toBeGreaterThanOrEqual(1);
    expect(await prisma.deletedBook.count({ where: { id: old.id } })).toBe(0);
    expect(await prisma.deletedBook.count({ where: { id: recent.id } })).toBe(1);
  });

  it("leaves a book in the bin when one with its id is already back", async () => {
    const book = await prisma.book.create({ data: { userId, title: "Twice" } });
    await binBooks(userId, [book.id]);
    await prisma.book.create({ data: { id: book.id, userId, title: "Twice" } });
    expect(await restoreBooks(userId, [book.id])).toMatchObject({ restored: 0 });
    expect(await prisma.deletedBook.count({ where: { id: book.id } })).toBe(1);
    await forgetBooks(userId);
  });
});
