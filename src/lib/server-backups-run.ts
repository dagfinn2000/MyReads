import { constants as fsConstants } from "node:fs";
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { buildBackupZip, type BackupZip } from "@/lib/backup-zip";
import { dayKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  PARTIAL_BACKUP_NAME,
  backupFileDay,
  backupFileName,
  backupRunDue,
  backupsToDelete,
  isBackupFileName,
  isSafeAccountId,
  serverBackupConfig,
  type ServerBackupConfig,
} from "@/lib/server-backups";
import type { ServerJob } from "@/lib/server-jobs";

/**
 * The nightly backups' work on disk: writing each account's copy, keeping
 * only the newest few, listing them for the Backup card, opening one to
 * download, and removing them with the account. The rules these follow
 * are in server-backups.ts.
 */

/**
 * An account's folder of copies. Every path here goes through this, so
 * the build's file tracer is told once that they are only known at run
 * time (see coverFilePath), and an id that could step out of BACKUP_DIR,
 * or name BACKUP_DIR itself, is refused before any path is made from it.
 */
function accountDir(config: ServerBackupConfig, userId: string): string {
  if (!isSafeAccountId(userId)) throw new Error("Not an account id");
  return path.join(/* turbopackIgnore: true */ path.resolve(config.dir), userId);
}

/** A partial file nobody has written to for this long was left by a run
 *  that died part-way (a restart mid-write): a live one is written to all
 *  the time. */
const STALE_PARTIAL_MS = 60 * 60_000;

/** A JSZip stream as a Node stream, so pipeline() can write it to a file
 *  with backpressure: the zip is made only as fast as the disk takes it. */
function zipReadable(zip: BackupZip["stream"]): Readable {
  const out = new Readable({
    read() {
      zip.resume();
    },
  });
  zip
    .on("data", (chunk: Uint8Array) => {
      if (!out.push(chunk)) zip.pause();
    })
    .on("error", (err: Error) => out.destroy(err))
    .on("end", () => out.push(null));
  return out;
}

/**
 * Creates the partial file for writing, only if no one else has it: two
 * writers on one file would rename a zip into place while the other was
 * still writing into it. One left behind by a run that died is taken over.
 */
