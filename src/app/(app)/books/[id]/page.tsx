import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReadingStatus } from "@prisma/client";
import { Library, Pencil, Repeat } from "lucide-react";
import { BookFormat } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPreferences } from "@/lib/current-user";
import { arrangeBookCards, FORCED_CARD_NOTES } from "@/lib/book-page";
import { orderByIds } from "@/lib/library-order";
import type { BookPageCard } from "@/lib/preferences";
import {
  formatDate,
  FORMAT_LABELS,
  OWNERSHIP_BADGE_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
} from "@/lib/display";
import { AuthorLinks } from "@/components/author-links";
import { formatLength } from "@/lib/progress-units";
import { BookBackdrop, BookCover } from "@/components/book-card";
import { BookDescription } from "@/components/book-description";
import { BookLink } from "@/components/book-link";
import { BookShelvesCard } from "@/components/book-shelves-card";
import { CloseBookButton } from "@/components/close-book-button";
import { DeleteBookButton } from "@/components/delete-book-button";
import { FindItAt } from "@/components/find-it-at";
import { QuotesCard } from "@/components/quotes-card";
import { LendingCard } from "@/components/lending-card";
import { showsLendingCard } from "@/lib/loans";
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
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const { id } = await params;
  const userId = session.user.id;
  const prefs = await getPreferences();

  // Kicked off before the book fetch so the two round-trips overlap. The
  // no-op catch keeps a 404'd render (which never awaits this) from turning
  // a failed shelf query into an unhandled rejection; the Promise.all below
  // still sees the original promise and surfaces the error normally.
  const shelvesPromise = prisma.shelf.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  shelvesPromise.catch(() => {});

  const book = await prisma.book.findFirst({
    where: { id, userId },
    // Search's folded copies of title, authors, series and review: the
    // reading card is a client component and would carry them to the page.
    omit: { searchText: true, reviewSearchText: true },
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
      // Newest first: the open loan (if any) leads, history follows.
      loans: { orderBy: { lentAt: "desc" } },
    },
  });
  if (!book) notFound();

  // Sidebar data: every shelf (for the assignment card) and, if this book is
  // part of a series, its siblings ordered by series number.
  const [allShelves, seriesBooks] = await Promise.all([
    shelvesPromise,
    book.seriesName
      ? prisma.book.findMany({
          where: {
            userId,
            seriesName: { equals: book.seriesName, mode: "insensitive" },
            id: { not: book.id },
          },
          // Just what the cover strip renders — not the full rows.
          select: { id: true, title: true, coverUrl: true, seriesNumber: true },
          orderBy: { seriesNumber: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const seriesHref = book.seriesName
    ? `/books?series=${encodeURIComponent(book.seriesName)}&group=series`
    : null;

  // The cards below the details, in the reader's order (Preferences > Book
  // page). A hidden card still shows when it holds something written down
  // nowhere else on the page, with a line saying why.
  const cards: Record<BookPageCard, React.ReactNode> = {
    shelves: (
      <BookShelvesCard
        bookId={book.id}
        // In the reader's own order, as the library's shelf chips are.
        shelves={orderByIds(allShelves, prefs.shelfOrder)}
        memberIds={book.shelves.map((s) => s.id)}
      />
    ),
    reading: <ReadingCard book={book} progress={book.progress} />,
    history: <ReadHistoryCard book={book} reads={book.reads} />,
    // A wishlist copy with no loan history has nothing to show.
    lending: showsLendingCard(book.ownership, book.loans.length) ? (
      <LendingCard bookId={book.id} ownership={book.ownership} loans={book.loans} />
    ) : null,
    quotes: <QuotesCard bookId={book.id} quotes={book.quotes} />,
  };
  const arranged = arrangeBookCards(prefs, {
    reading: book.status === ReadingStatus.READING || !!book.review?.trim(),
    history: book.reads.length > 0,
    lending: book.loans.some((l) => l.returnedAt === null),
    quotes: book.quotes.length > 0,
  });

  return (
    <>
      {/* Outside the positioned page below, so the wash still runs the
          full width of the window. */}
      <BookBackdrop book={book} />
      {/* Both column definitions clamp their track minimums to 0 — with the
          default (auto) minimum, one unbreakable token in the description
          (Open Library URLs, say) would stretch the whole page past the
          viewport. */}
      <div className="book-page relative grid grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        <CloseBookButton bookId={book.id} />
        <div className="grid content-start gap-3">
          <BookCover
            book={book}
            className="hero-cover aspect-[2/3] w-full max-w-60"
            loading="eager"
            flightTarget={book.id}
          />
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

        <div className="grid grid-cols-1 content-start gap-4">
          {/* A title, author or series with no spaces to break at wraps
              anywhere, instead of pushing the page sideways. */}
          <div className="book-title wrap-anywhere">
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              {book.title}
            </h1>
            {book.authors.length > 0 && (
              <p className="mt-1.5 text-lg text-muted-foreground">
                <AuthorLinks authors={book.authors} />
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
            <Badge variant="outline">
              {OWNERSHIP_BADGE_LABELS[book.ownership]}
            </Badge>
            {book.timesRead > 1 && (
              <Badge variant="outline">
                <Repeat data-slot="icon" className="size-3" />
                Read {book.timesRead}×
              </Badge>
            )}
            {book.tags.map((tag) =>
              // The tag filter lists tags comma-separated, so an old tag with
              // a comma in it can't be linked to.
              tag.includes(",") ? (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ) : (
                <Link key={tag} href={`/books?tag=${encodeURIComponent(tag)}`}>
                  <Badge variant="secondary" className="hover:bg-accent">
                    {tag}
                  </Badge>
                </Link>
              ),
            )}
          </div>

          {/* Each fact sits after a hairline, with its label in small
              capitals above the value (globals.css, `.book-facts`). */}
          <dl className="book-facts grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {book.pageCount && (
              <div>
                <dt className="text-muted-foreground">Pages</dt>
                <dd>{book.pageCount}</dd>
              </div>
            )}
            {book.format === BookFormat.AUDIOBOOK && book.lengthMinutes != null && (
              <div>
                <dt className="text-muted-foreground">Length</dt>
                <dd>{formatLength(book.lengthMinutes)}</dd>
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
                <dd>{formatDate(book.dateFinished, prefs)}</dd>
              </div>
            )}
          </dl>

          <FindItAt book={book} links={prefs.findLinks} />

          {book.description &&
            (prefs.bookDescription === "clamp" ? (
              <BookDescription text={book.description} />
            ) : (
              // break-words: imported descriptions can contain long raw URLs,
              // which would otherwise refuse to wrap and overflow on phones.
              <p className="long-text max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                {book.description}
              </p>
            ))}

          {seriesBooks.length > 0 && seriesHref && (
            <section className="grid gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                More in{" "}
                <Link href={seriesHref} className="italic hover:underline">
                  {book.seriesName}
                </Link>
              </h2>
              {/* One row that scrolls, so a long series doesn't push the rest down. */}
              <div className="flex gap-3 overflow-x-auto pb-1">
                {seriesBooks.map((b) => (
                  <BookLink
                    key={b.id}
                    bookId={b.id}
                    className="group w-20 shrink-0"
                    title={`${b.title}${b.seriesNumber != null ? ` (#${b.seriesNumber})` : ""}`}
                  >
                    <BookCover book={b} className="aspect-[2/3] w-20" />
                    <p className="mt-1 line-clamp-2 text-xs leading-tight text-muted-foreground group-hover:text-foreground">
                      {b.seriesNumber != null ? `#${b.seriesNumber} · ` : ""}
                      {b.title}
                    </p>
                  </BookLink>
                ))}
              </div>
            </section>
          )}

          {arranged.map(({ key, forced }) =>
            // A card left out here (null) gets no "shown although hidden" line.
            forced && cards[key] ? (
              <div key={key} className="grid grid-cols-1 gap-1.5">
                {cards[key]}
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {FORCED_CARD_NOTES[key]}{" "}
                  <Link
                    href="/account#book-page"
                    className="font-medium underline underline-offset-4 hover:text-foreground"
                  >
                    Book page settings
                  </Link>
                </p>
              </div>
            ) : (
              <Fragment key={key}>{cards[key]}</Fragment>
            ),
          )}
        </div>
      </div>
    </>
  );
}
