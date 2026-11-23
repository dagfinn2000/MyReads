import { coverArt } from "@/lib/cover-art";

/**
 * The library's sort by cover colour: a rainbow shelf. Each book's main
 * colour (its cover's, read on the server with the spines' rule, or its
 * drawn cover's) becomes a number: reds first, through orange, yellow,
 * green, blue and violet to pink, each hue running light to dark, and then
 * the covers with hardly any colour, white through grey to black. Books
 * whose cover colour isn't known have no number and come last.
 */

/** Hues fall into bands this wide; within a band, light comes before dark. */
const BAND = 15;
/** Reds a little the purple side of 0° still count as red. */
const HUE_SHIFT = 18;
/** Below this saturation (HSL, 0–1) a cover reads as grey, white or black. */
const GREY = 0.14;
/** The first key of the greys, after every hue band. */
const GREYS = 1000;

/** The rainbow key of a colour given as HSL (hue in degrees, the rest 0–1). */
export function rainbowKeyHsl(hue: number, saturation: number, lightness: number): number {
  const dark = 1 - lightness;
  if (saturation < GREY || lightness < 0.08 || lightness > 0.95) return GREYS + dark * 100;
  const shifted = (((hue + HUE_SHIFT) % 360) + 360) % 360;
  return Math.floor(shifted / BAND) * 10 + dark * 9;
}

/** HSL of "#rrggbb", or null when it isn't one. */
export function hexToHsl(hex: string): { hue: number; saturation: number; lightness: number } | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = d / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return { hue: (hue * 60 + 360) % 360, saturation, lightness };
}

/** The rainbow key of "#rrggbb", or null. */
export function rainbowKey(hex: string): number | null {
  const hsl = hexToHsl(hex);
  return hsl ? rainbowKeyHsl(hsl.hue, hsl.saturation, hsl.lightness) : null;
}

/** The address of a cover cached on this server, as its file name. */
export function cachedCoverFile(coverUrl: string | null | undefined): string | null {
  const named = coverUrl ? /^\/api\/covers\/([^/?#]+)/.exec(coverUrl)?.[1] : undefined;
  return named ?? null;
}

/**
 * A book's rainbow key: its cached cover's colour from `colours` (by file
 * name), or for a book without a cover image the colour its cover is
 * drawn in. Null when its colour isn't known: a cover on another site, or
 * one that couldn't be read.
 */
export function bookRainbowKey(
  book: { title: string; coverUrl: string | null },
  colours: ReadonlyMap<string, string>,
): number | null {
  if (!book.coverUrl) {
    const art = coverArt(book.title);
    return rainbowKeyHsl(art.hue, art.saturation / 100, art.lightness / 100);
  }
  const file = cachedCoverFile(book.coverUrl);
  const colour = file ? colours.get(file) : undefined;
  return colour ? rainbowKey(colour) : null;
}
