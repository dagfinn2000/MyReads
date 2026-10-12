import { calendarDay, dayKey, keyToUtcDate } from "@/lib/dates";
import { formatDate, formatNumber, type FormatPrefs } from "@/lib/display";
import type { BackupReminder } from "@/lib/preferences";

/**
 * When the last backup was downloaded, and the optional monthly reminder.
 * The date is User.lastBackupAt, set by the export route once a zip has
 * gone out in full. Accounts that downloaded backups before that column
 * existed have no date on record, so the wording never claims "never".
 */

/** A backup counts as due this long after the last download. */
export const BACKUP_DUE_DAYS = 30;

/** "Not now" on the reminder hides it this long, in this browser. The
 *  cookie holds the account's id, so another account signed in on the same
 *  browser still sees its own reminder. */
export const BACKUP_SNOOZE_COOKIE = "myreads-backup-snooze";
export const BACKUP_SNOOZE_DAYS = 7;

const DAY_MS = 86_400_000;

/** No download on record, or the last one is BACKUP_DUE_DAYS (in whole
 *  days of 24 hours) or more ago. A date in the future is not due. */
export function isBackupDue(last: Date | null, now: Date): boolean {
  if (!last) return true;
  return now.getTime() - last.getTime() >= BACKUP_DUE_DAYS * DAY_MS;
}

/** Calendar days from the last download to today in the reader's zone.
 *  The download's day is read the same way the date beside it is shown
 *  (calendarDay), so "today" and the date always agree. Never negative. */
export function backupAgeDays(last: Date, now: Date, timeZone?: string): number {
  const days = Math.round(
    (keyToUtcDate(dayKey(now, timeZone)).getTime() -
      keyToUtcDate(calendarDay(last, timeZone)).getTime()) /
      DAY_MS,
  );
  return Math.max(0, days);
}

/** "today", "yesterday" or "42 days ago". */
export function backupAgeText(days: number, prefs?: FormatPrefs): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${formatNumber(days, prefs)} days ago`;
}

/** The line on the Backup card. */
export function backupStatusText(last: Date | null, now: Date, prefs: FormatPrefs): string {
  if (!last) return "No download on record yet";
  const age = backupAgeText(backupAgeDays(last, now, prefs.timeZone), prefs);
  return `Last downloaded ${formatDate(last, prefs)} · ${age}`;
}

/** What the reminder says. */
export function backupReminderText(last: Date | null, now: Date, prefs: FormatPrefs): string {
  if (!last) return "No backup download on record yet.";
  return `Your last backup was ${backupAgeText(backupAgeDays(last, now, prefs.timeZone), prefs)}.`;
}

/**
 * The reminder to show, or null: only with the reminder on, a backup due,
 * and no "Not now" from this same account in this browser.
 */
export function backupReminderMessage(o: {
  reminder: BackupReminder;
  lastBackupAt: Date | null;
  /** The snooze cookie's value: the id of the account that snoozed. */
  snoozedBy: string | undefined;
  userId: string;
  now: Date;
  prefs: FormatPrefs;
}): string | null {
  if (o.reminder !== "monthly") return null;
  if (!isBackupDue(o.lastBackupAt, o.now)) return null;
  if (o.snoozedBy === o.userId) return null;
  return backupReminderText(o.lastBackupAt, o.now, o.prefs);
}
