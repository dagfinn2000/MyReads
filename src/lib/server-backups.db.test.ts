import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";

/**
 * The nightly backups on the server, against a real database and a real
 * folder: each account's zip is the same backup the Download button makes
 * (so it restores with the importer), a day already saved is left alone,
 * old copies are pruned to BACKUP_KEEP by their names only, one account's
 * failure doesn't stop the rest, and deleting an account takes its copies.
 */
const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId, name: "me" } } : null),
  signOut: async () => {},
}));

const { runServerBackups, serverBackupJob, listServerBackups } = await import(
  "@/lib/server-backups-run"
);
const { PARTIAL_BACKUP_NAME, backupFileName } = await import("@/lib/server-backups");
const { POST: importRoute } = await import("@/app/api/import/route");
const { deleteAccount } = await import("@/lib/actions/account");
const { coverFilePath, coversDir } = await import("@/lib/covers");

/** 20 October 2026, 03:05 on the server's clock. */
const NOW = new Date(2026, 9, 20, 3, 5);
const TODAY = "2026-10-20";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

let dir: string;
let config: { dir: string; hour: number; keep: number };
let userIds: string[] = [];
let coverName: string;

/** Accounts made one after another, so the run reaches them in order. */
async function makeUser(prefix: string, password = "x") {
  const stamp = `${Date.now()}-${Math.random()}`;
  const passwordHash = password === "x" ? "x" : await bcrypt.hash(password, 4);
  const user = await prisma.user.create({ data: { username: `${prefix}-${stamp}`, passwordHash } });
  userIds.push(user.id);
  return user.id;
}

const copyPath = (userId: string, day = TODAY) => path.join(dir, userId, backupFileName(day));

async function readCopy(userId: string, day = TODAY) {
  const zip = await JSZip.loadAsync(await fs.readFile(copyPath(userId, day)));
  const library = JSON.parse(await zip.file("library.json")!.async("text"));
  return { zip, library };
}

async function exists(p: string) {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "myreads-backups-"));
  config = { dir, hour: 3, keep: 7 };
  userIds = [];
  currentUserId = null;
  coverName = `srv-backup-${Date.now()}.png`;
  await fs.mkdir(coversDir(), { recursive: true });
  await fs.writeFile(coverFilePath(coverName), PNG);
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.BACKUP_DIR;
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await fs.rm(dir, { recursive: true, force: true });
  await fs.rm(coverFilePath(coverName), { force: true });
});

