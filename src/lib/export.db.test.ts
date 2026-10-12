import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";

/**
 * The export route records when a backup was downloaded, for the Backup
 * card and the monthly reminder. Only a download that went out in full
 * counts, and only for the account that made it.
 */
const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId, name: "me" } } : null),
  signOut: async () => {},
}));

const { GET: exportRoute } = await import("@/app/api/export/route");
const { prisma: appPrisma } = await import("@/lib/prisma");

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `ex-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `ey-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

const lastBackupAt = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { lastBackupAt: true } }))
    .lastBackupAt;

describe("export and lastBackupAt", () => {
  it("is set once the whole zip has been read, for this account only", async () => {
    await prisma.book.create({
      data: { userId, title: "A Book", searchText: "a book", quotes: { create: [{ text: "Hi" }] } },
    });
    expect(await lastBackupAt(userId)).toBeNull();

    const before = Date.now();
    const res = await exportRoute();
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
    const after = Date.now();

    const stamp = await lastBackupAt(userId);
    expect(stamp).not.toBeNull();
    expect(stamp!.getTime()).toBeGreaterThanOrEqual(before);
    expect(stamp!.getTime()).toBeLessThanOrEqual(after);
    expect(await lastBackupAt(otherUserId)).toBeNull();
  });

  it("writes nothing without a session", async () => {
    currentUserId = null;
    const res = await exportRoute();
    expect(res.status).toBe(401);
    expect(await lastBackupAt(userId)).toBeNull();
  });

  it("survives the client going away while the date is being written", async () => {
    // Hold the write open, so the cancel lands between the zip's end and
    // the stream's close.
    const write = vi.spyOn(appPrisma.user, "updateMany").mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ count: 1 }), 200)) as never,
    );
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      const res = await exportRoute();
      const reader = res.body!.getReader();
      // Read to the end; the last read waits on the write.
      void (async () => {
        while (!(await reader.read()).done);
      })().catch(() => {});
      await vi.waitFor(() => expect(write).toHaveBeenCalled());
      await reader.cancel();
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
      write.mockRestore();
    }
  });

  it("writes nothing when the client goes away before the zip is done", async () => {
    const res = await exportRoute();
    await res.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await lastBackupAt(userId)).toBeNull();
  });

  it("writes nothing when the client reads no bytes, however long it waits", async () => {
    await prisma.book.create({ data: { userId, title: "A Book", searchText: "a book" } });
    const res = await exportRoute();
    // Time enough for a server that generates ahead of the client to finish.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await res.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await lastBackupAt(userId)).toBeNull();
  });

  it("writes nothing when the client goes away after the first chunk", async () => {
    const res = await exportRoute();
    const reader = res.body!.getReader();
    expect((await reader.read()).done).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await lastBackupAt(userId)).toBeNull();
  });

  it("writes nothing when the zip fails part-way", async () => {
    // A zip stream that hands out one chunk, then breaks.
    const handlers: Record<string, (arg?: unknown) => void> = {};
    let resumes = 0;
    const fake = {
      on(evt: string, fn: (arg?: unknown) => void) {
        handlers[evt] = fn;
        return fake;
      },
      pause: () => fake,
      resume() {
        setTimeout(() => {
          if (resumes++ === 0) handlers.data(new Uint8Array([1, 2, 3]));
          else handlers.error(new Error("disk went away"));
        });
        return fake;
      },
    };
    const generate = vi
      .spyOn(JSZip.prototype, "generateInternalStream")
      .mockReturnValue(fake as never);
    try {
      const res = await exportRoute();
      const reader = res.body!.getReader();
      expect((await reader.read()).value).toEqual(new Uint8Array([1, 2, 3]));
      await expect(reader.read()).rejects.toThrow("disk went away");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(await lastBackupAt(userId)).toBeNull();
    } finally {
      generate.mockRestore();
    }
  });

  it("waits until the client has read the last chunk", async () => {
    await prisma.book.create({ data: { userId, title: "A Book", searchText: "a book" } });
    const res = await exportRoute();
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      // However slowly the client reads, nothing counts until it's had it all.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(await lastBackupAt(userId)).toBeNull();
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(await lastBackupAt(userId)).not.toBeNull();
  });
});
