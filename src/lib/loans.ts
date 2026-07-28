/**
 * Pure lending helpers, kept out of the card component so they're testable —
 * the same split as lib/progress.ts and its reading card.
 */

/**
 * How long a book has been out, in words.
 *
 * Floors rather than rounds: a book lent this morning has been out for zero
 * whole days, and rounding turned that into "1 days" by mid-afternoon —
 * wrong on both the count and the grammar.
 */
export function outFor(lentAt: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - lentAt.getTime()) / 86_400_000));
  if (days === 0) return "lent today";
  if (days === 1) return "out for 1 day";
  return `out for ${days} days`;
}
