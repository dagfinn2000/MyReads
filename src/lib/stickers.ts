/**
 * Stickers and stamps a reader can pin on a book's cover (Book.stickers),
 * the way a shop marks a signed copy or a gift gets its tag. They are drawn
 * in components/cover-stickers.tsx and show on the cover wherever it is big
 * enough: the book's page, and the library's cards, covers and bookshelf.
 * A book keeps them in the order they were pinned; the first ones are the
 * ones a small cover has room for.
 */

export type StickerKey = (typeof STICKERS)[number]["key"];

export type Sticker = {
  key: string;
  name: string;
  /** A rubber stamp (on a paper label), pressed at more of an angle. */
  stamp?: boolean;
};

export const STICKERS = [
  { key: "signed", name: "Signed" },
  { key: "first-edition", name: "First edition" },
  { key: "gift", name: "A gift" },
  { key: "reread", name: "Re-read", stamp: true },
  { key: "loved", name: "Loved" },
  { key: "book-club", name: "Book club" },
  { key: "award", name: "Award winner" },
  { key: "bargain", name: "Bargain" },
  { key: "rare", name: "Rare" },
  { key: "holiday", name: "Holiday read" },
] as const satisfies readonly Sticker[];

const KNOWN = new Set<string>(STICKERS.map((s) => s.key));

/** At most this many on one book. */
export const MAX_STICKERS = STICKERS.length;

/** The sticker with this key, or undefined for one no longer known. */
export function stickerOf(key: string): Sticker | undefined {
  return STICKERS.find((s) => s.key === key);
}

/** A list of sticker keys made safe to save: known ones only, each once,
 *  in the order given. Anything else (from a form, a backup) is dropped. */
export function cleanStickers(list: unknown): StickerKey[] {
  if (!Array.isArray(list)) return [];
  const out: StickerKey[] = [];
  for (const k of list) {
    if (typeof k === "string" && KNOWN.has(k) && !out.includes(k as StickerKey)) out.push(k as StickerKey);
  }
  return out.slice(0, MAX_STICKERS);
}

/** How far a sticker on a book sits off straight, in degrees, the same
 *  every time: pinned by hand, none of them quite level. A stamp is pressed
 *  at more of an angle. */
export function stickerTilt(title: string, key: string): number {
  let h = 2166136261;
  for (const c of `${title}\u0000${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const span = stickerOf(key)?.stamp ? 26 : 18;
  return Math.round(((h % 1000) / 1000 - 0.5) * span);
}