describe("runServerBackups", () => {
  it("writes each account's backup, which restores with the importer", async () => {
    const a = await makeUser("sb-a");
    const b = await makeUser("sb-b");
    const shelf = await prisma.shelf.create({ data: { userId: a, name: "Favourites" } });
    await prisma.book.create({
      data: {
        userId: a,
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        searchText: "the hobbit tolkien",
        coverUrl: `/api/covers/${coverName}`,
        shelves: { connect: { id: shelf.id } },
        quotes: { create: [{ text: "In a hole in the ground" }] },
      },
    });
    await prisma.book.create({ data: { userId: a, title: "Dune", searchText: "dune" } });
    await prisma.book.create({ data: { userId: b, title: "Emma", searchText: "emma" } });

    const run = await runServerBackups(config, NOW);
    expect(run.failed).toBe(0);
    expect(run.written).toBeGreaterThanOrEqual(2);

    // Each account's own library, and nothing half-written left behind.
    const copyA = await readCopy(a);
    expect(copyA.library.format).toBe("myreads-export");
    expect(copyA.library.books.map((x: { title: string }) => x.title).sort()).toEqual([
      "Dune",
      "The Hobbit",
    ]);
    expect(await copyA.zip.file(`covers/${coverName}`)!.async("uint8array")).toEqual(PNG);
    const copyB = await readCopy(b);
    expect(copyB.library.books.map((x: { title: string }) => x.title)).toEqual(["Emma"]);
    expect(await fs.readdir(path.join(dir, a))).toEqual([backupFileName(TODAY)]);
    // The library is private to the server's user.
    expect((await fs.stat(copyPath(a))).mode & 0o777).toBe(0o600);

    // Restored through the same route as the Restore backup button.
    const c = await makeUser("sb-c");
    currentUserId = c;
    const res = await importRoute(
      new Request("http://localhost/api/import", {
        method: "POST",
        body: await fs.readFile(copyPath(a)),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).booksCreated).toBe(2);
    const restored = await prisma.book.findMany({
      where: { userId: c },
      include: { shelves: true, quotes: true },
      orderBy: { title: "asc" },
    });
    expect(restored.map((x) => x.title)).toEqual(["Dune", "The Hobbit"]);
    expect(restored[1].shelves.map((s) => s.name)).toEqual(["Favourites"]);
    expect(restored[1].quotes.map((q) => q.text)).toEqual(["In a hole in the ground"]);
    expect(restored[1].coverUrl).toBe(`/api/covers/${coverName}`);
  });

  it("backs up an empty library too", async () => {
    const a = await makeUser("sb-empty");
    await runServerBackups(config, NOW);
    const { library } = await readCopy(a);
    expect(library.books).toEqual([]);
    expect(library.counts).toEqual({ books: 0, shelves: 0 });
  });

  it("leaves a day that is already saved alone", async () => {
    const a = await makeUser("sb-a");
    const b = await makeUser("sb-b");
    await fs.mkdir(path.join(dir, a), { recursive: true });
    await fs.writeFile(copyPath(a), "saved earlier today");

    const run = await runServerBackups(config, NOW);
    expect(run.skipped).toBeGreaterThanOrEqual(1);
    expect(await fs.readFile(copyPath(a), "utf8")).toBe("saved earlier today");
    expect((await readCopy(b)).library.format).toBe("myreads-export");
  });

  it("keeps the newest BACKUP_KEEP copies and touches nothing else", async () => {
    const a = await makeUser("sb-a");
    const folder = path.join(dir, a);
    await fs.mkdir(folder, { recursive: true });
    for (let d = 11; d <= 19; d++) await fs.writeFile(copyPath(a, `2026-10-${d}`), "old");
    await fs.writeFile(path.join(folder, "notes.txt"), "mine");
    await fs.writeFile(path.join(folder, "myreads-backup-2026-10-01.zip.bak"), "mine too");
    // A folder with a copy's name isn't a copy either.
    await fs.mkdir(path.join(folder, backupFileName("2026-01-01")));

    const run = await runServerBackups({ ...config, keep: 3 }, NOW);
    expect(run.pruned).toBeGreaterThanOrEqual(9 - 2);
    expect((await fs.readdir(folder)).sort()).toEqual(
      [
        backupFileName("2026-01-01"),
        backupFileName("2026-10-18"),
        backupFileName("2026-10-19"),
        backupFileName(TODAY),
        "myreads-backup-2026-10-01.zip.bak",
        "notes.txt",
      ].sort(),
    );
    const listed = await listServerBackups(config, a);
    expect(listed.map((x) => x.day)).toEqual([TODAY, "2026-10-19", "2026-10-18"]);
    expect(listed[1].bytes).toBe(3);
  });

  it("prunes a day that was skipped too, when BACKUP_KEEP is lowered", async () => {
    const a = await makeUser("sb-a");
    await fs.mkdir(path.join(dir, a), { recursive: true });
    for (const day of ["2026-10-18", "2026-10-19", TODAY]) {
      await fs.writeFile(copyPath(a, day), day);
    }
    await runServerBackups({ ...config, keep: 1 }, NOW);
    expect(await fs.readdir(path.join(dir, a))).toEqual([backupFileName(TODAY)]);
    expect(await fs.readFile(copyPath(a), "utf8")).toBe(TODAY);
  });

  it("goes on to the next account when one fails, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = await makeUser("sb-a");
    const b = await makeUser("sb-b");
    // A file where the account's folder should be: it can't be made.
    await fs.writeFile(path.join(dir, a), "in the way");

    const run = await runServerBackups(config, NOW);
    expect(run.failed).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain(a);
    expect((await readCopy(b)).library.format).toBe("myreads-export");
    expect(await fs.readFile(path.join(dir, a), "utf8")).toBe("in the way");
  });

  it("never leaves a zip under a copy's name when writing fails part-way", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = await makeUser("sb-a");
    const b = await makeUser("sb-b");
    // A big enough library to come in several chunks, with a cover that
    // marks its zip out from the others'.
    await prisma.book.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId: a,
        title: `Book ${i}`,
        description: "x".repeat(2000) + i,
        searchText: `book ${i}`,
        coverUrl: i === 0 ? `/api/covers/${coverName}` : null,
      })),
    });
    // That zip breaks after its first chunk.
    const real = JSZip.prototype.generateInternalStream;
    vi.spyOn(JSZip.prototype, "generateInternalStream").mockImplementation(function (
      this: JSZip,
      options,
    ) {
      const stream = real.call(this, options);
      if (!this.file(`covers/${coverName}`)) return stream;
      let fail: ((err: Error) => void) | undefined;
      const broken = {
        on(evt: string, fn: (...args: never[]) => void) {
          if (evt === "error") fail = fn as (err: Error) => void;
          else if (evt === "data") {
            let chunks = 0;
            stream.on("data", (chunk, meta) => {
              (fn as (c: unknown, m: unknown) => void)(chunk, meta);
              if (++chunks === 1) {
                stream.pause();
                setTimeout(() => fail?.(new Error("disk went away")));
              }
            });
          } else stream.on(evt as "end", fn as () => void);
          return broken;
        },
        pause: () => (stream.pause(), broken),
        resume: () => (stream.resume(), broken),
      };
      return broken as never;
    });

    const run = await runServerBackups(config, NOW);
    expect(run.failed).toBe(1);
    expect(String(error.mock.calls[0][1])).toContain("disk went away");
    expect(await fs.readdir(path.join(dir, a))).toEqual([]);
    expect((await readCopy(b)).library.format).toBe("myreads-export");
  });

  it("takes over a partial copy left by a run that died, not one being written", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = await makeUser("sb-a");
    const partial = path.join(dir, a, PARTIAL_BACKUP_NAME);
    await fs.mkdir(path.join(dir, a), { recursive: true });

    // Written to a moment ago: someone else is on it.
    await fs.writeFile(partial, "busy");
    await runServerBackups(config, NOW);
    expect(await fs.readFile(partial, "utf8")).toBe("busy");
    expect(await exists(copyPath(a))).toBe(false);
    expect(String(error.mock.calls[0][1])).toContain("being written");

    // Untouched for two hours: left over, and taken over.
    const old = new Date(Date.now() - 2 * 3_600_000);
    await fs.utimes(partial, old, old);
    await runServerBackups(config, NOW);
    expect(await exists(partial)).toBe(false);
    expect((await readCopy(a)).library.format).toBe("myreads-export");
  });
});

