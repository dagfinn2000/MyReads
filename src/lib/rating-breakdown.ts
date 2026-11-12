import type { RatingStyle } from "@/lib/preferences";

/**
 * The rating broken down: the plot, the characters and the writing, each
 * rated on its own under a book's rating (Preferences › Ratings), in the
 * same 1–10 half-star units. The overall rating stays the reader's own
 * verdict; nothing here works it out from the three. Stats shows how each
 * averages out, the book rated best for it, and how the overall ratings
 * spread across the scale.
 */

export const RATING_ASPECTS = [
  { key: "plotRating", label: "Plot", phrase: "the plot" },
  { key: "charactersRating", label: "Characters", phrase: "the characters" },
  { key: "writingRating", label: "Writing", phrase: "the writing" },
] as const;

export type RatingAspect = (typeof RATING_ASPECTS)[number]["key"];

export type AspectRatings = Record<RatingAspect, number | null>;

/** A stored rating that is one, 1–10. */
function isRating(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10;
}

/**
 * The columns a save of the reading card writes: only the aspects the form
 * sent, so a form without the breakdown (switched off in Preferences)
 * leaves them as they are. 0 clears one.
 */
export function aspectRatingUpdate(
  data: Partial<Record<RatingAspect, number | undefined>>,
): Partial<AspectRatings> {
  const out: Partial<AspectRatings> = {};
  for (const { key } of RATING_ASPECTS) {
    const v = data[key];
    if (v !== undefined) out[key] = isRating(v) ? v : null;
  }
  return out;
}

/** Whether any of the three is rated. */
export function hasAspectRatings(book: AspectRatings): boolean {
  return RATING_ASPECTS.some(({ key }) => isRating(book[key]));
}

/** What the summaries need of a book. */
export interface AspectBook extends AspectRatings {
  id: string;
  title: string;
  rating: number | null;
  dateFinished?: Date | null;
}

export interface AspectSummary<B extends AspectBook = AspectBook> {
  key: RatingAspect;
  label: string;
  /** The mean in half-star units (so 7.6 is 3.8 stars), or null when no
   *  book is rated for it. */
  average: number | null;
  /** Books rated for it. */
  count: number;
  /** The book rated highest for it. A tie goes to the one rated higher
   *  overall, then the one finished last, then by title. */
  best: B | null;
}

/** Each aspect's average and best book, over the books given. */
export function aspectSummaries<B extends AspectBook>(books: readonly B[]): AspectSummary<B>[] {
  return RATING_ASPECTS.map(({ key, label }) => {
    const rated = books.filter((b) => isRating(b[key]));
    if (rated.length === 0) return { key, label, average: null, count: 0, best: null };
    const sum = rated.reduce((total, b) => total + b[key]!, 0);
    const best = rated.reduce((a, b) => (outranks(b, a, key) ? b : a));
    return { key, label, average: sum / rated.length, count: rated.length, best };
  });
}

/** `a` beats `b` for the aspect. */
function outranks(a: AspectBook, b: AspectBook, key: RatingAspect): boolean {
  if (a[key] !== b[key]) return a[key]! > b[key]!;
  const ra = isRating(a.rating) ? a.rating : 0;
  const rb = isRating(b.rating) ? b.rating : 0;
  if (ra !== rb) return ra > rb;
  const fa = a.dateFinished?.getTime() ?? 0;
  const fb = b.dateFinished?.getTime() ?? 0;
  if (fa !== fb) return fa > fb;
  return a.title.localeCompare(b.title) < 0;
}

/** Pearson's correlation, or null when either side never changes. */
function correlation(pairs: readonly [number, number][]): number | null {
  const n = pairs.length;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of pairs) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

/** Books rated overall and for an aspect before a lean is worth naming. */
export const LEAN_MIN_BOOKS = 5;

/**
 * The aspect the reader's overall ratings rise and fall with most, when one
 * clearly does: over at least LEAN_MIN_BOOKS books rated for both, it goes
 * along with the overall rating (a correlation of 0.4 or more) by a clear
 * margin (0.1) over the next. Null otherwise, which is the usual answer
 * for a small library.
 */
export function ratingLean(
  books: readonly AspectBook[],
): { key: RatingAspect; phrase: string; books: number } | null {
  const scored = RATING_ASPECTS.flatMap(({ key, phrase }) => {
    const pairs = books.flatMap((b): [number, number][] =>
      isRating(b.rating) && isRating(b[key]) ? [[b[key]!, b.rating]] : [],
    );
    if (pairs.length < LEAN_MIN_BOOKS) return [];
    const r = correlation(pairs);
    return r == null ? [] : [{ key, phrase, r, books: pairs.length }];
  }).sort((a, b) => b.r - a.r);
  const [top, next] = scored;
  if (!top || top.r < 0.4 || (next && top.r - next.r < 0.1)) return null;
  return { key: top.key, phrase: top.phrase, books: top.books };
}

/** One column of the overall ratings chart. */
export interface RatingBucket {
  /** The stored value it stands for (whole stars: the even one). */
  value: number;
  /** Under the column: "½", "4", "9". */
  label: string;
  count: number;
}

/**
 * How many ratings land on each step of the reader's scale: ten half stars,
 * five whole stars (a half star rated before the switch goes up to the next
 * whole one, as the whole-star input rounds), or 1 to 10.
 */
export function ratingDistribution(
  values: readonly number[],
  style: RatingStyle,
): RatingBucket[] {
  const whole = style === "whole";
  const steps = whole ? 5 : 10;
  const buckets: RatingBucket[] = Array.from({ length: steps }, (_, i) => {
    const value = whole ? (i + 1) * 2 : i + 1;
    return { value, label: bucketLabel(value, style), count: 0 };
  });
  for (const v of values) {
    if (!isRating(v)) continue;
    buckets[whole ? Math.ceil(v / 2) - 1 : v - 1].count++;
  }
  return buckets;
}

function bucketLabel(value: number, style: RatingStyle): string {
  return style === "ten" || style === "off" ? String(value) : shortRating(value, style);
}

/** A stored rating in the fewest characters: "4½" (stars) or "8/10". */
export function shortRating(value: number, style: RatingStyle): string {
  if (style === "ten" || style === "off") return `${value}/10`;
  const stars = Math.floor(value / 2);
  return `${stars || ""}${value % 2 ? "½" : ""}`;
}
