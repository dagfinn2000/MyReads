import Link from "next/link";
import { redirect } from "next/navigation";
import { Quote } from "lucide-react";
import { auth } from "@/auth";
import { getPreferences } from "@/lib/current-user";
import { formatNumber } from "@/lib/display";
import {
  QUOTES_MAX,
  QUOTES_PAGE_SIZE,
  newSeed,
  parseQuotesParams,
  quotesHref,
} from "@/lib/quote-order";
import { loadQuotes, quoteSources } from "@/lib/quotes-query";
import { BookCover } from "@/components/book-card";
import { QuoteItem } from "@/components/quote-item";
import { QuotesToolbar } from "@/components/quotes-toolbar";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes · MyReads" };

/**
 * Every quote in the library on one page — the commonplace book view.
 * Newest first, oldest first, by book or shuffled, optionally grouped
 * under each book (its quotes then in page order), and narrowed to one
 * shelf or tag. Search covers the quote text, the personal note, and the
 * book (via its searchText blob, so authors and series match too).
 */
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;

  const sp = await searchParams;
  const prefs = await getPreferences();
  const params = parseQuotesParams(sp, prefs);

  // A shuffle is pinned by a seed in the URL, so a re-render after an edit
  // or a Show more keeps the same order. A visit without one (the nav link
  // with Shuffle remembered) gets a fresh one.
  if (params.order === "shuffle" && params.seed === null) {
    redirect(quotesHref({ ...params, seed: newSeed(), limit: undefined }));
  }

  const [{ total, shown, list, groups }, sources] = await Promise.all([
    loadQuotes(userId, params, {
      ignoreArticles: prefs.ignoreArticles,
      authorOrder: prefs.authorOrder,
      alphabet: prefs.sortAlphabet,
    }),
    quoteSources(userId, { alphabet: prefs.sortAlphabet, shelfId: params.shelfId }),
  ]);

  const fromFilter = Boolean(params.tag || params.shelfId);
  const filtered = Boolean(params.q) || fromFilter;
  const hidden = total - shown;
  const { limit: _limit, ...toolbarParams } = params;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Focusable from script only: where focus lands after deleting
            the last quote on the page. */}
        <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight">
          Quotes
        </h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatNumber(total, prefs)}
          {filtered ? " matching" : ""}
          {hidden > 0 ? ` · showing ${formatNumber(shown, prefs)}` : ""}
        </span>
      </div>

      <QuotesToolbar
        params={toolbarParams}
        shelves={sources.shelves}
        tags={sources.tags}
        hasQuotes={total > 0 || filtered}
      />

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Quote className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {fromFilter
              ? "No quotes match these filters."
              : params.q
                ? "No quotes match that search."
                : "No quotes yet — add passages worth keeping from any book page."}
          </p>
          {fromFilter && (
            <Link
              href={quotesHref({ ...params, tag: "", shelfId: "", limit: undefined })}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Show quotes from all books
            </Link>
          )}
        </div>
      ) : groups ? (
        <div className="grid grid-cols-1 gap-6" data-quote-scope="">
          {groups.map(({ book, quotes, total: count }) => (
            <section key={book.id} aria-labelledby={`qb-${book.id}`} className="grid grid-cols-1 gap-3">
              <h2 id={`qb-${book.id}`} className="flex min-w-0 items-center gap-3 border-b pb-2">
                <Link href={`/books/${book.id}`} className="group flex min-w-0 items-center gap-3">
                  <BookCover book={book} className="aspect-[2/3] w-10 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-lg font-medium group-hover:underline">
                      {book.title}
                    </span>
                    <span className="block truncate text-sm font-normal text-muted-foreground">
                      {book.authors.join(", ")}
                    </span>
                  </span>
                </Link>
                <span className="ml-auto shrink-0 text-sm font-normal text-muted-foreground tabular-nums">
                  {formatNumber(count, prefs)} quote{count === 1 ? "" : "s"}
                </span>
              </h2>
              <ul className="grid grid-cols-1 gap-3">
                {quotes.map((quote) => (
                  <li key={quote.id}>
                    <QuoteItem quote={quote} showBook={false} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        // grid-cols-1 (minmax(0,1fr)) caps the track at the container width;
        // a bare `grid` would let a long nowrap book title stretch every
        // quote card past the page edge instead of truncating.
        <ul className="grid grid-cols-1 gap-3" data-quote-scope="">
          {(list ?? []).map((quote) => (
            <li key={quote.id}>
              <QuoteItem quote={quote} showBook />
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 &&
        (params.limit < QUOTES_MAX ? (
          // A plain link, so it works before the page hydrates; it carries
          // the shuffle seed, so the quotes already shown stay put.
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link
                href={quotesHref({ ...params, limit: params.limit + QUOTES_PAGE_SIZE })}
                scroll={false}
              >
                Show more ({formatNumber(hidden, prefs)} not shown)
              </Link>
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Showing the first {formatNumber(QUOTES_MAX, prefs)}. Search, or pick a tag or shelf,
            to see the rest.
          </p>
        ))}
    </div>
  );
}
