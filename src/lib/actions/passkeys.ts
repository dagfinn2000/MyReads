"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, signOut, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { checkPassword } from "@/lib/password-check";
import { clientIp, loginLimiter, passkeyAskLimiter } from "@/lib/rate-limit";
import { MAX_PASSKEYS, expectedSite, issueChallenge, passkeyName, takeChallenge } from "@/lib/passkeys";
import { keepSessionProof } from "@/lib/session-keep";
import { PASSKEY_ALGORITHMS, WebAuthnError, userHandle, verifyRegistration } from "@/lib/webauthn";

/**
 * Passkeys (Account › Passkeys) and "Sign out everywhere else". Signing in
 * with a passkey is the "passkey" provider in auth.ts; what a browser sends
 * is checked in lib/webauthn.ts.
 */

const NOT_HERE = "Passkeys can’t be used at this address.";

/**
 * What a browser needs to make a passkey for this account, once the
 * account's password is given. A passkey signs in for as long as it's kept,
 * so a moment at someone else's unlocked, signed-in browser mustn't be
 * enough to add one; and a passkey can only be added by answering a
 * challenge given here.
 */
export async function passkeyRegistrationOptions(password: unknown) {
  const userId = await requireUserId();
  const site = expectedSite(await headers());
  if (!site) return { error: NOT_HERE } as const;
  const [user, existing] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, passwordHash: true } }),
    prisma.passkey.findMany({ where: { userId }, select: { id: true, transports: true } }),
  ]);
  if (existing.length >= MAX_PASSKEYS) {
    return { error: `An account can have ${MAX_PASSKEYS} passkeys. Remove one to add another.` } as const;
  }
  if (typeof password !== "string" || !password) return { error: "Enter your password first." } as const;
  // bcrypt reads at most 72 bytes; a longer string is no password of ours.
  if (password.length > 1000) return { error: "Current password is incorrect" } as const;
  const verified = await checkPassword(user, password);
  if ("error" in verified) return { error: verified.error } as const;
  return {
    options: {
      challenge: issueChallenge("register", userId),
      rp: { name: "MyReads", id: site.rpId },
      user: { id: userHandle(userId), name: user.username, displayName: user.username },
      pubKeyCredParams: PASSKEY_ALGORITHMS.map((alg) => ({ type: "public-key" as const, alg })),
      timeout: 5 * 60_000,
      attestation: "none" as const,
      authenticatorSelection: {
        residentKey: "required" as const,
        requireResidentKey: true,
        // The device checks it's you (fingerprint, face, PIN or screen
        // lock), not only that someone touched it: lib/webauthn.ts refuses
        // a passkey made or used without that.
        userVerification: "required" as const,
      },
      // Don't make a second one on a device that already has one.
      excludeCredentials: existing.map((p) => ({ type: "public-key" as const, id: p.id, transports: p.transports })),
    },
  } as const;
}

const registrationSchema = z.object({
  id: z.string().min(1).max(1400),
  clientDataJSON: z.string().min(1).max(8000),
  attestationObject: z.string().min(1).max(20000),
  transports: z.array(z.string().max(20)).max(8).optional(),
});

/** Keeps a passkey the browser just made, once it checks out. */
export async function addPasskey(raw: unknown): Promise<{ error?: string; name?: string }> {
  const userId = await requireUserId();
  const h = await headers();
  const site = expectedSite(h);
  const parsed = registrationSchema.safeParse(raw);
  if (!site || !parsed.success) return { error: NOT_HERE };
  try {
    const made = verifyRegistration(parsed.data, site);
    if (!takeChallenge(made.challenge, "register", userId)) {
      return { error: "That took too long. Try adding it again." };
    }
    if ((await prisma.passkey.count({ where: { userId } })) >= MAX_PASSKEYS) {
      return { error: `An account can have ${MAX_PASSKEYS} passkeys.` };
    }
    const taken = await prisma.passkey.findUnique({ where: { id: made.id }, select: { userId: true } });
    if (taken) return { error: taken.userId === userId ? "That passkey is already here." : NOT_HERE };
    const name = passkeyName(made.aaguid, h.get("user-agent"));
    await prisma.passkey.create({
      data: {
        id: made.id,
        userId,
        publicKey: made.publicKey,
        algorithm: made.algorithm,
        signCount: made.signCount,
        transports: parsed.data.transports ?? [],
        name,
      },
    });
    revalidatePath("/account");
    return { name };
  } catch (e) {
    if (e instanceof WebAuthnError) return { error: "That passkey couldn’t be checked, so it wasn’t added." };
    throw e;
  }
}

const idSchema = z.string().min(1).max(1400);
const nameSchema = z.string().trim().min(1, "Give it a name").max(60, "Keep the name under 60 characters");

/** Renames one of the account's passkeys. */
export async function renamePasskey(id: unknown, name: unknown): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const pid = idSchema.safeParse(id);
  const pname = nameSchema.safeParse(name);
  if (!pid.success) return { error: "That passkey is gone." };
  if (!pname.success) return { error: pname.error.issues[0]?.message ?? "Give it a name" };
  const { count } = await prisma.passkey.updateMany({ where: { id: pid.data, userId }, data: { name: pname.data } });
  revalidatePath("/account");
  return count ? {} : { error: "That passkey is gone." };
}

/** Removes one of the account's passkeys: it no longer signs in here. */
export async function removePasskey(id: unknown): Promise<void> {
  const userId = await requireUserId();
  const pid = idSchema.safeParse(id);
  if (!pid.success) return;
  await prisma.passkey.deleteMany({ where: { id: pid.data, userId } });
  revalidatePath("/account");
}

/** What a browser needs to sign in with a passkey (no account yet). */
export async function passkeySignInOptions() {
  const h = await headers();
  const site = expectedSite(h);
  if (!site) return { error: NOT_HERE } as const;
  // An address with too many failed sign-ins is turned away here too.
  const ip = clientIp(h);
  if (loginLimiter.blocked(`login:ip:${ip}`)) {
    return { error: "Too many failed attempts — wait a few minutes and try again." } as const;
  }
  // Asking costs the server a challenge kept for five minutes, so asks are
  // counted too: a flood from one address can't push out everyone else's.
  const askKey = `passkey-ask:${ip}`;
  if (passkeyAskLimiter.blocked(askKey)) {
    return { error: "Too many tries — wait a minute and try again." } as const;
  }
  passkeyAskLimiter.hit(askKey);
  return {
    options: {
      challenge: issueChallenge("sign-in"),
      rpId: site.rpId,
      timeout: 5 * 60_000,
      userVerification: "required" as const,
    },
  } as const;
}

/**
 * Signs out every other browser and phone signed in to this account, and
 * keeps this one signed in: the account's sessions all end (tokenVersion,
 * as a password change does), and this one is moved onto the new version.
 */
export async function signOutEverywhereElse(): Promise<{ error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  const { tokenVersion } = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  const proof = keepSessionProof(userId, tokenVersion);
  // Without AUTH_SECRET there's no proof to make: this one goes too.
  if (!proof) await signOut({ redirectTo: "/login" });
  await unstable_update({ keepSession: proof } as never);
  return {};
}
