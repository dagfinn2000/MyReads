import { BookOwnership, ReadingStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/display";
import { isNextInSeries, seriesKey, type SeriesMember } from "@/lib/series";

/**
 * Which books "Pick for me" chooses from, kept pure so the rule is testable
 * apart from the database (actions/pick.ts does the fetching).
 *
 * The rule: the books on screen (the tab and filters), minus what the
 * Preferences switches leave out; then, on the All tab only, Want to Read
 * books when any are left. A status tab is never swapped for Want to Read.
 */

/** A book in the current view, with what the rules look at. */
export interface PickRow extends SeriesMember {
  id: string;
  ownership: BookOwnership;
  seriesName: string | null;
  /** Out with someone right now (an open loan). */
  lent: boolean;
}

/** Any numbered series book in the library, on screen or not. */
export interface SeriesRow extends SeriesMember {
  seriesName: string | null;
}

export interface PickRules {
  /** The status tab, or null for All (and custom shelves without one). */
  tab: ReadingStatus | null;
  /** Preferences: Only books I have. */
  onlyHave: boolean;
  /** Preferences: Only the next book in a series. */
  nextInSeries: boolean;
}

/** "none": nothing on screen. "settings": the switches left nothing. */
export type PickResult = { id: string } | { reason: "none" | "settings" };

/** The status tab a `shelf` param names, if any. */
export function tabStatus(shelf: string | undefined): ReadingStatus | null {
  return Object.values(ReadingStatus).find((s) => s === shelf) ?? null;
}

/** Yours or borrowed, and on hand: not wishlist, given away or lent out. */
function haveIt(b: PickRow): boolean {
  return (
    (b.ownership === BookOwnership.OWNED || b.ownership === BookOwnership.BORROWED) && !b.lent
  );
}

export function pickPool(rows: PickRow[], rules: PickRules, series: SeriesRow[] = []): PickRow[] {
  let pool = rows;
  if (rules.onlyHave) pool = pool.filter(haveIt);

  if (rules.nextInSeries) {
    // Each series from the whole library plus the rows themselves, so a
    // sibling missing from `series` can't wave a later book through.
    const bySeries = new Map<string, SeriesMember[]>();
    for (const b of [...series, ...rows]) {
      if (!b.seriesName || b.seriesNumber === null) continue;
      const key = seriesKey(b.seriesName);
      const list = bySeries.get(key);
      if (list) list.push(b);
      else bySeries.set(key, [b]);
    }
    // Only Want to Read books wait their turn. A book you're already
    // reading is never held back.
    pool = pool.filter(
      (b) =>
        b.status !== ReadingStatus.WANT_TO_READ ||
        !b.seriesName ||
        isNextInSeries<SeriesMember>(b, bySeries.get(seriesKey(b.seriesName)) ?? []),
    );
  }

  if (rules.tab === null) {
    const unread = pool.filter((b) => b.status === ReadingStatus.WANT_TO_READ);
    if (unread.length > 0) return unread;
  }
  return pool;
}

/** One item at random, or null from an empty list. */
export function chooseRandom<T>(pool: T[], random: () => number = Math.random): T | null {
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** "a", "a and b", "a, b and c". */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The Pick for me button's tooltip: where it picks from and what it obeys. */
export function pickButtonTitle(
  tab: ReadingStatus | null,
  prefs: { pickOnlyHave: boolean; pickNextInSeries: boolean },
): string {
  const base = tab
    ? `Open a random book from ${STATUS_LABELS[tab]}`
    : "Open a random book, from Want to Read when there is one";
  const rules = ["your filters"];
  if (prefs.pickOnlyHave) rules.push("only books you have");
  if (prefs.pickNextInSeries) rules.push("only the next book in each series");
  return `${base} (respects ${joinList(rules)})`;
}
