import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

/** The two backup actions: reading the last download date (polled after a
 *  download) and snoozing the reminder. */
const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));

const { getLastBackupAt, snoozeBackupReminder } = await import("@/lib/actions/backup");

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `ba-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `bb-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  cookieSet.mockClear();
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("getLastBackupAt", () => {
  it("is null until a backup is recorded, then the ISO date", async () => {
    expect(await getLastBackupAt()).toBeNull();
    const when = new Date("2026-10-01T09:30:00.000Z");
    await prisma.user.update({ where: { id: userId }, data: { lastBackupAt: when } });
    expect(await getLastBackupAt()).toBe(when.toISOString());
  });

  it("reads only the signed-in account", async () => {
    await prisma.user.update({
      where: { id: otherUserId },
      data: { lastBackupAt: new Date("2026-10-01T09:30:00.000Z") },
    });
    expect(await getLastBackupAt()).toBeNull();
  });
});

describe("snoozeBackupReminder", () => {
  it("sets a week-long httpOnly cookie holding the account id", async () => {
    await snoozeBackupReminder();
    expect(cookieSet).toHaveBeenCalledWith("myreads-backup-snooze", userId, {
      maxAge: 604800,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  });
});

describe("without a session", () => {
  it("both refuse", async () => {
    currentUserId = null;
    await expect(getLastBackupAt()).rejects.toThrow("Not authenticated");
    await expect(snoozeBackupReminder()).rejects.toThrow("Not authenticated");
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
