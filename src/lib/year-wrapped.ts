import { shiftDayKey } from "@/lib/dates";

/**
 * The year played back as a story (components/year-story.tsx): a run of
 * full-screen slides, one figure each, ending on a picture of the year to
 * keep or share (lib/year-card.ts). The Year in review page works the
 * numbers out with the stats page's own counting and hands them over as a
 * YearWrapped; the helpers here pick the highlights and decide which slides
 * have something to say. Kept free of React so they can be tested.
 */

/** A book as the story shows it. */
export interface WrappedBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
}

/** One finished pass through a book in the year, in finishing order. */
export interface WrappedFinish {
  book: WrappedBook;
  /** The finish day, "YYYY-MM-DD" in the reader's zone. */
  day: string;
  /** 1–10, or null when not rated. */
  rating: number | null;
  /** Days from start to finish, when both dates are known. */
  days: number | null;
}

/** Everything the story shows, worked out on the server. Plain data, so it
 *  can be handed to the browser. */
export interface YearWrapped {
  year: number;
  /** The year isn't over yet: "so far". */
  current: boolean;
  /** The books the year's count adds up to (finishes, and books put down
   *  when they count as books), as the stat card shows it. */
  books: number;
  /** "finished", or "read" when books put down count as books too. */
  bookWord: "finished" | "read";
  rereads: number;
  pages: number;
  /** Minutes with the reading timer. */
  minutes: number;
  /** The days pages were logged, "YYYY-MM-DD". */
  days: string[];
  /** Books per month, January first. */
  months: number[];
  /** Tags on the year's books, most used first, at most three. */
  genres: { tag: string; count: number }[];
  /** Every finish, in the order they came. */
  finishes: WrappedFinish[];
  /** The best-rated books, best first, at most five; empty when ratings
   *  are off. */
  top: WrappedFinish[];
  /** Ratings are shown (not turned off in Preferences). */
  ratings: boolean;
  /** The year's goal, when it was met. */
  goal: { done: number; target: number; unit: "BOOKS" | "PAGES" | "DAYS" } | null;
}

/** The longest run of days in a row, and where it starts and ends. Ties go
 *  to the earliest run. The same count as readingStreaks' longest
 *  (lib/progress.ts). */
export function longestRun(days: Iterable<string>): { length: number; start: string; end: string } | null {
  const sorted = [...new Set(days)].sort();
  if (!sorted.length) return null;
  let best = { length: 1, start: sorted[0], end: sorted[0] };
  let start = sorted[0];
  let length = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === shiftDayKey(sorted[i - 1], 1)) {
      length++;
    } else {
      start = sorted[i];
      length = 1;
    }
    if (length > best.length) best = { length, start, end: sorted[i] };
  }
  return best;
}

/** Every day key from `start` to `end`, both included. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let key = start; key <= end && out.length < 400; key = shiftDayKey(key, 1)) out.push(key);
  return out;
}

/**
 * The author with the most different books finished in the year, when
 * that's at least two, with those books in the order they were finished.
 * A tie goes to the one with more pages between them, then the one read
 * first.
 */
export function favouriteAuthor(finishes: readonly WrappedFinish[]): { name: string; books: WrappedBook[] } | null {
  const byAuthor = new Map<string, { name: string; books: Map<string, WrappedBook>; first: number }>();
  finishes.forEach((f, i) => {
    for (const raw of f.book.authors) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = byAuthor.get(key) ?? { name, books: new Map(), first: i };
      entry.books.set(f.book.id, f.book);
      byAuthor.set(key, entry);
    }
  });
  const pagesOf = (books: Map<string, WrappedBook>) =>
    [...books.values()].reduce((sum, b) => sum + (b.pageCount ?? 0), 0);
  let best: { name: string; books: Map<string, WrappedBook>; first: number } | null = null;
  for (const entry of byAuthor.values()) {
    if (entry.books.size < 2) continue;
    if (
      !best ||
      entry.books.size > best.books.size ||
      (entry.books.size === best.books.size &&
        (pagesOf(entry.books) > pagesOf(best.books) ||
          (pagesOf(entry.books) === pagesOf(best.books) && entry.first < best.first)))
    ) {
      best = entry;
    }
  }
  return best && { name: best.name, books: [...best.books.values()] };
}

/** The month with the most books (0–11), the earliest of a tie; null when
 *  no month has any. */
export function busiestMonth(months: readonly number[]): number | null {
  let best: number | null = null;
  months.forEach((n, i) => {
    if (n > 0 && (best === null || n > months[best])) best = i;
  });
  return best;
}

/** How long a year is, and how much of it has gone by on `todayKey`
 *  (today included). A past year counts whole; a year not begun, none. */
export function daysSoFar(year: number, todayKey: string): number {
  const length = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
  const todayYear = Number(todayKey.slice(0, 4));
  if (todayYear > year) return length;
  if (todayYear < year) return 0;
  const today = Date.UTC(year, Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10)));
  return Math.round((today - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
}

/** Long books everyone knows, to measure a year's pages against. */
const YARDSTICKS = [
  { title: "War and Peace", pages: 1225 },
  { title: "The Hobbit", pages: 310 },
] as const;

/** The year's pages as so many times through a well-known book: "War and
 *  Peace, 10 times over". Null when it isn't even twice the shorter one. */
export function pagesYardstick(pages: number): { title: string; times: number } | null {
  for (const book of YARDSTICKS) {
    const times = Math.floor(pages / book.pages);
    if (times >= 2) return { title: book.title, times };
  }
  return null;
}

/** The slides a story can have, in the order they play. */
export const STORY_SLIDES = [
  "intro",
  "books",
  "pages",
  "time",
  "days",
  "months",
  "genres",
  "author",
  "top",
  "longest",
  "goal",
  "picture",
] as const;
export type StorySlide = (typeof STORY_SLIDES)[number];

/** The slides that have something to say about this year. */
export function storySlides(w: YearWrapped): StorySlide[] {
  const has: Record<StorySlide, boolean> = {
    intro: true,
    books: w.books > 0,
    pages: w.pages > 0,
    // An hour at least, or it's hardly worth a slide.
    time: w.minutes >= 60,
    days: w.days.length > 0,
    // With one book there's no busiest month to speak of.
    months: w.books >= 2 && busiestMonth(w.months) !== null,
    genres: w.genres.length > 0,
    author: favouriteAuthor(w.finishes) !== null,
    top: w.ratings && w.top.length > 0,
    // Without ratings, the longest book and the fastest read stand in for
    // the top books.
    longest:
      (!w.ratings || w.top.length === 0) &&
      w.finishes.some((f) => f.book.pageCount != null || f.days != null),
    goal: w.goal !== null,
    picture: true,
  };
  return STORY_SLIDES.filter((s) => has[s]);
}

/** Whether the year has anything to tell at all. */
export function hasStory(w: YearWrapped): boolean {
  return w.books > 0 || w.pages > 0 || w.days.length > 0 || w.minutes >= 60;
}

/** The longest finished book, and the fastest read (fewest days from start
 *  to finish), the first of a tie. */
export function longestAndFastest(finishes: readonly WrappedFinish[]): {
  longest: WrappedFinish | null;
  fastest: WrappedFinish | null;
} {
  let longest: WrappedFinish | null = null;
  let fastest: WrappedFinish | null = null;
  for (const f of finishes) {
    if (f.book.pageCount != null && (!longest || f.book.pageCount > longest.book.pageCount!)) longest = f;
    if (f.days != null && (!fastest || f.days < fastest.days!)) fastest = f;
  }
  return { longest, fastest };
}
