import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, ReadingStatus } from "@prisma/client";

/**
 * The book form actions against a real database: createBook, updateBook,
 * updateReading (and the reading log it writes through logProgress), and
 * deleteBook's cover cleanup.
 *
 * The reading log is the part most worth pinning down. Stats count pages as
 * the gap between consecutive entries, so a missing page-0 anchor, or a
 * closing entry written where none should be, quietly shifts pages between
 * days and years without anything looking broken.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// redirect() ends an action by throwing; surface where it was headed.
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

// Cover downloads run in after(); queue them so a test can run them when it
// wants to, and stub the download itself so nothing touches the network.
const deferred: (() => Promise<void>)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => {
    deferred.push(fn);
  },
}));
const cacheCoverImage = vi.fn<(url: string, bookId: string) => Promise<string | null>>();
vi.mock("@/lib/covers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/covers")>()),
  cacheCoverImage: (url: string, bookId: string) => cacheCoverImage(url, bookId),
}));

const { createBook, updateBook, updateReading, deleteBook } = await import(
  "@/lib/actions/books"
);
const { logPage } = await import("@/lib/actions/progress");

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
    prisma.user.create({ data: { username: `bk-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `bko-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  deferred.length = 0;
  cacheCoverImage.mockReset();
  cacheCoverImage.mockResolvedValue(null);
});

afterEach(async () => {
  vi.useRealTimers();
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

async function setZone(timeZone: string) {
  await prisma.user.update({ where: { id: userId }, data: { preferences: { timeZone } } });
}

/** Freezes the clock (only Date) at `iso`. */
function clockAt(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const bookFields = {
  title: "The Left Hand of Darkness",
  authors: "Ursula K. Le Guin",
  tags: "",
  format: "PHYSICAL",
  ownership: "OWNED",
};

/** Runs an action that should end in redirect() and returns the target. */
async function redirectOf(run: Promise<unknown>): Promise<string> {
  const err = await run.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof Redirect)) throw new Error(`expected a redirect, got ${String(err)}`);
  return err.url;
}

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title: "Test Book", searchText: "test book", pageCount: 300, ...over },
  });
}

async function writeCover(name: string) {
  await fs.writeFile(path.join(coversDir, name), "cover");
  return `/api/covers/${name}`;
}

async function coverExists(url: string) {
  return fs
    .access(path.join(coversDir, path.basename(url)))
    .then(() => true)
    .catch(() => false);
}

function progressOf(bookId: string) {
  return prisma.progressEntry.findMany({
    where: { bookId },
    orderBy: [{ date: "asc" }, { page: "asc" }],
  });
}

