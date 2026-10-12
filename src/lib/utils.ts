import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Letters that NFD doesn't split into base + accent, spelled the way
 *  someone without the key would type them. */
const FOLDED_LETTERS: Record<string, string> = {
  æ: "ae",
  ø: "o",
  œ: "oe",
  ß: "ss",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
};

/**
 * Lowercases and strips accents, so "Brontë" and "Bjørn" are found by
 * "bronte" and "bjorn". Applied to both the stored searchText and the words
 * typed into search; the two have to agree exactly.
 *
 * The 20261011000000_accent_insensitive_search migration repeats these steps
 * in SQL to backfill existing rows. Change one, change the other.
 */
export function foldForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/[æøœßđðłþ]/g, (c) => FOLDED_LETTERS[c]);
}

/** Folded title+authors+series blob stored on Book.searchText: makes
 *  case- and accent-insensitive search a `contains` query (Prisma can't
 *  substring-search a String[] column). Shared by the book actions and the
 *  backup import so the two can never drift. */
export function buildSearchText(
  title: string,
  authors: string[],
  seriesName?: string | null,
): string {
  return foldForSearch([title, ...authors, seriesName ?? ""].join(" ").trim());
}

/** Escapes LIKE's wildcards. Prisma's `contains` passes `%` and `_` through,
 *  so a search for "%" would otherwise match every book. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

/** The words of a search query, folded like searchText, each once, at most
 *  ten. For matching in JS; searchTerms is the same list escaped for SQL. */
export function searchWords(q: string): string[] {
  const words = foldForSearch(q).split(/\s+/).filter(Boolean);
  return [...new Set(words)].slice(0, 10);
}

/**
 * The words of a search query, folded like searchText and escaped for
 * `contains`. Each word is matched on its own, so "tolkien hobbit" finds
 * The Hobbit by J.R.R. Tolkien even though that phrase appears nowhere.
 */
export function searchTerms(q: string): string[] {
  return searchWords(q).map(escapeLike);
}
