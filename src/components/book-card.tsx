import Link from "next/link";
import type { Book } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/stars";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/display";

/** Cover image with a graceful placeholder when there's no cover. */
export function BookCover({
  book,
  className,
}: {
  book: Pick<Book, "title" | "coverUrl">;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-md bg-muted ${className ?? ""}`}
    >
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className="size-10 text-muted-foreground/40" />
        </div>
      )}
    </div>
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
>;

/** Grid tile for the library view. */
export function BookCard({ book }: { book: BookCardBook }) {
  const progress =
    book.status === ReadingStatus.READING && book.currentPage != null && book.pageCount
      ? Math.min(book.currentPage / book.pageCount, 1)
      : null;

  return (
    <Link
      href={`/books/${book.id}`}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-ring/60"
    >
      <BookCover book={book} className="aspect-[2/3] w-full" />
      {progress !== null && (
        <div
          className="-mt-1 h-1.5 rounded-full bg-muted"
          title={`Page ${book.currentPage} of ${book.pageCount}`}
        >
          <div
            className="h-full rounded-full bg-primary/80"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
          {book.title}
        </p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {book.authors.join(", ")}
        </p>
        {book.seriesName && (
          <p className="line-clamp-1 text-xs italic text-muted-foreground/80">
            {book.seriesName}
            {book.seriesNumber != null ? ` #${book.seriesNumber}` : ""}
          </p>
        )}
        {/* flex-wrap: on narrow cards the badge drops below the stars
            instead of overflowing the card. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-1">
          {book.rating ? <Stars value={book.rating} /> : <span />}
          <Badge className={`${STATUS_BADGE_CLASS[book.status]} text-[10px]`}>
            {STATUS_LABELS[book.status]}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
