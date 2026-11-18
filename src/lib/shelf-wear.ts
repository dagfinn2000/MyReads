import { BookOwnership, ReadingStatus } from "@/lib/enums";

/**
 * Shelf wear: how a book's cover (and its spine in the Spines view) shows
 * the way it has been treated (globals.css, "Shelf wear").
 *
 * - **Dust** settles on a book nobody has touched for a year or more: a
 *   faint film at one year, more at two, the most from four years on.
 *   Touching it means reading it: starting it, logging a page, finishing
 *   it. A book waiting to be read was last touched when it joined the
 *   pile, and so was a book with no reading dates at all.
 * - **Wear** comes from love: each read after the first adds some, and so
 *   does a rating of 4½ stars or more, up to three steps.
 *
 * Only books on the reader's own shelves wear: a wishlist book isn't there
 * yet, a given-away one is gone, and a borrowed copy gathers dust but isn't
 * the reader's to wear out.
 */

/** Days untouched before each step of dust: a year, two, four. */
export const DUST_AFTER_DAYS = [365, 730, 1461] as const;

/** A rating (in half stars) that counts as a favourite: 4½ stars. */
export const FAVOURITE_RATING = 9;

const DAY_MS = 86_400_000;

export type ShelfWear = {
  /** 0 (none) to 3. */
  dust: number;
  /** 0 (none) to 3. */
  worn: number;
  /** What it says under the pointer, "" without either. */
  note: string;
};

export const NO_WEAR: ShelfWear = { dust: 0, worn: 0, note: "" };

export type WearBook = {
  status: ReadingStatus | string;
  ownership?: BookOwnership | string | null;
  createdAt: Date;
  dateStarted: Date | null;
  dateFinished: Date | null;
  timesRead: number;
  rating: number | null;
};

/** When the book was last touched: its newest reading date (started, a
 *  page logged, finished), or the day it was added for a book still waiting
 *  to be read, or with no reading dates at all. */
export function lastTouched(book: WearBook, lastLog: Date | null): Date {
  const reading = [book.dateStarted, book.dateFinished, lastLog].filter((d): d is Date => d !== null);
  if (book.status === ReadingStatus.WANT_TO_READ || reading.length === 0) reading.push(book.createdAt);
  return new Date(Math.max(...reading.map((d) => d.getTime())));
}

/** How much dust a book untouched for `days` days has: 0 to 3. */
export function dustFor(days: number): number {
  return DUST_AFTER_DAYS.filter((d) => days >= d).length;
}

/** How worn a favourite is: 0 to 3. */
export function wornFor(book: Pick<WearBook, "timesRead" | "rating">): number {
  const rereads = Math.max(0, book.timesRead - 1);
  const loved = book.rating != null && book.rating >= FAVOURITE_RATING ? 1 : 0;
  return Math.min(3, rereads + loved);
}

const SMALL = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function count(n: number): string {
  return SMALL[n] ?? String(n);
}

/** The book's dust and wear, and a line saying why. `lastLog` is its newest
 *  reading log entry, if any. */
export function shelfWear(book: WearBook, lastLog: Date | null, now: Date): ShelfWear {
  const ownership = book.ownership ?? BookOwnership.OWNED;
  if (ownership === BookOwnership.WISHLIST || ownership === BookOwnership.GIVEN_AWAY) return NO_WEAR;

  const days = Math.floor((now.getTime() - lastTouched(book, lastLog).getTime()) / DAY_MS);
  const dust = dustFor(days);
  const worn = ownership === BookOwnership.OWNED ? wornFor(book) : 0;

  const notes: string[] = [];
  if (worn > 0) {
    notes.push(
      book.timesRead >= 2
        ? `Well worn: read ${count(book.timesRead)} times`
        : "Well worn: a favourite",
    );
  }
  if (dust > 0) {
    const years = Math.floor(days / 365);
    notes.push(`Gathering dust: untouched for ${years === 1 ? "a year" : `${count(years)} years`}`);
  }
  return { dust, worn, note: notes.join(" · ") };
}

/** Which of the three dust pictures a book gets, from its id, so books side
 *  by side don't share one scattering. */
export function dustGrain(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 3;
}

/** Where a book the reader stopped reading was put down, as far as it's
 *  known: the page, and of how many. Its cover gets a dog-eared corner
 *  (components/book-card.tsx DogEar). */
export type StoppedAt = { page: number | null; of: number | null };

/** Where a book was put down; null for a book the reader didn't stop. A
 *  stopped book keeps the page it was left at. */
export function stoppedAt(book: {
  status: ReadingStatus | string;
  currentPage: number | null;
  pageCount: number | null;
}): StoppedAt | null {
  return book.status === ReadingStatus.DNF ? { page: book.currentPage, of: book.pageCount } : null;
}

/** What a dog-eared corner says under the pointer. */
export function stoppedNote(at: StoppedAt): string {
  if (at.page == null || at.page <= 0) return "Put down before the end";
  return at.of ? `Put down at page ${at.page} of ${at.of}` : `Put down at page ${at.page}`;
}
