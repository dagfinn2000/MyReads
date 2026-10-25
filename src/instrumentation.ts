import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Runs once when the server starts (Next's instrumentation hook), to start
 * the server's own timer for the jobs that are turned on: the nightly
 * backup (BACKUP_DIR) and reading reminders (on unless READING_REMINDERS
 * is off). With none on, no timer runs and no job's code is loaded.
 *
 * Only on the Node.js runtime, where the jobs' file and database access
 * work, and not while `next build` prerenders pages, which can load this
 * hook too. The import sits inside the runtime check, as in Next's guide,
 * so the build for the Edge runtime leaves the jobs out.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
    const { startServerJobsFromEnv } = await import("@/lib/server-jobs-start");
    await startServerJobsFromEnv();
  }
}
