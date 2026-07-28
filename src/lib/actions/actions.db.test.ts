import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, ReadingStatus } from "@prisma/client";

/**
 * Server actions against a real database.
 *
 * Two things are being pinned down here. First, `timesRead` is *derived*
 * (archived passes plus the current one when it's finished) and is
 * recalculated from several directions — re-reading, adding a past read,
 * deleting one. Getting it wrong silently misreports how many times you've
 * read a book and skews the yearly goal. Second, every action is supposed to
 * scope its writes to the signed-in user; that promise is only worth anything
 * if something checks it.
 */

const prisma = new PrismaClient();

// The actions resolve identity through auth(); the session itself is not what
// is under test here, so it's stubbed and swapped per-test.
let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

// Server actions call revalidatePath, which needs a request scope.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { readAgain, addPastRead, deletePastRead } = await import("@/lib/actions/reads");
const { bulkUpdateBooks } = await import("@/lib/actions/bulk");
const { renameTag, deleteTag } = await import("@/lib/actions/tags");
const { lendBook, returnLoan, deleteLoan } = await import("@/lib/actions/loans");

let userId: string;
let otherUserId: string;

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: {
      userId: owner,
      title: "Test Book",
      searchText: "test book",
      pageCount: 300,
      ...over,
    },
  });
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `act-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `oth-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("read history bookkeeping", () => {
  it("readAgain archives the finished pass and restarts the book", async () => {
    const finished = new Date("2026-01-10T00:00:00.000Z");
    const bk = await makeBook({
      status: ReadingStatus.READ,
      dateStarted: new Date("2026-01-01T00:00:00.000Z"),
      dateFinished: finished,
      rating: 9,
      timesRead: 1,
    });

    await readAgain(bk.id);

    const after = await prisma.book.findFirstOrThrow({
      where: { id: bk.id },
      include: { reads: true, progress: true },
    });

    expect(after.status).toBe(ReadingStatus.READING);
    expect(after.dateFinished).toBeNull();
    expect(after.currentPage).toBeNull();
    // The pass moved from "current" to "archived" — the total is unchanged.
    expect(after.timesRead).toBe(1);
    expect(after.reads).toHaveLength(1);
    expect(after.reads[0].dateFinished?.toISOString()).toBe(finished.toISOString());
    expect(after.reads[0].rating).toBe(9);
    // A page-0 anchor so the new pass's pace starts from zero.
    expect(after.progress).toHaveLength(1);
    expect(after.progress[0].page).toBe(0);
  });

  it("readAgain does nothing to a book that isn't finished", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING });
    await readAgain(bk.id);

    const after = await prisma.book.findFirstOrThrow({
      where: { id: bk.id },
      include: { reads: true },
    });
    expect(after.status).toBe(ReadingStatus.READING);
    expect(after.reads).toHaveLength(0);
  });

  it("readAgain refuses a book belonging to someone else", async () => {
    const bk = await makeBook({ status: ReadingStatus.READ, timesRead: 1 }, otherUserId);
    await readAgain(bk.id);

    const after = await prisma.book.findFirstOrThrow({ where: { id: bk.id } });
    expect(after.status).toBe(ReadingStatus.READ); // untouched
  });

  it("adding and deleting a past read keeps timesRead consistent", async () => {
    const bk = await makeBook({ status: ReadingStatus.READ, timesRead: 1 });

    await addPastRead({}, form({ bookId: bk.id, dateFinished: "2019-05-01", rating: "8" }));
    let after = await prisma.book.findFirstOrThrow({
      where: { id: bk.id },
      include: { reads: true },
    });
    expect(after.reads).toHaveLength(1);
    expect(after.timesRead).toBe(2); // one archived + the current finished pass

    await deletePastRead(after.reads[0].id);
    after = await prisma.book.findFirstOrThrow({
      where: { id: bk.id },
      include: { reads: true },
    });
    expect(after.reads).toHaveLength(0);
    expect(after.timesRead).toBe(1);
  });

  it("an unfinished book with archived passes counts only the archived ones", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING, timesRead: 0 });
    await addPastRead({}, form({ bookId: bk.id, dateFinished: "2019-05-01" }));

    const after = await prisma.book.findFirstOrThrow({ where: { id: bk.id } });
    expect(after.timesRead).toBe(1);
  });

  it("addPastRead refuses a book belonging to someone else", async () => {
    const bk = await makeBook({}, otherUserId);
    const res = await addPastRead({}, form({ bookId: bk.id, dateFinished: "2019-05-01" }));

    expect(res).toHaveProperty("error");
    expect(await prisma.read.count({ where: { bookId: bk.id } })).toBe(0);
  });
});