async function openPartial(partial: string): Promise<FileHandle> {
  try {
    return await fs.open(partial, "wx", 0o600);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
  const { mtimeMs } = await fs.stat(partial);
  if (Date.now() - mtimeMs < STALE_PARTIAL_MS) {
    throw new Error("another backup of this account is being written");
  }
  await fs.rm(partial, { force: true });
  return fs.open(partial, "wx", 0o600);
}

/**
 * Writes `userId`'s backup zip to `target`: first under the partial name,
 * then, once every byte is on disk, renamed, so a zip under a copy's name
 * is always whole. Readable by the server's own user only: it holds the
 * whole library.
 */
async function writeCopy(userId: string, dir: string, target: string): Promise<void> {
  const partial = path.join(/* turbopackIgnore: true */ dir, PARTIAL_BACKUP_NAME);
  const handle = await openPartial(partial);
  try {
    const { stream } = await buildBackupZip(userId);
    // The stream closes the file when it's done, flushed to the disk
    // first (`flush`), so the rename below never names a zip that is
    // still only in memory. Kept open past the stream instead, the handle
    // would never close: the stream holds on to it.
    await pipeline(zipReadable(stream), handle.createWriteStream({ flush: true }));
  } catch (err) {
    await handle.close().catch(() => {});
    await fs.rm(partial, { force: true }).catch(() => {});
    throw err;
  }
  await fs.rename(partial, target);
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

async function accountExists(userId: string): Promise<boolean> {
  return (await prisma.user.count({ where: { id: userId } })) > 0;
}

/** One account's nightly copy: written, or already there from an earlier
 *  run today, then the oldest past BACKUP_KEEP removed. */
async function backUpAccount(
  config: ServerBackupConfig,
  userId: string,
  day: string,
): Promise<{ written: boolean; pruned: number }> {
  const dir = accountDir(config, userId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const target = path.join(/* turbopackIgnore: true */ dir, backupFileName(day));

  let written = false;
  if (!(await isFile(target))) {
    await writeCopy(userId, dir, target);
    written = true;
    // The account was deleted while its zip was being made, and the folder
    // removed with it before this run made it again: take it away again.
    if (!(await accountExists(userId))) {
      await fs.rm(dir, { recursive: true, force: true });
      return { written: false, pruned: 0 };
    }
  }

  // Only once today's copy is safely there, so a run that keeps failing
  // never thins out the copies that are left. Files only: a folder that
  // happens to carry a copy's name isn't one.
  const files = (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isFile());
  const old = backupsToDelete(files.map((e) => e.name), config.keep);
  for (const name of old) {
    await fs.rm(path.join(/* turbopackIgnore: true */ dir, name), { force: true });
  }
  return { written, pruned: old.length };
}

export interface ServerBackupRun {
  written: number;
  skipped: number;
  failed: number;
  pruned: number;
}

/**
 * Makes today's copy for every account, one account at a time so only one
 * library is ever held in memory. An account whose copy fails is logged
 * and passed over until the next night (or the next start of the server);
 * the rest still get theirs. Throws only if the accounts can't be listed
 * at all, so the run is tried again at the next check.
 */
export async function runServerBackups(
  config: ServerBackupConfig,
  now: Date = new Date(),
): Promise<ServerBackupRun> {
  const day = dayKey(now);
  const users = await prisma.user.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  const run: ServerBackupRun = { written: 0, skipped: 0, failed: 0, pruned: 0 };
  for (const { id } of users) {
    try {
      const { written, pruned } = await backUpAccount(config, id, day);
      if (written) run.written++;
      else run.skipped++;
      run.pruned += pruned;
    } catch (err) {
      run.failed++;
      console.error(`[myreads] nightly backup of account ${id} failed:`, err);
    }
  }
  return run;
}

/** The nightly backup as a job on the server's timer: looked at every 15
 *  minutes, run once a day from BACKUP_HOUR on. */
export function serverBackupJob(config: ServerBackupConfig): ServerJob {
  // The day of the last finished run, server time. Only in memory: after
  // a restart the run happens again, and finds today's copies already
  // there.
  let lastRunDay: string | null = null;
  return {
    name: "nightly backup",
    everyMinutes: 15,
    async run(now) {
      if (!backupRunDue(now, config.hour, lastRunDay)) return;
      const run = await runServerBackups(config, now);
      lastRunDay = dayKey(now);
      console.log(
        `[myreads] nightly backup: ${run.written} saved, ${run.skipped} already there, ` +
          `${run.failed} failed, ${run.pruned} old cop${run.pruned === 1 ? "y" : "ies"} removed`,
      );
    },
  };
}

export interface ServerBackupCopy {
  name: string;
  /** The day it was made, "2026-10-20". */
  day: string;
  bytes: number;
}

/** The account's copies, newest first. None when the folder isn't there
 *  yet, or can't be read (which is logged: the card still shows). */
export async function listServerBackups(
  config: ServerBackupConfig,
  userId: string,
): Promise<ServerBackupCopy[]> {
  try {
    const dir = accountDir(config, userId);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const copies = await Promise.all(
      entries
        .filter((e) => e.isFile() && isBackupFileName(e.name))
        .map(async (e) => {
          const { size } = await fs.stat(path.join(/* turbopackIgnore: true */ dir, e.name));
          return { name: e.name, day: backupFileDay(e.name)!, bytes: size };
        }),
    );
    return copies.sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[myreads] couldn't list the backups of account ${userId}:`, err);
    }
    return [];
  }
}

/**
 * Opens one of the account's copies to download, or null when `name` isn't
 * a copy's name or there's no such file. Only ever looks in the account's
 * own folder, and won't follow a link out of it.
 */
export async function openServerBackup(
  config: ServerBackupConfig,
  userId: string,
  name: string,
): Promise<{ handle: FileHandle; bytes: number } | null> {
  if (!isBackupFileName(name) || !isSafeAccountId(userId)) return null;
  const file = path.join(/* turbopackIgnore: true */ accountDir(config, userId), name);
  let handle: FileHandle;
  try {
    handle = await fs.open(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch {
    return null;
  }
  try {
    const stat = await handle.stat();
    if (stat.isFile()) return { handle, bytes: stat.size };
  } catch {
    // fall through
  }
  await handle.close().catch(() => {});
  return null;
}

/** Deletes the account's folder of copies, when server backups are on.
 *  Never fails the account's deletion: a problem is logged. */
export async function removeServerBackups(userId: string): Promise<void> {
  const config = serverBackupConfig();
  if (!config || !isSafeAccountId(userId)) return;
  try {
    await fs.rm(accountDir(config, userId), { recursive: true, force: true });
  } catch (err) {
    console.error(`[myreads] couldn't remove the backups of account ${userId}:`, err);
  }
}
