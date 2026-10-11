import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { dailyPageTotals } from "@/lib/progress";
import { dailyPageTotalsForUser } from "@/lib/progress-query";

/**
 * Differential test: the SQL implementation must agree with the JS one that
 * the book page still uses, entry for entry. The SQL exists purely to avoid
 * loading every ProgressEntry into memory — if it ever disagreed, the
 * heatmap and the all-time streak would drift without anything looking
 * broken.
 *
 * Deliberately includes times that fall on different calendar days in UTC
 * than in a non-UTC local zone, which is where a naive rewrite goes wrong.
 */
const prisma = new PrismaClient();
const USER = "tz-diff-user";

/** Local wall-clock time -> Date, so the fixtures mean what they read as. */
function local(y: number, m: number, d: number, h: number, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

const entries: { bookId: string; page: number; date: Date }[] = [
  // Book A — a normal run of days.
  { bookId: "tz-a", page: 0, date: local(2026, 3, 1, 9) },
  { bookId: "tz-a", page: 40, date: local(2026, 3, 1, 22) },
  { bookId: "tz-a", page: 90, date: local(2026, 3, 2, 20) },
  // Just after local midnight: a different UTC day east of Greenwich.
  { bookId: "tz-a", page: 150, date: local(2026, 3, 3, 0, 30) },
  // Just before local midnight: a different UTC day west of Greenwich.
  { bookId: "tz-a", page: 200, date: local(2026, 3, 3, 23, 45) },

  // Book B — overlapping days, so the two books' deltas must sum per day.
  { bookId: "tz-b", page: 0, date: local(2026, 3, 2, 10) },
  { bookId: "tz-b", page: 25, date: local(2026, 3, 2, 21) },
  // A correction backwards: credits nothing, but moves the baseline.
  { bookId: "tz-b", page: 10, date: local(2026, 3, 4, 12) },
  { bookId: "tz-b", page: 60, date: local(2026, 3, 5, 12) },

  // Book C — a lone entry with no predecessor credits nothing.
  { bookId: "tz-c", page: 300, date: local(2026, 3, 6, 12) },

  // Across a DST boundary (Europe clocks jump on 2026-03-29).
  { bookId: "tz-a", page: 260, date: local(2026, 3, 29, 1, 30) },
  { bookId: "tz-a", page: 300, date: local(2026, 3, 29, 12, 0) },
];

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.user.create({
    data: { id: USER, username: `tzdiff-${Date.now()}`, passwordHash: "x" },
  });
  for (const bookId of ["tz-a", "tz-b", "tz-c"]) {
    await prisma.book.create({
      data: {
        id: bookId,
        userId: USER,
        title: bookId,
        searchText: bookId,
      },
    });
  }
  await prisma.progressEntry.createMany({ data: entries });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

describe("dailyPageTotalsForUser", () => {
  it("matches the in-memory implementation exactly", async () => {
    const fromSql = await dailyPageTotalsForUser(USER);
    const fromJs = dailyPageTotals(entries);

    expect(Object.fromEntries([...fromSql].sort())).toEqual(
      Object.fromEntries([...fromJs].sort()),
    );
  });

  it("buckets late-night reading on the local day, not the UTC day", async () => {
    const fromSql = await dailyPageTotalsForUser(USER);
    // 00:30 local on the 3rd is the 2nd in UTC when east of Greenwich; the
    // 60 pages must land on the 3rd either way.
    expect(fromSql.get("2026-03-03")).toBe(60 + 50);
  });

  it("credits nothing for a lone entry or a backwards correction", async () => {
    const fromSql = await dailyPageTotalsForUser(USER);
    expect(fromSql.has("2026-03-06")).toBe(false); // tz-c, no predecessor
    expect(fromSql.has("2026-03-04")).toBe(false); // tz-b went backwards
  });

  it("agrees with the in-memory version in the reader's own zone", async () => {
    for (const zone of ["UTC", "America/New_York", "Asia/Tokyo", "Europe/Oslo"]) {
      const fromSql = await dailyPageTotalsForUser(USER, zone);
      const fromJs = dailyPageTotals(entries, zone);
      expect(Object.fromEntries([...fromSql].sort()), zone).toEqual(
        Object.fromEntries([...fromJs].sort()),
      );
    }
  });
});
