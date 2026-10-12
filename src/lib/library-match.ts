import { prisma } from "@/lib/prisma";
import { isbnVariants } from "@/lib/isbn";
import { escapeLike, foldForSearch } from "@/lib/utils";

/**
 * "Is this book already in the library?" for the shelf scan. The same two
 * checks as GET /api/library/check (keep them in step): the exact edition by
 * ISBN in either form, then the same title by the same author in any
 * edition.
 */

/** What a match says about the book: enough to word it the way the check
 *  page does (lib/check-verdict.ts) and to mark it owned. */
const matchSelect = { id: true, title: true, ownership: true, format: true } as const;

/** The user's book with this ISBN, in its 10- or 13-digit form. */
export function findBookByIsbn(userId: string, isbn: string) {
  return prisma.book.findFirst({
    where: { userId, isbn: { in: isbnVariants(isbn) } },
    select: matchSelect,
  });
}

/**
 * A book of the user's whose searchText holds the title (folded, so
 * "Bronte" finds "Brontë") and, when known, the author's surname, which
 * keeps a short title from matching half the library.
 */
export function findBookByTitle(userId: string, title: string, author?: string | null) {
  const surname = (author ?? "").split(/\s+/).filter(Boolean).pop();
  return prisma.book.findFirst({
    where: {
      userId,
      AND: [
        { searchText: { contains: escapeLike(foldForSearch(title)) } },
        ...(surname ? [{ searchText: { contains: escapeLike(foldForSearch(surname)) } }] : []),
      ],
    },
    select: matchSelect,
  });
}
