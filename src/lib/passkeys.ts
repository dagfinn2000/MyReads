import crypto from "node:crypto";
import { deviceLabel } from "@/lib/reminders";
import type { Expected } from "@/lib/webauthn";

/**
 * Passkeys on the server, around lib/webauthn.ts: the one-time challenges a
 * browser signs, where this site expects passkeys from, and a name for a
 * new one.
 */

/** A passkey asked for (made or used) has this long to answer. */
export const CHALLENGE_MS = 5 * 60_000;
/** At most this many challenges wait at once; older ones are dropped. */
const MAX_WAITING = 2000;
/** How many passkeys one account can have. */
export const MAX_PASSKEYS = 20;

interface Waiting {
  purpose: "register" | "sign-in";
  userId: string | null;
  expires: number;
}

// One Node process serves MyReads (as for lib/rate-limit.ts), so a Map is
// enough; hung on globalThis so a development reload keeps it.
const globalForPasskeys = globalThis as unknown as { passkeyChallenges?: Map<string, Waiting> };
const waiting = (globalForPasskeys.passkeyChallenges ??= new Map());

/** A new challenge for making a passkey (with the account) or signing in. */
export function issueChallenge(purpose: Waiting["purpose"], userId: string | null = null): string {
  const now = Date.now();
  for (const [key, w] of waiting) {
    if (w.expires <= now || waiting.size >= MAX_WAITING) waiting.delete(key);
    else break; // in order of issue, so the rest are newer
  }
  const challenge = crypto.randomBytes(32).toString("base64url");
  waiting.set(challenge, { purpose, userId, expires: now + CHALLENGE_MS });
  return challenge;
}

/** True, once, for a challenge this server gave for this purpose (and
 *  account) that hasn't run out. */
export function takeChallenge(challenge: string, purpose: Waiting["purpose"], userId: string | null = null): boolean {
  const w = waiting.get(challenge);
  if (!w) return false;
  waiting.delete(challenge);
  return w.purpose === purpose && w.userId === userId && w.expires > Date.now();
}

/**
 * The origin pages are served from and the site's name for passkeys: from
 * AUTH_URL when it's set, otherwise from the request as the reverse proxy
 * passed it on (the same trust Auth.js gives it with AUTH_TRUST_HOST).
 */
export function expectedSite(headers: Headers): Expected | null {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  let origin: string | null = null;
  if (configured) {
    try {
      origin = new URL(configured).origin;
    } catch {
      origin = null;
    }
  }
  if (!origin) {
    const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
    const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    if (!host) return null;
    try {
      origin = new URL(`${proto}://${host}`).origin;
    } catch {
      return null;
    }
  }
  return { origin, rpId: new URL(origin).hostname };
}

/** Well-known passkey keepers, by the AAGUID they make passkeys with. */
const KEEPERS: Record<string, string> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "iCloud Keychain",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "iCloud Keychain",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "Chrome on Mac",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
  "531126d6-e717-415c-9320-3d9aa6981239": "Dashlane",
  "50726f74-6f6e-5061-7373-50726f746f6e": "Proton Pass",
  "fdb141b2-5d84-443e-8a35-4698c205a502": "KeePassXC",
  "53414d53-554e-4700-0000-000000000000": "Samsung Pass",
};

/** A name for a new passkey: what keeps it when that's known, otherwise
 *  the browser and system it was made on. */
export function passkeyName(aaguid: string, userAgent: string | null): string {
  return KEEPERS[aaguid.toLowerCase()] ?? deviceLabel(userAgent);
}
