import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { ReminderMessage } from "@/lib/reminders";
import type { PushTarget } from "@/lib/reminders-run";

/**
 * Reading reminders against a real database: the browsers an account turns
 * them on in, the server's own signing key, and the timer's look for
 * readers whose time has come (claiming the day, skipping a day already
 * read, forgetting a browser that's gone, and what the reminder says).
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const userAgent = "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0";
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": userAgent }),
}));

const { addPushDevice, reminderKey, removePushDevice, sendTestReminder } = await import(
  "@/lib/actions/reminders"
);
const { sendDueReminders, vapidKeys } = await import("@/lib/reminders-run");
const { POST: renew } = await import("@/app/api/push/renew/route");

/** A browser's subscription, as PushSubscription.toJSON() gives it. A
 *  literal public address, so the network guard needs no DNS. */
function subscription(endpoint = `https://203.0.113.7/push/${crypto.randomUUID()}`) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint,
    keys: {
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: crypto.randomBytes(16).toString("base64url"),
    },
  };
}

const userIds: string[] = [];
async function makeUser(preferences: object = {}) {
  const user = await prisma.user.create({
    data: { username: `rm-${Date.now()}-${Math.random()}`, passwordHash: "x", preferences },
  });
  userIds.push(user.id);
  return user.id;
}

let userId: string;
beforeEach(async () => {
  userId = await makeUser({ timeZone: "Europe/Oslo" });
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  vi.unstubAllGlobals();
});

describe("turning reminders on in a browser", () => {
  it("saves the subscription with what the browser is", async () => {
    const sub = subscription();
    expect(await addPushDevice(sub)).toEqual({});
    const devices = await prisma.pushDevice.findMany({ where: { userId } });
    expect(devices).toMatchObject([
      { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: "Firefox on Linux" },
    ]);
  });

  it("refuses what isn't a browser's subscription, or a push service inside the network", async () => {
    const good = subscription();
    for (const bad of [
      null,
      "junk",
      { ...good, endpoint: good.endpoint.replace("https:", "http:") },
      { ...good, keys: { ...good.keys, p256dh: "AAAA" } },
      { ...good, keys: { ...good.keys, auth: "not base64!" } },
      { endpoint: good.endpoint },
    ]) {
      expect(await addPushDevice(bad)).toEqual({ error: "This browser's subscription couldn't be read." });
    }
    for (const inside of ["https://127.0.0.1/push", "https://10.0.0.8/push", "https://[::1]/push"]) {
      expect((await addPushDevice(subscription(inside))).error).toMatch(/can't reach/);
    }
    expect(await prisma.pushDevice.count({ where: { userId } })).toBe(0);
  });

  it("takes a browser over from the account signed in before, without counting it twice", async () => {
    const sub = subscription();
    await addPushDevice(sub);
    const other = await makeUser();
    currentUserId = other;
    await addPushDevice(sub);
    await addPushDevice(sub);
    expect(await prisma.pushDevice.count({ where: { userId } })).toBe(0);
    expect(await prisma.pushDevice.count({ where: { userId: other } })).toBe(1);
  });

  it("keeps to ten browsers", async () => {
    for (let i = 0; i < 10; i++) expect(await addPushDevice(subscription())).toEqual({});
    expect((await addPushDevice(subscription())).error).toMatch(/10 browsers at most/);
  });

  it("removes only the account's own", async () => {
    await addPushDevice(subscription());
    const mine = await prisma.pushDevice.findFirstOrThrow({ where: { userId } });
    currentUserId = await makeUser();
    await removePushDevice(mine.id);
    await removePushDevice({ not: "" });
    expect(await prisma.pushDevice.count({ where: { userId } })).toBe(1);
    currentUserId = userId;
    await removePushDevice(mine.id);
    expect(await prisma.pushDevice.count({ where: { userId } })).toBe(0);
  });

  it("follows the browser to a new address when its push service moves it", async () => {
    const before = subscription();
    await addPushDevice(before);
    const after = subscription();
    const res = await renew(
      new Request("http://localhost/api/push/renew", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": userAgent },
        body: JSON.stringify({ oldEndpoint: before.endpoint, subscription: after }),
      }),
    );
    expect(res.status).toBe(200);
    const devices = await prisma.pushDevice.findMany({ where: { userId } });
    expect(devices.map((d) => [d.endpoint, d.auth])).toEqual([[after.endpoint, after.keys.auth]]);
  });
});

describe("the server's key", () => {
  it("is made once, the same for everyone asking at once", async () => {
    await prisma.serverSetting.deleteMany({ where: { key: "vapidKeys" } });
    const keys = await Promise.all([vapidKeys(), vapidKeys(), vapidKeys()]);
    expect(new Set(keys.map((k) => k.publicKey)).size).toBe(1);
    expect(await reminderKey()).toEqual({ key: keys[0].publicKey });
    expect(Buffer.from(keys[0].publicKey, "base64url")).toHaveLength(65);
  });
});

