import Link from "next/link";
import type { Book, Prisma } from "@prisma/client";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { LibraryBig, Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BookCard } from "@/components/book-card";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { ShelfChips } from "@/components/shelf-chips";
import { ShelfTabs } from "@/components/shelf-tabs";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

/** In-memory sort — a personal library is small enough that sorting after
 *  the filtered fetch is simpler than fighting Prisma over array columns
 *  (author sort) and nulls-last semantics. */
function sortBooks(books: Book[], sort: string, dir: string): Book[] {
  const mul = dir === "asc" ? 1 : -1;
  const cmp: Record<string, (a: Book, b: Book) => number> = {
    title: (a, b) => a.title.localeCompare(b.title),
    author: (a, b) => (a.authors[0] ?? "").localeCompare(b.authors[0] ?? ""),
    rating: (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
    dateFinished: (a, b) =>
      (a.dateFinished?.getTime() ?? 0) - (b.dateFinished?.getTime() ?? 0),
    createdAt: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  };
  const fn = cmp[sort] ?? cmp.createdAt;
  return [...books].sort((a, b) => mul * fn(a, b));
}

interface BookGroup {
  title: string;
  books: Book[];
}

/** Sections for the group-by views. Series sections order their books by
 *  series number; a trailing section collects books outside any series. */
function groupBooks(books: Book[], group: string): BookGroup[] | null {
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

function BookGrid({ books }: { books: Book[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
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
  const values: FilterValues = {
    shelf: param(sp.shelf) || "all",
    shelfId: param(sp.shelfId),
    q: param(sp.q),
    tag: param(sp.tag),
    format: param(sp.format),
    minRating: param(sp.minRating),
    series: param(sp.series),
    group: param(sp.group) || "none",
    sort: param(sp.sort) || "createdAt",
    dir: param(sp.dir) || "desc",
  };

  const shelf = Object.values(ReadingStatus).find((s) => s === values.shelf);
  const format = Object.values(BookFormat).find((f) => f === values.format);
  const minRating = parseInt(values.minRating, 10);

  const where: Prisma.BookWhereInput = {
    userId,
    ...(shelf && { status: shelf }),
    ...(format && { format }),
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

  // Current params as plain strings, for shelf/status links.
  const flatParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) flatParams[k] = v;
  }

  const hasFilters =
    !!values.q ||
    !!values.tag ||
    !!values.format ||
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
      <FilterBar values={values} allTags={allTags} />

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
      ) : groups ? (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.title} className="grid gap-3">
              <h2 className="border-b pb-1 text-lg font-medium">
                {g.title}
                <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                  {g.books.length}
                </span>
              </h2>
              <BookGrid books={g.books} />
            </section>
          ))}
        </div>
      ) : (
        <BookGrid books={sorted} />
      )}
    </div>
  );
}
