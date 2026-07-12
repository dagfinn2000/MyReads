import Link from "next/link";
import type { Book } from "@prisma/client";
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

/** Grid tile for the library view. */
export function BookCard({ book }: { book: Book }) {
  return (
    <Link
      href={`/books/${book.id}`}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-ring/60"
    >
      <BookCover book={book} className="aspect-[2/3] w-full" />
      <div className="flex flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
          {book.title}
        </p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {book.authors.join(", ")}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1">
          {book.rating ? <Stars value={book.rating} /> : <span />}
          <Badge className={`${STATUS_BADGE_CLASS[book.status]} text-[10px]`}>
            {STATUS_LABELS[book.status]}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
