import type { Book } from "@prisma/client";
import { BookOwnership, ReadingStatus } from "@prisma/client";
import {
  ArrowLeftRight,
  BookOpen,
  Gift,
  HandHeart,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { BookLink } from "@/components/book-link";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/stars";
import {
  OWNERSHIP_BADGE_LABELS,
  OWNERSHIP_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  formatDate,
  formatNumber,
  type FormatPrefs,
} from "@/lib/display";
import { coverArt } from "@/lib/cover-art";
import type { LibraryDisplay } from "@/lib/library-view";
import { cn } from "@/lib/utils";

/** Cover image, or a stand-in when the book has none.
 *  Lazy by default — grids request hundreds of covers at once, and the
 *  below-the-fold ones shouldn't compete with the visible page. The detail
 *  page passes `loading="eager"` for its above-the-fold hero cover. */
export function BookCover({
  book,
  className,
  loading = "lazy",
  flightTarget,
}: {
  book: Pick<Book, "title" | "coverUrl"> & { authors?: string[] };
  className?: string;
  loading?: "eager" | "lazy";
  /** The book's id, on the book page's own cover: where a cover clicked
   *  elsewhere flies to (lib/cover-flight.ts). */
  flightTarget?: string;
}) {
  return (
    <div
      className={cn("book-cover relative overflow-hidden rounded-md bg-muted", className)}
      data-cover-for={flightTarget}
    >
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          loading={loading}
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <MissingCover title={book.title} author={book.authors?.[0]} />
      )}
    </div>
  );
}

/**
 * A soft wash of a book's cover colours behind the top of its page: the
 * cover itself, stretched across the page width, blurred until only its
 * colours are left, and faded out downwards (globals.css, `.book-backdrop`).
 * A book without a cover image gets its drawn cover's colour instead, unless
 * drawn covers are off. "Behind a book's page: Nothing" in Preferences hides
 * it, through `data-book-backdrop` on <html>.
 */
export function BookBackdrop({ book }: { book: Pick<Book, "title" | "coverUrl"> }) {
  if (book.coverUrl) {
    return (
      <div className="book-backdrop" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={book.coverUrl} alt="" decoding="async" />
      </div>
    );
  }
  const art = coverArt(book.title);
  return (
    <div
      className="book-backdrop"
      data-drawn=""
      aria-hidden="true"
      style={
        {
          "--cover-hue": art.hue,
          "--cover-sat": `${art.saturation}%`,
          "--cover-light": `${art.lightness}%`,
        } as React.CSSProperties
      }
    />
  );
}

/**
 * The stand-in for a book without a cover image. Both kinds are rendered and
 * CSS shows one, following "Books without a cover" in Preferences
 * (`data-covers` on <html>; see globals.css) — so this stays a plain
 * component that server and client pages can share without passing the
 * setting down.
 *
 * The drawn cover is a coloured board with the title and first author,
 * coloured from the title (lib/cover-art.ts). The plain one is the old grey
 * box with a book icon.
 */
function MissingCover({ title, author }: { title: string; author?: string }) {
  const art = coverArt(title);
  return (
    <>
      <div
        className="drawn-cover"
        data-layout={art.layout}
        style={
          {
            "--cover-hue": art.hue,
            "--cover-sat": `${art.saturation}%`,
            "--cover-light": `${art.lightness}%`,
            "--cover-title": `${art.titleSize}cqi`,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <div className="drawn-cover-frame">
          <span className="drawn-cover-title">{title}</span>
          <span className="drawn-cover-rule" />
          {author && <span className="drawn-cover-author">{author}</span>}
        </div>
      </div>
      <div className="plain-cover h-full w-full items-center justify-center">
        <BookOpen className="size-10 text-muted-foreground/40" />
      </div>
    </>
  );
}

/** The slice of a Book the library grid actually renders. The books page
 *  fetches exactly this (plus its sort keys) instead of full rows, so large
 *  text fields (description, review, searchText) never reach the client. */
export type BookCardBook = Pick<
  Book,
  | "id"
  | "title"
  | "authors"
  | "coverUrl"
  | "status"
  | "rating"
  | "currentPage"
  | "pageCount"
  | "seriesName"
  | "seriesNumber"
> & {
  /** True when an unreturned loan exists. Passed as a flag rather than the
   *  loan rows so the grid payload stays the card's fields only. */
  lentOut?: boolean;
  /** For the details the View menu can add: an ownership badge, and a list
   *  row's date. */
  ownership?: BookOwnership;
  createdAt?: Date;
  dateFinished?: Date | null;
};

/** Which details a card or row shows (the library's View menu). */
export type CardDetails = Pick<
  LibraryDisplay,
  "showRating" | "showStatus" | "showSeries" | "showOwnership" | "rowDate" | "showPageCount"
>;

const ALL_DETAILS: CardDetails = {
  showRating: true,
  showStatus: true,
  showSeries: true,
  showOwnership: false,
  rowDate: "none",
  showPageCount: false,
};

/** Reading progress as 0–1 while a book is being read, else null. */
function readingProgress(book: BookCardBook): number | null {
  return book.status === ReadingStatus.READING && book.currentPage != null && book.pageCount
    ? Math.min(book.currentPage / book.pageCount, 1)
    : null;
}

function LentBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-400 text-[10px] text-amber-700 dark:text-amber-300"
      title="Lent out"
    >
      <HandHeart className="size-3" />
      Lent
    </Badge>
  );
}

