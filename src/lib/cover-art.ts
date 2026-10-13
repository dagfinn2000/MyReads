/**
 * The colours of the drawn cover a book gets when it has no cover image
 * (BookCover in components/book-card.tsx).
 *
 * Everything comes from the title, so a book keeps the same cover on every
 * page and every visit, and different titles spread around the colour
 * wheel instead of all coming out one shade. Saturation and lightness stay
 * in a band dark enough for the pale title text to read on any hue.
 */
export interface CoverArt {
  /** 0–359 */
  hue: number;
  /** Percent, 26–47 */
  saturation: number;
  /** Percent, 22–32 */
  lightness: number;
  /** Which of the three title arrangements to use (see globals.css). */
  layout: 0 | 1 | 2;
  /** Title size as a percent of the cover's width: smaller when the title
   *  has a long word, so "Lavransdatter" fits on one line instead of
   *  breaking mid-word. */
  titleSize: number;
}

/** 32-bit FNV-1a, finished with MurmurHash3's mixing step. FNV alone
 *  leaves titles that differ only in their last letter ("Book 1",
 *  "Book 2") with nearly the same low bits, which the hue comes from.
 *  The reading room (lib/room.ts) uses it for spine heights too. */
export function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The text area is about 70% of the cover's width, and a letter of the
 *  title face averages a little under 0.6 of its size; the 11.5 cap is what
 *  short titles get. */
function titleSize(title: string): number {
  const longest = Math.max(1, ...title.split(/\s+/).map((w) => [...w].length));
  return Math.floor(Math.min(11.5, 70 / (longest * 0.6)) * 10) / 10;
}

export function coverArt(title: string): CoverArt {
  // Case and stray spaces don't change a book's colour.
  const h = hash(title.trim().toLowerCase());
  return {
    hue: h % 360,
    saturation: 26 + ((h >>> 9) % 22),
    lightness: 22 + ((h >>> 17) % 11),
    layout: ((h >>> 5) % 3) as CoverArt["layout"],
    titleSize: titleSize(title),
  };
}
