import bcrypt from "bcryptjs";
import { loginLimiter } from "@/lib/rate-limit";

/**
 * Rate-limited bcrypt check of an account's password, for the things a
 * signed-in session alone mustn't be enough for (changing the password,
 * deleting the account, adding a passkey): a session cookie proves someone
 * is signed in, not that it's the account's owner at an unlocked machine.
 * Keyed like the sign-in throttle in auth.ts, so failures here and there
 * pool together and these forms aren't a side door for guessing.
 */
export async function checkPassword(
  user: { username: string; passwordHash: string },
  password: string,
): Promise<{ error: string } | { ok: true }> {
  const key = `login:u:${user.username}`;
  if (loginLimiter.blocked(key)) {
    return { error: "Too many failed attempts — wait a few minutes and try again." };
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    loginLimiter.hit(key);
    return { error: "Current password is incorrect" };
  }
  loginLimiter.clear(key);
  return { ok: true };
}
