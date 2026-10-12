import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { LibraryBig, Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPreferences } from "@/lib/current-user";
import { groupBooks, sortBooks, type SortOptions } from "@/lib/library-sort";
import { parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";
import { parseLibraryView } from "@/lib/library-view";
import { canonicalViewQuery } from "@/lib/saved-views";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { LibraryView } from "@/components/library-view";
import { SavedViewChips } from "@/components/saved-view-chips";
import { ShelfChips } from "@/components/shelf-chips";
import { ShelfTabs } from "@/components/shelf-tabs";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Cards rendered per page load, and the ceiling "Show more" can reach.
 *  The cap keeps a crafted ?limit= from asking the server to serialize an
 *  entire library in one response. */
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 2000;

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

/** Fill grouped sections in order until the budget runs out. Sections keep
 *  their real size in the heading, so a partially shown group still says how
 *  many books it holds. */
function sliceGroups(
  groups: { title: string; books: LibraryBook[] }[],
  limit: number,
): { title: string; books: LibraryBook[]; total: number }[] {
  let budget = limit;
  const out: { title: string; books: LibraryBook[]; total: number }[] = [];
  for (const g of groups) {
    if (budget <= 0) break;
    out.push({ title: g.title, books: g.books.slice(0, budget), total: g.books.length });
    budget -= g.books.length;
  }
  return out;
}

/** What the library page fetches per book: the card fields plus the two
 *  sort keys the cards don't render. Everything else on Book — description,
 *  review, searchText, … — would be serialized into the client payload for
 *  every book on every visit, for nothing. */
const librarySelect = {
  id: true,
  title: true,
  authors: true,
  coverUrl: true,
  status: true,
  rating: true,
  currentPage: true,
  pageCount: true,
  seriesName: true,
  seriesNumber: true,
  dateFinished: true,
  createdAt: true,
  // Just enough to know whether the copy is out — one row at most, rather
  // than the loan history the card would never render.
  loans: { where: { returnedAt: null }, select: { id: true }, take: 1 },
} satisfies Prisma.BookSelect;

/** What the card actually receives: the selected columns with the open-loan
 *  probe collapsed into a boolean. */
type LibraryBook = Omit<
  Prisma.BookGetPayload<{ select: typeof librarySelect }>,
  "loans"
> & { lentOut: boolean };

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;

  const sp = await searchParams;
  const prefs = await getPreferences();

  // Saved views are needed up front: a bare visit to /books (the nav link,
  // the installed app) opens on the default saved view when there is one.
  // Every link the page itself makes carries explicit params, so this only
  // ever fires on the way in.
  const savedViews = await prisma.savedView.findMany({
    where: { userId },
    select: { id: true, name: true, query: true },
    orderBy: { name: "asc" },
  });
  if (Object.keys(sp).length === 0 && prefs.defaultViewId) {
    const start = savedViews.find((v) => v.id === prefs.defaultViewId);
    if (start) redirect(`/books?${start.query}`);
  }

  // Explicit view params in the URL win (the filter bar always writes them);
  // a param-less visit — the nav link, a bookmark — falls back to the view
  // saved on the account, so the chosen sort survives clicking away.
  const hasViewParams =
    sp.sort !== undefined || sp.dir !== undefined || sp.group !== undefined;

  const filters = parseFilters(sp);
  const where = await resolveBookWhere(userId, filters, prefs);

  // How many cards to render. Sorting and grouping stay in JS — the
  // surname-filing and series-block rules have no SQL equivalent — so the
  // whole filtered set is still fetched and ordered here, but only this many
  // books are serialized into the client payload. "Show more" raises it via
  // the URL, like every other bit of view state in this app.
  const limit = Math.min(
    Math.max(parseInt(param(sp.limit), 10) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const [books, statusCounts, tagRows, shelves, viewUser] = await Promise.all([
    prisma.book.findMany({ where, select: librarySelect }),
    prisma.book.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    // Tag names + occurrence counts across the whole library, aggregated in
    // SQL instead of shipping every book's tags array out of the database.
    prisma.$queryRaw<{ tag: string; count: number }[]>`
      SELECT t AS tag, COUNT(*)::int AS count
      FROM "Book", LATERAL unnest("tags") AS t
      WHERE "userId" = ${userId}
      GROUP BY t`,
    prisma.shelf.findMany({
      where: { userId },
      include: { _count: { select: { books: true } } },
      orderBy: { name: "asc" },
    }),
    // The saved view only affects sort/group and how cards are drawn,
    // never the where clause, so its lookup can ride in the same round of
    // queries.
    prisma.user.findUnique({
      where: { id: userId },
      select: { libraryView: true },
    }),
  ]);

  const accountView = parseLibraryView(viewUser?.libraryView);
  // Sort and grouping from the account only fill in a param-less visit; the
  // display settings (card size, layout, card details) always apply.
  const savedView = hasViewParams ? parseLibraryView(null) : accountView;

  const values: FilterValues = {
    ...filters,
    group: param(sp.group) || savedView.group,
    sort: param(sp.sort) || savedView.sort,
    dir: param(sp.dir) || savedView.dir,
  };

  // Sort and group the whole filtered set — the shelf-filing rules need every
  // book to place any of them — then hand the client only the slice it
  // renders. Passing all of them was the page's real cost: a 20k-book library
  // serialized ~6.7 MB of props to draw two hundred cards.
  // Flatten the open-loan probe into a boolean before sorting, so the client
  // payload carries a flag rather than a relation.
  const withLoanFlag = books.map(({ loans, ...b }) => ({
    ...b,
    lentOut: loans.length > 0,
  }));

  const sortOptions: SortOptions = {
    ignoreArticles: prefs.ignoreArticles,
    authorOrder: prefs.authorOrder,
    alphabet: prefs.sortAlphabet,
  };
  const sorted = sortBooks(withLoanFlag, values.sort, values.dir, sortOptions);
  const groups = groupBooks(sorted, values.group, sortOptions);

  const visibleBooks = sorted.slice(0, limit);
  const visibleGroups = groups ? sliceGroups(groups, limit) : null;

  const counts: Record<string, number> = { all: 0 };
  for (const row of statusCounts) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  // Sorted in JS (not ORDER BY) so tag ordering stays exactly what the
  // previous [...new Set(...)].sort() produced, independent of DB collation.
  const allTags = tagRows.map((r) => r.tag).sort();
  const tagCounts: Record<string, number> = {};
  for (const row of tagRows) tagCounts[row.tag] = row.count;

  // Current params as plain strings, for shelf/status links.
  const flatParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) flatParams[k] = v;
  }
  // Links built from these (status tabs, shelf chips, "Show more") always
  // name the view they keep. None of them is then a bare /books, which would
  // open the default saved view instead of the shelf that was clicked.
  flatParams.group ||= values.group;
  flatParams.sort ||= values.sort;
  flatParams.dir ||= values.dir;

  const hasFilters =
    !!values.q ||
    !!values.tag ||
    !!values.format ||
    values.owned !== "all" ||
    !!values.minRating ||
    !!values.shelfId ||
    !!values.series;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <Button asChild>
          <Link href="/books/new">
            <Plus data-slot="icon" />
            Add book
          </Link>
        </Button>
      </div>

      <ShelfTabs current={values.shelf} counts={counts} searchParams={flatParams} />
      <ShelfChips
        shelves={shelves.map((s) => ({
          id: s.id,
          name: s.name,
          bookCount: s._count.books,
        }))}
        activeShelfId={values.shelfId}
        searchParams={flatParams}
      />
      <SavedViewChips
        views={savedViews}
        currentQuery={canonicalViewQuery({ ...flatParams, ...values })}
        clearHref={`/books?${new URLSearchParams({
          group: values.group,
          sort: values.sort,
          dir: values.dir,
        })}`}
      />
      <FilterBar
        values={values}
        allTags={allTags}
        tagCounts={tagCounts}
        display={accountView}
        ratingStyle={prefs.ratingStyle}
      />

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <LibraryBig className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {counts.all === 0
              ? "Your library is empty. Add your first book!"
              : hasFilters
                ? "No books match these filters."
                : "Nothing on this shelf yet."}
          </p>
          {counts.all === 0 && (
            <Button asChild variant="outline">
              <Link href="/books/new">
                <Plus data-slot="icon" />
                Add a book
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <LibraryView
          books={visibleBooks}
          groups={visibleGroups}
          totalCount={sorted.length}
          searchParams={flatParams}
          shelves={shelves.map((s) => ({ id: s.id, name: s.name }))}
          display={accountView}
        />
      )}
    </div>
  );
}
