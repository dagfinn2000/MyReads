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
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

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

  it("returns the validation error and saves nothing", async () => {
    const result = await createBook({}, form({ ...bookFields, title: "  " }));
    expect(result.error).toBe("Title is required");
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("refuses a protocol-relative cover URL", async () => {
    const result = await createBook({}, form({ ...bookFields, coverUrl: "//evil.example/x.jpg" }));
    expect(result.error).toBe("Cover URL must be an http(s) URL");
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

describe("updateReading and the reading log", () => {
  it("anchors the first progress update at page 0, then logs each change", async () => {
    const started = "2026-03-01";
    const bk = await makeBook({ status: ReadingStatus.READING });

    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: started, currentPage: "74" }));
    let log = await progressOf(bk.id);
    expect(log.map((e) => e.page)).toEqual([0, 74]);
    expect(log[0].date.toISOString().slice(0, 10)).toBe(started);

    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: started, currentPage: "120" }));
    log = await progressOf(bk.id);
    expect(log.map((e) => e.page)).toEqual([0, 74, 120]);

    // Saving without a page change logs nothing new.
    await updateReading(bk.id, {}, form({ status: "READING", dateStarted: started, currentPage: "120" }));
    expect(await progressOf(bk.id)).toHaveLength(3);
  });

  it("finishing a tracked book closes the log at the last page", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING });
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

  it("counts archived reads plus the current one in timesRead", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING });
    await prisma.read.createMany({ data: [{ bookId: bk.id }, { bookId: bk.id }] });

    await updateReading(bk.id, {}, form({ status: "READ" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).timesRead).toBe(3);

    await updateReading(bk.id, {}, form({ status: "READING" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).timesRead).toBe(2);
  });

  it("keeps the page for DNF and clears it when reshelved", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING });
    await updateReading(bk.id, {}, form({ status: "DNF", currentPage: "218" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).currentPage).toBe(218);

    await updateReading(bk.id, {}, form({ status: "WANT_TO_READ", currentPage: "218" }));
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bk.id } })).currentPage).toBeNull();
  });

  it("refuses a page past the end of the book, and logs nothing", async () => {
    const bk = await makeBook({ status: ReadingStatus.READING, pageCount: 220 });
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
