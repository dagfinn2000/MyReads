import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * GET /api/backups/[name] serves the signed-in account's own nightly
 * copies and nothing else: no session is a 401, and another account's copy,
 * a malformed name or a link out of the folder are all a 404, the same as
 * a copy that isn't there. A download read to the end counts as a backup,
 * like the Download backup button's.
 */
const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId, name: "me" } } : null),
  signOut: async () => {},
}));

const { GET } = await import("@/app/api/backups/[name]/route");

const NAME = "myreads-backup-2026-10-20.zip";

let dir: string;
let userId: string;
let otherUserId: string;
/** Bigger than one read from disk, so the download comes in chunks. */
const bytes = crypto.randomBytes(200 * 1024);

const get = (name: string) => GET(new Request(`http://localhost/api/backups/${name}`), {
  params: Promise.resolve({ name }),
});

const lastBackupAt = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { lastBackupAt: true } }))
    .lastBackupAt;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "myreads-backups-route-"));
  process.env.BACKUP_DIR = dir;
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `br-a-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `br-b-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  await fs.mkdir(path.join(dir, userId));
  await fs.writeFile(path.join(dir, userId, NAME), bytes);
  await fs.mkdir(path.join(dir, otherUserId));
  await fs.writeFile(path.join(dir, otherUserId, "myreads-backup-2026-10-19.zip"), "theirs");
});

afterEach(async () => {
  delete process.env.BACKUP_DIR;
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await fs.rm(dir, { recursive: true, force: true });
});

describe("GET /api/backups/[name]", () => {
  it("serves the account's own copy, and counts it once it's all been read", async () => {
    const res = await get(NAME);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-length")).toBe(String(bytes.length));
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${NAME}"`);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      if (chunks.length === 1) expect(await lastBackupAt(userId)).toBeNull();
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(Buffer.concat(chunks).equals(bytes)).toBe(true);
    expect(await lastBackupAt(userId)).not.toBeNull();
    expect(await lastBackupAt(otherUserId)).toBeNull();
  });

  it("doesn't count a download that stops part-way", async () => {
    const res = await get(NAME);
    const reader = res.body!.getReader();
    expect((await reader.read()).done).toBe(false);
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await lastBackupAt(userId)).toBeNull();
  });

  it("is a 401 without a session", async () => {
    currentUserId = null;
    expect((await get(NAME)).status).toBe(401);
    expect((await get("../../etc/passwd")).status).toBe(401);
  });

  it("is a 404 for another account's copy", async () => {
    expect((await get("myreads-backup-2026-10-19.zip")).status).toBe(404);
    expect((await get(`../${otherUserId}/myreads-backup-2026-10-19.zip`)).status).toBe(404);
    expect((await get(`..%2F${otherUserId}%2Fmyreads-backup-2026-10-19.zip`)).status).toBe(404);
  });

  it("is a 404 for a malformed name", async () => {
    await fs.writeFile(path.join(dir, userId, "notes.txt"), "mine");
    await fs.writeFile(path.join(dir, userId, ".myreads-backup.zip.partial"), "half");
    for (const name of [
      "",
      "notes.txt",
      ".myreads-backup.zip.partial",
      `${NAME}.partial`,
      `./${NAME}`,
      `/${NAME}`,
      `${NAME}/`,
      `${NAME}%00`,
      "myreads-backup-2026-10-20.ZIP",
      "myreads-backup-2026-1-20.zip",
      "..",
      "%2e%2e",
    ]) {
      expect((await get(name)).status, name).toBe(404);
    }
  });

  it("is a 404 for a link out of the account's folder", async () => {
    await fs.symlink(
      path.join(dir, otherUserId, "myreads-backup-2026-10-19.zip"),
      path.join(dir, userId, "myreads-backup-2026-10-19.zip"),
    );
    expect((await get("myreads-backup-2026-10-19.zip")).status).toBe(404);
  });

  it("is a 404 for a copy that isn't there, or with server backups off", async () => {
    expect((await get("myreads-backup-2026-10-18.zip")).status).toBe(404);
    delete process.env.BACKUP_DIR;
    expect((await get(NAME)).status).toBe(404);
  });
});
