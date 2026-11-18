"use client";

import type { Book } from "@prisma/client";
import { BookOwnership, ReadingStatus } from "@/lib/enums";
import { BookLink } from "@/components/book-link";
import { usePreferences } from "@/components/preferences-provider";
import { drawnSpineHex, spineAuthor, spineInk, spineShape } from "@/lib/book-spine";
import { bookStatusName } from "@/lib/statuses";
import { dustGrain } from "@/lib/shelf-wear";
import { readingAt, type CoverWear } from "@/components/book-card";
import { cn } from "@/lib/utils";
import { fineText } from "@/lib/fine-type";

/** What a spine needs to know about its book. */
export type SpineBook = Pick<
  Book,
  "id" | "title" | "authors" | "coverUrl" | "pageCount" | "status"
> &
  Partial<Pick<Book, "currentPage">> & {
  statusKey?: string | null;
  ownership?: BookOwnership;
  /** Lent out right now. */
  lentOut?: boolean;
} & CoverWear;

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
 * the foot. A book being read has a bookmark peeking out of the top and is
 * in its full colour only as far up as the reader has got, filling up to
 * there as the shelf opens (unless Preferences turns that off). One on the
 * wishlist, lent out or given away keeps its place as an outline, as in the
 * reading room.
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
  const at = readingAt({ ...book, currentPage: book.currentPage ?? null });
  const read = at ? Math.min(1, Math.max(0, at.page / at.of)) : null;
  const author = book.authors[0] ? spineAuthor(book.authors[0]) : "";
  const byline = book.authors.length ? `, by ${book.authors.join(", ")}` : "";
  const notes = [bookStatusName(book, prefs)];
  if (at) notes.push(`page ${at.page} of ${at.of}`);
  if (book.ownership === BookOwnership.WISHLIST) notes.push("on your wishlist");
  else if (book.ownership === BookOwnership.GIVEN_AWAY) notes.push("given away");
  else if (book.lentOut) notes.push("lent out");
  if (book.wearNote) notes.push(book.wearNote);
  const label = ownLabel ?? `${book.title}${byline}. ${notes.join(" · ")}`;

  return (
    <BookLink
      bookId={book.id}
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
        <span className="spine-title">{fineText(book.title)}</span>
        {author && <span className="spine-author">{author}</span>}
        {read != null && !away && (
          // The colour not yet come in above where the reader is: a grey
          // of it, and a pale wash (globals.css, "Spines").
          <>
            <span className="spine-unread" style={{ "--read": read } as React.CSSProperties} />
            <span
              className="spine-unread spine-unread-wash"
              style={{ "--read": read } as React.CSSProperties}
            />
          </>
        )}
        {(!!book.dust || !!book.worn) && (
          <span
            className="spine-wear"
            data-dust={book.dust || undefined}
            data-worn={book.worn || undefined}
            data-grain={dustGrain(book.title)}
          />
        )}
      </span>
      {reading && <span className="spine-bookmark" aria-hidden="true" />}
    </BookLink>
  );
}
