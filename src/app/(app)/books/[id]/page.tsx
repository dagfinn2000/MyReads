import Link from "next/link";
import { notFound } from "next/navigation";
import { Library, Pencil, Repeat } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, FORMAT_LABELS, STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/display";
import { BookCover } from "@/components/book-card";
import { BookShelvesCard } from "@/components/book-shelves-card";
import { DeleteBookButton } from "@/components/delete-book-button";
import { QuotesCard } from "@/components/quotes-card";
import { ReadHistoryCard } from "@/components/read-history-card";
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
  const userId = session.user.id;

  const book = await prisma.book.findFirst({
    where: { id, userId },
    include: {
      shelves: { select: { id: true } },
      quotes: {
        orderBy: [{ page: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      },
      // Oldest pass first; undated reads are presumed oldest.
      reads: {
        orderBy: [
          { dateFinished: { sort: "asc", nulls: "first" } },
          { createdAt: "asc" },
        ],
      },
      // The automatic reading log, oldest first (page breaks same-instant
      // ties — a pass's page-0 anchor sorts before its first real entry).
      progress: {
        orderBy: [{ date: "asc" }, { page: "asc" }],
      },
    },
  });
  if (!book) notFound();

  // Sidebar data: every shelf (for the assignment card) and, if this book is
  // part of a series, its siblings ordered by series number.
  const [allShelves, seriesBooks] = await Promise.all([
    prisma.shelf.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    book.seriesName
      ? prisma.book.findMany({
          where: {
            userId,
            seriesName: { equals: book.seriesName, mode: "insensitive" },
            id: { not: book.id },
          },
          orderBy: { seriesNumber: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const seriesHref = book.seriesName
    ? `/books?series=${encodeURIComponent(book.seriesName)}&group=series`
    : null;

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="grid content-start gap-3">
        <BookCover book={book} className="aspect-[2/3] w-full max-w-60" loading="eager" />
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
          {book.seriesName && seriesHref && (
            <Link
              href={seriesHref}
              className="mt-1 inline-flex items-center gap-1.5 text-sm italic text-muted-foreground hover:text-foreground hover:underline"
            >
              <Library className="size-3.5" />
              {book.seriesName}
              {book.seriesNumber != null ? ` #${book.seriesNumber}` : ""}
            </Link>
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

        {seriesBooks.length > 0 && seriesHref && (
          <section className="grid gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              More in{" "}
              <Link href={seriesHref} className="italic hover:underline">
                {book.seriesName}
              </Link>
            </h2>
            <div className="flex flex-wrap gap-3">
              {seriesBooks.map((b) => (
                <Link
                  key={b.id}
                  href={`/books/${b.id}`}
                  className="group w-20"
                  title={`${b.title}${b.seriesNumber != null ? ` (#${b.seriesNumber})` : ""}`}
                >
                  <BookCover book={b} className="aspect-[2/3] w-20" />
                  <p className="mt-1 line-clamp-2 text-xs leading-tight text-muted-foreground group-hover:text-foreground">
                    {b.seriesNumber != null ? `#${b.seriesNumber} · ` : ""}
                    {b.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <BookShelvesCard
          bookId={book.id}
          shelves={allShelves}
          memberIds={book.shelves.map((s) => s.id)}
        />

        <ReadingCard book={book} progress={book.progress} />

        <ReadHistoryCard book={book} reads={book.reads} />

        <QuotesCard bookId={book.id} quotes={book.quotes} />
      </div>
    </div>
  );
}
