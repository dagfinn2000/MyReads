import { afterEach, describe, expect, it, vi } from "vitest";
import {
  jobDue,
  registerServerJob,
  startServerJobs,
  stopServerJobs,
  tickServerJobs,
  type ServerJob,
} from "@/lib/server-jobs";

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 20, 3, 0);

afterEach(() => {
  stopServerJobs();
  vi.restoreAllMocks();
});

/** A job that records each time it was run. */
function recorder(name: string, everyMinutes: number, run?: () => Promise<void>) {
  const runs: number[] = [];
  const job: ServerJob = {
    name,
    everyMinutes,
    async run(now) {
      runs.push(now.getTime());
      await run?.();
    },
  };
  return { job, runs };
}

describe("jobDue", () => {
  it("is due at once, then once its interval is up", () => {
    expect(jobDue({ lastStart: 0, running: false }, 15, T0)).toBe(true);
    expect(jobDue({ lastStart: T0, running: false }, 15, T0 + 14 * MIN)).toBe(false);
    expect(jobDue({ lastStart: T0, running: false }, 15, T0 + 15 * MIN)).toBe(true);
  });

  it("allows a tick that comes a little early", () => {
    expect(jobDue({ lastStart: T0, running: false }, 15, T0 + 15 * MIN - 5)).toBe(true);
  });

  it("is never due while the last run is still going", () => {
    expect(jobDue({ lastStart: T0, running: true }, 15, T0 + 60 * MIN)).toBe(false);
  });

  it("looks at a job at most once a minute", () => {
    expect(jobDue({ lastStart: T0, running: false }, 0, T0 + 10_000)).toBe(false);
    expect(jobDue({ lastStart: T0, running: false }, Number.NaN, T0 + MIN)).toBe(true);
  });
});

describe("tickServerJobs", () => {
  it("runs each job on its own interval", async () => {
    const backup = recorder("backup", 15);
    const reminder = recorder("reminder", 5);
    registerServerJob(backup.job);
    registerServerJob(reminder.job);

    for (let m = 0; m <= 30; m++) await Promise.all(tickServerJobs(T0 + m * MIN));
    expect(backup.runs).toEqual([T0, T0 + 15 * MIN, T0 + 30 * MIN]);
    expect(reminder.runs).toHaveLength(7); // 0, 5, ..., 30
  });

  it("doesn't start a job again while it is still running", async () => {
    let finish!: () => void;
    const held = new Promise<void>((resolve) => (finish = resolve));
    // The first run waits until it's let go; later ones end at once.
    const slow = recorder("slow", 1, () => (slow.runs.length === 1 ? held : Promise.resolve()));
    registerServerJob(slow.job);

    const first = tickServerJobs(T0);
    await vi.waitFor(() => expect(slow.runs).toHaveLength(1));
    expect(tickServerJobs(T0 + 5 * MIN)).toEqual([]);
    finish();
    await Promise.all(first);
    await Promise.all(tickServerJobs(T0 + 6 * MIN));
    expect(slow.runs).toEqual([T0, T0 + 6 * MIN]);
  });

  it("keeps one job's error from the others, and tries it again later", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const broken: ServerJob = {
      name: "broken",
      everyMinutes: 1,
      run() {
        calls++;
        throw new Error("disk full");
      },
    };
    const fine = recorder("fine", 1);
    registerServerJob(broken);
    registerServerJob(fine.job);

    await Promise.all(tickServerJobs(T0));
    await Promise.all(tickServerJobs(T0 + MIN));
    expect(calls).toBe(2);
    expect(fine.runs).toHaveLength(2);
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0][0])).toContain("broken");
  });

  it("replaces a job registered again under its name, keeping its clock", async () => {
    const first = recorder("backup", 15);
    registerServerJob(first.job);
    await Promise.all(tickServerJobs(T0));

    // A hot reload registers a fresh copy of the same job.
    const second = recorder("backup", 15);
    registerServerJob(second.job);
    await Promise.all(tickServerJobs(T0 + MIN));
    await Promise.all(tickServerJobs(T0 + 15 * MIN));
    expect(first.runs).toEqual([T0]);
    expect(second.runs).toEqual([T0 + 15 * MIN]);
  });
});

describe("startServerJobs", () => {
  it("starts one timer however often it's called", () => {
    const setInterval = vi.spyOn(globalThis, "setInterval");
    expect(startServerJobs()).toBe(true);
    expect(startServerJobs()).toBe(false);
    expect(setInterval).toHaveBeenCalledTimes(1);
  });

  it("ticks once a minute", async () => {
    vi.useFakeTimers({ now: T0 });
    try {
      const job = recorder("job", 1);
      registerServerJob(job.job);
      startServerJobs();
      expect(job.runs).toEqual([]); // nothing at start-up itself
      await vi.advanceTimersByTimeAsync(3 * MIN);
      expect(job.runs).toEqual([T0 + MIN, T0 + 2 * MIN, T0 + 3 * MIN]);
    } finally {
      vi.useRealTimers();
    }
  });
});