describe("the reminder timer", () => {
  // 20:05 in Oslo on Sunday 25 October 2026.
  const due = new Date("2026-10-25T19:05:00Z");

  function recorder(outcome: "sent" | "gone" | "failed" = "sent") {
    const sent: { endpoint: string; message: ReminderMessage }[] = [];
    const send = async (device: PushTarget, message: ReminderMessage) => {
      sent.push({ endpoint: device.endpoint, message });
      return outcome;
    };
    return { sent, send };
  }

  async function withDevice(id = userId) {
    const sub = subscription();
    await prisma.pushDevice.create({
      data: { userId: id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: "x" },
    });
    return sub.endpoint;
  }

  it("sends at the reader's time, to each browser, once a day", async () => {
    const a = await withDevice();
    const b = await withDevice();
    const early = recorder();
    await sendDueReminders(new Date("2026-10-25T18:50:00Z"), early.send);
    expect(early.sent).toEqual([]);

    const r = recorder();
    await sendDueReminders(due, r.send);
    expect(r.sent.map((s) => s.endpoint).sort()).toEqual([a, b].sort());
    expect(r.sent[0].message).toEqual({ title: "Time to read", body: "Pick up where you left off.", url: "/reading" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).lastReminderDay).toBe("2026-10-25");

    const again = recorder();
    await sendDueReminders(new Date("2026-10-25T19:10:00Z"), again.send);
    expect(again.sent).toEqual([]);
  });

  it("sends nothing to an account with no browser, or on a day not chosen", async () => {
    const r = recorder();
    await sendDueReminders(due, r.send);
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { timeZone: "Europe/Oslo", reminderDays: [1, 2, 3, 4, 5] } },
    });
    await withDevice();
    await sendDueReminders(due, r.send);
    expect(r.sent).toEqual([]);
  });

  it("lets a day go when the reader has already read, unless they want it anyway", async () => {
    await withDevice();
    const book = await prisma.book.create({
      data: { userId, title: "Dune", status: "READING", pageCount: 412, currentPage: 120 },
    });
    await prisma.progressEntry.create({
      data: { bookId: book.id, page: 120, date: new Date("2026-10-25T07:00:00Z") },
    });
    const r = recorder();
    await sendDueReminders(due, r.send);
    expect(r.sent).toEqual([]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).lastReminderDay).toBe("2026-10-25");

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastReminderDay: null,
        preferences: { timeZone: "Europe/Oslo", reminderSkipIfRead: false, dailyGoal: "pages", dailyGoalPages: 30 },
      },
    });
    await sendDueReminders(due, r.send);
    expect(r.sent.map((s) => s.message.body)).toEqual(["Dune · page 120 of 412\n30 pages to go for today's goal"]);
  });

  it("names the book read last, in its own unit", async () => {
    await withDevice();
    const older = await prisma.book.create({
      data: { userId, title: "Older", status: "READING", pageCount: 300, currentPage: 30 },
    });
    const ebook = await prisma.book.create({
      data: { userId, title: "Ebook", status: "READING", format: "EBOOK", pageCount: 200, currentPage: 50 },
    });
    await prisma.progressEntry.createMany({
      data: [
        { bookId: older.id, page: 30, date: new Date("2026-10-23T18:00:00Z") },
        { bookId: ebook.id, page: 50, date: new Date("2026-10-24T18:00:00Z") },
      ],
    });
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { timeZone: "Europe/Oslo", ebookUnit: "percent" } },
    });
    const r = recorder();
    await sendDueReminders(due, r.send);
    expect(r.sent[0].message.body).toBe("Ebook · 25%");
  });

  it("forgets a browser its push service says is gone", async () => {
    await withDevice();
    const r = recorder("gone");
    await sendDueReminders(due, r.send);
    expect(r.sent).toHaveLength(1);
    expect(await prisma.pushDevice.count({ where: { userId } })).toBe(0);
  });

  it("claims the day so two timers at once send it once", async () => {
    await withDevice();
    const r = recorder();
    await Promise.all([sendDueReminders(due, r.send), sendDueReminders(due, r.send)]);
    expect(r.sent).toHaveLength(1);
  });
});

describe("a test reminder", () => {
  it("goes to the push service, encrypted, and a gone browser comes off the list", async () => {
    await addPushDevice(subscription());
    const device = await prisma.pushDevice.findFirstOrThrow({ where: { userId } });
    const calls: string[] = [];
    let status = 201;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push(url);
      expect((init.headers as Record<string, string>)["Content-Encoding"]).toBe("aes128gcm");
      return new Response(null, { status });
    });
    expect(await sendTestReminder(device.id)).toEqual({});
    expect(calls).toEqual([device.endpoint]);
    status = 410;
    expect((await sendTestReminder(device.id)).error).toMatch(/off the list/);
    expect(await prisma.pushDevice.count({ where: { userId } })).toBe(0);
    expect((await sendTestReminder(device.id)).error).toMatch(/no longer/);
  });
});
