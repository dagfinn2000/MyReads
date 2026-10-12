import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookFormat, type Prisma, PrismaClient, ReadingStatus } from "@prisma/client";
import { dailyPageTotals } from "@/lib/progress";
import type { MoveResult, UndoMove } from "@/lib/reading-log";

/**
 * The reading-log actions against a real database: quick logging for any
 * day, fixing and deleting entries, and Finished / Stopped with their undo.
 *
 * Stats credit each increase between consecutive entries to the later
 * entry's day, so these pin down the exact moments entries get and what
 * the book's page does, as well as what is refused.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { logPage, updateProgressEntry, deleteProgressEntry, moveFromReading, undoMoveFromReading } =
  await import("@/lib/actions/progress");

const OSLO = "Europe/Oslo";
// Monday 12 October 2026, 12:00 in Oslo.
const NOW = new Date("2026-10-12T10:00:00.000Z");
const at = (iso: string) => new Date(iso);

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({
      data: { username: `pr-${stamp}`, passwordHash: "x", preferences: { timeZone: OSLO } },
    }),
    prisma.user.create({ data: { username: `pro-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  vi.useRealTimers();
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

function undoOf(result: MoveResult): UndoMove {
  if ("error" in result) throw new Error(result.error);
  return result.undo;
}

async function setPrefs(preferences: Prisma.InputJsonObject) {
  await prisma.user.update({ where: { id: userId }, data: { preferences } });
}

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: {
      userId: owner,
      title: "Jane Eyre",
      searchText: "jane eyre",
      pageCount: 300,
      status: ReadingStatus.READING,
      dateStarted: at("2026-10-05T00:00:00.000Z"),
      ...over,
    },
  });
}

async function addEntries(bookId: string, entries: [number, string][]) {
  await prisma.progressEntry.createMany({
    data: entries.map(([page, iso]) => ({ bookId, page, date: at(iso) })),
  });
}

async function log(bookId: string) {
  const rows = await prisma.progressEntry.findMany({
    where: { bookId },
    orderBy: [{ date: "asc" }, { page: "asc" }],
  });
  return rows.map((r) => [r.page, r.date.toISOString()] as const);
}

async function bookRow(bookId: string) {
  return prisma.book.findUniqueOrThrow({ where: { id: bookId } });
}

describe("logPage", () => {
  it("anchors a fresh read at its start date and logs today now", async () => {
    const book = await makeBook();
    expect(await logPage(book.id, { page: 40, day: "today" })).toEqual({
      ok: true,
      message: "Logged page 40 for today.",
      page: 40,
      lastPage: false,
    });
    expect(await log(book.id)).toEqual([
      [0, "2026-10-05T00:00:00.000Z"],
      [40, NOW.toISOString()],
    ]);
    expect((await bookRow(book.id)).currentPage).toBe(40);
  });

  it("puts yesterday at the end of yesterday in the reader's zone, and credits that day", async () => {
    const book = await makeBook();
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [100, "2026-10-08T18:00:00.000Z"]]);
    const result = await logPage(book.id, { page: 150, day: "yesterday" });
    expect(result).toMatchObject({ ok: true, message: "Logged page 150 for yesterday." });
    const rows = await log(book.id);
    expect(rows.at(-1)).toEqual([150, "2026-10-11T21:59:59.999Z"]);
    const totals = dailyPageTotals(
      rows.map(([page, date]) => ({ bookId: book.id, page, date: new Date(date) })),
      OSLO,
    );
    expect(totals.get("2026-10-11")).toBe(50);
    expect((await bookRow(book.id)).currentPage).toBe(150);
  });

  it("slots an earlier day between two entries and leaves the page alone", async () => {
    const book = await makeBook({ currentPage: 210 });
    await addEntries(book.id, [
      [0, "2026-10-05T00:00:00.000Z"],
      [120, "2026-10-08T18:00:00.000Z"],
      [210, "2026-10-12T07:00:00.000Z"],
    ]);
    expect(await logPage(book.id, { page: 160, day: "2026-10-10" })).toMatchObject({
      ok: true,
      message: "Logged page 160 for 10 Oct 2026.",
      lastPage: false,
    });
    expect(await log(book.id)).toContainEqual([160, "2026-10-10T21:59:59.999Z"]);
    expect((await bookRow(book.id)).currentPage).toBe(210);
  });

  it("refuses an earlier day past a later entry, and writes nothing", async () => {
    const book = await makeBook({ currentPage: 188 });
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [188, "2026-10-12T07:00:00.000Z"]]);
    expect(await logPage(book.id, { page: 200, day: "yesterday" })).toEqual({
      error:
        "Page 200 for yesterday is past page 188, which you logged today. Log it for a later day, or fix that entry.",
    });
    expect(await log(book.id)).toHaveLength(2);
  });

  it("refuses today below the newest entry", async () => {
    const book = await makeBook({ currentPage: 400, pageCount: 500 });
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [400, "2026-10-11T18:00:00.000Z"]]);
    expect(await logPage(book.id, { page: 380, day: "today" })).toEqual({
      error:
        "Page 380 for today is before page 400, which you logged yesterday. If that entry is wrong, fix it with its pencil.",
    });
  });

  it("refuses a future day, a day before the start, a page past the end and page 0", async () => {
    const book = await makeBook();
    expect(await logPage(book.id, { page: 10, day: "2026-10-13" })).toEqual({
      error: "That day hasn't happened yet.",
    });
    expect(await logPage(book.id, { page: 10, day: "2026-10-04" })).toEqual({
      error: "You started this book on 5 Oct 2026. Pick that day or later.",
    });
    expect(await logPage(book.id, { page: 301, day: "today" })).toEqual({
      error: "Page 301 is past the end of the book (300 pages).",
    });
    expect(await logPage(book.id, { page: 0, day: "today" })).toEqual({ error: "Log at least page 1" });
    expect(await logPage(book.id, { page: 10, day: "2026-02-30" })).toMatchObject({ error: expect.any(String) });
    expect(await log(book.id)).toEqual([]);
  });

  it("refuses a book that isn't being read, and another account's book", async () => {
    const shelved = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    expect(await logPage(shelved.id, { page: 10, day: "today" })).toEqual({
      error: "Only books you're reading can log pages. Set this one to Currently Reading first.",
    });
    const theirs = await makeBook({}, otherUserId);
    expect(await logPage(theirs.id, { page: 10, day: "today" })).toEqual({ error: "Book not found" });
    expect(await logPage(42 as unknown as string, { page: 10, day: "today" })).toEqual({
      error: "Book not found",
    });
    expect(await log(theirs.id)).toEqual([]);
  });

  it("flags the last page, and logs nothing for the page it's already at", async () => {
    const book = await makeBook();
    expect(await logPage(book.id, { page: 300, day: "today" })).toMatchObject({ ok: true, lastPage: true });
    expect(await logPage(book.id, { page: 300, day: "today" })).toEqual({
      ok: true,
      message: "Already at page 300.",
      page: 300,
      lastPage: true,
    });
    expect(await log(book.id)).toHaveLength(2);
  });

  it("compares with the log, not a book page the log never reached", async () => {
    const book = await makeBook({ currentPage: 212 });
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [200, "2026-10-10T18:00:00.000Z"]]);
    expect(await logPage(book.id, { page: 212, day: "today" })).toMatchObject({
      message: "Logged page 212 for today.",
    });
    expect((await log(book.id)).at(-1)).toEqual([212, NOW.toISOString()]);
  });

  it("speaks the book's unit", async () => {
    await setPrefs({ timeZone: OSLO, ebookUnit: "percent" });
    const book = await makeBook({ format: BookFormat.EBOOK, pageCount: 400 });
    expect(await logPage(book.id, { page: 180, day: "today" })).toMatchObject({
      message: "Logged 45% for today.",
    });
  });

  it("says a percent or time back as typed", async () => {
    await setPrefs({ timeZone: OSLO, audiobookUnit: "time" });
    const book = await makeBook({ format: BookFormat.AUDIOBOOK, pageCount: 400, lengthMinutes: 700 });
    // 5:11 saves as page 178, which on its own reads as 5:12.
    expect(await logPage(book.id, { page: 178, day: "today", value: 311 })).toMatchObject({
      message: "Logged 5:11 for today.",
    });
  });

  it("never says 42% is before 42%", async () => {
    await setPrefs({ timeZone: OSLO, ebookUnit: "percent" });
    const book = await makeBook({ format: BookFormat.EBOOK, pageCount: 412, currentPage: 175 });
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [175, "2026-10-11T18:00:00.000Z"]]);
    // 42% typed is page 173; yesterday's page 175 also reads 42%.
    expect(await logPage(book.id, { page: 173, day: "today", value: 42 })).toEqual({
      error:
        "42% (page 173) for today is before 42% (page 175), which you logged yesterday. If that entry is wrong, fix it with its pencil.",
    });
    // Logging the box as it stands sends the book's own page.
    expect(await logPage(book.id, { page: 175, day: "today", value: 42 })).toMatchObject({
      message: "Already at 42%.",
    });
  });

  describe("east of UTC on the start day", () => {
    // 08:00 on the 12th in Tokyo, before the typed Started date's midnight UTC.
    const morning = new Date("2026-10-11T23:00:00.000Z");
    const started = at("2026-10-12T00:00:00.000Z");

    beforeEach(async () => {
      vi.setSystemTime(morning);
      await setPrefs({ timeZone: "Asia/Tokyo" });
    });

    it("anchors a fresh read no later than its first entry", async () => {
      const book = await makeBook({ dateStarted: started });
      expect(await logPage(book.id, { page: 30, day: "today" })).toMatchObject({ ok: true });
      const rows = await log(book.id);
      expect(rows).toEqual([
        [0, morning.toISOString()],
        [30, morning.toISOString()],
      ]);
      const totals = dailyPageTotals(
        rows.map(([page, date]) => ({ bookId: book.id, page, date: new Date(date) })),
        "Asia/Tokyo",
      );
      expect(totals.get("2026-10-12")).toBe(30);
    });

    it("counts on from a book added mid-read earlier that morning", async () => {
      // createBook's lone entry, from 07:30 in Tokyo, with no anchor.
      const book = await makeBook({ dateStarted: started, currentPage: 50 });
      await addEntries(book.id, [[50, "2026-10-11T22:30:00.000Z"]]);
      expect(await logPage(book.id, { page: 70, day: "today" })).toMatchObject({
        ok: true,
        message: "Logged page 70 for today.",
      });
      expect(await log(book.id)).toEqual([
        [50, "2026-10-11T22:30:00.000Z"],
        [70, morning.toISOString()],
      ]);
      expect((await bookRow(book.id)).currentPage).toBe(70);
    });

    it("moves an existing start-date anchor back to the entry", async () => {
      const book = await makeBook({ dateStarted: started });
      await addEntries(book.id, [[0, started.toISOString()]]);
      expect(await logPage(book.id, { page: 30, day: "today" })).toMatchObject({ ok: true });
      expect(await log(book.id)).toEqual([
        [0, morning.toISOString()],
        [30, morning.toISOString()],
      ]);
    });
  });
});

describe("updateProgressEntry", () => {
  async function seeded(over: Record<string, unknown> = {}) {
    const book = await makeBook({ currentPage: 210, ...over });
    await addEntries(book.id, [
      [0, "2026-10-05T00:00:00.000Z"],
      [120, "2026-10-08T18:00:00.000Z"],
      [161, "2026-10-10T18:00:00.000Z"],
      [210, "2026-10-12T07:00:00.000Z"],
    ]);
    const rows = await prisma.progressEntry.findMany({ where: { bookId: book.id }, orderBy: { date: "asc" } });
    return { book, rows };
  }

  it("fixes a page within its neighbours, keeping its moment", async () => {
    const { book, rows } = await seeded();
    expect(await updateProgressEntry(rows[2].id, { page: 190, day: "2026-10-10" })).toEqual({
      message: "Fixed: page 190 for 10 Oct 2026.",
    });
    expect((await log(book.id))[2]).toEqual([190, "2026-10-10T18:00:00.000Z"]);
    expect((await bookRow(book.id)).currentPage).toBe(210);
  });

  it("moves the book's page with the newest entry", async () => {
    const { book, rows } = await seeded();
    await updateProgressEntry(rows[3].id, { page: 205, day: "2026-10-12" });
    expect((await bookRow(book.id)).currentPage).toBe(205);
  });

  it("moves an entry to another day", async () => {
    const { book, rows } = await seeded();
    expect(await updateProgressEntry(rows[2].id, { page: 161, day: "2026-10-11" })).toEqual({
      message: "Fixed: page 161 for yesterday.",
    });
    expect((await log(book.id))[2]).toEqual([161, "2026-10-11T21:59:59.999Z"]);
  });

  it("refuses crossing a neighbour, the start, and a future day", async () => {
    const { rows } = await seeded();
    expect(await updateProgressEntry(rows[2].id, { page: 230, day: "2026-10-10" })).toEqual({
      error: "That entry has to stay between page 120 and page 210, to fit the days around it.",
    });
    // Moved to today, it would come after today's page 210.
    expect(await updateProgressEntry(rows[2].id, { page: 161, day: "2026-10-12" })).toEqual({
      error: "That entry has to stay between page 210 and page 300, to fit the days around it.",
    });
    expect(await updateProgressEntry(rows[1].id, { page: 120, day: "2026-10-01" })).toEqual({
      error: "That's before this read started (5 Oct 2026).",
    });
    expect(await updateProgressEntry(rows[1].id, { page: 120, day: "2026-10-13" })).toEqual({
      error: "That day hasn't happened yet.",
    });
  });

  it("keeps an entry of a read with no anchor on or after its Started day", async () => {
    // A book added mid-read: one entry, no page-0 anchor. Moved before
    // Started it would leave the read and take the book's page with it.
    const book = await makeBook({ currentPage: 120 });
    await addEntries(book.id, [[120, "2026-10-08T12:00:00.000Z"]]);
    const [row] = await prisma.progressEntry.findMany({ where: { bookId: book.id } });
    expect(await updateProgressEntry(row.id, { page: 120, day: "2026-09-28" })).toEqual({
      error: "You started this book on 5 Oct 2026. Pick that day or later.",
    });
    expect(await log(book.id)).toEqual([[120, "2026-10-08T12:00:00.000Z"]]);
    expect(await updateProgressEntry(row.id, { page: 120, day: "2026-10-05" })).toEqual({
      message: "Fixed: page 120 for 5 Oct 2026.",
    });
    expect((await bookRow(book.id)).currentPage).toBe(120);
  });

  it("reads a refusal against what was typed", async () => {
    await setPrefs({ timeZone: OSLO, ebookUnit: "percent" });
    const { rows } = await seeded({ format: BookFormat.EBOOK, pageCount: 412 });
    // 29% typed is page 119, just under the entry before it: page 120,
    // which also reads 29%.
    expect(await updateProgressEntry(rows[2].id, { page: 119, day: "2026-10-10", value: 29 })).toEqual({
      error: "That entry has to stay between 29% (page 120) and 51%, to fit the days around it.",
    });
    expect(await updateProgressEntry(rows[2].id, { page: 165, day: "2026-10-10", value: 40 })).toEqual({
      message: "Fixed: 40% for 10 Oct 2026.",
    });
  });

  it("keeps an entry of an earlier read before the next one starts", async () => {
    const book = await makeBook({ currentPage: 50 });
    await addEntries(book.id, [
      [0, "2026-01-05T10:00:00.000Z"],
      [300, "2026-02-01T10:00:00.000Z"],
      [0, "2026-03-01T10:00:00.000Z"],
      [50, "2026-03-02T10:00:00.000Z"],
    ]);
    const rows = await prisma.progressEntry.findMany({ where: { bookId: book.id }, orderBy: { date: "asc" } });
    expect(await updateProgressEntry(rows[1].id, { page: 300, day: "2026-03-05" })).toEqual({
      error: "That's after you started reading it again (1 Mar 2026).",
    });
    // An earlier read's fix leaves the current read's page alone.
    await updateProgressEntry(rows[1].id, { page: 290, day: "2026-02-01" });
    expect((await bookRow(book.id)).currentPage).toBe(50);
  });

  it("refuses the start of a read and another account's entry", async () => {
    const { rows } = await seeded();
    expect(await updateProgressEntry(rows[0].id, { page: 5, day: "2026-10-05" })).toEqual({
      error: "The start of a read can't be changed.",
    });
    currentUserId = otherUserId;
    expect(await updateProgressEntry(rows[2].id, { page: 150, day: "2026-10-10" })).toEqual({
      error: "Entry not found",
    });
  });
});

describe("deleteProgressEntry", () => {
  it("moves the page back when the newest entry goes, and only then", async () => {
    const book = await makeBook({ currentPage: 210 });
    await addEntries(book.id, [
      [0, "2026-10-05T00:00:00.000Z"],
      [120, "2026-10-08T18:00:00.000Z"],
      [210, "2026-10-12T07:00:00.000Z"],
    ]);
    const rows = await prisma.progressEntry.findMany({ where: { bookId: book.id }, orderBy: { date: "asc" } });
    expect(await deleteProgressEntry(rows[1].id)).toEqual({});
    expect((await bookRow(book.id)).currentPage).toBe(210);
    await deleteProgressEntry(rows[2].id);
    expect((await bookRow(book.id)).currentPage).toBeNull();
    expect(await log(book.id)).toEqual([[0, "2026-10-05T00:00:00.000Z"]]);
  });

  it("won't delete the start of a read, or another account's entry", async () => {
    const book = await makeBook();
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [20, "2026-10-06T10:00:00.000Z"]]);
    const rows = await prisma.progressEntry.findMany({ where: { bookId: book.id }, orderBy: { date: "asc" } });
    expect(await deleteProgressEntry(rows[0].id)).toEqual({ error: "The start of a read can't be deleted." });
    currentUserId = otherUserId;
    expect(await deleteProgressEntry(rows[1].id)).toEqual({ error: "Entry not found" });
    expect(await log(book.id)).toHaveLength(2);
  });
});

describe("moveFromReading and undo", () => {
  it("finishes today, closes the log and can be undone", async () => {
    const book = await makeBook({ currentPage: 218 });
    await prisma.read.create({ data: { bookId: book.id } }); // one earlier read
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [218, "2026-10-11T18:00:00.000Z"]]);

    const moved = await moveFromReading(book.id, "READ");
    expect(moved).toEqual({
      ok: true,
      finished: true,
      message: "Jane Eyre moved to Read. Finished today.",
      undo: { from: "READ", finishedAt: NOW.toISOString(), page: 218 },
    });
    const done = await bookRow(book.id);
    expect(done).toMatchObject({
      status: ReadingStatus.READ,
      dateFinished: NOW,
      currentPage: null,
      timesRead: 2,
    });
    expect((await log(book.id)).at(-1)).toEqual([300, NOW.toISOString()]);

    expect(await undoMoveFromReading(book.id, undoOf(moved))).toEqual({});
    expect(await bookRow(book.id)).toMatchObject({
      status: ReadingStatus.READING,
      dateFinished: null,
      currentPage: 218,
      timesRead: 1,
    });
    expect(await log(book.id)).toHaveLength(2);
  });

  it("stops at the current page, writing nothing to the log", async () => {
    const book = await makeBook({ currentPage: 218 });
    await addEntries(book.id, [[0, "2026-10-05T00:00:00.000Z"], [218, "2026-10-11T18:00:00.000Z"]]);
    const moved = await moveFromReading(book.id, "DNF");
    expect(moved).toMatchObject({
      message: "Jane Eyre moved to Did Not Finish at page 218.",
      finished: false,
      undo: { from: "DNF", finishedAt: null, page: 218 },
    });
    expect(await bookRow(book.id)).toMatchObject({ status: ReadingStatus.DNF, currentPage: 218 });
    expect(await log(book.id)).toHaveLength(2);
    await undoMoveFromReading(book.id, { from: "DNF", finishedAt: null, page: 218 });
    expect(await bookRow(book.id)).toMatchObject({ status: ReadingStatus.READING, currentPage: 218 });
  });

  it("says nothing about a page it doesn't have", async () => {
    const book = await makeBook();
    expect(await moveFromReading(book.id, "DNF")).toMatchObject({
      message: "Jane Eyre moved to Did Not Finish.",
    });
  });

  it("restores an untracked book's page on undo", async () => {
    const book = await makeBook({ currentPage: 120 });
    const moved = await moveFromReading(book.id, "READ");
    expect(await log(book.id)).toEqual([]);
    await undoMoveFromReading(book.id, undoOf(moved));
    expect((await bookRow(book.id)).currentPage).toBe(120);
  });

  it("refuses a book that isn't being read and another account's book", async () => {
    const shelved = await makeBook({ status: ReadingStatus.READ });
    expect(await moveFromReading(shelved.id, "READ")).toEqual({
      error: "This book isn't in Currently Reading any more.",
    });
    const theirs = await makeBook({}, otherUserId);
    expect(await moveFromReading(theirs.id, "READ")).toEqual({ error: "Book not found" });
    expect((await bookRow(theirs.id)).status).toBe(ReadingStatus.READING);
  });

  it("won't undo once the book has changed, and never touches an earlier read's entries", async () => {
    const book = await makeBook({ currentPage: 100, dateStarted: at("2026-09-01T10:00:00.000Z") });
    await addEntries(book.id, [
      [0, "2026-01-05T10:00:00.000Z"],
      [300, "2026-02-01T00:00:00.000Z"], // the first read's closing entry
      [0, "2026-09-01T10:00:00.000Z"],
      [100, "2026-10-10T10:00:00.000Z"],
    ]);
    const moved = await moveFromReading(book.id, "READ");
    const undo = (moved as { undo: { from: "READ"; finishedAt: string; page: number } }).undo;

    // A crafted undo aimed at the first read's finish is refused.
    expect(
      await undoMoveFromReading(book.id, { ...undo, finishedAt: "2026-02-01T00:00:00.000Z" }),
    ).toEqual({ error: "This book has changed since. Open it to set its status." });
    // So is one after the book was moved on elsewhere.
    await prisma.book.update({ where: { id: book.id }, data: { status: ReadingStatus.WANT_TO_READ } });
    expect(await undoMoveFromReading(book.id, undo)).toEqual({
      error: "This book has changed since. Open it to set its status.",
    });
    await prisma.book.update({ where: { id: book.id }, data: { status: ReadingStatus.READ } });

    expect(await undoMoveFromReading(book.id, undo)).toEqual({});
    expect(await log(book.id)).toEqual([
      [0, "2026-01-05T10:00:00.000Z"],
      [300, "2026-02-01T00:00:00.000Z"],
      [0, "2026-09-01T10:00:00.000Z"],
      [100, "2026-10-10T10:00:00.000Z"],
    ]);
    expect((await bookRow(book.id)).currentPage).toBe(100);
  });
});