const OWNERSHIP_ICONS: Record<Exclude<BookOwnership, "OWNED">, LucideIcon> = {
  WISHLIST: Heart,
  BORROWED: ArrowLeftRight,
  GIVEN_AWAY: Gift,
};

/** Wishlist, Borrowed or Given away. Owned is the usual case and gets no
 *  badge, so the ones worth noticing stand out. */
function OwnershipBadge({ ownership }: { ownership: BookOwnership }) {
  if (ownership === BookOwnership.OWNED) return null;
  const Icon = OWNERSHIP_ICONS[ownership];
  return (
    <Badge
      variant="outline"
      className="text-[10px] text-muted-foreground"
      title={OWNERSHIP_LABELS[ownership]}
    >
      <Icon className="size-3" aria-hidden="true" />
      {OWNERSHIP_BADGE_LABELS[ownership]}
    </Badge>
  );
}

function seriesLabel(book: BookCardBook): string {
  return `${book.seriesName}${book.seriesNumber != null ? ` #${book.seriesNumber}` : ""}`;
}

/** A list row's extra line: the date added or finished and the page count,
 *  as the View menu asks. Empty when there is nothing to show (a date
 *  finished for a book not finished, say). */
function rowFacts(book: BookCardBook, details: CardDetails, formatPrefs?: FormatPrefs): string {
  const facts: string[] = [];
  if (details.rowDate === "added" && book.createdAt) {
    facts.push(`Added ${formatDate(book.createdAt, formatPrefs)}`);
  }
  if (details.rowDate === "finished" && book.dateFinished) {
    facts.push(`Finished ${formatDate(book.dateFinished, formatPrefs)}`);
  }
  if (details.showPageCount && book.pageCount) {
    facts.push(`${formatNumber(book.pageCount, formatPrefs)} pages`);
  }
  return facts.join(" · ");
}

/**
 * One line per book for the library's list layout: a small cover, title,
 * author and series, then rating and badges on the right. For long
 * libraries, where scanning titles beats scanning covers.
 */
