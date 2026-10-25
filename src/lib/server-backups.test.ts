import { describe, expect, it } from "vitest";
import {
  PARTIAL_BACKUP_NAME,
  backupEnvProblems,
  backupFileDay,
  backupFileName,
  backupRunDue,
  backupsToDelete,
  isBackupFileName,
  isSafeAccountId,
  parseBackupHour,
  parseBackupKeep,
  serverBackupConfig,
  serverBackupNote,
} from "@/lib/server-backups";

/** A moment on the server's own clock (whatever zone the tests run in),
 *  which is the clock BACKUP_HOUR is read on. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

describe("backupRunDue", () => {
  it("is not due before the hour", () => {
    expect(backupRunDue(at(20, 0, 0), 3, null)).toBe(false);
    expect(backupRunDue(at(20, 2, 59), 3, null)).toBe(false);
  });

  it("is due from the hour on, when nothing has run today", () => {
    expect(backupRunDue(at(20, 3, 0), 3, null)).toBe(true);
    expect(backupRunDue(at(20, 3, 14), 3, "2026-10-19")).toBe(true);
  });

  it("is not due again once today's run is done", () => {
    expect(backupRunDue(at(20, 3, 15), 3, "2026-10-20")).toBe(false);
    expect(backupRunDue(at(20, 23, 59), 3, "2026-10-20")).toBe(false);
  });

  it("is due the next day, but not before that day's hour", () => {
    expect(backupRunDue(at(21, 0, 30), 3, "2026-10-20")).toBe(false);
    expect(backupRunDue(at(21, 3, 0), 3, "2026-10-20")).toBe(true);
  });

  it("runs at the first check after a restart past the hour", () => {
    // A restart forgets the last run; the copies already on disk are
    // skipped by the run itself.
    expect(backupRunDue(at(20, 15, 42), 3, null)).toBe(true);
  });

  it("runs at midnight for hour 0, and only late in the day for hour 23", () => {
    expect(backupRunDue(at(20, 0, 0), 0, "2026-10-19")).toBe(true);
    expect(backupRunDue(at(20, 22, 59), 23, null)).toBe(false);
    expect(backupRunDue(at(20, 23, 0), 23, null)).toBe(true);
  });
});

describe("parseBackupHour and parseBackupKeep", () => {
  it("default to 3 and 7", () => {
    expect(parseBackupHour(undefined)).toBe(3);
    expect(parseBackupHour("")).toBe(3);
    expect(parseBackupKeep(undefined)).toBe(7);
    expect(parseBackupKeep("  ")).toBe(7);
  });

  it("take whole numbers in range, with spaces or a leading zero", () => {
    expect(parseBackupHour("0")).toBe(0);
    expect(parseBackupHour("23")).toBe(23);
    expect(parseBackupHour(" 04 ")).toBe(4);
    expect(parseBackupKeep("1")).toBe(1);
    expect(parseBackupKeep("365")).toBe(365);
    expect(parseBackupKeep("14")).toBe(14);
  });

  it("fall back to the default for anything else", () => {
    for (const bad of ["24", "-1", "3.5", "3am", "0x3", "1e1", "three", "99999"]) {
      expect(parseBackupHour(bad)).toBe(3);
    }
    // 0 would leave an account with no copies at all.
    for (const bad of ["0", "366", "-7", "7.0", "seven", "Infinity", "NaN"]) {
      expect(parseBackupKeep(bad)).toBe(7);
    }
  });

  it("are named in the log when they can't be used", () => {
    expect(backupEnvProblems({ BACKUP_HOUR: "4", BACKUP_KEEP: "30" })).toEqual([]);
    expect(backupEnvProblems({})).toEqual([]);
    const problems = backupEnvProblems({ BACKUP_HOUR: "25", BACKUP_KEEP: "0" });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('BACKUP_HOUR "25"');
    expect(problems[1]).toContain('BACKUP_KEEP "0"');
  });
});

describe("serverBackupConfig", () => {
  it("is off without BACKUP_DIR, or with it blank", () => {
    expect(serverBackupConfig({})).toBeNull();
    expect(serverBackupConfig({ BACKUP_DIR: "   ", BACKUP_HOUR: "4" })).toBeNull();
  });

  it("is on with BACKUP_DIR, with the hour and count read or defaulted", () => {
    expect(serverBackupConfig({ BACKUP_DIR: "/app/data/backups" })).toEqual({
      dir: "/app/data/backups",
      hour: 3,
      keep: 7,
    });
    expect(
      serverBackupConfig({ BACKUP_DIR: " /srv/b ", BACKUP_HOUR: "22", BACKUP_KEEP: "nope" }),
    ).toEqual({ dir: "/srv/b", hour: 22, keep: 7 });
  });
});

describe("backup file names", () => {
  it("carry the day, and read back", () => {
    expect(backupFileName("2026-10-20")).toBe("myreads-backup-2026-10-20.zip");
    expect(backupFileDay("myreads-backup-2026-10-20.zip")).toBe("2026-10-20");
    expect(isBackupFileName(backupFileName("2026-01-01"))).toBe(true);
  });

  it("match nothing else", () => {
    for (const name of [
      "",
      "myreads-backup-2026-10-20.zip.partial",
      PARTIAL_BACKUP_NAME,
      "myreads-backup-2026-13-01.zip",
      "myreads-backup-2026-10-32.zip",
      "myreads-backup-2026-10-00.zip",
      "myreads-backup-26-10-20.zip",
      "myreads-backup-2026-10-20.ZIP",
      "myreads-export-2026-10-20.zip",
      "../myreads-backup-2026-10-20.zip",
      "other/myreads-backup-2026-10-20.zip",
      "myreads-backup-2026-10-20.zip/",
      "myreads-backup-2026-10-20.zip\n",
      " myreads-backup-2026-10-20.zip",
      "notes.txt",
    ]) {
      expect(isBackupFileName(name), name).toBe(false);
      expect(backupFileDay(name)).toBeNull();
    }
  });
});

describe("isSafeAccountId", () => {
  it("takes ids as Prisma makes them, and nothing that could leave the folder", () => {
    expect(isSafeAccountId("cmvgchz9h00007dw3ra94p276")).toBe(true);
    for (const id of ["", ".", "..", "a/b", "a\\b", "../x", "a b", "x".repeat(65)]) {
      expect(isSafeAccountId(id), id).toBe(false);
    }
  });
});

describe("backupsToDelete", () => {
  const day = (n: number) => backupFileName(`2026-10-${String(n).padStart(2, "0")}`);

  it("keeps the newest, by the date in the name", () => {
    // Out of order, as a folder listing may come.
    const names = [day(14), day(20), day(9), day(17), day(15), day(16), day(18), day(19), day(13)];
    expect(backupsToDelete(names, 7).sort()).toEqual([day(9), day(13)].sort());
    expect(backupsToDelete(names, 1).sort()).toEqual(
      [day(9), day(13), day(14), day(15), day(16), day(17), day(18), day(19)].sort(),
    );
  });

  it("sorts across months and years", () => {
    const names = ["2025-12-31", "2026-01-01", "2026-02-28", "2025-11-30"].map(backupFileName);
    expect(backupsToDelete(names, 2).sort()).toEqual(
      [backupFileName("2025-11-30"), backupFileName("2025-12-31")].sort(),
    );
  });

  it("deletes nothing when there are no more than it keeps", () => {
    expect(backupsToDelete([], 7)).toEqual([]);
    expect(backupsToDelete([day(1), day(2)], 7)).toEqual([]);
    expect(backupsToDelete([day(1), day(2)], 2)).toEqual([]);
  });

  it("never touches a file that isn't a copy", () => {
    const names = [
      "notes.txt",
      PARTIAL_BACKUP_NAME,
      "myreads-backup-2020-01-01.zip.bak",
      "myreads-export-2020-01-01.zip",
      day(1),
      day(2),
      day(3),
    ];
    expect(backupsToDelete(names, 1).sort()).toEqual([day(1), day(2)].sort());
  });

  it("deletes nothing for a count that isn't a whole number from 1", () => {
    const names = [day(1), day(2), day(3)];
    for (const keep of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(backupsToDelete(names, keep), String(keep)).toEqual([]);
    }
  });
});

describe("serverBackupNote", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");

  it("says when and how many, in the reader's zone", () => {
    expect(serverBackupNote({ hour: 3, keep: 7 }, now, "UTC", "UTC")).toBe(
      "The server also saves a copy every night at 03:00 and keeps the last 7.",
    );
    // 03:00 UTC is 05:00 in Oslo in October (summer time)...
    expect(serverBackupNote({ hour: 3, keep: 7 }, now, "Europe/Oslo", "UTC")).toBe(
      "The server also saves a copy every night at 05:00 and keeps the last 7.",
    );
    // ...and 04:00 once the clocks have gone back.
    expect(
      serverBackupNote({ hour: 3, keep: 7 }, new Date("2026-11-20T12:00:00Z"), "Europe/Oslo", "UTC"),
    ).toBe("The server also saves a copy every night at 04:00 and keeps the last 7.");
  });

  it("says every day when it isn't night where the reader is", () => {
    // 03:00 in Oslo is the afternoon before in Los Angeles.
    expect(serverBackupNote({ hour: 3, keep: 7 }, now, "America/Los_Angeles", "Europe/Oslo")).toBe(
      "The server also saves a copy every day at 18:00 and keeps the last 7.",
    );
  });

  it("names a single copy plainly", () => {
    expect(serverBackupNote({ hour: 22, keep: 1 }, now, "UTC", "UTC")).toBe(
      "The server also saves a copy every night at 22:00 and keeps the newest one.",
    );
  });
});
