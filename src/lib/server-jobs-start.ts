import { remindersEnabled } from "@/lib/reminders";
import { backupEnvProblems, serverBackupConfig } from "@/lib/server-backups";
import { registerServerJob, startServerJobs } from "@/lib/server-jobs";

/**
 * Registers each job whose setting turns it on, and starts the timer if
 * there is at least one; called from instrumentation.ts. Nightly backups
 * are on with BACKUP_DIR set, reading reminders unless READING_REMINDERS
 * is off. A job's own code is only loaded once it's on.
 */
export async function startServerJobsFromEnv(): Promise<void> {
  const backups = serverBackupConfig();
  const reminders = remindersEnabled();
  if (!backups && !reminders) return;

  if (backups) {
    const { serverBackupJob } = await import("@/lib/server-backups-run");
    registerServerJob(serverBackupJob(backups));
  }
  if (reminders) {
    const { readingReminderJob } = await import("@/lib/reminders-run");
    registerServerJob(readingReminderJob());
  }
  if (!startServerJobs()) return; // already running: a hot reload

  if (backups) {
    for (const problem of backupEnvProblems()) console.warn(`[myreads] ${problem}`);
    console.log(
      `[myreads] nightly backups on: ${backups.dir}, at ${backups.hour}:00 server time, ` +
        `keeping ${backups.keep} per account`,
    );
  }
}
