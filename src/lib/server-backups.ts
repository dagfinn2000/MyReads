import { dayKey, zoneOffset } from "@/lib/dates";

/**
 * Nightly backups on the server: the rules, kept free of the disk and the
 * database so they can be tested on their own. The job that follows them
 * is in server-backups-run.ts.
 *
 * A self-hosted instance turns them on by naming a folder in BACKUP_DIR
 * (the Docker setup does). Once a day, at BACKUP_HOUR in the server's own
 * time zone, every account's backup zip is written to
 * `<BACKUP_DIR>/<account id>/myreads-backup-YYYY-MM-DD.zip`, and only the
 * newest BACKUP_KEEP of them are kept.
 */

export interface ServerBackupConfig {
  /** The folder the copies go in, as given (resolved where it's used). */
  dir: string;
  /** The hour of the day the copies are made, 0-23, server time. */
  hour: number;
  /** How many copies to keep for each account. */
  keep: number;
}

export const DEFAULT_BACKUP_HOUR = 3;
export const DEFAULT_BACKUP_KEEP = 7;
export const MAX_BACKUP_KEEP = 365;

/** A whole number from `min` to `max`, written plainly ("7", not "7.0" or
 *  "0x7"), or `fallback` for anything else, including nothing. */
function envInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const text = raw?.trim() ?? "";
  if (!/^\d{1,4}$/.test(text)) return fallback;
  const n = Number(text);
  return n >= min && n <= max ? n : fallback;
}

/** BACKUP_HOUR: 0-23, or 3 when unset or not one of those. */
export function parseBackupHour(raw: string | undefined): number {
  return envInt(raw, 0, 23, DEFAULT_BACKUP_HOUR);
}

/** BACKUP_KEEP: 1-365, or 7 when unset or out of range. Never 0: a
 *  mistyped value must not leave an account with no copies at all. */
export function parseBackupKeep(raw: string | undefined): number {
  return envInt(raw, 1, MAX_BACKUP_KEEP, DEFAULT_BACKUP_KEEP);
}

/**
 * The settings from the environment, or null when server backups are off:
 * BACKUP_DIR unset or blank, which is how development, the tests and CI
 * run. Read on each call, so nothing about it is fixed at build time.
 */
export function serverBackupConfig(
  env: Record<string, string | undefined> = process.env,
): ServerBackupConfig | null {
  const dir = env.BACKUP_DIR?.trim();
  if (!dir) return null;
  return {
    dir,
    hour: parseBackupHour(env.BACKUP_HOUR),
    keep: parseBackupKeep(env.BACKUP_KEEP),
  };
}

/** What's wrong with BACKUP_HOUR and BACKUP_KEEP as set, if anything, in
 *  words for the server log: a value that can't be used falls back to the
 *  default quietly otherwise. */
export function backupEnvProblems(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = [];
  const hour = env.BACKUP_HOUR?.trim();
  if (hour && parseBackupHour(hour) !== Number(hour)) {
    problems.push(`BACKUP_HOUR "${hour}" isn't an hour from 0 to 23, so ${DEFAULT_BACKUP_HOUR} is used`);
  }
  const keep = env.BACKUP_KEEP?.trim();
  if (keep && parseBackupKeep(keep) !== Number(keep)) {
    problems.push(
      `BACKUP_KEEP "${keep}" isn't a number from 1 to ${MAX_BACKUP_KEEP}, so ${DEFAULT_BACKUP_KEEP} is used`,
    );
  }
  return problems;
}

/**
 * The copies' names: the day they were made, so they sort by date as
 * plain text. Nothing else in an account's folder ever matches, which is
 * what lets the clean-up and the download route trust a name that does.
 * Month and day are held to real ranges; no dots, slashes or anything
 * else that could reach another folder.
 */
const BACKUP_FILE = /^myreads-backup-(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\.zip$/;

/** "myreads-backup-2026-10-20.zip" for the day key "2026-10-20". */
export function backupFileName(day: string): string {
  return `myreads-backup-${day}.zip`;
}

/** The day key a copy's name carries, or null for any other name. */
export function backupFileDay(name: string): string | null {
  return BACKUP_FILE.exec(name)?.[1] ?? null;
}

/** Whether `name` is a copy's name, exactly. */
export function isBackupFileName(name: string): boolean {
  return BACKUP_FILE.test(name);
}

/** Where a copy is written before it's complete: a dot file that never
 *  matches a copy's name, so a run that dies part-way leaves nothing that
 *  looks like a backup, and always the same one, so the next run takes it
 *  over instead of leaving another behind. */
export const PARTIAL_BACKUP_NAME = ".myreads-backup.zip.partial";

/**
 * Account ids as Prisma makes them (cuid). A folder name is built from one,
 * and a recursive delete is aimed at it when an account goes, so anything
 * that could be empty, "." or ".." or carry a slash is refused outright.
 */
const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isSafeAccountId(id: string): boolean {
  return ACCOUNT_ID.test(id);
}

/**
 * Of the names in an account's folder, the copies to delete so that only
 * the newest `keep` stay. Only names that are copies count or go: a file
 * of the reader's own, or one half-written under a temporary name, is
 * never touched. A `keep` that isn't a whole number from 1 up deletes
 * nothing, rather than everything.
 */
export function backupsToDelete(names: readonly string[], keep: number): string[] {
  if (!Number.isInteger(keep) || keep < 1) return [];
  const copies = [...new Set(names.filter(isBackupFileName))].sort().reverse();
  return copies.slice(keep);
}

/**
 * Whether the nightly run is due at `now`: the server's clock is at or past
 * BACKUP_HOUR, and no run has finished on this calendar day (server time).
 * After a restart nothing has run as far as the server knows, so a server
 * started after the hour runs at its first check; the copies already on
 * disk for today are then skipped one by one.
 */
export function backupRunDue(now: Date, hour: number, lastRunDay: string | null): boolean {
  if (now.getHours() < hour) return false;
  return dayKey(now) !== lastRunDay;
}

/** The moment the clock in `timeZone` reads `hour`:00 on day `key`. The
 *  second pass corrects for a daylight-saving change in between, as
 *  zonedDayStart does. */
function zonedHour(key: string, hour: number, timeZone: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  const first = wall - zoneOffset(wall, timeZone);
  return new Date(wall - zoneOffset(first, timeZone));
}

/**
 * The line on the Backup card: when the copies are made, as a time in the
 * reader's own zone (BACKUP_HOUR is the server's, and a container's clock
 * is often UTC), and how many are kept. "Night" only when it is night
 * where the reader is.
 */
export function serverBackupNote(
  config: Pick<ServerBackupConfig, "hour" | "keep">,
  now: Date,
  readerZone: string,
  serverZone: string,
): string {
  const run = zonedHour(dayKey(now, serverZone), config.hour, serverZone);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: readerZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(run);
  const localHour = Number(time.slice(0, 2));
  const when = localHour < 6 || localHour >= 21 ? "every night" : "every day";
  const kept = config.keep === 1 ? "keeps the newest one" : `keeps the last ${config.keep}`;
  return `The server also saves a copy ${when} at ${time} and ${kept}.`;
}
