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

const { readAgain, addPastRead, deletePastRead, updatePastRead } = await import(
  "@/lib/actions/reads"
);
const { bulkUpdateBooks } = await import("@/lib/actions/bulk");
const { renameTag, deleteTag, removeTagRule } = await import("@/lib/actions/tags");
const { lendBook, returnLoan, deleteLoan } = await import("@/lib/actions/loans");
const { createShelf } = await import("@/lib/actions/shelves");

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

describe("past-read notes", () => {
  async function onlyRead(bookId: string) {
    return prisma.read.findFirstOrThrow({ where: { bookId } });
  }

  it("addPastRead stores the note trimmed, and an empty one as nothing", async () => {
    const bk = await makeBook();
    await addPastRead({}, form({ bookId: bk.id, note: "  Read it aloud to the kids  " }));
    expect((await onlyRead(bk.id)).note).toBe("Read it aloud to the kids");

    const other = await makeBook();
    await addPastRead({}, form({ bookId: other.id, note: "   " }));
    expect((await onlyRead(other.id)).note).toBeNull();
  });

  it("updatePastRead changes the note, and an empty field clears it", async () => {
    const bk = await makeBook();
    const read = await prisma.read.create({ data: { bookId: bk.id, note: "First go" } });

    const res = await updatePastRead(read.id, {}, form({ note: "Second go", rating: "6" }));
    expect(res).toEqual({ success: true });
    expect(await onlyRead(bk.id)).toMatchObject({ note: "Second go", rating: 6 });

    await updatePastRead(read.id, {}, form({ note: "" }));
    expect((await onlyRead(bk.id)).note).toBeNull();
  });

  it("updatePastRead keeps the note when the field isn't sent", async () => {
    const bk = await makeBook();
    const read = await prisma.read.create({ data: { bookId: bk.id, note: "Keep me" } });

    await updatePastRead(read.id, {}, form({ dateFinished: "2019-05-01" }));
    expect((await onlyRead(bk.id)).note).toBe("Keep me");
  });

  it("updatePastRead refuses another account's read and changes nothing", async () => {
    const bk = await makeBook({}, otherUserId);
    const read = await prisma.read.create({ data: { bookId: bk.id, note: "Theirs", rating: 8 } });

    const res = await updatePastRead(read.id, {}, form({ note: "Mine now", rating: "2" }));
    expect(res).toEqual({ error: "Read not found" });
    expect(await onlyRead(bk.id)).toMatchObject({ note: "Theirs", rating: 8 });
  });

  it("updatePastRead turns away a note over 2000 characters", async () => {
    const bk = await makeBook();
    const read = await prisma.read.create({ data: { bookId: bk.id, note: "Short" } });

    const res = await updatePastRead(read.id, {}, form({ note: "x".repeat(2001) }));
    expect(res).toEqual({ error: "Keep the note to 2000 characters or fewer." });
    expect((await onlyRead(bk.id)).note).toBe("Short");
  });

  it("readAgain archives the pass without a note", async () => {
    const bk = await makeBook({ status: ReadingStatus.READ, timesRead: 1 });
    await readAgain(bk.id);
    expect((await onlyRead(bk.id)).note).toBeNull();
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

  it("dates and counts books moved to Read, as the reading card does", async () => {
    // A bare status update left these undated with timesRead 0, so they
    // were missing from the yearly stats and the goal.
    const fresh = await makeBook({ status: ReadingStatus.READING });
    const dated = await makeBook({
      status: ReadingStatus.READING,
      dateFinished: new Date("2026-02-03T00:00:00.000Z"),
    });
    const reread = await makeBook({ status: ReadingStatus.READING });
    await prisma.read.create({ data: { bookId: reread.id } });

    const res = await bulkUpdateBooks({
      bookIds: [fresh.id, dated.id, reread.id],
      status: ReadingStatus.READ,
    });
    expect(res.count).toBe(3);

    const rows = await prisma.book.findMany({
      where: { id: { in: [fresh.id, dated.id, reread.id] } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(fresh.id)?.dateFinished?.toDateString()).toBe(new Date().toDateString());
    expect(byId.get(fresh.id)?.timesRead).toBe(1);
    expect(byId.get(dated.id)?.dateFinished?.toISOString()).toBe("2026-02-03T00:00:00.000Z");
    expect(byId.get(reread.id)?.timesRead).toBe(2);
  });

  it("uncounts books moved off Read and clears their page", async () => {
    const bk = await makeBook({ status: ReadingStatus.READ, timesRead: 1, currentPage: 50 });
    await bulkUpdateBooks({ bookIds: [bk.id], status: ReadingStatus.WANT_TO_READ });

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.status).toBe(ReadingStatus.WANT_TO_READ);
    expect(after.timesRead).toBe(0);
    expect(after.currentPage).toBeNull();
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

  it("takes books off a shelf, leaving the others on it", async () => {
    const [a, b, c] = await Promise.all([makeBook(), makeBook(), makeBook()]);
    const shelf = await prisma.shelf.create({
      data: { userId, name: "Shelf", books: { connect: [{ id: a.id }, { id: b.id }, { id: c.id }] } },
    });

    const res = await bulkUpdateBooks({ bookIds: [a.id, b.id], removeShelfId: shelf.id });
    expect(res.count).toBe(2);

    const after = await prisma.shelf.findUniqueOrThrow({
      where: { id: shelf.id },
      select: { books: { select: { id: true } } },
    });
    expect(after.books.map((x) => x.id)).toEqual([c.id]);
  });

  it("won't take books off another account's shelf", async () => {
    const bk = await makeBook();
    const theirShelf = await prisma.shelf.create({ data: { userId: otherUserId, name: "Theirs" } });
    expect(await bulkUpdateBooks({ bookIds: [bk.id], removeShelfId: theirShelf.id })).toEqual({
      error: "Shelf not found",
    });
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

  it("won't rename a tag to one with a comma", async () => {
    // The library's tag filter keeps its tags comma-separated in the URL.
    await makeBook({ tags: ["scifi"] });
    expect(await renameTag("scifi", "science, fiction")).toEqual({
      error: "Tags can't contain commas.",
    });
    const bk = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(bk.tags).toEqual(["scifi"]);
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

describe("shelves", () => {
  it("refuses a second shelf whose name differs only by case or spaces", async () => {
    expect(await createShelf({}, form({ name: "Favourites" }))).toEqual({ success: true });
    expect(await createShelf({}, form({ name: "favourites " }))).toEqual({
      error: 'You already have a shelf called "Favourites"',
    });
    expect(await prisma.shelf.count({ where: { userId } })).toBe(1);
  });

  it("doesn't count another account's shelf as a duplicate", async () => {
    await prisma.shelf.create({ data: { userId: otherUserId, name: "Favourites" } });
    expect(await createShelf({}, form({ name: "Favourites" }))).toEqual({ success: true });
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

  it("only lends a copy you own", async () => {
    // The card hides "Lend out" for these; the action refuses them too.
    for (const ownership of ["BORROWED", "GIVEN_AWAY", "WISHLIST"]) {
      const bk = await makeBook({ ownership });
      const res = await lendBook(bk.id, {}, form({ borrower: "Kari" }));

      expect(res.error).toBe("Only a copy you own can be lent out.");
      expect(await prisma.loan.count({ where: { bookId: bk.id } })).toBe(0);
    }
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

describe("tag rules for future imports", () => {
  async function prefsOf(id: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    return (user.preferences ?? {}) as Record<string, unknown>;
  }

  it("renameTag with remember stores the rule, without it stores nothing", async () => {
    await makeBook({ tags: ["science fiction"] });

    const plain = await renameTag("science fiction", "scifi");
    expect(plain.ruleSaved).toBeUndefined();
    expect((await prefsOf(userId)).tagRenames).toBeUndefined();

    // Recorded even though no book carries the tag any more.
    const res = await renameTag("Science Fiction", "sci-fi", { remember: true });
    expect(res).toEqual({ count: 0, ruleSaved: true });
    expect((await prefsOf(userId)).tagRenames).toEqual([{ from: "science fiction", to: "sci-fi" }]);
  });

  it("refuses a new name with a comma in it", async () => {
    await makeBook({ tags: ["sf"] });
    expect((await renameTag("sf", "sci, fi", { remember: true })).error).toBe(
      "Tags can't contain commas.",
    );
    expect((await prisma.book.findFirstOrThrow({ where: { userId } })).tags).toEqual(["sf"]);
  });

  it("deleteTag with neverImport stores the skip", async () => {
    await makeBook({ tags: ["fiction"] });
    const res = await deleteTag("fiction", { neverImport: true });
    expect(res).toEqual({ count: 1, ruleSaved: true });
    expect((await prefsOf(userId)).tagSkips).toEqual(["fiction"]);
  });

  it("keeps the other preferences when it writes a rule", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { dateFormat: "iso", tagSkips: ["general"] } },
    });
    await renameTag("sf", "sci-fi", { remember: true });

    const prefs = await prefsOf(userId);
    expect(prefs.dateFormat).toBe("iso");
    expect(prefs.tagSkips).toEqual(["general"]);
    expect(prefs.tagRenames).toEqual([{ from: "sf", to: "sci-fi" }]);
  });

  it("removeTagRule takes one rule out and keeps the rest", async () => {
    await renameTag("sf", "sci-fi", { remember: true });
    await renameTag("ya", "young adult", { remember: true });
    await deleteTag("general", { neverImport: true });

    expect(await removeTagRule({ from: "sf" })).toEqual({});
    expect(await removeTagRule({ skip: "general" })).toEqual({});
    const prefs = await prefsOf(userId);
    expect(prefs.tagRenames).toEqual([{ from: "ya", to: "young adult" }]);
    expect(prefs.tagSkips).toEqual([]);
    expect((await removeTagRule({})).error).toBe("Invalid input");
  });

  it("stores rules on the signed-in account only", async () => {
    await renameTag("sf", "sci-fi", { remember: true });
    await deleteTag("fiction", { neverImport: true });
    expect(await prefsOf(otherUserId)).toEqual({});
  });
});

describe("bulk Set status: Read and the finish-date preference", () => {
  it("leaves the finish date empty when undated is chosen, and keeps a date already there", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { addedAsReadFinished: "undated" } },
    });
    const finished = new Date("2024-03-10T00:00:00.000Z");
    const plain = await makeBook({ status: ReadingStatus.READING });
    const dated = await makeBook({ status: ReadingStatus.DNF, dateFinished: finished });

    const res = await bulkUpdateBooks({ bookIds: [plain.id, dated.id], status: ReadingStatus.READ });
    expect(res.count).toBe(2);

    const a = await prisma.book.findUniqueOrThrow({ where: { id: plain.id } });
    expect(a.dateFinished).toBeNull();
    expect(a.timesRead).toBe(1);
    const b = await prisma.book.findUniqueOrThrow({ where: { id: dated.id } });
    expect(b.dateFinished).toEqual(finished);
  });

  it("still finishes them today by default", async () => {
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await bulkUpdateBooks({ bookIds: [bk.id], status: ReadingStatus.READ });
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.dateFinished?.toDateString()).toBe(new Date().toDateString());
  });
});
