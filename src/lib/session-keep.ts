import crypto from "node:crypto";

/**
 * "Sign out everywhere else" bumps the account's tokenVersion, which ends
 * every session, and then moves this one session onto the new version
 * (lib/actions/passkeys.ts, through Auth.js's session update). An update can
 * also be asked for by anyone holding a session cookie, so the move carries
 * a short-lived proof signed with AUTH_SECRET that only the server can make:
 * a stolen cookie can't move itself along.
 */

const LIFETIME_MS = 60_000;

function sign(text: string): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(`keep-session:${text}`).digest("base64url");
}

/** A proof that lets this account's session move to `version`. */
export function keepSessionProof(userId: string, version: number, now = Date.now()): string | null {
  const text = `${userId}.${version}.${now + LIFETIME_MS}`;
  const sig = sign(text);
  return sig ? `${text}.${sig}` : null;
}

/** The version a proof moves this account's session to, or null. */
export function keptVersion(proof: unknown, userId: string, now = Date.now()): number | null {
  if (typeof proof !== "string" || proof.length > 400) return null;
  const cut = proof.lastIndexOf(".");
  const text = proof.slice(0, cut);
  const expected = cut > 0 ? sign(text) : null;
  if (!expected) return null;
  const given = Buffer.from(proof.slice(cut + 1));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, Buffer.from(expected))) return null;
  const [id, version, expires] = text.split(".");
  if (id !== userId || !(Number(expires) > now)) return null;
  const v = Number(version);
  return Number.isInteger(v) && v >= 0 ? v : null;
}
