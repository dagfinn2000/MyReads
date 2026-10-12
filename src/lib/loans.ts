import { BookOwnership } from "@prisma/client";

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

/** What the Lending card can do with this copy. Only a copy you own can be
 *  lent out; for the others the card says why not. */
export type LendingMode = "lendable" | "borrowed" | "given-away" | "wishlist";

export function lendingMode(ownership: BookOwnership): LendingMode {
  switch (ownership) {
    case BookOwnership.BORROWED:
      return "borrowed";
    case BookOwnership.GIVEN_AWAY:
      return "given-away";
    case BookOwnership.WISHLIST:
      return "wishlist";
    default:
      return "lendable";
  }
}

/** A wishlist book has no copy to lend, so it gets no Lending card, unless
 *  it has loans on record (it was owned once), which must not vanish. */
export function showsLendingCard(ownership: BookOwnership, loanCount: number): boolean {
  return ownership !== BookOwnership.WISHLIST || loanCount > 0;
}

/** The card's line while nothing is lent out. */
export const LENDING_NOTE: Record<LendingMode, string> = {
  lendable: "This copy is on your shelf.",
  borrowed: "Borrowed copy. It isn't yours to lend.",
  "given-away": "You gave this copy away.",
  wishlist: "On your wishlist, so there's no copy to lend.",
};
