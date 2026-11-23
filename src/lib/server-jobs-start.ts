import { mailConfig, mailEnvProblems } from "@/lib/mail";
import { remindersEnabled } from "@/lib/reminders";
import { backupEnvProblems, serverBackupConfig } from "@/lib/server-backups";
import { registerServerJob, startServerJobs } from "@/lib/server-jobs";

/**
 * Registers each job whose setting turns it on, and starts the timer;
 * called from instrumentation.ts. Recently deleted's hourly sweep always
 * runs. Nightly backups are on with BACKUP_DIR set, reading reminders
 * unless READING_REMINDERS is off, and the monthly email with SMTP_HOST
 * set. A job's own code is only loaded once it's on.
 */
export async function startServerJobsFromEnv(): Promise<void> {
  const backups = serverBackupConfig();
  const reminders = remindersEnabled();
  const mail = mailConfig();

  const { recentlyDeletedJob } = await import("@/lib/recently-deleted");
  registerServerJob(recentlyDeletedJob());
  if (backups) {
    const { serverBackupJob } = await import("@/lib/server-backups-run");
    registerServerJob(serverBackupJob(backups));
  }
  if (reminders) {
    const { readingReminderJob } = await import("@/lib/reminders-run");
    registerServerJob(readingReminderJob());
  }
  if (mail) {
    const { monthlyEmailJob } = await import("@/lib/monthly-email-run");
    registerServerJob(monthlyEmailJob());
  }
  if (!startServerJobs()) return; // already running: a hot reload

  if (backups) {
    for (const problem of backupEnvProblems()) console.warn(`[myreads] ${problem}`);
    console.log(
      `[myreads] nightly backups on: ${backups.dir}, at ${backups.hour}:00 server time, ` +
        `keeping ${backups.keep} per account`,
    );
  }

  for (const problem of mailEnvProblems()) console.warn(`[myreads] ${problem}`);
  if (mail) console.log(`[myreads] email on: monthly emails go out through ${mail.host}:${mail.port}`);
}
