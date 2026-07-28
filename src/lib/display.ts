import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  WANT_TO_READ: "Want to Read",
  READING: "Currently Reading",
  READ: "Read",
  DNF: "Did Not Finish",
};

export const FORMAT_LABELS: Record<BookFormat, string> = {
  PHYSICAL: "Physical",
  EBOOK: "Ebook",
  AUDIOBOOK: "Audiobook",
};

export const OWNERSHIP_LABELS: Record<BookOwnership, string> = {
  OWNED: "Owned",
  WISHLIST: "Wishlist",
  BORROWED: "Borrowed",
  GIVEN_AWAY: "No longer have it",
};

/** Shorter form for the badge on a book page, where "Owned" is the boring
 *  default and only the other three are worth calling out. */
export const OWNERSHIP_BADGE_LABELS: Record<BookOwnership, string> = {
  OWNED: "Owned",
  WISHLIST: "Wishlist",
  BORROWED: "Borrowed",
  GIVEN_AWAY: "Given away",
};

/** Badge tint per reading status (light + dark variants). */
export const STATUS_BADGE_CLASS: Record<ReadingStatus, string> = {
  WANT_TO_READ:
    "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border-transparent",
  READING:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent",
  READ: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-transparent",
  DNF: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-transparent",
};

/** "12 May 2024" or empty string. */
export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Date → value usable by <input type="date">. */
export function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}
