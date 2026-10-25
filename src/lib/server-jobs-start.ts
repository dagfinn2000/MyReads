import { backupEnvProblems, serverBackupConfig } from "@/lib/server-backups";
import { registerServerJob, startServerJobs } from "@/lib/server-jobs";

/**
 * Registers each job whose setting turns it on, and starts the timer if
 * there is at least one; called from instrumentation.ts. A later job
 * (reading reminders, say) reads its own setting here and joins the same
 * timer. A job's own code is only loaded once it's on.
 */
export async function startServerJobsFromEnv(): Promise<void> {
  const backups = serverBackupConfig();
  if (!backups) return;

  const { serverBackupJob } = await import("@/lib/server-backups-run");
  registerServerJob(serverBackupJob(backups));
  if (!startServerJobs()) return; // already running: a hot reload

  for (const problem of backupEnvProblems()) console.warn(`[myreads] ${problem}`);
  console.log(
    `[myreads] nightly backups on: ${backups.dir}, at ${backups.hour}:00 server time, ` +
      `keeping ${backups.keep} per account`,
  );
}
