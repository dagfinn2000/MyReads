import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { issueChallenge } from "@/lib/passkeys";
import { userHandle } from "@/lib/webauthn";
import { makePasskey, signIn } from "@/lib/webauthn-fake";

/**
 * Passkeys against a real database: one is kept only for the account that
 * asked for it, with its password, and only answering a challenge given to
 * that account; it then signs in once per challenge, its counter is kept,
 * and a removed or another account's passkey signs no one in.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => undefined,
  unstable_update: async () => undefined,
}));
const siteHeaders = new Headers({ host: "books.example.org", "x-forwarded-proto": "https", "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15" });
vi.mock("next/headers", () => ({ headers: async () => siteHeaders }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { addPasskey, removePasskey, renamePasskey, passkeyRegistrationOptions, passkeySignInOptions } = await import(
  "@/lib/actions/passkeys"
);
const { loginLimiter, passkeyAskLimiter } = await import("@/lib/rate-limit");
const { passkeySignIn } = await import("@/lib/passkey-sign-in");

let userId: string;
let otherId: string;
let username: string;

const PASSWORD = "correct horse battery";
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

beforeEach(async () => {
  delete process.env.AUTH_URL;
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `pk-${stamp}`, passwordHash } }),
    prisma.user.create({ data: { username: `pk-other-${stamp}`, passwordHash } }),
  ]);
  userId = a.id;
  username = a.username;
  otherId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

/** Makes a passkey the way the Account page does, for the signed-in account. */
async function addOne(alg = -7) {
  const asked = await passkeyRegistrationOptions(PASSWORD);
  if (!("options" in asked) || !asked.options) throw new Error("no options");
  expect(asked.options.rp.id).toBe("books.example.org");
  const made = makePasskey({ alg, challenge: asked.options.challenge });
  const res = await addPasskey(made.response);
  return { made, res };
}

function answer(made: ReturnType<typeof makePasskey>, owner: string, over: Parameters<typeof signIn>[3] = {}) {
  return JSON.stringify(
    signIn(made.privateKey, made.alg, made.response.id, {
      challenge: issueChallenge("sign-in"),
      user: userHandle(owner),
      ...over,
    }),
  );
}