describe("createBook", () => {
  it("saves the book for the signed-in user and opens it", async () => {
    const url = await redirectOf(
      createBook({}, form({ ...bookFields, seriesName: "Hainish Cycle", status: "READING" })),
    );

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(url).toBe(`/books/${book.id}`);
    expect(book.authors).toEqual(["Ursula K. Le Guin"]);
    expect(book.status).toBe(ReadingStatus.READING);
    expect(book.searchText).toBe("the left hand of darkness ursula k. le guin hainish cycle");
  });

  it("dates and counts a book added straight onto Read", async () => {
    // It used to land with no finish date and timesRead 0: in "Books read"
    // but missing from the year it was read and from the goal.
    await redirectOf(createBook({}, form({ ...bookFields, status: "READ" })));

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.dateFinished?.toDateString()).toBe(new Date().toDateString());
    expect(book.timesRead).toBe(1);
  });

  it("starts a book added as Currently Reading today", async () => {
    await redirectOf(createBook({}, form({ ...bookFields, status: "READING" })));

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.dateStarted?.toDateString()).toBe(new Date().toDateString());
    expect(book.dateFinished).toBeNull();
    expect(book.timesRead).toBe(0);
  });

  it("saves a blank series number as none, not #0", async () => {
    await redirectOf(createBook({}, form({ ...bookFields, seriesName: "Jane Eyre", seriesNumber: "" })));

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.seriesNumber).toBeNull();
  });

  it("saves an audiobook's length, and no length for other formats", async () => {
    await redirectOf(
      createBook({}, form({ ...bookFields, title: "Heard", format: "AUDIOBOOK", lengthMinutes: "970" })),
    );
    await redirectOf(
      createBook({}, form({ ...bookFields, title: "Held", format: "PHYSICAL", lengthMinutes: "970" })),
    );

    const books = await prisma.book.findMany({ where: { userId }, orderBy: { title: "asc" } });
    expect(books.map((b) => [b.title, b.lengthMinutes])).toEqual([
      ["Heard", 970],
      ["Held", null],
    ]);
  });

  it("refuses a length out of range", async () => {
    const result = await createBook(
      {},
      form({ ...bookFields, format: "AUDIOBOOK", lengthMinutes: "60001" }),
    );
    expect(result.error).toBe("Length must be at most 1,000 hours");
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("returns the validation error and saves nothing", async () => {
    const result = await createBook({}, form({ ...bookFields, title: "  " }));
    expect(result.error).toBe("Title is required");
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("refuses a protocol-relative cover URL", async () => {
    const result = await createBook({}, form({ ...bookFields, coverUrl: "//evil.example/x.jpg" }));
    expect(result.error).toBe("Cover URL must be an http(s) URL");
  });

  it("keeps the finish date picked for a book added as Read, and its rating", async () => {
    await redirectOf(
      createBook({}, form({ ...bookFields, status: "READ", dateFinished: "2019-06-14", rating: "8" })),
    );

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.dateFinished?.toISOString().slice(0, 10)).toBe("2019-06-14");
    expect(book.rating).toBe(8);
    expect(book.timesRead).toBe(1);
  });

  it("leaves a book added as Read undated when the reader doesn't remember", async () => {
    // A date sent along with the box (it can't be, the field is disabled)
    // still loses to it.
    await redirectOf(
      createBook(
        {},
        form({ ...bookFields, status: "READ", finishedUnknown: "on", dateFinished: "2019-06-14" }),
      ),
    );

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.dateFinished).toBeNull();
    expect(book.timesRead).toBe(1);
  });

  it("follows the undated preference when no date is given", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { addedAsReadFinished: "undated" } },
    });
    await redirectOf(createBook({}, form({ ...bookFields, status: "READ" })));
    expect((await prisma.book.findFirstOrThrow({ where: { userId } })).dateFinished).toBeNull();

    // A date picked anyway is kept.
    await redirectOf(createBook({}, form({ ...bookFields, status: "READ", dateFinished: "2020-01-02" })));
    const dated = await prisma.book.findFirstOrThrow({ where: { userId, dateFinished: { not: null } } });
    expect(dated.dateFinished?.toISOString().slice(0, 10)).toBe("2020-01-02");
  });

  it("starts the log of a book added mid-read at its page, with no page-0 anchor", async () => {
    // Started 8 Oct on page 64 credits nothing to today: a lone first entry
    // has no predecessor to count from.
    await redirectOf(
      createBook(
        {},
        form({ ...bookFields, pageCount: "208", status: "READING", dateStarted: "2026-10-08", currentPage: "64" }),
      ),
    );

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.dateStarted?.toISOString().slice(0, 10)).toBe("2026-10-08");
    expect(book.currentPage).toBe(64);
    const log = await progressOf(book.id);
    expect(log.map((e) => e.page)).toEqual([64]);
    expect(log[0].date.getTime()).toBeGreaterThanOrEqual(book.dateStarted!.getTime());

    // The next page logged counts from there.
    expect(await logPage(book.id, { page: 80, day: "today" })).toMatchObject({ ok: true });
    expect((await progressOf(book.id)).map((e) => e.page)).toEqual([64, 80]);
  });

  it("dates a book added mid-read now, even before a Started date typed today", async () => {
    // 08:30 on 12 October in Tokyo. Started, typed as today, is midnight
    // UTC: still half an hour ahead. Dated there, the entry would sit after
    // the morning's next log and refuse it.
    await setZone("Asia/Tokyo");
    clockAt("2026-10-11T23:30:00.000Z");
    await redirectOf(
      createBook(
        {},
        form({ ...bookFields, pageCount: "300", status: "READING", dateStarted: "2026-10-12", currentPage: "50" }),
      ),
    );
    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect((await progressOf(book.id)).map((e) => [e.page, e.date.toISOString()])).toEqual([
      [50, "2026-10-11T23:30:00.000Z"],
    ]);

    vi.setSystemTime(new Date("2026-10-11T23:40:00.000Z"));
    expect(await logPage(book.id, { page: 60, day: "today" })).toMatchObject({ ok: true });
    expect((await progressOf(book.id)).map((e) => e.page)).toEqual([50, 60]);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).currentPage).toBe(60);
  });

  it("logs nothing for a book added as Currently Reading on page 0", async () => {
    await redirectOf(createBook({}, form({ ...bookFields, status: "READING", currentPage: "" })));
    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(await progressOf(book.id)).toHaveLength(0);
  });

  it("refuses a page past the end or a finish date in the future, and saves nothing", async () => {
    const pastEnd = await createBook(
      {},
      form({ ...bookFields, pageCount: "208", status: "READING", currentPage: "900" }),
    );
    expect(pastEnd.error).toBe("Page 900 is past the end of the book (208 pages)");

    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const early = await createBook({}, form({ ...bookFields, status: "READ", dateFinished: future }));
    expect(early.error).toBe("Finish date is in the future");

    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("stays on the add page for Add and add another, saying what was added", async () => {
    const res = await createBook({}, form({ ...bookFields, afterAdd: "another" }));

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(res).toEqual({ success: true, added: { id: book.id, title: book.title } });
  });

  it("goes to the library when asked, and follows the preference without a button", async () => {
    expect(await redirectOf(createBook({}, form({ ...bookFields, afterAdd: "library" })))).toBe("/books");

    await prisma.user.update({ where: { id: userId }, data: { preferences: { afterAdd: "library" } } });
    expect(await redirectOf(createBook({}, form(bookFields)))).toBe("/books");

    await prisma.user.update({ where: { id: userId }, data: { preferences: { afterAdd: "another" } } });
    expect((await createBook({}, form(bookFields))).added).toBeDefined();
    // Junk in the field reads as no button.
    expect((await createBook({}, form({ ...bookFields, afterAdd: "then" }))).added).toBeDefined();
  });

  it("swaps a remote cover for the cached copy once it downloads", async () => {
    cacheCoverImage.mockResolvedValue("/api/covers/cached-1.jpg");
    await redirectOf(
      createBook({}, form({ ...bookFields, coverUrl: "https://covers.example.org/a.jpg" })),
    );
    for (const run of deferred) await run();

    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.coverUrl).toBe("/api/covers/cached-1.jpg");
  });
});

