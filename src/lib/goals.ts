import type { GoalUnit } from "@prisma/client";

/**
 * Finished passes and what they count toward. Shared by the stats page and
 * the year in review, so a goal shows the same progress on both.
 */

/** One finished pass through a book: the current one on a Read book, or
 *  an archived re-read or pre-app read. */
export interface Finish {
  bookId: string;
  dateFinished: Date;
  pageCount: number | null;
  /** True when the book had been finished before this pass. */
  isReread: boolean;
}

/**
 * Marks which finishes are re-reads. A finish is a re-read when the same
 * book has an earlier dated finish, or any undated past read — "read it
 * before" placeholders are presumed to come first.
 */
export function markRereads<T extends { bookId: string; dateFinished: Date }>(
  finishes: T[],
  undatedReadBookIds: ReadonlySet<string>,
): (T & { isReread: boolean })[] {
  const byBook = new Map<string, Date[]>();
  for (const f of finishes) {
    const list = byBook.get(f.bookId) ?? [];
    list.push(f.dateFinished);
    byBook.set(f.bookId, list);
  }
  return finishes.map((f) => ({
    ...f,
    isReread:
      undatedReadBookIds.has(f.bookId) ||
      (byBook.get(f.bookId) ?? []).some((d) => d < f.dateFinished),
  }));
}

export interface GoalRule {
  unit: GoalUnit;
  countRereads: boolean;
}

/** The finishes that count toward a goal — all of them, or first reads
 *  only when re-reads are left out. */
export function countedFinishes<T extends Pick<Finish, "isReread">>(
  finishes: T[],
  rule: Pick<GoalRule, "countRereads">,
): T[] {
  return rule.countRereads ? finishes : finishes.filter((f) => !f.isReread);
}

/** Progress toward a goal from the year's finishes: a book count, or the
 *  pages of those books. A finish with no page count adds no pages. */
export function goalProgress(
  yearFinishes: Pick<Finish, "isReread" | "pageCount">[],
  rule: GoalRule,
): number {
  const counted = countedFinishes(yearFinishes, rule);
  if (rule.unit === "PAGES") {
    return counted.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);
  }
  return counted.length;
}
