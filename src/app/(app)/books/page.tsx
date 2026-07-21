import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { LibraryBig, Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { groupBooks, sortBooks } from "@/lib/library-sort";
import { DEFAULT_LIBRARY_VIEW, parseLibraryView } from "@/lib/library-view";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { LibraryView } from "@/components/library-view";
import { ShelfChips } from "@/components/shelf-chips";
import { ShelfTabs } from "@/components/shelf-tabs";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
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
} satisfies Prisma.BookSelect;

type LibraryBook = Prisma.BookGetPayload<{ select: typeof librarySelect }>;

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null; // middleware already guards this
  const userId = session.user.id;

  const sp = await searchParams;

  // Explicit view params in the URL win (the filter bar always writes them);
  // a param-less visit — the nav link, a bookmark — falls back to the view
  // saved on the account, so the chosen sort survives clicking away.
  const hasViewParams =
    sp.sort !== undefined || sp.dir !== undefined || sp.group !== undefined;

  const filters = {
    shelf: param(sp.shelf) || "all",
    shelfId: param(sp.shelfId),
    q: param(sp.q),
    tag: param(sp.tag),
    format: param(sp.format),
    owned: param(sp.owned) || "all",
    minRating: param(sp.minRating),
    series: param(sp.series),
  };

  const shelf = Object.values(ReadingStatus).find((s) => s === filters.shelf);
  const format = Object.values(BookFormat).find((f) => f === filters.format);
  const minRating = parseInt(filters.minRating, 10);

  const where: Prisma.BookWhereInput = {
    userId,
    ...(shelf && { status: shelf }),
    ...(format && { format }),
    ...(filters.owned === "owned" && { owned: true }),
    ...(filters.owned === "wishlist" && { owned: false }),
    ...(minRating >= 1 && { rating: { gte: minRating } }),
    ...(filters.tag && filters.tag !== "all" && { tags: { has: filters.tag } }),
    ...(filters.shelfId && { shelves: { some: { id: filters.shelfId } } }),
    ...(filters.series && {
      seriesName: { equals: filters.series, mode: "insensitive" as const },
    }),
    ...(filters.q && { searchText: { contains: filters.q.toLowerCase() } }),
  };

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
    // The saved view only affects sort/group below, never the where clause,
    // so its lookup can ride in the same round of queries.
    hasViewParams
      ? null
      : prisma.user.findUnique({
          where: { id: userId },
          select: { libraryView: true },
        }),
  ]);

  const savedView = hasViewParams
    ? DEFAULT_LIBRARY_VIEW
    : parseLibraryView(viewUser?.libraryView);

  const values: FilterValues = {
    ...filters,
    group: param(sp.group) || savedView.group,
    sort: param(sp.sort) || savedView.sort,
    dir: param(sp.dir) || savedView.dir,
  };

  const sorted = sortBooks(books, values.sort, values.dir);
  const groups = groupBooks(sorted, values.group);

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
      <FilterBar values={values} allTags={allTags} tagCounts={tagCounts} />

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
          books={sorted}
          groups={groups}
          shelves={shelves.map((s) => ({ id: s.id, name: s.name }))}
        />
      )}
    </div>
  );
}