describe("updateBook", () => {
  it("updates the fields and the search text", async () => {
    const bk = await makeBook();
    await redirectOf(
      updateBook(bk.id, {}, form({ ...bookFields, title: "Lathe of Heaven", authors: "Le Guin" })),
    );

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.title).toBe("Lathe of Heaven");
    expect(after.searchText).toBe("lathe of heaven le guin");
  });

  it("keeps the Open Library id the form sends", async () => {
    const bk = await makeBook({ openLibraryId: "OL27482W" });
    await redirectOf(updateBook(bk.id, {}, form({ ...bookFields, openLibraryId: "OL27482W" })));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).openLibraryId).toBe(
      "OL27482W",
    );
  });

  it("drops the length when the book stops being an audiobook", async () => {
    const bk = await makeBook();
    await redirectOf(updateBook(bk.id, {}, form({ ...bookFields, format: "AUDIOBOOK", lengthMinutes: "600" })));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).lengthMinutes).toBe(600);

    await redirectOf(updateBook(bk.id, {}, form({ ...bookFields, format: "EBOOK", lengthMinutes: "600" })));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).lengthMinutes).toBeNull();
  });

  it("refuses another account's book", async () => {
    const bk = await makeBook({}, otherUserId);
    const result = await updateBook(bk.id, {}, form({ ...bookFields, title: "Mine now" }));

    expect(result.error).toBe("Book not found");
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).title).toBe("Test Book");
  });

  it("deletes the replaced cached cover", async () => {
    const old = await writeCover("old-cover.jpg");
    const bk = await makeBook({ coverUrl: old });
    await redirectOf(updateBook(bk.id, {}, form({ ...bookFields, coverUrl: "" })));

    expect(await coverExists(old)).toBe(false);
  });

  it("keeps a replaced cover file that another book still shows", async () => {
    const shared = await writeCover("shared-cover.jpg");
    const bk = await makeBook({ coverUrl: shared });
    await makeBook({ coverUrl: shared }, otherUserId);
    await redirectOf(updateBook(bk.id, {}, form({ ...bookFields, coverUrl: "" })));

    expect(await coverExists(shared)).toBe(true);
  });

  it("does not let a late cover download overwrite a newer cover", async () => {
    const bk = await makeBook();
    const late = await writeCover(`${bk.id}-late.jpg`);
    cacheCoverImage.mockResolvedValue(late);

    // First save starts a download; a second save picks another cover
    // before that download finishes.
    await redirectOf(
      updateBook(bk.id, {}, form({ ...bookFields, coverUrl: "https://a.example/1.jpg" })),
    );
    const firstDownload = deferred.shift()!;
    await redirectOf(updateBook(bk.id, {}, form({ ...bookFields, coverUrl: "/api/covers/new.jpg" })));
    await firstDownload();

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.coverUrl).toBe("/api/covers/new.jpg");
    expect(await coverExists(late)).toBe(false); // nothing points at it
  });
});

