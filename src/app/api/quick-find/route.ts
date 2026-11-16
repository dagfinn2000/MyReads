import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_RESULT,
  QUICK_FIND_LIMITS,
  collectAuthors,
  collectSeries,
  matchShelves,
  parseQuickQuery,
  rankBooks,
  type QuickFindResult,
} from "@/lib/quick-find";
import { searchTerms } from "@/lib/utils";

/** What a found book shows. */
const bookSelect = {
  id: true,
  title: true,
  authors: true,
  coverUrl: true,
  status: true,
  statusKey: true,
  seriesName: true,
  seriesNumber: true,
  updatedAt: true,
} as const;

/** How many books whose search text matches are weighed for the list,
 *  and looked through for authors and series. */
const CANDIDATES = 300;

const json = (body: QuickFindResult) =>
  NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });

/**
 * GET /api/quick-find?q=… — quick find's answers (lib/quick-find.ts): the
 * signed-in reader's books, authors, series and shelves matching every
 * word of q, case and accents aside. With no q, the books being read.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const q = parseQuickQuery(new URL(req.url).searchParams.get("q"));
  const terms = searchTerms(q);

  if (terms.length === 0) {
    const reading = await prisma.book.findMany({
      where: { userId, status: ReadingStatus.READING },
      select: bookSelect,
      orderBy: { updatedAt: "desc" },
      take: QUICK_FIND_LIMITS.books,
    });
    return json({ ...EMPTY_RESULT, books: reading.map(({ updatedAt: _, ...b }) => b) });
  }

  const [candidates, shelves, smartShelves] = await Promise.all([
    prisma.book.findMany({
      where: { userId, AND: terms.map((term) => ({ searchText: { contains: term } })) },
      select: bookSelect,
      orderBy: { updatedAt: "desc" },
      take: CANDIDATES,
    }),
    prisma.shelf.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.smartShelf.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);

  // An author's count is every book of theirs, not just those that matched
  // (a query naming a title and its author narrows them).
  const authors = collectAuthors(candidates, q);
  if (authors.length) {
    const theirs = await prisma.book.findMany({
      where: { userId, authors: { hasSome: authors.map((a) => a.name) } },
      select: { authors: true },
    });
    for (const a of authors) {
      a.count = theirs.filter((b) => b.authors.some((n) => n.trim() === a.name)).length;
    }
  }

  return json({
    books: rankBooks(candidates, q)
      .slice(0, QUICK_FIND_LIMITS.books)
      .map(({ updatedAt: _, ...b }) => b),
    authors,
    series: collectSeries(candidates, q),
    shelves: matchShelves(
      [
        ...shelves.map((s) => ({ ...s, smart: false })),
        ...smartShelves.map((s) => ({ ...s, smart: true })),
      ],
      q,
    ),
  });
}
