import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { BookOwnership, PrismaClient, ReadingStatus } from "@prisma/client";

/**
 * Export a library, restore it into an empty account, and check that what
 * comes out the far end is the library that went in.
 *
 * This is the test the project most needed. Backup and restore are the only
 * features whose failure loses data you cannot get back, and the two halves
 * are written independently — an export field the import doesn't read, or a
 * shape change on one side, would go unnoticed until someone actually needed
 * their backup.
 */
const prisma = new PrismaClient();

let sourceUserId: string;
let targetUserId: string;

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: process.env.__ROUNDTRIP_USER, name: "src" } }),
  signOut: async () => {},
}));

const { GET: exportRoute } = await import("@/app/api/export/route");
const { importLibrary } = await import("@/lib/import");

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `src-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `dst-${stamp}`, passwordHash: "x" } }),
  ]);
  sourceUserId = a.id;
  targetUserId = b.id;
  process.env.__ROUNDTRIP_USER = sourceUserId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [sourceUserId, targetUserId] } } });
  delete process.env.__ROUNDTRIP_USER;
});

/** Runs the real export route and returns the parsed library.json. */
async function exportLibrary() {
  const res = await exportRoute();
  expect(res.status).toBe(200);
  const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
  const file = zip.file("library.json");
  expect(file).not.toBeNull();
  return JSON.parse(await file!.async("text"));
}

describe("export -> import round trip", () => {
  it("restores a full library into an empty account unchanged", async () => {
    const shelf = await prisma.shelf.create({
      data: { userId: sourceUserId, name: "Sanderson" },
    });
    await prisma.readingGoal.create({
      data: { userId: sourceUserId, year: 2026, target: 24 },
    });

    await prisma.book.create({
      data: {
        userId: sourceUserId,
        title: "The Final Empire",
        authors: ["Brandon Sanderson"],
        isbn: "9780765311788",
        description: "Ash falls from the sky.",
        pageCount: 541,
        publishedDate: "2006",
        tags: ["fantasy", "epic"],
        format: "PHYSICAL",
        ownership: BookOwnership.OWNED,
        seriesName: "Mistborn",
        seriesNumber: 1,
        status: ReadingStatus.READ,
        rating: 9,
        review: "Superb.",
        dateStarted: new Date("2026-01-01T00:00:00.000Z"),
        dateFinished: new Date("2026-01-20T00:00:00.000Z"),
        timesRead: 2,
        searchText: "the final empire brandon sanderson mistborn",
        shelves: { connect: { id: shelf.id } },
        quotes: {
          create: [{ text: "There's always another secret.", page: 500, note: "!" }],
        },
        reads: {
          create: [{ dateFinished: new Date("2019-06-01T00:00:00.000Z"), rating: 8 }],
        },
        progress: {
          create: [
            { page: 0, date: new Date("2026-01-01T09:00:00.000Z") },
            { page: 250, date: new Date("2026-01-10T09:00:00.000Z") },
          ],
        },
        loans: {
          create: [
            {
              borrower: "Kari",
              lentAt: new Date("2026-02-01T00:00:00.000Z"),
              returnedAt: new Date("2026-02-20T00:00:00.000Z"),
            },
            { borrower: "Ola", lentAt: new Date("2026-03-01T00:00:00.000Z") },
          ],
        },
      },
    });

    const payload = await exportLibrary();
    expect(payload.format).toBe("myreads-export");
    expect(payload.books).toHaveLength(1);

    const summary = await importLibrary(targetUserId, payload);
    expect(summary).toMatchObject({
      booksCreated: 1,
      booksSkipped: 0,
      booksInvalid: 0,
      shelvesCreated: 1,
      quotesRestored: 1,
      readsRestored: 1,
      progressRestored: 2,
      loansRestored: 2,
      goalsRestored: 1,
    });

    const restored = await prisma.book.findFirstOrThrow({
      where: { userId: targetUserId },
      include: { shelves: true, quotes: true, reads: true, progress: true, loans: true },
    });

    // Bibliographic data
    expect(restored.title).toBe("The Final Empire");
    expect(restored.authors).toEqual(["Brandon Sanderson"]);
    expect(restored.isbn).toBe("9780765311788");
    expect(restored.description).toBe("Ash falls from the sky.");
    expect(restored.pageCount).toBe(541);
    expect(restored.publishedDate).toBe("2006");
    expect([...restored.tags].sort()).toEqual(["epic", "fantasy"]);
    expect(restored.seriesName).toBe("Mistborn");
    expect(restored.seriesNumber).toBe(1);
    expect(restored.ownership).toBe(BookOwnership.OWNED);

    // Personal reading data
    expect(restored.status).toBe(ReadingStatus.READ);
    expect(restored.rating).toBe(9);
    expect(restored.review).toBe("Superb.");
    expect(restored.dateFinished?.toISOString()).toBe("2026-01-20T00:00:00.000Z");
    expect(restored.timesRead).toBe(2);

    // Relations
    expect(restored.shelves.map((s) => s.name)).toEqual(["Sanderson"]);
    expect(restored.quotes[0].text).toBe("There's always another secret.");
    expect(restored.quotes[0].page).toBe(500);
    expect(restored.reads).toHaveLength(1);
    expect(restored.reads[0].rating).toBe(8);
    expect(restored.progress.map((p) => p.page).sort((a, b) => a - b)).toEqual([0, 250]);

    // Lending survives, including which loan is still open.
    expect(restored.loans).toHaveLength(2);
    const stillOut = restored.loans.filter((l) => l.returnedAt === null);
    expect(stillOut.map((l) => l.borrower)).toEqual(["Ola"]);

    const goal = await prisma.readingGoal.findFirstOrThrow({
      where: { userId: targetUserId, year: 2026 },
    });
    expect(goal.target).toBe(24);
  });

  it("still writes the legacy `owned` boolean for older instances", async () => {
    // The export format promises an older build can read this file, and
    // `owned` is the only ownership vocabulary such a build has.
    await prisma.book.create({
      data: {
        userId: sourceUserId,
        title: "Borrowed one",
        searchText: "borrowed one",
        ownership: BookOwnership.BORROWED,
      },
    });

    const payload = await exportLibrary();
    expect(payload.books[0].ownership).toBe("BORROWED");
    expect(payload.books[0].owned).toBe(false);
  });

  it("does not leak the internal columns into the backup", async () => {
    await prisma.book.create({
      data: {
        userId: sourceUserId,
        title: "Elantris",
        searchText: "elantris",
      },
    });

    const payload = await exportLibrary();
    // userId would tie a backup to an account it may be restored away from;
    // searchText is derived and rebuilt on import.
    expect(payload.books[0]).not.toHaveProperty("userId");
    expect(payload.books[0]).not.toHaveProperty("searchText");
  });

  it("survives a library with nothing in it", async () => {
    const payload = await exportLibrary();
    expect(payload.books).toEqual([]);

    const summary = await importLibrary(targetUserId, payload);
    expect(summary).toMatchObject({ booksCreated: 0, booksInvalid: 0 });
  });

  it("is idempotent: restoring the same backup twice changes nothing", async () => {
    await prisma.book.create({
      data: {
        userId: sourceUserId,
        title: "Warbreaker",
        authors: ["Brandon Sanderson"],
        isbn: "9780765320308",
        searchText: "warbreaker brandon sanderson",
      },
    });

    const payload = await exportLibrary();
    await importLibrary(targetUserId, payload);
    const second = await importLibrary(targetUserId, payload);

    expect(second).toMatchObject({ booksCreated: 0, booksSkipped: 1 });
    expect(await prisma.book.count({ where: { userId: targetUserId } })).toBe(1);
  });
});
