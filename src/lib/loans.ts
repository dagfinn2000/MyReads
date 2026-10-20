import { BookOwnership } from "@/lib/enums";
import { calendarDay, dayKey, keyToUtcDate, shiftDayKey } from "@/lib/dates";
import type { LoanPeriod } from "@/lib/preferences";

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

const DAY_MS = 86_400_000;

/**
 * Where an open loan stands against the day it's due back, counted in
 * calendar days in the reader's zone. `days` is how many are left while
 * it's upcoming, and how many have gone by once it's overdue.
 */
export type LoanDue =
  | { kind: "none" }
  | { kind: "upcoming"; days: number }
  | { kind: "today" }
  | { kind: "overdue"; days: number };

export function loanDue(dueAt: Date | null | undefined, now: Date, timeZone?: string): LoanDue {
  if (!dueAt) return { kind: "none" };
  const today = keyToUtcDate(dayKey(now, timeZone)).getTime();
  // The due day reads the way it's shown beside it (calendarDay), so the
  // words and the date never disagree.
  const due = keyToUtcDate(calendarDay(dueAt, timeZone)).getTime();
  const days = Math.round((due - today) / DAY_MS);
  if (days > 0) return { kind: "upcoming", days };
  if (days === 0) return { kind: "today" };
  return { kind: "overdue", days: -days };
}

export function isOverdue(dueAt: Date | null | undefined, now: Date, timeZone?: string): boolean {
  return loanDue(dueAt, now, timeZone).kind === "overdue";
}

/** How the due day stands, after the date itself: "in 5 days",
 *  "tomorrow", "today", "1 day overdue". Empty without a due date. */
export function dueText(due: LoanDue): string {
  switch (due.kind) {
    case "none":
      return "";
    case "today":
      return "today";
    case "upcoming":
      return due.days === 1 ? "tomorrow" : `in ${due.days} days`;
    case "overdue":
      return due.days === 1 ? "1 day overdue" : `${due.days} days overdue`;
  }
}

/**
 * Due dates before this are past: today's date at midnight UTC, the way a
 * date typed into a field is saved. A loan due today isn't overdue yet.
 */
export function overdueCutoff(now: Date, timeZone?: string): Date {
  return keyToUtcDate(dayKey(now, timeZone));
}

/** The due date the lend form starts with, from the "Lend books for"
 *  preference: `period` days after the day it's lent. Empty for none. */
export function defaultDueKey(lentKey: string, period: LoanPeriod): string {
  return period === "none" ? "" : shiftDayKey(lentKey, Number(period));
}

/** An overdue loan as the reminder lists it. */
export interface OverdueLoan {
  bookId: string;
  title: string;
  borrower: string;
}

/** Most books the overdue reminder names before "and N more". */
const NAMED = 2;

/**
 * The reminder's line: "Dune is overdue. Kari has had it since 3 Sep." for
 * one book, "3 lent books are overdue: Dune (Kari), Emma (Ola) and 1 more."
 * for several. Null when nothing is overdue.
 */
export function overdueText(
  loans: OverdueLoan[],
  lentSince?: string,
): string | null {
  if (loans.length === 0) return null;
  if (loans.length === 1) {
    const [l] = loans;
    return lentSince
      ? `${l.title} is overdue. ${l.borrower} has had it since ${lentSince}.`
      : `${l.title} is overdue. ${l.borrower} has it.`;
  }
  const named = loans.slice(0, NAMED).map((l) => `${l.title} (${l.borrower})`);
  const rest = loans.length - named.length;
  const list =
    rest > 0
      ? `${named.join(", ")} and ${rest} more`
      : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `${loans.length} lent books are overdue: ${list}.`;
}
