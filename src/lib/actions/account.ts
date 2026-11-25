"use server";

import bcrypt from "bcryptjs";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteCachedCovers } from "@/lib/covers";
import { checkPassword } from "@/lib/password-check";
import { removeServerBackups } from "@/lib/server-backups-run";
import { changePasswordSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/helpers";

/**
 * Account-level actions. Both re-verify the current password — a session
 * cookie proves you're signed in, not that you're the account owner sitting
 * at an unlocked machine (lib/password-check.ts, which shares the sign-in
 * limiter's per-username budget).
 */

/** The signed-in user, fetched fresh (not from the JWT). */
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("Not authenticated");
  return user;
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

  const verified = await checkPassword(user, parsed.data.currentPassword);
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
 * cover files and the server's nightly copies of the library don't live in
 * Postgres, so they're cleaned up once it has gone. Signs out afterwards —
 * with JWT sessions there's no server-side session row, and a cookie for a
 * deleted user must not linger looking signed-in.
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
  const verified = await checkPassword(user, password);
  if ("error" in verified) return verified;

  // Collect the cover paths *before* the delete (the rows are about to go),
  // but unlink the files only once the database delete has actually landed.
  // The other order loses your images to a failed delete, leaving a library
  // that still lists every book with a broken cover — the same trap
  // updateBook already avoids when it replaces a cover.
  // Books in Recently deleted still hold their covers too.
  const books = [
    ...(await prisma.book.findMany({ where: { userId: user.id }, select: { coverUrl: true } })),
    ...(await prisma.deletedBook.findMany({ where: { userId: user.id }, select: { coverUrl: true } })),
  ];

  await prisma.user.delete({ where: { id: user.id } });

  // One look at which covers are still in use, not one search of every
  // book in the instance per cover (tolerates already-missing files).
  await deleteCachedCovers(books.map((b) => b.coverUrl));
  await removeServerBackups(user.id);

  // Throws Next's redirect to /login — never returns.
  await signOut({ redirectTo: "/login" });
  return { success: true };
}
