import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailMessage } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

/**
 * The monthly email against a real database: the timer's look for readers
 * whose 1st has come (once a month, quiet months let go, a failed send
 * tried again), what it puts in the message, Send it to me, the address
 * the links use, and the link that stops it without signing in.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let requestHeaders = new Headers({ host: "books.example.net", "x-forwarded-proto": "https" });
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

/** What Send it to me sent; the job is given its own. */
const handSent: MailMessage[] = [];
vi.mock("@/lib/mail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mail")>()),
  mailEnabled: () => true,
  sendMail: async (message: MailMessage) => {
    handSent.push(message);
  },
}));

const { sendDueMonthlyEmails, resetMonthlyEmailRetries, unsubscribeToken } = await import("@/lib/monthly-email-run");
const { sendMonthlyEmailNow } = await import("@/lib/actions/monthly-email");
const { savePreferences } = await import("@/lib/actions/preferences");
const unsubscribe = await import("@/app/api/email/unsubscribe/route");
const preview = await import("@/app/api/email/monthly/route");

let coversDir: string;
const savedEnv = { COVERS_DIR: process.env.COVERS_DIR, AUTH_URL: process.env.AUTH_URL };
beforeAll(async () => {
  coversDir = await fs.mkdtemp(path.join(os.tmpdir(), "monthly-email-covers-"));
  process.env.COVERS_DIR = coversDir;
  delete process.env.AUTH_URL;
  const { default: sharp } = await import("sharp");
  await sharp({ create: { width: 300, height: 450, channels: 3, background: "#336699" } })
    .png()
    .toFile(path.join(coversDir, "monthly-test.png"));
});
afterAll(async () => {
  await fs.rm(coversDir, { recursive: true, force: true });
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const userIds: string[] = [];
let n = 0;
async function makeUser(preferences: object = {}, lastMonthlyEmail: string | null = null) {
  const user = await prisma.user.create({
    data: {
      username: `me-${Date.now()}-${n++}`,
      passwordHash: "x",
      lastMonthlyEmail,
      preferences: { timeZone: "Europe/Oslo", ...preferences },
    },
  });
  userIds.push(user.id);
  return user.id;
}

/** A reader with the email on and October 2026 read: two books finished,
 *  one with a cover on this server, and a quote. */
async function octoberReader(preferences: object = {}) {
  const address = `reader${n}@example.com`;
  const id = await makeUser({ monthlyEmail: true, emailAddress: address, ...preferences });
  const a = await prisma.book.create({
    data: {
      userId: id,
      title: "The Left Hand of Darkness",
      authors: ["Ursula K. Le Guin"],
      pageCount: 304,
      status: "READ",
      rating: 10,
      coverUrl: "/api/covers/monthly-test.png",
      dateStarted: new Date("2026-10-10T00:00:00Z"),
      dateFinished: new Date("2026-10-19T00:00:00Z"),
    },
  });
  await prisma.book.create({
    data: {
      userId: id,
      title: "Station Eleven",
      authors: ["Emily St. John Mandel"],
      pageCount: 333,
      status: "READ",
      rating: 8,
      dateFinished: new Date("2026-10-06T00:00:00Z"),
    },
  });
  await prisma.progressEntry.createMany({
    data: [
      { bookId: a.id, page: 0, date: new Date("2026-10-10T06:00:00Z") },
      { bookId: a.id, page: 120, date: new Date("2026-10-10T19:00:00Z"), minutes: 50 },
      { bookId: a.id, page: 304, date: new Date("2026-10-19T19:00:00Z"), minutes: 80 },
    ],
  });
  await prisma.quote.create({
    data: { bookId: a.id, text: "Light is the left hand of darkness.", createdAt: new Date("2026-10-16T20:00:00Z") },
  });
  return { id, address };
}

const sentTo = (messages: MailMessage[], to: string) => messages.filter((m) => m.to === to);

beforeEach(() => {
  resetMonthlyEmailRetries();
  handSent.length = 0;
  requestHeaders = new Headers({ host: "books.example.net", "x-forwarded-proto": "https" });
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  currentUserId = null;
});

// 1 November 2026, 08:05 in Oslo (UTC+1).
const FIRST = new Date("2026-11-01T07:05:00Z");

describe("the monthly email job", () => {
  it("sends last month's at 08:00 on the 1st, once", async () => {
    const { id, address } = await octoberReader();
    const sent: MailMessage[] = [];
    const send = async (m: MailMessage) => {
      sent.push(m);
    };

    await sendDueMonthlyEmails(new Date("2026-11-01T06:55:00Z"), send);
    expect(sentTo(sent, address)).toHaveLength(0);

    await sendDueMonthlyEmails(FIRST, send);
    const [message] = sentTo(sent, address);
    expect(message.subject).toBe("Your October in books: 2 finished, 637 pages");
    expect(message.html).toContain("Book of the month");
    expect(message.html).toContain("Light is the left hand of darkness.");
    expect(message.text).toContain("Time read: 2 h 10 min");
    expect((await prisma.user.findUnique({ where: { id } }))?.lastMonthlyEmail).toBe("2026-10");

    // The cover cached on this server goes inside, as a JPEG; the other is
    // drawn as cloth.
    expect(message.inline).toHaveLength(1);
    const [cover] = message.inline!;
    expect(cover.contentType).toBe("image/jpeg");
    expect(cover.content.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(message.html).toContain(`src="cid:${cover.cid}"`);
    expect(message.headers).toMatchObject({ "Auto-Submitted": "auto-generated" });

    await sendDueMonthlyEmails(new Date("2026-11-01T07:20:00Z"), send);
    await sendDueMonthlyEmails(new Date("2026-11-03T12:00:00Z"), send);
    expect(sentTo(sent, address)).toHaveLength(1);
  });

  it("leaves out readers with it off or without an address", async () => {
    const off = `off${n}@example.com`;
    await makeUser({ monthlyEmail: false, emailAddress: off });
    const none = await makeUser({ monthlyEmail: true, emailAddress: "" });
    const sent: MailMessage[] = [];
    await sendDueMonthlyEmails(FIRST, async (m) => {
      sent.push(m);
    });
    expect(sentTo(sent, off)).toHaveLength(0);
    expect((await prisma.user.findUnique({ where: { id: none } }))?.lastMonthlyEmail).toBeNull();
  });

  it("lets a month with no reading go, unless the reader wants those too", async () => {
    const quiet = await makeUser({ monthlyEmail: true, emailAddress: `quiet${n}@example.com` });
    const wanted = await makeUser({
      monthlyEmail: true,
      emailAddress: `quiet-too${n}@example.com`,
      monthlyEmailSkipQuiet: false,
    });
    const sent: MailMessage[] = [];
    await sendDueMonthlyEmails(FIRST, async (m) => {
      sent.push(m);
    });
    expect(sent.filter((m) => m.to.startsWith("quiet"))).toEqual([
      expect.objectContaining({ to: expect.stringMatching(/^quiet-too/), subject: "Your October in books" }),
    ]);
    // Both months are done with.
    const users = await prisma.user.findMany({ where: { id: { in: [quiet, wanted] } } });
    expect(users.map((u) => u.lastMonthlyEmail)).toEqual(["2026-10", "2026-10"]);
  });

  it("gives the month back when the send fails, and tries again later", async () => {
    const { id, address } = await octoberReader();
    let failing = true;
    const sent: MailMessage[] = [];
    const send = async (m: MailMessage) => {
      if (failing && m.to === address) throw new Error("mail server down");
      sent.push(m);
    };
    const quietLog = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendDueMonthlyEmails(FIRST, send);
    quietLog.mockRestore();
    expect((await prisma.user.findUnique({ where: { id } }))?.lastMonthlyEmail).toBeNull();

    failing = false;
    // Not straight away: the first wait is a quarter of an hour.
    await sendDueMonthlyEmails(new Date(FIRST.getTime() + 5 * 60_000), send);
    expect(sentTo(sent, address)).toHaveLength(0);
    await sendDueMonthlyEmails(new Date(FIRST.getTime() + 16 * 60_000), send);
    expect(sentTo(sent, address)).toHaveLength(1);
    expect((await prisma.user.findUnique({ where: { id } }))?.lastMonthlyEmail).toBe("2026-10");
  });

  it("links to MyReads where the reader set it up, with a way to stop it", async () => {
    const { id, address } = await octoberReader({ emailSite: "https://books.example.net" });
    const sent: MailMessage[] = [];
    await sendDueMonthlyEmails(FIRST, async (m) => {
      sent.push(m);
    });
    const [message] = sentTo(sent, address);
    const stop = `https://books.example.net/api/email/unsubscribe?u=${id}&t=${unsubscribeToken(id, address)}`;
    expect(message.headers).toMatchObject({
      "List-Unsubscribe": `<${stop}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(message.html).toContain('href="https://books.example.net/stats"');
  });
});

describe("Send it to me", () => {
  it("sends last month's (or one asked for) to the reader's address now", async () => {
    const { id, address } = await octoberReader();
    currentUserId = id;
    expect(await sendMonthlyEmailNow()).toEqual({ sentTo: address });
    expect(handSent.map((m) => m.subject)).toEqual(["Your October in books: 2 finished, 637 pages"]);
    expect(await sendMonthlyEmailNow("2026-09")).toEqual({ sentTo: address });
    expect(handSent[1].subject).toBe("Your September in books");
    // A month still to come is last month instead.
    await sendMonthlyEmailNow("2099-01");
    expect(handSent[2].subject).toMatch(/^Your (October|\w+) in books/);
    // It doesn't count as the month's email.
    expect((await prisma.user.findUnique({ where: { id } }))?.lastMonthlyEmail).toBeNull();
  });

  it("notes where MyReads is open, for the links", async () => {
    const { id } = await octoberReader();
    currentUserId = id;
    await sendMonthlyEmailNow("2026-10");
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect((user.preferences as { emailSite?: string }).emailSite).toBe("https://books.example.net");
    expect(handSent[0].html).toContain('href="https://books.example.net/stats"');
  });

  it("needs an address, and only sends a few in a short while", async () => {
    currentUserId = await makeUser({ monthlyEmail: false });
    expect(await sendMonthlyEmailNow()).toEqual({ error: "Add your email address first." });

    const { id } = await octoberReader();
    currentUserId = id;
    for (let i = 0; i < 5; i++) expect(await sendMonthlyEmailNow("2026-10")).toHaveProperty("sentTo");
    expect(await sendMonthlyEmailNow("2026-10")).toEqual({
      error: "That’s a few in a short while. Try again in a quarter of an hour.",
    });
  });
});

describe("saving the email preferences", () => {
  it("keeps where MyReads is the server's to say", async () => {
    const id = await makeUser();
    currentUserId = id;
    await savePreferences({ emailSite: "https://evil.example" });
    let prefs = (await prisma.user.findUniqueOrThrow({ where: { id } })).preferences as Record<string, unknown>;
    expect(prefs.emailSite).toBeUndefined();

    await savePreferences({ emailAddress: "me@example.com", monthlyEmail: true, emailSite: "https://evil.example" });
    prefs = (await prisma.user.findUniqueOrThrow({ where: { id } })).preferences as Record<string, unknown>;
    expect(prefs).toMatchObject({ emailAddress: "me@example.com", monthlyEmail: true, emailSite: "https://books.example.net" });
  });

  it("drops an address that isn't one", async () => {
    const id = await makeUser();
    currentUserId = id;
    await savePreferences({ emailAddress: "a@b.com\r\nBcc: c@d.com" });
    const prefs = (await prisma.user.findUniqueOrThrow({ where: { id } })).preferences as Record<string, unknown>;
    expect(prefs.emailAddress).toBe("");
  });
});

describe("the preview", () => {
  it("is the email as a page, covers inside, for the signed-in reader only", async () => {
    const { id } = await octoberReader();
    const req = new NextRequest("http://localhost/api/email/monthly?month=2026-10");
    expect((await preview.GET(req)).status).toBe(401);
    currentUserId = id;
    const res = await preview.GET(req);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await res.text();
    expect(html).toContain("Your October in books");
    expect(html).toContain('src="data:image/jpeg;base64,');
  });
});

describe("Stop these emails", () => {
  const link = (u: string, t: string) => new NextRequest(`https://books.example.net/api/email/unsubscribe?u=${u}&t=${t}`);

  it("asks first, then turns the email off without signing in", async () => {
    const { id, address } = await octoberReader();
    const token = unsubscribeToken(id, address);

    const ask = await unsubscribe.GET(link(id, token));
    expect(ask.status).toBe(200);
    const page = await ask.text();
    expect(page).toContain("Stop the monthly email?");
    expect(page).toContain('<form method="post">');
    // Opening the link alone changes nothing.
    let prefs = (await prisma.user.findUniqueOrThrow({ where: { id } })).preferences as Record<string, unknown>;
    expect(prefs.monthlyEmail).toBe(true);

    const done = await unsubscribe.POST(link(id, token));
    expect(await done.text()).toContain("The monthly email is off");
    prefs = (await prisma.user.findUniqueOrThrow({ where: { id } })).preferences as Record<string, unknown>;
    expect(prefs).toMatchObject({ monthlyEmail: false, emailAddress: address });
    expect(await (await unsubscribe.GET(link(id, token))).text()).toContain("already off");
  });

  it("refuses a wrong key, or one for an address since changed", async () => {
    const { id, address } = await octoberReader();
    expect((await unsubscribe.POST(link(id, "x".repeat(32)))).status).toBe(404);
    expect((await unsubscribe.POST(link("nobody", unsubscribeToken("nobody", address)))).status).toBe(404);

    const old = unsubscribeToken(id, address);
    currentUserId = id;
    await savePreferences({ emailAddress: "new@example.com" });
    expect((await unsubscribe.POST(link(id, old))).status).toBe(404);
    const prefs = (await prisma.user.findUniqueOrThrow({ where: { id } })).preferences as Record<string, unknown>;
    expect(prefs.monthlyEmail).toBe(true);
  });
});
