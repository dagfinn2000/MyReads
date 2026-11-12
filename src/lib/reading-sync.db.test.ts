import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ReadingStatus } from "@/lib/enums";
import { dailyPageTotals } from "@/lib/progress";

/**
 * Reading saved offline and sent later (lib/reading-sync.ts): it lands at
 * the moment it was made, is written once however often it's sent, and
 * comes back with a reason when the book no longer allows it.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { syncItems, MAX_SYNC_ITEMS } = await import("@/lib/reading-sync");
const { logPage } = await import("@/lib/actions/progress");

const OSLO = "Europe/Oslo";
// Monday 12 October 2026, 12:00 in Oslo.
const NOW = new Date("2026-10-12T10:00:00.000Z");
// Sunday evening, 21:30 in Oslo: logged on the train, offline.
const SUNDAY_EVENING = new Date("2026-10-11T19:30:00.000Z").getTime();

let userId: string;
let otherUserId: string;
let n = 0;
const clientId = () => `client-id-${Date.now()}-${++n}-abcdef`;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({
      data: { username: `sync-${stamp}`, passwordHash: "x", preferences: { timeZone: OSLO } },
    }),
    prisma.user.create({ data: { username: `synco-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  vi.useRealTimers();
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: {
      userId: owner,
      title: "Jane Eyre",
      searchText: "jane eyre",
      pageCount: 300,
      status: ReadingStatus.READING,
      dateStarted: new Date("2026-10-05T00:00:00.000Z"),
      ...over,
    },
  });
}

async function log(bookId: string) {
  const rows = await prisma.progressEntry.findMany({
    where: { bookId },
    orderBy: [{ date: "asc" }, { page: "asc" }],
  });
  return rows.map((r) => [r.page, r.date.toISOString(), r.minutes] as const);
}

const logItem = (bookId: string, over: Record<string, unknown> = {}) => ({
  kind: "log",
  id: clientId(),
  bookId,
  page: 120,
  day: "2026-10-11",
  at: SUNDAY_EVENING,
  ...over,
});

describe("syncItems", () => {
  it("writes a log at the moment it was made and credits that day", async () => {
    const book = await makeBook();
    const out = await syncItems(userId, { items: [logItem(book.id, { minutes: 25 })] });
    expect(out).toEqual({
      results: [{ id: expect.any(String), ok: true, message: "Logged page 120 for yesterday (25 min)." }],
    });
    const rows = await log(book.id);
    expect(rows).toEqual([
      [0, "2026-10-05T00:00:00.000Z", null],
      [120, "2026-10-11T19:30:00.000Z", 25],
    ]);
    const totals = dailyPageTotals(
      rows.map(([page, date]) => ({ bookId: book.id, page, date: new Date(date) })),
      OSLO,
    );
    expect(totals.get("2026-10-11")).toBe(120);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).currentPage).toBe(120);
  });

  it("writes several logs of one book in order", async () => {
    const book = await makeBook();
    const out = await syncItems(userId, {
      items: [
        logItem(book.id, { page: 80, at: SUNDAY_EVENING - 3_600_000 }),
        logItem(book.id, { page: 120 }),
        logItem(book.id, { page: 150, day: "2026-10-12", at: NOW.getTime() - 60_000 }),
      ],
    });
    expect("results" in out && out.results.map((r) => r.ok)).toEqual([true, true, true]);
    expect((await log(book.id)).map(([page]) => page)).toEqual([0, 80, 120, 150]);
  });

  it("writes a log sent twice once", async () => {
    const book = await makeBook();
    const item = logItem(book.id, { minutes: 25 });
    await syncItems(userId, { items: [item] });
    const again = await syncItems(userId, { items: [item] });
    expect(again).toEqual({
      results: [{ id: item.id, ok: true, message: "Logged page 120 for yesterday (25 min)." }],
    });
    expect(await log(book.id)).toHaveLength(2);
  });

  it("writes it once when two tabs send it at the same time", async () => {
    const book = await makeBook();
    const item = logItem(book.id, { minutes: 25 });
    const [a, b] = await Promise.all([
      syncItems(userId, { items: [item] }),
      syncItems(userId, { items: [item] }),
    ]);
    expect("results" in a && a.results[0].ok).toBe(true);
    expect("results" in b && b.results[0].ok).toBe(true);
    expect((await log(book.id)).filter(([page]) => page === 120)).toHaveLength(1);
  });

  it("doesn't write again a log whose first send got through but whose answer was lost", async () => {
    const book = await makeBook();
    const id = clientId();
    // Sent from the quick-log row; the connection dropped before the answer.
    await logPage(book.id, { page: 120, day: "today", minutes: 25, clientId: id });
    // So the browser saved it, and sends it again later.
    const out = await syncItems(userId, {
      items: [logItem(book.id, { id, day: "2026-10-12", at: NOW.getTime() })],
    });
    expect("results" in out && out.results[0]).toMatchObject({ ok: true });
    expect((await log(book.id)).filter(([page]) => page === 120)).toHaveLength(1);
  });

  it("puts a log from a clock that runs ahead at now, not in the future", async () => {
    const book = await makeBook();
    await syncItems(userId, {
      items: [logItem(book.id, { day: "2026-10-12", at: NOW.getTime() + 3_600_000 })],
    });
    expect((await log(book.id)).at(-1)?.[1]).toBe(NOW.toISOString());
  });

  it("says why when the book no longer takes the log", async () => {
    const finished = await makeBook({ status: ReadingStatus.READ, dateFinished: NOW });
    const short = await makeBook({ pageCount: 100 });
    const theirs = await makeBook({}, otherUserId);
    const out = await syncItems(userId, {
      items: [logItem(finished.id), logItem(short.id), logItem(theirs.id)],
    });
    expect("results" in out && out.results.map((r) => (r.ok ? "ok" : r.error))).toEqual([
      "Only books you're reading can log pages. Set this one to Currently Reading first.",
      expect.stringContaining("100"),
      "Book not found",
    ]);
    expect(await log(theirs.id)).toEqual([]);
  });

  it("refuses a log for a day before the read started", async () => {
    const book = await makeBook({ dateStarted: new Date("2026-10-12T08:00:00.000Z") });
    const out = await syncItems(userId, { items: [logItem(book.id)] });
    expect("results" in out && out.results[0]).toMatchObject({ ok: false });
    expect(await log(book.id)).toEqual([]);
  });

  it("finishes a book at the moment Finished was pressed, and only once", async () => {
    const book = await makeBook();
    await prisma.progressEntry.createMany({
      data: [
        { bookId: book.id, page: 0, date: new Date("2026-10-05T00:00:00.000Z") },
        { bookId: book.id, page: 250, date: new Date("2026-10-10T18:00:00.000Z") },
      ],
    });
    await prisma.book.update({ where: { id: book.id }, data: { currentPage: 250 } });
    const move = { kind: "move", id: clientId(), bookId: book.id, to: "READ", minutes: 40, at: SUNDAY_EVENING };
    const out = await syncItems(userId, { items: [move] });
    expect(out).toEqual({
      results: [
        {
          id: move.id,
          ok: true,
          message: "Jane Eyre moved to Read. Finished yesterday.",
          undo: { from: "READ", finishedAt: "2026-10-11T19:30:00.000Z", page: 250 },
        },
      ],
    });
    const row = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(row.status).toBe(ReadingStatus.READ);
    expect(row.dateFinished?.toISOString()).toBe("2026-10-11T19:30:00.000Z");
    expect((await log(book.id)).at(-1)).toEqual([300, "2026-10-11T19:30:00.000Z", 40]);

    const again = await syncItems(userId, { items: [move] });
    expect(again).toEqual({
      results: [{ id: move.id, ok: true, message: "Jane Eyre is already in Read." }],
    });
    expect(await log(book.id)).toHaveLength(3);
  });

  it("stops a book at the page it was on", async () => {
    const book = await makeBook({ currentPage: 90 });
    const out = await syncItems(userId, {
      items: [{ kind: "move", id: clientId(), bookId: book.id, to: "DNF", at: SUNDAY_EVENING }],
    });
    expect("results" in out && out.results[0]).toMatchObject({
      ok: true,
      message: "Jane Eyre moved to Did Not Finish at page 90.",
    });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).status).toBe(ReadingStatus.DNF);
  });

  it("won't finish a read that started after Finished was pressed", async () => {
    // Finished offline on Sunday; meanwhile finished and started again on
    // another device on Monday morning.
    const book = await makeBook({ dateStarted: new Date("2026-10-12T06:00:00.000Z") });
    const out = await syncItems(userId, {
      items: [{ kind: "move", id: clientId(), bookId: book.id, to: "READ", at: SUNDAY_EVENING }],
    });
    expect("results" in out && out.results[0]).toMatchObject({ ok: false });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).status).toBe(ReadingStatus.READING);
  });

  it("answers for each item, including ones it can't read", async () => {
    const book = await makeBook();
    const out = await syncItems(userId, {
      items: [
        { kind: "log", id: "short", bookId: book.id, page: 10, day: "2026-10-11", at: SUNDAY_EVENING },
        { kind: "nap", id: clientId() },
        logItem(book.id, { page: "lots" }),
        logItem(book.id, { day: "2026-13-40" }),
        logItem(book.id),
      ],
    });
    expect("results" in out && out.results.map((r) => r.ok)).toEqual([false, false, false, false, true]);
    expect("results" in out && out.results[0]).toEqual({ id: "short", ok: false, error: "This couldn't be read." });
  });

  it("refuses a body that isn't a list, or too long a list", async () => {
    expect(await syncItems(userId, null)).toEqual({ error: "Expected a list of items" });
    expect(await syncItems(userId, { items: "x" })).toEqual({ error: "Expected a list of items" });
    const many = Array.from({ length: MAX_SYNC_ITEMS + 1 }, () => ({}));
    expect(await syncItems(userId, { items: many })).toMatchObject({ error: expect.any(String) });
  });
});
