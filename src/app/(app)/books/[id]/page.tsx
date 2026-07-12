import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Repeat } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, FORMAT_LABELS, STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/display";
import { BookCover } from "@/components/book-card";
import { DeleteBookButton } from "@/components/delete-book-button";
import { ReadingCard } from "@/components/reading-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id } = await params;

  const book = await prisma.book.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!book) notFound();

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="grid content-start gap-3">
        <BookCover book={book} className="aspect-[2/3] w-full max-w-60" />
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/books/${book.id}/edit`}>
              <Pencil data-slot="icon" />
              Edit
            </Link>
          </Button>
          <DeleteBookButton bookId={book.id} title={book.title} />
        </div>
      </div>

      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
          {book.authors.length > 0 && (
            <p className="mt-1 text-lg text-muted-foreground">
              {book.authors.join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_BADGE_CLASS[book.status]}>
            {STATUS_LABELS[book.status]}
          </Badge>
          <Badge variant="secondary">{FORMAT_LABELS[book.format]}</Badge>
          {book.owned && <Badge variant="outline">Owned</Badge>}
          {book.timesRead > 1 && (
            <Badge variant="outline">
              <Repeat data-slot="icon" className="size-3" />
              Read {book.timesRead}×
            </Badge>
          )}
          {book.tags.map((tag) => (
            <Link key={tag} href={`/books?tag=${encodeURIComponent(tag)}`}>
              <Badge variant="secondary" className="hover:bg-accent">
                {tag}
              </Badge>
            </Link>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {book.pageCount && (
            <div>
              <dt className="text-muted-foreground">Pages</dt>
              <dd>{book.pageCount}</dd>
            </div>
          )}
          {book.publishedDate && (
            <div>
              <dt className="text-muted-foreground">Published</dt>
              <dd>{book.publishedDate}</dd>
            </div>
          )}
          {book.isbn && (
            <div>
              <dt className="text-muted-foreground">ISBN</dt>
              <dd>{book.isbn}</dd>
            </div>
          )}
          {book.dateFinished && (
            <div>
              <dt className="text-muted-foreground">Finished</dt>
              <dd>{formatDate(book.dateFinished)}</dd>
            </div>
          )}
        </dl>

        {book.description && (
          <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {book.description}
          </p>
        )}

        <ReadingCard book={book} />
      </div>
    </div>
  );
}