describe("updateReading and review search", () => {
  it("keeps the folded copy search reads in step with the review", async () => {
    const bk = await makeBook({ status: ReadingStatus.READ });
    await updateReading(bk.id, {}, form({ status: "READ", review: "Better than ÉMILE Brontë" }));
    let row = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(row.reviewSearchText).toBe("better than emile bronte");

    await updateReading(bk.id, {}, form({ status: "READ", review: "" }));
    row = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(row.reviewSearchText).toBe("");
  });
});

describe("updateReading and the reading log", () => {
  it("anchors the first progress update at page 0", async () => {
    const started = "2026-03-01";
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });

    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: started, currentPage: "74" }));
    const log = await progressOf(bk.id);
    expect(log.map((e) => e.page)).toEqual([0, 74]);
    expect(log[0].date.toISOString().slice(0, 10)).toBe(started);

    // Then each change, from a stopped book's page box.
    await updateReading(bk.id, {}, form({ status: "DNF", dateStarted: started, currentPage: "74" }));
    await updateReading(bk.id, {}, form({ status: "DNF", dateStarted: started, currentPage: "120" }));
    expect((await progressOf(bk.id)).map((e) => e.page)).toEqual([0, 74, 120]);

    // Saving without a page change logs nothing new.
    await updateReading(bk.id, {}, form({ status: "DNF", dateStarted: started, currentPage: "120" }));
    expect((await progressOf(bk.id)).map((e) => e.page)).toEqual([0, 74, 120]);
  });

  it("never moves a book being read off its own page", async () => {
    // The quick row logs a book being read; the card has no page box then
    // and sends the page it was rendered with, here from before a log made
    // in another tab.
    const bk = await makeBook({
      status: ReadingStatus.READING,
      dateStarted: new Date("2026-03-01T00:00:00Z"),
      currentPage: 150,
    });
    await prisma.progressEntry.createMany({
      data: [
        { bookId: bk.id, page: 0, date: new Date("2026-03-01T00:00:00Z") },
        { bookId: bk.id, page: 150, date: new Date("2026-03-05T12:00:00Z") },
      ],
    });

    const saved = await updateReading(
      bk.id,
      {},
      form({ status: "READING", dateStarted: "2026-03-01", currentPage: "120", rating: "8" }),
    );
    expect(saved.success).toBe(true);
    let after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.currentPage).toBe(150);
    expect(after.rating).toBe(8);
    expect((await progressOf(bk.id)).map((e) => e.page)).toEqual([0, 150]);

    // Nor when it's stopped from the card.
    await updateReading(bk.id, {}, form({ status: "DNF", dateStarted: "2026-03-01", currentPage: "120" }));
    after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.currentPage).toBe(150);
    expect((await progressOf(bk.id)).map((e) => e.page)).toEqual([0, 150]);
  });

  it("moves the read's start back when Started is moved earlier, never over the read before", async () => {
    await setZone("Europe/Oslo");
    clockAt("2026-10-12T10:00:00.000Z");
    const bk = await makeBook({
      status: ReadingStatus.READING,
      dateStarted: new Date("2026-10-05T00:00:00Z"),
      currentPage: 120,
    });
    await prisma.progressEntry.createMany({
      data: [
        { bookId: bk.id, page: 0, date: new Date("2026-09-01T10:00:00Z") },
        { bookId: bk.id, page: 300, date: new Date("2026-09-20T12:00:00Z") },
        { bookId: bk.id, page: 0, date: new Date("2026-10-05T00:00:00Z") },
        { bookId: bk.id, page: 120, date: new Date("2026-10-08T12:00:00Z") },
      ],
    });
    const anchorDate = async () =>
      (await progressOf(bk.id)).filter((e) => e.page === 0).at(-1)!.date.toISOString();

    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: "2026-10-02" }));
    expect(await anchorDate()).toBe("2026-10-02T00:00:00.000Z");
    expect(await logPage(bk.id, { page: 60, day: "2026-10-03" })).toMatchObject({ ok: true });

    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: "2026-09-15" }));
    expect(await anchorDate()).toBe("2026-09-20T12:00:00.001Z");
    expect((await progressOf(bk.id)).map((e) => e.page)).toEqual([0, 300, 0, 60, 120]);
  });

  it("never anchors a read after its first entry", async () => {
    // East of UTC, a Started date typed today is midnight UTC, which can
    // still be ahead of the moment the first page is logged. Tomorrow's
    // date (allowed, a day's slack) stands in for that here.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: tomorrow, currentPage: "30" }));

    const log = await progressOf(bk.id);
    expect(log.map((e) => e.page)).toEqual([0, 30]);
    expect(log[0].date.getTime()).toBe(log[1].date.getTime());
  });

  it("finishing a tracked book closes the log at the last page", async () => {
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await updateReading(bk.id, {}, form({ status: "READING", currentPage: "120" }));
    await updateReading(bk.id, {}, form({ status: "READ" }));

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.currentPage).toBeNull();
    expect(after.timesRead).toBe(1);
    const log = await progressOf(bk.id);
    expect(log.map((e) => e.page)).toEqual([0, 120, 300]);
    expect(log[2].date.getTime()).toBe(after.dateFinished?.getTime());
  });

  it("finishing an untracked book logs nothing and fills in today", async () => {
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await updateReading(bk.id, {}, form({ status: "READ" }));

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.dateFinished?.toDateString()).toBe(new Date().toDateString());
    expect(await progressOf(bk.id)).toHaveLength(0);
  });

  it("keeps an undated Read book undated when it is saved again", async () => {
    const bk = await makeBook({ status: ReadingStatus.READ, timesRead: 1 });
    await updateReading(bk.id, {}, form({ status: "READ", rating: "8" }));

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.dateFinished).toBeNull();
    expect(after.rating).toBe(8);
  });

  it("closes the log on a typed finish day in the reader's zone", async () => {
    // 11:00 on 12 October in New York. 11 October typed is midnight UTC,
    // which in New York is the evening of the 10th.
    await setZone("America/New_York");
    clockAt("2026-10-12T15:00:00.000Z");
    const bk = await makeBook({
      status: ReadingStatus.READING,
      dateStarted: new Date("2026-10-05T00:00:00Z"),
      currentPage: 120,
    });
    await prisma.progressEntry.createMany({
      data: [
        { bookId: bk.id, page: 0, date: new Date("2026-10-05T00:00:00Z") },
        { bookId: bk.id, page: 120, date: new Date("2026-10-08T16:00:00Z") },
      ],
    });
    await updateReading(
      bk.id,
      {},
      form({ status: "READ", dateStarted: "2026-10-05", dateFinished: "2026-10-11" }),
    );
    // The last moment of the 11th in New York.
    expect((await progressOf(bk.id)).at(-1)?.date.toISOString()).toBe("2026-10-12T03:59:59.999Z");
  });

  it("finishing with Don't remember leaves no date and no closing log entry", async () => {
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await updateReading(bk.id, {}, form({ status: "READING", currentPage: "120" }));
    await updateReading(bk.id, {}, form({ status: "READ", finishedUnknown: "on" }));

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.dateFinished).toBeNull();
    expect(after.timesRead).toBe(1);
    expect((await progressOf(bk.id)).map((e) => e.page)).toEqual([0, 120]);
  });

  it("counts archived reads plus the current one in timesRead", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING });
    await prisma.read.createMany({ data: [{ bookId: bk.id }, { bookId: bk.id }] });

    await updateReading(bk.id, {}, form({ status: "READ" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).timesRead).toBe(3);

    await updateReading(bk.id, {}, form({ status: "READING" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).timesRead).toBe(2);
  });

  it("keeps the page for DNF and clears it when reshelved", async () => {
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await updateReading(bk.id, {}, form({ status: "DNF", currentPage: "218" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).currentPage).toBe(218);

    await updateReading(bk.id, {}, form({ status: "WANT_TO_READ", currentPage: "218" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).currentPage).toBeNull();
  });

  it("refuses a page past the end of the book, and logs nothing", async () => {
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ, pageCount: 220 });
    const result = await updateReading(bk.id, {}, form({ status: "READING", currentPage: "9999" }));

    expect(result.error).toBe("Page 9999 is past the end of the book (220 pages)");
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).currentPage).toBeNull();
    expect(await progressOf(bk.id)).toHaveLength(0);

    // The last page itself is fine.
    expect((await updateReading(bk.id, {}, form({ status: "READING", currentPage: "220" }))).success).toBe(true);
  });

  it("refuses a finish date before the start date", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING });
    const result = await updateReading(
      bk.id,
      {},
      form({ status: "READ", dateStarted: "2026-10-05", dateFinished: "2026-10-01" }),
    );

    expect(result.error).toBe("Finish date is before the start date");
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).status).toBe(
      ReadingStatus.READING,
    );
  });

  it("starting a book from Want to Read fills in today as the start date", async () => {
    const bk = await makeBook({ status: ReadingStatus.WANT_TO_READ });
    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: "", currentPage: "40" }));

    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.dateStarted?.toDateString()).toBe(new Date().toDateString());
    expect((await progressOf(bk.id)).map((e) => e.page)).toEqual([0, 40]);
  });

  it("says when a save finished the book, and only then", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING });
    expect((await updateReading(bk.id, {}, form({ status: "READ" }))).finished).toBe(true);
    // Saving it again (a new rating, say) isn't finishing it again.
    expect((await updateReading(bk.id, {}, form({ status: "READ", rating: "8" }))).finished).toBe(
      false,
    );
  });

  it("refuses another account's book", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING }, otherUserId);
    const result = await updateReading(bk.id, {}, form({ status: "READ" }));

    expect(result.error).toBe("Book not found");
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).status).toBe(
      ReadingStatus.READING,
    );
  });
});

describe("deleteBook", () => {
  it("removes the book and its cached cover", async () => {
    const cover = await writeCover("gone.jpg");
    const bk = await makeBook({ coverUrl: cover });
    expect(await redirectOf(deleteBook(bk.id))).toBe("/books");

    expect(await prisma.book.findUnique({ where: { id: bk.id } })).toBeNull();
    expect(await coverExists(cover)).toBe(false);
  });

  it("leaves a cover file that another account's book points at", async () => {
    const theirs = await writeCover("theirs.jpg");
    await makeBook({ coverUrl: theirs }, otherUserId);
    const mine = await makeBook({ coverUrl: theirs });
    await redirectOf(deleteBook(mine.id));

    expect(await coverExists(theirs)).toBe(true);
  });

  it("does nothing to another account's book", async () => {
    const bk = await makeBook({}, otherUserId);
    await deleteBook(bk.id);
    expect(await prisma.book.findUnique({ where: { id: bk.id } })).not.toBeNull();
  });
});