describe("passkeys", () => {
  it("keeps a passkey made for this account, named after its keeper", async () => {
    const { res } = await addOne();
    expect(res).toEqual({ name: "iCloud Keychain" });
    const rows = await prisma.passkey.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].algorithm).toBe(-7);
  });

  it("asks for the account's password before a passkey can be made", async () => {
    try {
      expect(await passkeyRegistrationOptions(undefined)).toEqual({ error: "Enter your password first." });
      expect(await passkeyRegistrationOptions("")).toEqual({ error: "Enter your password first." });
      expect(await passkeyRegistrationOptions("not it")).toEqual({ error: "Current password is incorrect" });
      expect(await passkeyRegistrationOptions("x".repeat(5000))).toEqual({ error: "Current password is incorrect" });
      // Wrong ones count with failed sign-ins, so this isn't a way to guess.
      for (let i = 0; i < 10; i++) await passkeyRegistrationOptions("not it");
      expect(await passkeyRegistrationOptions(PASSWORD)).toEqual({
        error: "Too many failed attempts — wait a few minutes and try again.",
      });
      loginLimiter.clear(`login:u:${username}`);
      expect("options" in (await passkeyRegistrationOptions(PASSWORD))).toBe(true);
    } finally {
      loginLimiter.clear(`login:u:${username}`);
    }
  });

  it("keeps no passkey, and signs no one in, without the device checking it was them", async () => {
    // Touched, but no fingerprint, face, PIN or screen lock (flag UV unset).
    const asked = await passkeyRegistrationOptions(PASSWORD);
    if (!("options" in asked) || !asked.options) throw new Error("no options");
    expect(asked.options.authenticatorSelection.userVerification).toBe("required");
    const unverified = makePasskey({ challenge: asked.options.challenge, flags: 0x49 });
    expect((await addPasskey(unverified.response)).error).toMatch(/couldn’t be checked/);
    expect(await prisma.passkey.count({ where: { userId } })).toBe(0);

    const { made } = await addOne();
    expect(await passkeySignIn(answer(made, userId, { flags: 0x01 }), siteHeaders)).toBeNull();
    expect((await passkeySignIn(answer(made, userId, { flags: 0x05 }), siteHeaders))?.id).toBe(userId);
    const signInAsk = await passkeySignInOptions();
    expect("options" in signInAsk && signInAsk.options?.userVerification).toBe("required");
  });

  it("refuses a passkey answering a challenge it wasn't given, or one used already", async () => {
    const made = makePasskey({ challenge: "not-one-of-ours" });
    expect(await addPasskey(made.response)).toEqual({ error: "That took too long. Try adding it again." });

    const asked = await passkeyRegistrationOptions(PASSWORD);
    const challenge = "options" in asked ? asked.options!.challenge : "";
    // Another account can't use this account's challenge.
    currentUserId = otherId;
    expect((await addPasskey(makePasskey({ challenge }).response)).error).toMatch(/too long/);
    currentUserId = userId;
    expect((await addPasskey(makePasskey({ challenge }).response)).error).toMatch(/too long/);
    expect(await prisma.passkey.count({ where: { userId } })).toBe(0);
  });

  it("signs in with it once per challenge, keeping the counter and when it was used", async () => {
    const { made } = await addOne();
    const once = answer(made, userId, { count: 3 });
    const user = await passkeySignIn(once, siteHeaders);
    expect(user?.id).toBe(userId);
    const row = await prisma.passkey.findUniqueOrThrow({ where: { id: made.response.id } });
    expect(Number(row.signCount)).toBe(3);
    expect(row.lastUsedAt).not.toBeNull();
    // The same answer again: its challenge is used up.
    expect(await passkeySignIn(once, siteHeaders)).toBeNull();
    // A counter that doesn't go up.
    expect(await passkeySignIn(answer(made, userId, { count: 3 }), siteHeaders)).toBeNull();
    expect((await passkeySignIn(answer(made, userId, { count: 4 }), siteHeaders))?.id).toBe(userId);
  });

  it("signs no one in with a challenge it made up, from another site, or junk", async () => {
    const { made } = await addOne();
    expect(await passkeySignIn(answer(made, userId, { challenge: "made-up" }), siteHeaders)).toBeNull();
    expect(await passkeySignIn(answer(made, userId, { origin: "https://evil.example" }), siteHeaders)).toBeNull();
    const elsewhere = new Headers({ host: "evil.example", "x-forwarded-proto": "https" });
    expect(await passkeySignIn(answer(made, userId), elsewhere)).toBeNull();
    expect(await passkeySignIn("{", siteHeaders)).toBeNull();
    expect(await passkeySignIn(undefined, siteHeaders)).toBeNull();
  });

  it("renames and removes only the account's own; a removed one signs no one in", async () => {
    const { made } = await addOne();
    const id = made.response.id;
    currentUserId = otherId;
    expect(await renamePasskey(id, "Mine now")).toEqual({ error: "That passkey is gone." });
    await removePasskey(id);
    expect(await prisma.passkey.count({ where: { id } })).toBe(1);

    currentUserId = userId;
    expect(await renamePasskey(id, "   ")).toEqual({ error: "Give it a name" });
    expect(await renamePasskey(id, "Phone")).toEqual({});
    expect((await prisma.passkey.findUniqueOrThrow({ where: { id } })).name).toBe("Phone");
    await removePasskey(id);
    expect(await passkeySignIn(answer(made, userId), siteHeaders)).toBeNull();
  });

  it("uses AUTH_URL for the site when it's set", async () => {
    process.env.AUTH_URL = "https://reads.example.net/";
    const asked = await passkeyRegistrationOptions(PASSWORD);
    expect("options" in asked && asked.options?.rp.id).toBe("reads.example.net");
  });

  it("turns away a flood of sign-in asks from one address", async () => {
    siteHeaders.set("x-forwarded-for", "203.0.113.9");
    try {
      const asks = [];
      for (let i = 0; i < 31; i++) asks.push(await passkeySignInOptions());
      expect(asks.slice(0, 30).every((a) => "options" in a)).toBe(true);
      expect(asks[30]).toEqual({ error: "Too many tries — wait a minute and try again." });
      // Another address still gets its challenge.
      siteHeaders.set("x-forwarded-for", "203.0.113.10");
      expect("options" in (await passkeySignInOptions())).toBe(true);
    } finally {
      siteHeaders.delete("x-forwarded-for");
      passkeyAskLimiter.clear("passkey-ask:203.0.113.9");
      passkeyAskLimiter.clear("passkey-ask:203.0.113.10");
    }
  });
});