export function BookRow({
  book,
  details = ALL_DETAILS,
  formatPrefs,
}: {
  book: BookCardBook;
  details?: CardDetails;
  /** The reader's date and number formats, for the date and page count
   *  line. Passed in so this file stays free of hooks: server pages import
   *  BookCover from it. */
  formatPrefs?: FormatPrefs;
}) {
  const progress = readingProgress(book);
  const facts = rowFacts(book, details, formatPrefs);
  return (
    <BookLink
      bookId={book.id}
      className="surface lift group flex items-center gap-3 rounded-lg border bg-card p-2 shadow-(--surface-shadow) transition-colors hover:border-ring/60"
    >
      <BookCover book={book} className="aspect-[2/3] w-10 shrink-0" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate font-heading text-sm font-medium group-hover:underline">
          {book.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {book.authors.join(", ")}
          {details.showSeries && book.seriesName && (
            <span className="italic text-muted-foreground/80"> · {seriesLabel(book)}</span>
          )}
        </p>
        {facts && <p className="truncate text-xs text-muted-foreground tabular-nums">{facts}</p>}
        {progress !== null && (
          <div
            className="mt-0.5 h-1 max-w-40 rounded-full bg-muted"
            title={`Page ${book.currentPage} of ${book.pageCount}`}
          >
            <div
              className="bar-grow h-full rounded-full bg-primary/80"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {details.showRating && book.rating ? <Stars value={book.rating} /> : null}
        {details.showOwnership && book.ownership && <OwnershipBadge ownership={book.ownership} />}
        {book.lentOut && <LentBadge />}
        {details.showStatus && (
          <Badge className={`${STATUS_BADGE_CLASS[book.status]} hidden text-[10px] sm:inline-flex`}>
            {STATUS_LABELS[book.status]}
          </Badge>
        )}
      </div>
    </BookLink>
  );
}

/** Grid tile for the library view. */
export function BookCard({
  book,
  details = ALL_DETAILS,
  compact = false,
}: {
  book: BookCardBook;
  details?: CardDetails;
  /** Small covers: tighter padding, no author line. */
  compact?: boolean;
}) {
  const progress = readingProgress(book);

  return (
    <BookLink
      bookId={book.id}
      className={cn(
        "surface lift group flex flex-col rounded-lg border bg-card shadow-(--surface-shadow) transition-colors hover:border-ring/60",
        compact ? "gap-1.5 p-2" : "gap-2 p-3",
      )}
    >
      <BookCover book={book} className="aspect-[2/3] w-full" />
      {progress !== null && (
        <div
          className="-mt-1 h-1.5 rounded-full bg-muted"
          title={`Page ${book.currentPage} of ${book.pageCount}`}
        >
          <div
            className="bar-grow h-full rounded-full bg-primary/80"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1">
        <p
          className={cn(
            "line-clamp-2 font-heading font-medium leading-snug group-hover:underline",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {book.title}
        </p>
        {!compact && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {book.authors.join(", ")}
          </p>
        )}
        {details.showSeries && book.seriesName && (
          <p className="line-clamp-1 text-xs italic text-muted-foreground/80">
            {seriesLabel(book)}
          </p>
        )}
        {/* flex-wrap: on narrow cards the badge drops below the stars
            instead of overflowing the card. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-1">
          {details.showRating && book.rating ? <Stars value={book.rating} /> : <span />}
          <span className="flex flex-wrap items-center gap-1">
            {details.showOwnership && book.ownership && (
              <OwnershipBadge ownership={book.ownership} />
            )}
            {book.lentOut && <LentBadge />}
            {details.showStatus && (
              <Badge className={`${STATUS_BADGE_CLASS[book.status]} text-[10px]`}>
                {STATUS_LABELS[book.status]}
              </Badge>
            )}
          </span>
        </div>
      </div>
    </BookLink>
  );
}

/** "Covers only": the cover and title with no frame, details or badges. */
export function BookCoverTile({ book, compact = false }: { book: BookCardBook; compact?: boolean }) {
  const progress = readingProgress(book);
  return (
    <BookLink bookId={book.id} className="lift-cover group flex flex-col gap-1.5">
      <BookCover book={book} className="cover-shadow aspect-[2/3] w-full" />
      {progress !== null && (
        <div
          className="h-1 rounded-full bg-muted"
          title={`Page ${book.currentPage} of ${book.pageCount}`}
        >
          <div
            className="bar-grow h-full rounded-full bg-primary/80"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      <p
        className={cn(
          "line-clamp-2 font-heading leading-snug text-muted-foreground group-hover:text-foreground group-hover:underline",
          compact ? "text-[11px]" : "text-xs",
        )}
      >
        {book.title}
      </p>
    </BookLink>
  );
}

/** "Bookshelf": just the cover, standing on the shelf its slot draws
 *  (globals.css). The title shows on hover and to screen readers. */
export function BookOnShelf({ book }: { book: BookCardBook }) {
  const byline = book.authors.length ? ` by ${book.authors.join(", ")}` : "";
  return (
    <BookLink bookId={book.id} className="lift-cover block" title={`${book.title}${byline}`}>
      <BookCover book={book} className="cover-shadow aspect-[2/3] w-full" />
      <span className="sr-only">{book.title}</span>
    </BookLink>
  );
}
