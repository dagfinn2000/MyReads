import { ReadingStatus } from "@/lib/enums";
import { seriesKey } from "@/lib/series";

/**
 * "More like this" on a book's page: other books on the reader's own
 * shelves that share its genres and tags, moods or author. A tag few books
 * have says more than one most of them have, so each shared tag counts by
 * how rare it is in the library. Books still to read come first, as the
 * likeliest next read; a book put down never shows.
 */

/** How many books the strip shows. */
export const SIMILAR_LIMIT = 8;

/** The least a book must score to show: one rare tag, or a common tag and
 *  a mood, or the author and a little more. */
export const SIMILAR_MIN_SCORE = 2;

export interface SimilarSource {
  id: string;
  authors: string[];
  tags: string[];
  moods: string[];
  seriesName: string | null;
  pageCount: number | null;
}

export interface SimilarCandidate extends SimilarSource {
  title: string;
  coverUrl: string | null;
  status: ReadingStatus;
  rating: number | null;
}

/** What two books share, in the order a reason line names them. */
export interface SimilarReason {
  author: boolean;
  tags: string[];
  moods: string[];
}

export interface SimilarBook<C extends SimilarCandidate> {
  book: C;
  score: number;
  reason: SimilarReason;
}

/** How telling a shared tag or mood is: 1 when every book has it, more the
 *  fewer do. `df` counts the books that have it, this one included. */
function rarity(df: number, total: number): number {
  return 1 + Math.log(Math.max(total, df) / Math.max(df, 1));
}

/** Names compared as the Authors page compares them: trimmed, exact. */
function authorSet(authors: string[]): Set<string> {
  return new Set(authors.map((a) => a.trim()).filter(Boolean));
}

/**
 * The books most like `source`, best first, from `candidates` (the books
 * that share a tag, a mood or an author with it; others score nothing).
 * `total` is how many books the library holds, which tells how rare a tag
 * is. Books in the same series are left out (the page lists those), and so
 * is the book itself; of another series, only its likeliest book shows.
 */
export function similarBooks<C extends SimilarCandidate>(
  source: SimilarSource,
  candidates: C[],
  total: number,
  limit = SIMILAR_LIMIT,
): SimilarBook<C>[] {
  const tags = new Set(source.tags);
  const moods = new Set(source.moods);
  const authors = authorSet(source.authors);
  const series = source.seriesName ? seriesKey(source.seriesName) : null;

  // Every book with one of this book's tags is a candidate, so counting them
  // there counts them in the whole library.
  const tagCount = new Map<string, number>();
  const moodCount = new Map<string, number>();
  for (const c of candidates) {
    for (const t of new Set(c.tags)) if (tags.has(t)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    for (const m of new Set(c.moods)) if (moods.has(m)) moodCount.set(m, (moodCount.get(m) ?? 0) + 1);
  }

  const out: SimilarBook<C>[] = [];
  for (const c of candidates) {
    if (c.id === source.id || c.status === ReadingStatus.DNF) continue;
    if (series && c.seriesName && seriesKey(c.seriesName) === series) continue;
    const sharedTags = [...new Set(c.tags)].filter((t) => tags.has(t));
    const sharedMoods = [...new Set(c.moods)].filter((m) => moods.has(m));
    const sameAuthor = [...authorSet(c.authors)].some((a) => authors.has(a));
    let score = 0;
    for (const t of sharedTags) score += 1.5 * rarity((tagCount.get(t) ?? 0) + 1, total);
    for (const m of sharedMoods) score += 0.75 * rarity((moodCount.get(m) ?? 0) + 1, total);
    if (sameAuthor) score += 2;
    if (score === 0) continue;
    // A book of about the same length reads alike more often than not.
    if (source.pageCount && c.pageCount) {
      const ratio = c.pageCount / source.pageCount;
      if (ratio > 0.7 && ratio < 1.4) score += 0.25;
    }
    if (score < SIMILAR_MIN_SCORE) continue;
    // Still to read, it's a next read; read and liked, it's a reminder.
    if (c.status === ReadingStatus.WANT_TO_READ || c.status === ReadingStatus.READING) score += 1;
    else if (c.rating != null && c.rating >= 8) score += 0.5;
    out.push({
      book: c,
      score,
      reason: {
        author: sameAuthor,
        // The rarest first: what makes them alike.
        tags: sharedTags.sort((a, b) => (tagCount.get(a) ?? 0) - (tagCount.get(b) ?? 0)),
        moods: sharedMoods.sort((a, b) => (moodCount.get(a) ?? 0) - (moodCount.get(b) ?? 0)),
      },
    });
  }
  // One book of a series: the rest are a tap away from it.
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title))
    .filter((s) => {
      if (!s.book.seriesName) return true;
      const key = seriesKey(s.book.seriesName);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/**
 * Why a book is listed, short enough for under a cover: "Same author",
 * then up to two of the rarest tags, then a mood if there's room.
 * `moodName` gives a mood key its name, or null for one no longer known.
 */
export function similarReasonText(
  reason: SimilarReason,
  moodName: (key: string) => string | null,
): string {
  const parts: string[] = [];
  if (reason.author) parts.push("Same author");
  parts.push(...reason.tags.slice(0, reason.author ? 1 : 2));
  if (parts.length < 2) {
    const mood = reason.moods.map(moodName).find((m): m is string => !!m);
    if (mood) parts.push(mood.toLowerCase());
  }
  return parts.join(" · ");
}