describe("bulkUpdateBooks", () => {
  it("applies status, tags and shelf together", async () => {
    const [b1, b2] = await Promise.all([makeBook(), makeBook()]);
    const shelf = await prisma.shelf.create({ data: { userId, name: "Shelf" } });

    const res = await bulkUpdateBooks({
      bookIds: [b1.id, b2.id],
      status: ReadingStatus.READ,
      addShelfId: shelf.id,
      addTags: ["fantasy"],
    });

    expect(res.count).toBe(2);
    const books = await prisma.book.findMany({
      where: { id: { in: [b1.id, b2.id] } },
      include: { shelves: true },
    });
    for (const b of books) {
      expect(b.status).toBe(ReadingStatus.READ);
      expect(b.tags).toContain("fantasy");
      expect(b.shelves).toHaveLength(1);
    }
  });

  it("merges tags instead of appending duplicates", async () => {
    const bk = await makeBook({ tags: ["fantasy", "epic"] });
    await bulkUpdateBooks({ bookIds: [bk.id], addTags: ["fantasy", "reread"] });

    const after = await prisma.book.findFirstOrThrow({ where: { id: bk.id } });
    expect([...after.tags].sort()).toEqual(["epic", "fantasy", "reread"]);
  });

  it("silently drops ids belonging to another account", async () => {
    const mine = await makeBook();
    const theirs = await makeBook({}, otherUserId);

    const res = await bulkUpdateBooks({
      bookIds: [mine.id, theirs.id],
      status: ReadingStatus.DNF,
    });

    expect(res.count).toBe(1);
    expect((await prisma.book.findFirstOrThrow({ where: { id: theirs.id } })).status).toBe(
      ReadingStatus.WANT_TO_READ,
    );
  });

  it("rejects a shelf belonging to another account without writing anything", async () => {
    const bk = await makeBook();
    const theirShelf = await prisma.shelf.create({
      data: { userId: otherUserId, name: "Theirs" },
    });

    const res = await bulkUpdateBooks({
      bookIds: [bk.id],
      status: ReadingStatus.READ,
      addShelfId: theirShelf.id,
    });

    expect(res.error).toBeTruthy();
    // The status must not have been applied either — the whole action is one
    // unit, so a rejected shelf leaves nothing behind.
    const after = await prisma.book.findFirstOrThrow({ where: { id: bk.id } });
    expect(after.status).toBe(ReadingStatus.WANT_TO_READ);
  });
});

describe("tag management", () => {
  it("renames a tag across the library, merging onto an existing one", async () => {
    await makeBook({ tags: ["scifi"] });
    await makeBook({ tags: ["scifi", "fantasy"] });

    const res = await renameTag("scifi", "fantasy");
    expect(res.count).toBe(2);

    const books = await prisma.book.findMany({ where: { userId } });
    for (const b of books) {
      expect(b.tags).toContain("fantasy");
      expect(b.tags).not.toContain("scifi");
      // Merging must not leave a duplicate behind.
      expect(b.tags.filter((t) => t === "fantasy")).toHaveLength(1);
    }
  });

  it("deletes a tag everywhere without touching other tags", async () => {
    await makeBook({ tags: ["scifi", "fantasy"] });
    const res = await deleteTag("scifi");

    expect(res.count).toBe(1);
    const bk = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(bk.tags).toEqual(["fantasy"]);
  });

  it("leaves another account's tags alone", async () => {
    const theirs = await makeBook({ tags: ["scifi"] }, otherUserId);
    await deleteTag("scifi");

    const after = await prisma.book.findFirstOrThrow({ where: { id: theirs.id } });
    expect(after.tags).toEqual(["scifi"]);
  });
});

