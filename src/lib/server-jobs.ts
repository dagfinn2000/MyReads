/**
 * Work the app server does on its own, on a clock: one timer for every
 * job, started from instrumentation.ts when there is at least one to run.
 *
 * The timer ticks once a minute and each job says how often it wants to be
 * looked at (the nightly backup every 15 minutes; a reminder could ask for
 * every 5). A job decides for itself whether there's anything to do yet,
 * so the timer only has to keep time, keep a slow job from running twice
 * at once, and keep one job's error from reaching the others or the
 * server.
 *
 * The state lives on globalThis: in development a hot reload evaluates
 * this module again, and a second timer would run every job twice.
 */

export interface ServerJob {
  /** Names the job in the logs. Registering a name again replaces the
   *  job, so a reloaded module doesn't add a second copy. */
  name: string;
  /** How often to look at the job, in minutes (whole, at least 1). */
  everyMinutes: number;
  /** Does the job's work, or finds there's none yet. */
  run(now: Date): Promise<void>;
}

interface JobState {
  job: ServerJob;
  /** When the job was last started (ms), 0 before its first run. */
  lastStart: number;
  running: boolean;
}

const TICK_MS = 60_000;

const store = globalThis as unknown as {
  __myreadsServerJobs?: { jobs: Map<string, JobState>; timer: ReturnType<typeof setInterval> | null };
};
const state = (store.__myreadsServerJobs ??= { jobs: new Map(), timer: null });

/** Adds a job to the timer (or replaces the one with its name). It first
 *  runs at the timer's next tick. */
export function registerServerJob(job: ServerJob): void {
  // Swapped in place, so a run that is still going clears the same
  // `running` flag the replacement is checked against.
  const existing = state.jobs.get(job.name);
  if (existing) existing.job = job;
  else state.jobs.set(job.name, { job, lastStart: 0, running: false });
}

/**
 * Starts the timer, once per server process however often it's called;
 * true when this call started it. The first tick comes a minute after
 * start, so starting up is never held up by a job. The timer doesn't keep
 * the process alive by itself.
 */
export function startServerJobs(): boolean {
  if (state.timer) return false;
  state.timer = setInterval(() => tickServerJobs(Date.now()), TICK_MS);
  state.timer.unref?.();
  return true;
}

/** Stops the timer and forgets every job. For the tests. */
export function stopServerJobs(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  state.jobs.clear();
}

/**
 * Whether a job is due a look at `now`: not still busy with its last run,
 * and its interval up since that run started. Half a tick early counts:
 * a tick that fires a few milliseconds sooner after the last than the one
 * before it mustn't push a 15-minute job to 16.
 */
export function jobDue(
  s: Pick<JobState, "lastStart" | "running">,
  everyMinutes: number,
  now: number,
): boolean {
  if (s.running) return false;
  const every = Math.max(1, Math.round(everyMinutes) || 1) * TICK_MS;
  return now - s.lastStart >= every - TICK_MS / 2;
}

/**
 * One tick: starts every job that is due, without waiting for any of them.
 * A job that throws, or rejects, is logged and tried again at its next
 * interval. Exported for the tests, which drive the clock themselves.
 */
export function tickServerJobs(now: number): Promise<void>[] {
  const started: Promise<void>[] = [];
  for (const s of state.jobs.values()) {
    if (!jobDue(s, s.job.everyMinutes, now)) continue;
    s.lastStart = now;
    s.running = true;
    started.push(
      Promise.resolve()
        .then(() => s.job.run(new Date(now)))
        .catch((err: unknown) => {
          console.error(`[myreads] ${s.job.name} failed:`, err);
        })
        .finally(() => {
          s.running = false;
        }),
    );
  }
  return started;
}
