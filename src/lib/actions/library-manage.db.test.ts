import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BookFormat, BookOwnership, PrismaClient, ReadingStatus } from "@prisma/client";

/**
 * Library housekeeping against a real database: renaming and merging
 * shelves, renaming saved views, and bulk edit and delete, including "every
 * book that matches" and its 2,000-id limit.
 *
 * Kept apart from actions.db.test.ts so other work on those actions doesn't
 * collide with these.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { renameShelf } = await import("@/lib/actions/shelves");
const { renameView } = await import("@/lib/actions/saved-views");
const { bulkUpdateBooks, bulkDeleteBooks } = await import("@/lib/actions/bulk");
const { prisma: appPrisma } = await import("@/lib/prisma");

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
    prisma.user.create({ data: { username: `lm-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `lmo-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title: "Test Book", searchText: "test book", pageCount: 300, ...over },
  });
}

async function makeShelf(name: string, books: { id: string }[] = [], owner = userId) {
  return prisma.shelf.create({
    data: { userId: owner, name, books: { connect: books.map(({ id }) => ({ id })) } },
  });
}

async function shelfBookIds(shelfId: string) {
  const shelf = await prisma.shelf.findUniqueOrThrow({
    where: { id: shelfId },
    select: { books: { select: { id: true } } },
  });
  return shelf.books.map((b) => b.id).sort();
}

describe("renameShelf", () => {
  it("renames a shelf and keeps its books", async () => {
    const bk = await makeBook();
    const shelf = await makeShelf("Sci fi", [bk]);

    expect(await renameShelf(shelf.id, "  Science fiction ")).toEqual({
      shelfId: shelf.id,
      name: "Science fiction",
    });
    const after = await prisma.shelf.findUniqueOrThrow({ where: { id: shelf.id } });
    expect(after.name).toBe("Science fiction");
    expect(await shelfBookIds(shelf.id)).toEqual([bk.id]);
  });

  it("renames the same shelf when only the case changes", async () => {
    const shelf = await makeShelf("sci fi");
    const res = await renameShelf(shelf.id, "Sci fi");

    expect(res.merged).toBeUndefined();
    expect(res.shelfId).toBe(shelf.id);
    expect((await prisma.shelf.findUniqueOrThrow({ where: { id: shelf.id } })).name).toBe("Sci fi");
  });

  it("merges onto another shelf's name in any case, once per book", async () => {
    const [onlySource, both, onlyTarget] = await Promise.all([makeBook(), makeBook(), makeBook()]);
    const source = await makeShelf("Sci fi", [onlySource, both]);
    const target = await makeShelf("Sci-fi", [both, onlyTarget]);

    const res = await renameShelf(source.id, "sci-FI");

    expect(res).toEqual({ merged: true, shelfId: target.id, name: "Sci-fi", count: 3 });
    expect(await prisma.shelf.findUnique({ where: { id: source.id } })).toBeNull();
    expect(await shelfBookIds(target.id)).toEqual([onlySource.id, both.id, onlyTarget.id].sort());
    // The books themselves are untouched.
    expect(await prisma.book.count({ where: { userId } })).toBe(3);
  });

  it("points saved views on the merged shelf at the shelf it merged into", async () => {
    const source = await makeShelf("Sci fi");
    const target = await makeShelf("Sci-fi");
    const view = await prisma.savedView.create({
      data: { userId, name: "Sci-fi unread", query: `shelf=WANT_TO_READ&shelfId=${source.id}&group=none&sort=title&dir=asc` },
    });
    const other = await prisma.savedView.create({
      data: { userId, name: "All", query: "group=none&sort=title&dir=asc" },
    });

    await renameShelf(source.id, "Sci-fi");

    const after = await prisma.savedView.findUniqueOrThrow({ where: { id: view.id } });
    expect(new URLSearchParams(after.query).get("shelfId")).toBe(target.id);
    expect(new URLSearchParams(after.query).get("shelf")).toBe("WANT_TO_READ");
    expect((await prisma.savedView.findUniqueOrThrow({ where: { id: other.id } })).query).toBe(
      other.query,
    );
  });

  it("refuses another account's shelf and never merges into one", async () => {
    const theirs = await makeShelf("Theirs", [], otherUserId);
    expect(await renameShelf(theirs.id, "Mine now")).toEqual({ error: "Shelf not found" });
    expect((await prisma.shelf.findUniqueOrThrow({ where: { id: theirs.id } })).name).toBe("Theirs");

    const mine = await makeShelf("Mine");
    const res = await renameShelf(mine.id, "theirs");
    expect(res.merged).toBeUndefined();
    expect(res.shelfId).toBe(mine.id);
    expect(await prisma.shelf.count({ where: { userId: otherUserId } })).toBe(1);
  });

  it("explains an empty or too-long name", async () => {
    const shelf = await makeShelf("Shelf");
    expect(await renameShelf(shelf.id, "   ")).toEqual({ error: "Shelf name is required" });
    expect(await renameShelf(shelf.id, "x".repeat(51))).toEqual({
      error: "Shelf name must be at most 50 characters",
    });
  });
});

describe("renameView", () => {
  async function makeView(name: string, owner = userId) {
    return prisma.savedView.create({
      data: { userId: owner, name, query: "group=none&sort=title&dir=asc" },
    });
  }

  it("renames a view", async () => {
    const view = await makeView("Unread");
    expect(await renameView(view.id, " To read ")).toEqual({});
    expect((await prisma.savedView.findUniqueOrThrow({ where: { id: view.id } })).name).toBe(
      "To read",
    );
  });

  it("refuses another view's name, but not the view's own", async () => {
    const view = await makeView("Unread");
    await makeView("Favourites");
    expect(await renameView(view.id, "Favourites")).toEqual({
      error: "You already have a view called “Favourites”.",
    });
    expect(await renameView(view.id, "Unread")).toEqual({});
  });

  it("refuses another account's view and a bad id", async () => {
    const theirs = await makeView("Theirs", otherUserId);
    expect(await renameView(theirs.id, "Mine")).toEqual({ error: "View not found" });
    expect(await renameView("", "Mine")).toEqual({ error: "View not found" });
    expect((await prisma.savedView.findUniqueOrThrow({ where: { id: theirs.id } })).name).toBe(
      "Theirs",
    );
  });
});

describe("bulkUpdateBooks, more fields", () => {
  it("sets format and ownership on the selection only", async () => {
    const [a, b, untouched] = await Promise.all([
      makeBook({ format: BookFormat.AUDIOBOOK, lengthMinutes: 600 }),
      makeBook(),
      makeBook(),
    ]);

    const res = await bulkUpdateBooks({
      bookIds: [a.id, b.id],
      format: BookFormat.EBOOK,
      ownership: BookOwnership.BORROWED,
    });
    expect(res).toEqual({ count: 2 });

    const rows = await prisma.book.findMany({ where: { userId } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of [a.id, b.id]) {
      expect(byId.get(id)?.format).toBe(BookFormat.EBOOK);
      expect(byId.get(id)?.ownership).toBe(BookOwnership.BORROWED);
    }
    // Only an audiobook keeps a running time.
    expect(byId.get(a.id)?.lengthMinutes).toBeNull();
    expect(byId.get(untouched.id)?.format).toBe(BookFormat.PHYSICAL);
    expect(byId.get(untouched.id)?.ownership).toBe(BookOwnership.OWNED);
  });

  it("removes tags, alone or while adding others", async () => {
    const a = await makeBook({ tags: ["fantasy", "epic", "owned"] });
    const b = await makeBook({ tags: ["epic"] });

    await bulkUpdateBooks({ bookIds: [a.id, b.id], removeTags: ["epic"] });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: a.id } })).tags).toEqual([
      "fantasy",
      "owned",
    ]);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: b.id } })).tags).toEqual([]);

    await bulkUpdateBooks({ bookIds: [a.id], addTags: ["reread"], removeTags: ["owned"] });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: a.id } })).tags).toEqual([
      "fantasy",
      "reread",
    ]);
  });

  it("refuses a tag both added and removed, writing nothing", async () => {
    const bk = await makeBook({ tags: ["epic"] });
    expect(
      await bulkUpdateBooks({ bookIds: [bk.id], addTags: ["new"], removeTags: ["new"] }),
    ).toEqual({ error: "“new” is in both Add tags and Remove tags." });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).tags).toEqual(["epic"]);
  });

  it("applies to every book matching the filters, past any page, and only the reader's", async () => {
    const tagged = await Promise.all(
      Array.from({ length: 205 }, (_, i) => makeBook({ title: `Tagged ${i}`, tags: ["x"] })),
    );
    const untagged = await makeBook({ tags: ["y"] });
    const theirs = await makeBook({ tags: ["x"] }, otherUserId);

    const res = await bulkUpdateBooks({
      matching: { tag: "x", sort: "title", dir: "asc", group: "none", limit: "200" },
      ownership: BookOwnership.WISHLIST,
    });

    expect(res).toEqual({ count: tagged.length });
    expect(
      await prisma.book.count({ where: { userId, ownership: BookOwnership.WISHLIST } }),
    ).toBe(205);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: untagged.id } })).ownership).toBe(
      BookOwnership.OWNED,
    );
    expect((await prisma.book.findUniqueOrThrow({ where: { id: theirs.id } })).ownership).toBe(
      BookOwnership.OWNED,
    );
  });

  it("matches on a shelf only when the shelf is the reader's", async () => {
    const theirBook = await makeBook({}, otherUserId);
    const theirShelf = await makeShelf("Theirs", [theirBook], otherUserId);
    await makeBook();

    expect(
      await bulkUpdateBooks({ matching: { shelfId: theirShelf.id }, status: ReadingStatus.DNF }),
    ).toEqual({ error: "No matching books" });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: theirBook.id } })).status).toBe(
      ReadingStatus.WANT_TO_READ,
    );
  });

  it("dates and counts every matching book moved to Read", async () => {
    const books = await Promise.all([
      makeBook({ status: ReadingStatus.READING, tags: ["club"] }),
      makeBook({ status: ReadingStatus.WANT_TO_READ, tags: ["club"] }),
    ]);

    const res = await bulkUpdateBooks({ matching: { tag: "club" }, status: ReadingStatus.READ });
    expect(res).toEqual({ count: 2 });

    for (const bk of books) {
      const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
      expect(after.status).toBe(ReadingStatus.READ);
      expect(after.dateFinished).not.toBeNull();
      expect(after.timesRead).toBe(1);
    }
  });

  it("takes 2,000 ids, and explains 2,001 instead of 'Invalid input'", async () => {
    const bk = await makeBook();
    const ids = [bk.id, ...Array.from({ length: 1999 }, (_, i) => `missing${i}`)];
    expect(await bulkUpdateBooks({ bookIds: ids, status: ReadingStatus.READ })).toEqual({
      count: 1,
    });

    expect(
      await bulkUpdateBooks({ bookIds: [...ids, "one-more"], status: ReadingStatus.DNF }),
    ).toEqual({
      error: "That's more than 2,000 books. Use “Select all books that match” instead.",
    });
  });
});

describe("bulkDeleteBooks", () => {
  it("deletes the selection with its history, and nothing else", async () => {
    const [gone, kept] = await Promise.all([makeBook(), makeBook()]);
    const theirs = await makeBook({}, otherUserId);
    await prisma.read.create({ data: { bookId: gone.id } });
    await prisma.quote.create({ data: { bookId: gone.id, text: "A line" } });
    await prisma.loan.create({ data: { bookId: gone.id, borrower: "Sam" } });

    expect(await bulkDeleteBooks({ bookIds: [gone.id, theirs.id] })).toEqual({ count: 1 });

    expect(await prisma.book.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await prisma.read.count({ where: { bookId: gone.id } })).toBe(0);
    expect(await prisma.quote.count({ where: { bookId: gone.id } })).toBe(0);
    expect(await prisma.loan.count({ where: { bookId: gone.id } })).toBe(0);
    expect(await prisma.book.findUnique({ where: { id: kept.id } })).not.toBeNull();
    expect(await prisma.book.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  it("deletes every match only while the count is the one shown", async () => {
    await Promise.all([makeBook({ tags: ["weed"] }), makeBook({ tags: ["weed"] })]);
    const other = await makeBook({ tags: ["keep"] });

    expect(await bulkDeleteBooks({ matching: { tag: "weed" }, expectedCount: 3 })).toEqual({
      error: "The books that match have changed. Check the count and try again.",
    });
    expect(await prisma.book.count({ where: { userId } })).toBe(3);

    expect(await bulkDeleteBooks({ matching: { tag: "weed" }, expectedCount: 2 })).toEqual({
      count: 2,
    });
    expect(await prisma.book.findMany({ where: { userId }, select: { id: true } })).toEqual([
      { id: other.id },
    ]);
  });

  it("refuses when a match turns up after the count", async () => {
    await Promise.all([makeBook({ tags: ["weed"] }), makeBook({ tags: ["weed"] })]);
    // Another tab adds a matching book just after the server counted two.
    const count = vi.spyOn(appPrisma.book, "count").mockImplementationOnce((async (
      args: Parameters<typeof appPrisma.book.count>[0],
    ) => {
      count.mockRestore();
      const n = await appPrisma.book.count(args);
      await makeBook({ tags: ["weed"] });
      return n;
    }) as never);

    expect(await bulkDeleteBooks({ matching: { tag: "weed" }, expectedCount: 2 })).toEqual({
      error: "The books that match have changed. Check the count and try again.",
    });
    expect(await prisma.book.count({ where: { userId } })).toBe(3);
  });

  it("removes cached covers no other book uses, and keeps shared ones", async () => {
    const write = async (name: string) => {
      await fs.writeFile(path.join(coversDir, name), "cover");
      return `/api/covers/${name}`;
    };
    const exists = (url: string) =>
      fs.access(path.join(coversDir, path.basename(url))).then(
        () => true,
        () => false,
      );
    const own = await write("own-cover.jpg");
    const shared = await write("shared-cover.jpg");
    const a = await makeBook({ coverUrl: own });
    const b = await makeBook({ coverUrl: shared });
    await makeBook({ coverUrl: shared }, otherUserId);
    const remote = await makeBook({ coverUrl: "https://covers.example.org/x.jpg" });

    expect(await bulkDeleteBooks({ bookIds: [a.id, b.id, remote.id] })).toEqual({ count: 3 });

    expect(await exists(own)).toBe(false);
    expect(await exists(shared)).toBe(true);
  });
});