describe("serverBackupJob", () => {
  it("runs once a day, from BACKUP_HOUR on", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const a = await makeUser("sb-a");
    const job = serverBackupJob(config);

    await job.run(new Date(2026, 9, 20, 2, 50));
    expect(await exists(path.join(dir, a))).toBe(false);

    await job.run(new Date(2026, 9, 20, 3, 5));
    expect(await exists(copyPath(a))).toBe(true);

    // Already ran today: a copy removed since isn't made again until tomorrow.
    await fs.rm(copyPath(a));
    await job.run(new Date(2026, 9, 20, 3, 20));
    await job.run(new Date(2026, 9, 20, 23, 50));
    expect(await exists(copyPath(a))).toBe(false);

    await job.run(new Date(2026, 9, 21, 3, 0));
    expect(await exists(copyPath(a, "2026-10-21"))).toBe(true);
  });
});

describe("deleting an account", () => {
  it("removes its folder of copies, and no one else's", async () => {
    process.env.BACKUP_DIR = dir;
    const a = await makeUser("sb-a", "secret");
    const b = await makeUser("sb-b");
    await runServerBackups(config, NOW);
    expect(await exists(copyPath(a))).toBe(true);

    currentUserId = a;
    const form = new FormData();
    form.set("password", "secret");
    await deleteAccount({}, form);

    expect(await prisma.user.count({ where: { id: a } })).toBe(0);
    expect(await exists(path.join(dir, a))).toBe(false);
    expect(await exists(copyPath(b))).toBe(true);
  });
});