describe("lending", () => {
  it("lends a book out and reports who has it", async () => {
    const bk = await makeBook();
    const res = await lendBook(bk.id, {}, form({ borrower: "Kari", note: "back by June" }));
    expect(res).toEqual({ success: true });

    const loans = await prisma.loan.findMany({ where: { bookId: bk.id } });
    expect(loans).toHaveLength(1);
    expect(loans[0].borrower).toBe("Kari");
    expect(loans[0].returnedAt).toBeNull();
    expect(loans[0].note).toBe("back by June");
  });

  it("refuses a second loan while the book is still out", async () => {
    // Two open loans would make "who has it?" unanswerable.
    const bk = await makeBook();
    await lendBook(bk.id, {}, form({ borrower: "Kari" }));
    const res = await lendBook(bk.id, {}, form({ borrower: "Ola" }));

    expect(res.error).toContain("Kari");
    expect(await prisma.loan.count({ where: { bookId: bk.id } })).toBe(1);
  });

  it("allows lending again once the previous loan came back", async () => {
    const bk = await makeBook();
    await lendBook(bk.id, {}, form({ borrower: "Kari" }));
    const first = await prisma.loan.findFirstOrThrow({ where: { bookId: bk.id } });

    await returnLoan(first.id);
    const res = await lendBook(bk.id, {}, form({ borrower: "Ola" }));

    expect(res).toEqual({ success: true });
    const loans = await prisma.loan.findMany({ where: { bookId: bk.id }, orderBy: { lentAt: "asc" } });
    expect(loans).toHaveLength(2);
    // The returned one stays as history rather than being overwritten.
    expect(loans[0].returnedAt).not.toBeNull();
    expect(loans[1].returnedAt).toBeNull();
  });

  it("requires a borrower", async () => {
    const bk = await makeBook();
    const res = await lendBook(bk.id, {}, form({ borrower: "   " }));
    expect(res.error).toBeTruthy();
    expect(await prisma.loan.count({ where: { bookId: bk.id } })).toBe(0);
  });

  it("refuses to lend another account's book", async () => {
    const theirs = await makeBook({}, otherUserId);
    const res = await lendBook(theirs.id, {}, form({ borrower: "Kari" }));

    expect(res.error).toBeTruthy();
    expect(await prisma.loan.count({ where: { bookId: theirs.id } })).toBe(0);
  });

  it("refuses to return or delete another account's loan", async () => {
    const theirs = await makeBook({}, otherUserId);
    const loan = await prisma.loan.create({
      data: { bookId: theirs.id, borrower: "Someone" },
    });

    await returnLoan(loan.id);
    expect((await prisma.loan.findFirstOrThrow({ where: { id: loan.id } })).returnedAt).toBeNull();

    await deleteLoan(loan.id);
    expect(await prisma.loan.count({ where: { id: loan.id } })).toBe(1);
  });

  it("returning an already-returned loan does not move the date", async () => {
    const bk = await makeBook();
    await lendBook(bk.id, {}, form({ borrower: "Kari" }));
    const loan = await prisma.loan.findFirstOrThrow({ where: { bookId: bk.id } });

    await returnLoan(loan.id);
    const firstReturn = (await prisma.loan.findFirstOrThrow({ where: { id: loan.id } })).returnedAt;
    await returnLoan(loan.id);
    const secondReturn = (await prisma.loan.findFirstOrThrow({ where: { id: loan.id } })).returnedAt;

    expect(secondReturn?.toISOString()).toBe(firstReturn?.toISOString());
  });

  it("deleting a loan removes it from the history", async () => {
    const bk = await makeBook();
    await lendBook(bk.id, {}, form({ borrower: "Kari" }));
    const loan = await prisma.loan.findFirstOrThrow({ where: { bookId: bk.id } });

    await deleteLoan(loan.id);
    expect(await prisma.loan.count({ where: { bookId: bk.id } })).toBe(0);
  });

  it("loans disappear with the book", async () => {
    const bk = await makeBook();
    await lendBook(bk.id, {}, form({ borrower: "Kari" }));
    await prisma.book.delete({ where: { id: bk.id } });

    expect(await prisma.loan.count({ where: { bookId: bk.id } })).toBe(0);
  });
});
