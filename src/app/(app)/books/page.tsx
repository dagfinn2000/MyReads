import Link from "next/link";
import type { Book, Prisma } from "@prisma/client";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { LibraryBig, Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LIBRARY_VIEW, parseLibraryView } from "@/lib/library-view";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { LibraryView, type LibraryGroup } from "@/components/library-view";
import { ShelfChips } from "@/components/shelf-chips";
import { ShelfTabs } from "@/components/shelf-tabs";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

/** Shelf order within one author: series entries stay together (a series
 *  sorts as a block by its name, standalones slot in by title), ordered by
 *  series number inside the block — Mistborn #1 right before Mistborn #2. */
function seriesShelfOrder(a: Book, b: Book): number {
  return (
    (a.seriesName ?? a.title).localeCompare(b.seriesName ?? b.title) ||
    (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
    a.title.localeCompare(b.title)
  );
}

/** In-memory sort — a personal library is small enough that sorting after
 *  the filtered fetch is simpler than fighting Prisma over array columns
 *  (author sort) and nulls-last semantics. */
function sortBooks(books: Book[], sort: string, dir: string): Book[] {
  const mul = dir === "asc" ? 1 : -1;
  // Author sort: `dir` flips the author order only; within an author, books
  // keep shelf order (series grouped, in series order) in both directions.
  if (sort === "author") {
    return [...books].sort(
      (a, b) =>
        mul * (a.authors[0] ?? "").localeCompare(b.authors[0] ?? "") ||
        seriesShelfOrder(a, b),
    );
  }
  const cmp: Record<string, (a: Book, b: Book) => number> = {
    title: (a, b) => a.title.localeCompare(b.title),
    rating: (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
    dateFinished: (a, b) =>
      (a.dateFinished?.getTime() ?? 0) - (b.dateFinished?.getTime() ?? 0),
    createdAt: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  };
  const fn = cmp[sort] ?? cmp.createdAt;
  return [...books].sort((a, b) => mul * fn(a, b));
}

/** Sections for the group-by views. Series sections order their books by
 *  series number; a trailing section collects books outside any series. */
function groupBooks(books: Book[], group: string): LibraryGroup[] | null {
  if (group === "author") {
    const map = new Map<string, Book[]>();
    for (const b of books) {
      const key = b.authors[0] ?? "Unknown author";
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, groupBooks]) => ({ title, books: groupBooks }));
  }

  if (group === "series") {
    const map = new Map<string, Book[]>();
    const noSeries: Book[] = [];
    for (const b of books) {
      if (b.seriesName) map.set(b.seriesName, [...(map.get(b.seriesName) ?? []), b]);
      else noSeries.push(b);
    }
    const sections = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, groupBooks]) => ({
        title,
        books: [...groupBooks].sort(
          (a, b) =>
            (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
            a.title.localeCompare(b.title),
        ),
      }));
    if (noSeries.length > 0) sections.push({ title: "Not in a series", books: noSeries });
    return sections;
  }

  return null;
}

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
  const savedView = hasViewParams
    ? DEFAULT_LIBRARY_VIEW
    : parseLibraryView(
        (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { libraryView: true },
          })
        )?.libraryView,
      );

  const values: FilterValues = {
    shelf: param(sp.shelf) || "all",
    shelfId: param(sp.shelfId),
    q: param(sp.q),
    tag: param(sp.tag),
    format: param(sp.format),
    owned: param(sp.owned) || "all",
    minRating: param(sp.minRating),
    series: param(sp.series),
    group: param(sp.group) || savedView.group,
    sort: param(sp.sort) || savedView.sort,
    dir: param(sp.dir) || savedView.dir,
  };

  const shelf = Object.values(ReadingStatus).find((s) => s === values.shelf);
  const format = Object.values(BookFormat).find((f) => f === values.format);
  const minRating = parseInt(values.minRating, 10);

  const where: Prisma.BookWhereInput = {
    userId,
    ...(shelf && { status: shelf }),
    ...(format && { format }),
    ...(values.owned === "owned" && { owned: true }),
    ...(values.owned === "wishlist" && { owned: false }),
    ...(minRating >= 1 && { rating: { gte: minRating } }),
    ...(values.tag && values.tag !== "all" && { tags: { has: values.tag } }),
    ...(values.shelfId && { shelves: { some: { id: values.shelfId } } }),
    ...(values.series && {
      seriesName: { equals: values.series, mode: "insensitive" as const },
    }),
    ...(values.q && { searchText: { contains: values.q.toLowerCase() } }),
  };

  const [books, statusCounts, tagRows, shelves] = await Promise.all([
    prisma.book.findMany({ where }),
    prisma.book.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.book.findMany({ where: { userId }, select: { tags: true } }),
    prisma.shelf.findMany({
      where: { userId },
      include: { _count: { select: { books: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const sorted = sortBooks(books, values.sort, values.dir);
  const groups = groupBooks(sorted, values.group);

  const counts: Record<string, number> = { all: 0 };
  for (const row of statusCounts) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  const allTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const tagCounts: Record<string, number> = {};
  for (const row of tagRows) {
    for (const t of row.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }

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
