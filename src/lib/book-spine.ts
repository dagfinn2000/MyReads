import { coverArt, hash } from "@/lib/cover-art";
import { NAME_SUFFIXES, SURNAME_PARTICLES } from "@/lib/names";

/**
 * How a book looks standing spine out: the library's Spines view and the
 * shelf on a Year in review (components/book-spine.tsx). Kept free of React
 * so it can be tested.
 *
 * Everything comes from the book itself, so it looks the same on every
 * visit: thicker books get wider spines, and the title picks the height and
 * the binding, so a shelf looks bought over years rather than as a set.
 */

/** The bindings a spine can wear (globals.css draws them): gilt bands at
 *  the head and foot, a label panel the title sits on, a darker leather head
 *  and foot, or a plain cloth spine with a small ornament. */
export const SPINE_DESIGNS = ["bands", "label", "leather", "cloth"] as const;
export type SpineDesign = (typeof SPINE_DESIGNS)[number];

export interface SpineShape {
  /** Width in rem at the medium size: 1.35 to 3.4, by page count. */
  width: number;
  /** Height as a share of the shelf's tallest spine: 0.84 to 1. */
  height: number;
  design: SpineDesign;
  /** Wide enough for the title to run down it in two lines. */
  twoLines: boolean;
}

/** A book's width, height and binding. An unknown page count gets an
 *  ordinary width. */
export function spineShape(book: { title: string; pageCount: number | null }): SpineShape {
  const pages = book.pageCount && book.pageCount > 0 ? book.pageCount : null;
  const width = pages === null ? 1.9 : Math.min(3.4, Math.max(1.35, 1.25 + pages / 500));
  const h = hash(book.title.trim().toLowerCase());
  return {
    width: Math.round(width * 100) / 100,
    height: (84 + ((h >>> 5) % 17)) / 100,
    design: SPINE_DESIGNS[(h >>> 13) % SPINE_DESIGNS.length],
    twoLines: width >= 2.4,
  };
}

/** The colour of a spine for a book without a cover colour: its drawn
 *  cover's, as "#rrggbb" so spineInk can read it. */
export function drawnSpineHex(title: string): string {
  const art = coverArt(title);
  return hslToHex(art.hue, art.saturation, art.lightness + 6);
}

/** Pale or dark lettering, whichever reads better on `colour` ("#rrggbb";
 *  anything else is taken as dark). */
export function spineInk(colour: string): "light" | "dark" {
  const m = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!m) return "light";
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  // Where black and near-white text have the same contrast.
  return luminance > 0.2 ? "dark" : "light";
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** The name at the foot of a spine: the surname as written, with its
 *  particles, as the library files it ("Ursula K. Le Guin" → "Le Guin").
 *  A one-word name is its own. */
export function spineAuthor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && NAME_SUFFIXES.has(words[words.length - 1].toLowerCase())) words.pop();
  let start = words.length - 1;
  while (start > 0 && SURNAME_PARTICLES.has(words[start - 1].toLowerCase())) start--;
  return words.slice(Math.max(0, start)).join(" ");
}
