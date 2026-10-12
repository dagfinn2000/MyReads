import { cookies } from "next/headers";
import { getCurrentUser, getPreferences } from "@/lib/current-user";
import { BACKUP_SNOOZE_COOKIE, backupReminderMessage } from "@/lib/backup";
import { BackupReminderNotice } from "@/components/backup-reminder-notice";

/**
 * The monthly "time for a backup" note, rendered by the app shell. Whether
 * it's due is settled here on the server (reminder on, last download a
 * month or more ago, not snoozed by this account), so there's no flash and
 * no extra query: the user row is the request's cached one.
 */
export async function BackupReminder() {
  const [user, prefs, jar] = await Promise.all([getCurrentUser(), getPreferences(), cookies()]);
  if (!user) return null;
  const message = backupReminderMessage({
    reminder: prefs.backupReminder,
    lastBackupAt: user.lastBackupAt,
    snoozedBy: jar.get(BACKUP_SNOOZE_COOKIE)?.value,
    userId: user.id,
    now: new Date(),
    prefs,
  });
  if (!message) return null;
  return (
    <BackupReminderNotice
      message={message}
      lastBackupAt={user.lastBackupAt?.toISOString() ?? null}
    />
  );
}
