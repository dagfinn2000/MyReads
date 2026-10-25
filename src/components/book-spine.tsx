"use client";

import type { Book } from "@prisma/client";
import { BookOwnership, ReadingStatus } from "@/lib/enums";
import { BookLink } from "@/components/book-link";
import { usePreferences } from "@/components/preferences-provider";
import { drawnSpineHex, spineAuthor, spineInk, spineShape } from "@/lib/book-spine";
import { bookStatusName } from "@/lib/statuses";
import { cn } from "@/lib/utils";

/** What a spine needs to know about its book. */
export type SpineBook = Pick<
  Book,
  "id" | "title" | "authors" | "coverUrl" | "pageCount" | "status"
> & {
  statusKey?: string | null;
  ownership?: BookOwnership;
  /** Lent out right now. */
  lentOut?: boolean;
};

/** The spine's colour: its cover's main colour once read
 *  (lib/cover-colours.ts), else its drawn cover's. */
export function spineColourOf(book: Pick<SpineBook, "title" | "coverUrl">, known: Record<string, string>): string {
  return (book.coverUrl && known[book.coverUrl]) || drawnSpineHex(book.title);
}

/**
 * A book standing spine out on a shelf, for the library's Spines view and
 * the shelf on a Year in review (globals.css, "Spines"). Its width comes
 * from the page count and its height and binding from the title
 * (lib/book-spine.ts); the title runs down it with the author's surname at
 * the foot. A book being read has a bookmark peeking out of the top, and one
 * on the wishlist, lent out or given away keeps its place as an outline, as
 * in the reading room.
 *
 * The link itself is what flies to the book page's cover when clicked
 * (`data-flight-cover`, components/book-link.tsx).
 */
export function BookSpine({
  book,
  colour,
  label: ownLabel,
  className,
}: {
  book: SpineBook;
  colour: string;
  /** What it says to a screen reader and under the pointer, in place of
   *  the title, author and status. */
  label?: string;
  className?: string;
}) {
  const prefs = usePreferences();
  const shape = spineShape(book);
  const away =
    book.ownership === BookOwnership.WISHLIST ||
    book.ownership === BookOwnership.GIVEN_AWAY ||
    !!book.lentOut;
  const reading = book.status === ReadingStatus.READING;
  const author = book.authors[0] ? spineAuthor(book.authors[0]) : "";
  const byline = book.authors.length ? `, by ${book.authors.join(", ")}` : "";
  const notes = [bookStatusName(book, prefs)];
  if (book.ownership === BookOwnership.WISHLIST) notes.push("on your wishlist");
  else if (book.ownership === BookOwnership.GIVEN_AWAY) notes.push("given away");
  else if (book.lentOut) notes.push("lent out");
  const label = ownLabel ?? `${book.title}${byline}. ${notes.join(" · ")}`;

  return (
    <BookLink
      bookId={book.id}
      prefetch={false}
      className={cn("spine-link", className)}
      data-flight-cover=""
      aria-label={label}
      title={label}
      style={
        {
          "--spine-w": `${shape.width}rem`,
          "--spine-tall": shape.height,
          "--spine": colour,
        } as React.CSSProperties
      }
    >
      <span
        className="book-spine"
        data-design={shape.design}
        data-lines={shape.twoLines ? 2 : undefined}
        data-ink={spineInk(colour)}
        data-away={away ? "" : undefined}
        aria-hidden="true"
      >
        <span className="spine-title">{book.title}</span>
        {author && <span className="spine-author">{author}</span>}
      </span>
      {reading && <span className="spine-bookmark" aria-hidden="true" />}
    </BookLink>
  );
}
