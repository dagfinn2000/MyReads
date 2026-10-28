/**
 * Smaller copies of locally cached covers (/api/covers/<file>?w=<width>),
 * for the browser to pick from. The copies are made on the server the first
 * time they are asked for (coverThumbnail in lib/covers.ts); this module
 * only builds their addresses, so client components can use it.
 *
 * A cover from Open Library is often 500 px wide or more and 50 to 100 KB.
 * Lists and grids show covers 28 to 250 CSS px wide, a phone drawing three
 * device pixels to each: two hundred originals were most of what a library
 * page downloaded and decoded, and most of its memory.
 */

/** The widths a cover can be asked for at, besides its own. */
export const COVER_WIDTHS = [160, 320, 480, 720] as const;

/** Whether `url` is a cover this app caches, and so has smaller copies. A
 *  remote address (a cover that couldn't be cached) or one with a query of
 *  its own is left as it is. */
export function hasCoverCopies(url: string): boolean {
  return url.startsWith("/api/covers/") && !url.includes("?");
}

/** The copy of a cached cover `width` pixels wide (at most its own). */
export function coverAt(url: string, width: (typeof COVER_WIDTHS)[number]): string {
  return hasCoverCopies(url) ? `${url}?w=${width}` : url;
}

/** srcset for a cached cover: every copy, by width. */
export function coverSrcSet(url: string): string | undefined {
  if (!hasCoverCopies(url)) return undefined;
  return COVER_WIDTHS.map((w) => `${url}?w=${w} ${w}w`).join(", ");
}
