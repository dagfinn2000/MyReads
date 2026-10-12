import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BookFormat, BookOwnership, PrismaClient, ReadingStatus, type Prisma } from "@prisma/client";
import type { BookDetails, BookMetadata } from "@/lib/metadata/types";

/**
 * The shelf scan's server actions against a real database, with the book
 * catalogues stubbed: what's under test is what lands in the library (with
 * the reader's New books settings and tag rules), what is reported instead
 * of added, and that the lookup budget is respected.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

const searchBooks = vi.fn<(q: string) => Promise<BookMetadata[]>>();
const getBookDetails = vi.fn<(params: unknown) => Promise<BookDetails>>();
vi.mock("@/lib/metadata", async () => {
  class CataloguesUnreachableError extends Error {}
  return {
    CataloguesUnreachableError,
    searchBooks: (q: string) => searchBooks(q),
    getBookDetails: (params: unknown) => getBookDetails(params),
  };
});
const { CataloguesUnreachableError } = await import("@/lib/metadata");

const { scanAddBook, removeScannedBook } = await import("@/lib/actions/shelf-scan");
const { takeMetadataBudget } = await import("@/lib/api-guard");

let userId: string;
let otherUserId: string;
let coversDir: string;
const savedCoversDir = process.env.COVERS_DIR;

beforeAll(async () => {
  coversDir = await fs.mkdtemp(path.join(os.tmpdir(), "myreads-scan-covers-"));
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
    prisma.user.create({ data: { username: `scan-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `scano-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  searchBooks.mockReset().mockResolvedValue([hobbit()]);
  getBookDetails.mockReset().mockResolvedValue({
    description: "In a hole in the ground there lived a hobbit.",
    pageCount: 310,
    tags: ["Fantasy", "Fiction, General"],
    coverUrl: null,
    openLibraryId: "OL27482W",
  });
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

function hobbit(over: Partial<BookMetadata> = {}): BookMetadata {
  return {
    title: "The Hobbit",
    authors: ["J.R.R. Tolkien"],
    isbn: "9780000000001", // another edition of the work
    coverUrl: null,
    description: null,
    pageCount: 290,
    publishedDate: "1937",
    tags: [],
    openLibraryId: "OL27482W",
    source: "openlibrary",
    ...over,
  };
}

const SCANNED = "9780261103344";

async function setPrefs(prefs: Prisma.InputJsonObject) {
  await prisma.user.update({ where: { id: userId }, data: { preferences: prefs } });
}

describe("scanAddBook", () => {
  it("adds the book with the New books settings and the scanned ISBN", async () => {
    await setPrefs({
      newBookFormat: "EBOOK",
      newBookOwnership: "WISHLIST",
      newBookStatus: "WANT_TO_READ",
    });
    const res = await scanAddBook(SCANNED);

    expect(res.kind).toBe("added");
    expect(res.budget).toEqual({ used: 3, limit: 90 });
    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book).toMatchObject({
      title: "The Hobbit",
      authors: ["J.R.R. Tolkien"],
      isbn: SCANNED,
      format: BookFormat.EBOOK,
      ownership: BookOwnership.WISHLIST,
      status: ReadingStatus.WANT_TO_READ,
      pageCount: 310,
      openLibraryId: "OL27482W",
      searchText: "the hobbit j.r.r. tolkien",
    });
    expect(book.tags).toEqual(["fantasy", "fiction", "general"]);
  });

  it("applies the tag rules and the import mode to the subjects", async () => {
    await setPrefs({
      importTagsMode: "known",
      tagRenames: [{ from: "fiction", to: "novels" }],
      tagSkips: ["general"],
    });
    await prisma.book.create({
      data: { userId, title: "Other", searchText: "other", tags: ["novels"] },
    });
    await scanAddBook(SCANNED);

    const book = await prisma.book.findFirstOrThrow({ where: { userId, isbn: SCANNED } });
    expect(book.tags).toEqual(["novels"]);
  });

  it("follows the finish-date preference for a book added as Read", async () => {
    await setPrefs({ newBookStatus: "READ", addedAsReadFinished: "undated" });
    await scanAddBook(SCANNED);
    let book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.dateFinished).toBeNull();
    expect(book.timesRead).toBe(1);

    await prisma.book.deleteMany({ where: { userId } });
    await setPrefs({ newBookStatus: "READ", addedAsReadFinished: "today" });
    await scanAddBook(SCANNED);
    book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.dateFinished?.toDateString()).toBe(new Date().toDateString());
  });

  it("answers 'have' for an ISBN already in the library, in its other form, without asking the catalogues", async () => {
    const mine = await prisma.book.create({
      data: { userId, title: "The Hobbit", searchText: "the hobbit", isbn: "0261103342" },
    });
    const res = await scanAddBook(SCANNED);

    expect(res).toMatchObject({ kind: "have", match: "isbn", book: { id: mine.id } });
    expect(res.budget.used).toBe(0);
    expect(searchBooks).not.toHaveBeenCalled();
    expect(await prisma.book.count({ where: { userId } })).toBe(1);
  });

  it("says how the library holds the match, so a wishlist copy isn't worded as one you have", async () => {
    const wished = await prisma.book.create({
      data: {
        userId,
        title: "The Hobbit",
        searchText: "the hobbit",
        isbn: SCANNED,
        format: BookFormat.EBOOK,
        ownership: BookOwnership.WISHLIST,
      },
    });
    expect(await scanAddBook(SCANNED)).toMatchObject({
      kind: "have",
      match: "isbn",
      book: { id: wished.id, ownership: BookOwnership.WISHLIST, format: BookFormat.EBOOK },
    });

    await prisma.book.update({
      where: { id: wished.id },
      data: {
        isbn: null,
        ownership: BookOwnership.GIVEN_AWAY,
        authors: ["J.R.R. Tolkien"],
        searchText: "the hobbit j.r.r. tolkien",
      },
    });
    expect(await scanAddBook(SCANNED)).toMatchObject({
      kind: "have",
      match: "title",
      book: { id: wished.id, ownership: BookOwnership.GIVEN_AWAY, format: BookFormat.EBOOK },
    });
  });

  it("reports the same title in another edition, and adds it when asked to", async () => {
    await prisma.book.create({
      data: {
        userId,
        title: "The Hobbit",
        authors: ["J. R. R. Tolkien"],
        searchText: "the hobbit j. r. r. tolkien",
      },
    });
    expect(await scanAddBook(SCANNED)).toMatchObject({ kind: "have", match: "title" });
    expect(await prisma.book.count({ where: { userId } })).toBe(1);

    expect((await scanAddBook(SCANNED, { force: true })).kind).toBe("added");
    expect(await prisma.book.count({ where: { userId } })).toBe(2);
  });

  it("answers notFound and adds nothing when no catalogue knows the code", async () => {
    searchBooks.mockResolvedValue([]);
    expect(await scanAddBook(SCANNED)).toMatchObject({ kind: "notFound", isbn: SCANNED });
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("pauses with a wait when the lookup budget is spent, and adds nothing", async () => {
    for (let i = 0; i < 90; i++) takeMetadataBudget(userId);
    const res = await scanAddBook(SCANNED);

    expect(res.kind).toBe("paused");
    if (res.kind === "paused") expect(res.retryInMs).toBeGreaterThan(0);
    expect(searchBooks).not.toHaveBeenCalled();
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("still adds the book, without details, when only the search fits in the budget", async () => {
    for (let i = 0; i < 89; i++) takeMetadataBudget(userId);
    expect((await scanAddBook(SCANNED)).kind).toBe("added");

    expect(getBookDetails).not.toHaveBeenCalled();
    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.pageCount).toBe(290);
    expect(book.description).toBeNull();
  });

  it("says so when the catalogues are down", async () => {
    searchBooks.mockRejectedValue(new CataloguesUnreachableError());
    expect(await scanAddBook(SCANNED)).toMatchObject({
      kind: "error",
      message: "Couldn't reach the book catalogues",
    });
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("refuses junk before any lookup", async () => {
    expect((await scanAddBook("not a barcode")).kind).toBe("error");
    expect((await scanAddBook("9".repeat(40))).kind).toBe("error");
    expect(searchBooks).not.toHaveBeenCalled();
  });

  it("throws when signed out", async () => {
    currentUserId = null;
    await expect(scanAddBook(SCANNED)).rejects.toThrow("Not authenticated");
  });
});

describe("removeScannedBook", () => {
  it("deletes the reader's own book and its cached cover", async () => {
    await fs.writeFile(path.join(coversDir, "scanned.jpg"), "cover");
    const bk = await prisma.book.create({
      data: { userId, title: "Oops", searchText: "oops", coverUrl: "/api/covers/scanned.jpg" },
    });
    expect(await removeScannedBook(bk.id)).toEqual({});

    expect(await prisma.book.findUnique({ where: { id: bk.id } })).toBeNull();
    await expect(fs.access(path.join(coversDir, "scanned.jpg"))).rejects.toThrow();
  });

  it("leaves another account's book alone", async () => {
    const theirs = await prisma.book.create({
      data: { userId: otherUserId, title: "Theirs", searchText: "theirs" },
    });
    expect(await removeScannedBook(theirs.id)).toEqual({ error: "Book not found" });
    expect(await prisma.book.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });
});
