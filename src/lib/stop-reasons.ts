/**
 * Why a book was put down (Book.stopReason): picked on Now reading right
 * after Stopped, or on the book's reading card. Stats sums them up in "Why
 * you stopped", with how far in books were put down. The keys are stored;
 * the words are only shown.
 */

export const STOP_REASONS = [
  "slow",
  "not-for-me",
  "writing",
  "lost-interest",
  "too-long",
  "not-now",
  "other",
] as const;

export type StopReason = (typeof STOP_REASONS)[number];

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  slow: "Too slow",
  "not-for-me": "Not for me",
  writing: "Didn't like the writing",
  "lost-interest": "Lost interest",
  "too-long": "Too long",
  "not-now": "Not the right time",
  other: "Something else",
};

/** A stored reason, or null for anything else (an old or unknown key). */
export function parseStopReason(value: unknown): StopReason | null {
  return typeof value === "string" && (STOP_REASONS as readonly string[]).includes(value)
    ? (value as StopReason)
    : null;
}

export interface StoppedBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  stopReason: string | null;
  pageCount: number | null;
  currentPage: number | null;
  tags: string[];
}

export interface StopSummary {
  /** Books put down. */
  total: number;
  /** Each reason given, most often first, then those with none given. */
  reasons: { reason: StopReason | null; count: number }[];
  /** How far in, on average, books with a page count were put down: 0 to
   *  1, or null when none has both. */
  averageShare: number | null;
  /** Put down early: before a fifth of the way. */
  early: number;
  /** The tags most often on books put down, when at least two share one. */
  tags: { tag: string; count: number }[];
  /** Books put down for "not the right time": worth another go. */
  anotherGo: StoppedBook[];
}

/** Sums up the books put down (status Did Not Finish). */
export function stopSummary(books: StoppedBook[]): StopSummary {
  const byReason = new Map<StopReason | null, number>();
  const shares: number[] = [];
  const tagCount = new Map<string, number>();
  for (const b of books) {
    const reason = parseStopReason(b.stopReason);
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    if (b.pageCount && b.currentPage != null) {
      shares.push(Math.min(Math.max(b.currentPage / b.pageCount, 0), 1));
    }
    for (const t of new Set(b.tags)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  }
  const reasons = [...byReason]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => (a.reason === null ? 1 : 0) - (b.reason === null ? 1 : 0) || b.count - a.count);
  return {
    total: books.length,
    reasons,
    averageShare: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null,
    early: shares.filter((s) => s < 0.2).length,
    tags: [...tagCount]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count })),
    anotherGo: books.filter((b) => b.stopReason === "not-now").slice(0, 4),
  };
}
