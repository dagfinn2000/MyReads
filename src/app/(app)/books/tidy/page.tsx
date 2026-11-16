import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { getPreferences, getSession } from "@/lib/current-user";
import { FORMAT_LABELS, OWNERSHIP_LABELS, formatDate, formatNumber } from "@/lib/display";
import { bookStatusName } from "@/lib/statuses";
import { tidyReport, type TidyBook } from "@/lib/tidy";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { BringBackButton, FillFromCatalogue, LeaveButton, StaleActions } from "@/components/tidy-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tidy up · MyReads" };

/** Rows a list shows; the rest come up as these are fixed or left. */
const SHOWN = 24;

/** "3 weeks", "4 months", "over a year". */
function howLong(days: number): string {
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.floor(days / 365);
  return years === 1 ? "over a year" : `over ${years} years`;
}

/**
 * Tidy up: the books in the library that could use a little care (lib/
 * tidy.ts). Possible duplicates, books on Currently Reading that haven't
 * moved in a while, missing covers, page counts and authors, and reads
 * without a finish date. Each can be fixed from here or left alone, and
 * the catalogues can fill in covers and page counts for books with an
 * ISBN.
 */
export default async function TidyPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;
  const prefs = await getPreferences();
  const fmt = (n: number) => formatNumber(n, prefs);

  const [rows, logged] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        isbn: true,
        openLibraryId: true,
        pageCount: true,
        format: true,
        ownership: true,
        status: true,
        statusKey: true,
        dateStarted: true,
        dateFinished: true,
        createdAt: true,
        seriesName: true,
        seriesNumber: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    // The newest log entry of each book being read, for "still reading?".
    prisma.progressEntry.groupBy({
      by: ["bookId"],
      where: { book: { userId, status: ReadingStatus.READING } },
      _max: { date: true },
    }),
  ]);
  const lastBy = new Map(logged.map((l) => [l.bookId, l._max.date]));
  const books = rows.map((b) => ({ ...b, lastLogged: lastBy.get(b.id) ?? null }));
  const r = tidyReport(books, prefs.tidySkipped, new Date());

  const missing = r.cover.length + r.pages.length + r.author.length;
  const sections = [
    { id: "duplicates", label: "Maybe twice", count: r.dup.length },
    { id: "still-reading", label: "Still reading?", count: r.stale.length },
    { id: "missing", label: "Missing details", count: missing },
    { id: "undated", label: "No finish date", count: r.date.length },
  ];
  const total = sections.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tidy up</h1>
        <p className="text-sm text-muted-foreground">
          Books that could use a little care. Fix one, or leave it alone and it stops showing here.
        </p>
        {total > 0 && (
          <nav aria-label="On this page" className="flex flex-wrap gap-2 pt-1">
            {sections
              .filter((s) => s.count > 0)
              .map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent"
                >
                  {s.label} <span className="text-muted-foreground tabular-nums">{fmt(s.count)}</span>
                </a>
              ))}
          </nav>
        )}
      </div>

      {total === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Sparkles className="size-8 text-primary" aria-hidden="true" />
            <p className="font-medium">All tidy</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Every book has its cover, page count and author, and nothing looks like it&apos;s in
              the library twice.
            </p>
          </CardContent>
        </Card>
      )}

      {r.dup.length > 0 && (
        <Card id="duplicates" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Maybe the same book twice</CardTitle>
            <CardDescription>
              The same ISBN, or the same title by the same writer. Two editions on purpose? Leave
              them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {r.dup.slice(0, SHOWN).map((g) => (
                <li key={g.key} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                  <ul className="flex flex-wrap gap-4">
                    {g.books.map((b) => (
                      <li key={b.id} className="flex w-60 max-w-full gap-3">
                        <BookLink bookId={b.id} className="shrink-0" title={b.title}>
                          <BookCover book={b} className="aspect-[2/3] w-12" />
                        </BookLink>
                        <span className="grid min-w-0 content-start gap-0.5 text-sm">
                          <BookLink bookId={b.id} className="truncate font-medium hover:underline">
                            {b.title}
                          </BookLink>
                          <span className="truncate text-muted-foreground">{b.authors.join(", ")}</span>
                          <span className="text-xs text-muted-foreground">
                            {FORMAT_LABELS[b.format]} · {OWNERSHIP_LABELS[b.ownership]} · {bookStatusName(b, prefs)}
                          </span>
                          <span className="text-xs text-muted-foreground">Added {formatDate(b.createdAt, prefs)}</span>
                          {b.isbn && <span className="text-xs whitespace-nowrap text-muted-foreground">ISBN {b.isbn}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <LeaveButton itemKey={g.key} label="Leave them" />
                </li>
              ))}
            </ul>
            <More shown={SHOWN} total={r.dup.length} fmt={fmt} />
          </CardContent>
        </Card>
      )}

      {r.stale.length > 0 && (
        <Card id="still-reading" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Still reading?</CardTitle>
            <CardDescription>
              On Currently Reading, but nothing logged for a while. Put it down, back on the pile, or
              leave it if you&apos;re still at it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid divide-y">
              {r.stale.slice(0, SHOWN).map(({ book: b, days }) => (
                <TidyRow
                  key={b.id}
                  book={b}
                  note={`Nothing logged in ${howLong(days)}`}
                  actions={
                    <>
                      <StaleActions bookId={b.id} />
                      <LeaveButton itemKey={`stale:${b.id}`} />
                    </>
                  }
                />
              ))}
            </ul>
            <More shown={SHOWN} total={r.stale.length} fmt={fmt} />
          </CardContent>
        </Card>
      )}

      {missing > 0 && (
        <Card id="missing" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Missing details</CardTitle>
            <CardDescription>
              Covers, page counts and authors. A page count makes progress, pace and pages read
              work.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {r.lookable.length > 0 && <FillFromCatalogue ids={r.lookable} />}
            <MissingList title="No cover" kind="cover" books={r.cover} fmt={fmt} />
            <MissingList title="No page count" kind="pages" books={r.pages} fmt={fmt} />
            <MissingList title="No author" kind="author" books={r.author} fmt={fmt} />
          </CardContent>
        </Card>
      )}

      {r.date.length > 0 && (
        <Card id="undated" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Read, but when?</CardTitle>
            <CardDescription>
              Read without a finish date, so they don&apos;t count in a year&apos;s stats or goal. If
              you don&apos;t remember, leave it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid divide-y">
              {r.date.slice(0, SHOWN).map((b) => (
                <TidyRow
                  key={b.id}
                  book={b}
                  note={b.dateStarted ? `Started ${formatDate(b.dateStarted, prefs)}` : `Added ${formatDate(b.createdAt, prefs)}`}
                  actions={
                    <>
                      <Link
                        href={`/books/${b.id}`}
                        className="rounded-md px-2 py-1 text-sm font-medium underline-offset-4 hover:underline"
                      >
                        Add the date
                      </Link>
                      <LeaveButton itemKey={`date:${b.id}`} />
                    </>
                  }
                />
              ))}
            </ul>
            <More shown={SHOWN} total={r.date.length} fmt={fmt} />
          </CardContent>
        </Card>
      )}

      {r.skipped > 0 && (
        <p className="text-sm text-muted-foreground">
          <BringBackButton count={r.skipped} />
        </p>
      )}
    </div>
  );
}

/** One book: its cover, title and author, a note, and what can be done. */
function TidyRow({ book: b, note, actions }: { book: TidyBook; note: string; actions: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
      <BookLink bookId={b.id} className="shrink-0" title={b.title}>
        <BookCover book={b} className="aspect-[2/3] w-10" />
      </BookLink>
      <span className="grid min-w-0 flex-1 basis-48 gap-0.5 text-sm">
        <BookLink bookId={b.id} className="truncate font-medium hover:underline">
          {b.title}
        </BookLink>
        {b.authors.length > 0 && <span className="truncate text-muted-foreground">{b.authors.join(", ")}</span>}
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1">{actions}</span>
    </li>
  );
}

function MissingList({
  title,
  kind,
  books,
  fmt,
}: {
  title: string;
  kind: "cover" | "pages" | "author";
  books: TidyBook[];
  fmt: (n: number) => string;
}) {
  if (books.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-medium">
        {title} <span className="font-normal text-muted-foreground tabular-nums">· {fmt(books.length)}</span>
      </h2>
      <ul className="grid divide-y">
        {books.slice(0, SHOWN).map((b) => (
          <TidyRow
            key={b.id}
            book={b}
            note={b.isbn ? `ISBN ${b.isbn}` : ""}
            actions={
              <>
                <Link
                  href={`/books/${b.id}/edit`}
                  className="rounded-md px-2 py-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  Edit
                </Link>
                <LeaveButton itemKey={`${kind}:${b.id}`} />
              </>
            }
          />
        ))}
      </ul>
      <More shown={SHOWN} total={books.length} fmt={fmt} />
    </section>
  );
}

function More({ shown, total, fmt }: { shown: number; total: number; fmt: (n: number) => string }) {
  if (total <= shown) return null;
  return (
    <p className="pt-3 text-xs text-muted-foreground">
      And {fmt(total - shown)} more. They show up here as you go.
    </p>
  );
}
