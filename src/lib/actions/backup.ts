"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { BACKUP_SNOOZE_COOKIE, BACKUP_SNOOZE_DAYS } from "@/lib/backup";

/** When the signed-in account last downloaded a backup (ISO), or null.
 *  Polled by the Download backup button until the new date lands. */
export async function getLastBackupAt(): Promise<string | null> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastBackupAt: true },
  });
  return user?.lastBackupAt?.toISOString() ?? null;
}

/**
 * "Not now" on the backup reminder: hides it in this browser for a week.
 * Setting a cookie in a Server Action re-renders the current page and its
 * layouts, so the reminder goes in the same round trip.
 */
export async function snoozeBackupReminder(): Promise<void> {
  const userId = await requireUserId();
  (await cookies()).set(BACKUP_SNOOZE_COOKIE, userId, {
    maxAge: BACKUP_SNOOZE_DAYS * 86_400,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
}
