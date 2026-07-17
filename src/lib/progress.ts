import type { ProgressEntry } from "@prisma/client";

/** Local-time day key ("2026-07-17") — sortable and comparable. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The day after a key's day, DST-safe (local Date arithmetic, not +24h). */
function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + 1));
}

type LogPoint = Pick<ProgressEntry, "bookId" | "page" | "date">;

/**
 * The slice of a book's log belonging to the current reading pass:
 * everything from the latest page-0 anchor onward. Page-0 entries only ever
 * come from pass anchors — the reading form treats page 0 as "cleared" and
 * never logs it — so the latest one marks the pass start exactly, even when
 * a re-read begins on a day that already has entries (the started-date form
 * field only keeps day precision). Logs without an anchor (upgrade-seeded
 * books) fall back to the started-date window.
 */
export function currentPassEntries<T extends Pick<ProgressEntry, "page" | "date">>(
  entries: T[], // sorted by date ascending
  dateStarted: Date | null,
): T[] {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].page === 0) return entries.slice(i);
  }
  if (!dateStarted) return entries;
  return entries.filter((e) => e.date.getTime() >= dateStarted.getTime());
}

/**
 * Pages read per calendar day, summed across books. Each book's log is
 * walked in date order and every *increase* between consecutive entries is
 * credited to the later entry's day. A first entry has no predecessor and
 * credits nothing — that's what keeps the upgrade-seeded positions and
 * pass-start anchors inert — and decreases (corrections, re-read resets)
 * credit nothing but move the baseline.
 */
export function dailyPageTotals(entries: LogPoint[]): Map<string, number> {
  const byBook = new Map<string, LogPoint[]>();
  for (const e of entries) {
    const log = byBook.get(e.bookId);
    if (log) log.push(e);
    else byBook.set(e.bookId, [e]);
  }

  const totals = new Map<string, number>();
  for (const log of byBook.values()) {
    log.sort((a, b) => a.date.getTime() - b.date.getTime() || a.page - b.page);
    for (let i = 1; i < log.length; i++) {
      const delta = log[i].page - log[i - 1].page;
      if (delta <= 0) continue;
      const key = dayKey(log[i].date);
      totals.set(key, (totals.get(key) ?? 0) + delta);
    }
  }
  return totals;
}

/**
 * Current streak and longest-ever run of consecutive reading days. Today
 * counts toward the current streak when logged, but an unlogged today
 * doesn't break yesterday's streak — the day isn't over yet.
 */
export function readingStreaks(
  days: ReadonlySet<string>,
  today: Date = new Date(),
): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of [...days].sort()) {
    run = prev !== null && key === nextDayKey(prev) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = key;
  }

  const cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, longest };
}
