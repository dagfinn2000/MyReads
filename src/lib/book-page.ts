import { BOOK_PAGE_CARDS, type BookPageCard, type Preferences } from "@/lib/preferences";

/** Which of a book's cards have something of the reader's in them. */
export type CardHasContent = Partial<Record<BookPageCard, boolean>>;

/**
 * The line under a card that shows although the reader hid it. Only these
 * cards are ever shown that way: each holds something written down nowhere
 * else on the page. Shelves never is, since a book's shelves also show in
 * the library.
 */
export const FORCED_CARD_NOTES: Partial<Record<BookPageCard, string>> = {
  reading: "Shown although hidden, because you're reading it or wrote a review.",
  history: "Shown although hidden, because this book has past reads.",
  lending: "Shown although hidden, because it's lent out.",
  quotes: "Shown although hidden, because you've saved quotes from it.",
};

/**
 * The cards a book's page shows, in the reader's order. A hidden card is
 * left out unless it has content, so hiding a card never hides an open loan
 * or a saved quote; such a card comes back `forced`. Every card is placed
 * even if `bookPageCards` leaves one out (parsePreferences fills it in, but
 * this doesn't rely on that).
 */
export function arrangeBookCards(
  prefs: Pick<Preferences, "bookPageCards" | "hiddenBookPageCards">,
  hasContent: CardHasContent,
): { key: BookPageCard; forced: boolean }[] {
  const listed = prefs.bookPageCards.filter((c) => BOOK_PAGE_CARDS.includes(c));
  const order = new Set([...listed, ...BOOK_PAGE_CARDS]);
  const out: { key: BookPageCard; forced: boolean }[] = [];
  for (const key of order) {
    if (!prefs.hiddenBookPageCards.includes(key)) out.push({ key, forced: false });
    else if (FORCED_CARD_NOTES[key] && hasContent[key]) out.push({ key, forced: true });
  }
  return out;
}

/** A first guess, before the page can measure, at whether a description
 *  runs past four lines: long, or several paragraphs. */
export function descriptionMayOverflow(text: string): boolean {
  return text.length > 300 || text.split("\n").length > 4;
}

/** How long a description's first paragraph must be for a drop cap: about
 *  three lines on a wide screen, so the capital never stands taller than
 *  the text beside it. */
const DROP_CAP_MIN = 200;

/** Whether a description opens on a drop cap with "Like a printed book"
 *  typography (globals.css, "Book typography"): its first paragraph is long
 *  enough and starts with a letter, since a quote mark or a number three
 *  lines tall looks clumsy. */
export function takesDropCap(text: string): boolean {
  const first = text.trim().split("\n")[0];
  return first.length >= DROP_CAP_MIN && /^\p{L}/u.test(first);
}
