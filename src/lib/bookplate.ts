import { BookFormat, BookOwnership } from "@/lib/enums";

/**
 * Bookplates: the "Ex libris" plate on the page of a book you own, under
 * its cover (components/bookplate.tsx), with your name on it and the
 * book's number in your library, as an old library numbered its books.
 */

/** The longest name a bookplate takes. */
export const BOOKPLATE_NAME_MAX = 40;

/** The name as it's kept: on one line, without spaces round it, and no
 *  longer than a plate takes. Empty means the username. */
export function parseBookplateName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, BOOKPLATE_NAME_MAX).trim();
}

/** Only a printed book you own takes a plate: one on your wishlist, lent to
 *  you or given away is someone else's, and an ebook has nowhere to paste
 *  one. */
export function takesBookplate(book: { ownership: string; format: string }): boolean {
  return book.ownership === BookOwnership.OWNED && book.format === BookFormat.PHYSICAL;
}

/** The books counted before this one (and this one), for its number: the
 *  printed books you own, in the order you added them. A query for
 *  prisma.book.count. */
export function bookplateCountWhere(
  userId: string,
  book: { id: string; createdAt: Date },
) {
  return {
    userId,
    ownership: BookOwnership.OWNED,
    format: BookFormat.PHYSICAL,
    OR: [
      { createdAt: { lt: book.createdAt } },
      // Books added in the same instant (an import) go by id.
      { createdAt: book.createdAt, id: { lte: book.id } },
    ],
  };
}
