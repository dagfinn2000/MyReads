import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { expectedSite, takeChallenge } from "@/lib/passkeys";
import { WebAuthnError, userHandle, verifyAssertion } from "@/lib/webauthn";

/**
 * Signing in with a passkey: the "passkey" provider's authorize in auth.ts.
 * The browser's answer comes as one JSON string; it must answer a challenge
 * this server gave for signing in, be signed by a passkey kept here, and
 * come from this site. Returns the account, or null.
 */

const assertionSchema = z.object({
  id: z.string().min(1).max(1400),
  clientDataJSON: z.string().min(1).max(8000),
  authenticatorData: z.string().min(1).max(8000),
  signature: z.string().min(1).max(4000),
  userHandle: z.string().max(200).nullish(),
});

export async function passkeySignIn(
  response: unknown,
  headers: Headers,
): Promise<{ id: string; username: string; tokenVersion: number } | null> {
  const site = expectedSite(headers);
  if (!site || typeof response !== "string" || response.length > 24000) return null;
  let parsed;
  try {
    parsed = assertionSchema.safeParse(JSON.parse(response));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  const res = parsed.data;

  const passkey = await prisma.passkey.findUnique({
    where: { id: res.id },
    select: {
      id: true,
      publicKey: true,
      algorithm: true,
      signCount: true,
      user: { select: { id: true, username: true, tokenVersion: true } },
    },
  });
  if (!passkey) return null;

  let checked;
  try {
    checked = verifyAssertion(
      res,
      {
        publicKey: passkey.publicKey,
        algorithm: passkey.algorithm,
        signCount: Number(passkey.signCount),
        userHandle: userHandle(passkey.user.id),
      },
      site,
    );
  } catch (e) {
    if (e instanceof WebAuthnError) return null;
    throw e;
  }
  // Used once, and only one given for signing in.
  if (!takeChallenge(checked.challenge, "sign-in")) return null;

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { signCount: checked.signCount, lastUsedAt: new Date() },
  });
  return passkey.user;
}
