"use server";

import bcrypt from "bcryptjs";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteCachedCover } from "@/lib/covers";
import { loginLimiter } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/helpers";

/**
 * Account-level actions. Both re-verify the current password — a session
 * cookie proves you're signed in, not that you're the account owner sitting
 * at an unlocked machine. The verification shares the login limiter's
 * per-username budget, so these forms aren't a rate-limit-free side door
 * for password guessing.
 */

/** The signed-in user, fetched fresh (not from the JWT). */
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("Not authenticated");
  return user;
}

/** Rate-limited bcrypt check of the account password. Same keying as the
 *  login throttle in auth.ts, so failures here and there pool together. */
async function verifyPassword(
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

/**
 * Change the account password (current password required).
 *
 * Bumps `tokenVersion` in the same write, which invalidates every JWT issued
 * against the old password — the point of changing it after a suspected
 * compromise is that the other party loses access, and with JWT sessions
 * there is no session row to delete. That necessarily includes the session
 * doing the changing, so this signs out and sends you back to /login to sign
 * in with the new password.
 */
export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const verified = await verifyPassword(user, parsed.data.currentPassword);
  if ("error" in verified) return verified;

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  // Throws Next's redirect — never returns.
  await signOut({ redirectTo: "/login?changed=1" });
  return { success: true };
}

/**
 * Delete the account and everything in it. The database rows cascade from
 * the User delete (books → quotes/reads/progress, shelves, goals); cached
 * cover files don't live in Postgres, so they're cleaned up first. Signs
 * out afterwards — with JWT sessions there's no server-side session row,
 * and a cookie for a deleted user must not linger looking signed-in.
 */
export async function deleteAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const password = formData.get("password");
  if (typeof password !== "string" || !password) {
    return { error: "Enter your password to confirm" };
  }
  const verified = await verifyPassword(user, password);
  if ("error" in verified) return verified;

  // Collect the cover paths *before* the delete (the rows are about to go),
  // but unlink the files only once the database delete has actually landed.
  // The other order loses your images to a failed delete, leaving a library
  // that still lists every book with a broken cover — the same trap
  // updateBook already avoids when it replaces a cover.
  const books = await prisma.book.findMany({
    where: { userId: user.id },
    select: { coverUrl: true },
  });

  await prisma.user.delete({ where: { id: user.id } });

  for (const b of books) {
    await deleteCachedCover(b.coverUrl); // tolerates already-missing files
  }

  // Throws Next's redirect to /login — never returns.
  await signOut({ redirectTo: "/login" });
  return { success: true };
}
