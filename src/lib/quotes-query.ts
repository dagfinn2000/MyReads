import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SortOptions } from "@/lib/library-sort";
import {
  groupQuotes,
  orderQuotes,
  sliceQuoteGroups,
  type QuotesParams,
} from "@/lib/quote-order";
import { escapeLike, searchTerms } from "@/lib/utils";

/** What the quotes page renders per quote. */
const quoteRowSelect = {
  id: true,
  text: true,
  page: true,
  note: true,
  createdAt: true,
  bookId: true,
  book: { select: { id: true, title: true, authors: true, coverUrl: true } },
} satisfies Prisma.QuoteSelect;

export type QuoteRow = Prisma.QuoteGetPayload<{ select: typeof quoteRowSelect }>;
export type QuoteBook = QuoteRow["book"];

/**
 * The `where` for the quotes page. Everything goes through the book's
 * owner, so another reader's shelf id or tag in the URL matches nothing.
 */
export function buildQuoteWhere(
  userId: string,
  p: Pick<QuotesParams, "q" | "tag" | "shelfId">,
): Prisma.QuoteWhereInput {
  const terms = searchTerms(p.q);
  return {
    book: {
      userId,
      ...(p.tag && { tags: { has: p.tag } }),
      ...(p.shelfId && { shelves: { some: { id: p.shelfId } } }),
    },
    ...(p.q && {
      OR: [
        // The quote itself is matched as a phrase; the book by its words,
        // accent-insensitively, like the library search.
        { text: { contains: escapeLike(p.q), mode: "insensitive" as const } },
        { note: { contains: escapeLike(p.q), mode: "insensitive" as const } },
        { book: { is: { AND: terms.map((t) => ({ searchText: { contains: t } })) } } },
      ],
    }),
  };
}

/**
 * The quotes to show, in order. Ordering stays in JS (shuffle and the
 * title-filing rules have no SQL equivalent), so the first query reads
 * only the sort keys of every match; the full rows are then loaded for the
 * shown ones alone. `total` counts every match.
 */
export async function loadQuotes(
  userId: string,
  p: QuotesParams,
  sort: SortOptions,
): Promise<{
  total: number;
  shown: number;
  list: QuoteRow[] | null;
  groups: { book: QuoteBook; quotes: QuoteRow[]; total: number }[] | null;
}> {
  const keys = await prisma.quote.findMany({
    where: buildQuoteWhere(userId, p),
    select: {
      id: true,
      bookId: true,
      page: true,
      createdAt: true,
      book: { select: { title: true, authors: true } },
    },
    // A fixed input order, so nothing downstream depends on how Postgres
    // happened to return the rows.
    orderBy: { id: "asc" },
  });

  const opts = { seed: p.seed ?? 1, sort };
  const sliced = p.group ? sliceQuoteGroups(groupQuotes(keys, p.order, opts), p.limit) : null;
  const ordered = sliced ? null : orderQuotes(keys, p.order, opts).slice(0, p.limit);
  const ids = sliced ? sliced.flatMap((g) => g.quotes.map((q) => q.id)) : ordered!.map((q) => q.id);

  const rows =
    ids.length > 0
      ? await prisma.quote.findMany({
          where: { id: { in: ids }, book: { userId } },
          select: quoteRowSelect,
        })
      : [];
  // A quote deleted between the two queries simply drops out.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const rowsFor = (list: { id: string }[]) => list.flatMap((k) => byId.get(k.id) ?? []);

  return {
    total: keys.length,
    shown: rows.length,
    list: ordered ? rowsFor(ordered) : null,
    groups: sliced
      ? sliced.flatMap((g) => {
          const quotes = rowsFor(g.quotes);
          return quotes.length > 0 ? [{ book: quotes[0].book, quotes, total: g.total }] : [];
        })
      : null,
  };
}

/**
 * What the From filter offers: the shelves and tags whose books have
 * quotes, so no choice leads to an empty page. The shelf currently picked
 * is included even when it no longer has any, so its name still shows.
 */
export async function quoteSources(
  userId: string,
  opts: { alphabet?: string; shelfId?: string } = {},
): Promise<{ shelves: { id: string; name: string }[]; tags: string[] }> {
  const [shelves, tagRows] = await Promise.all([
    prisma.shelf.findMany({
      where: {
        userId,
        OR: [
          { books: { some: { userId, quotes: { some: {} } } } },
          ...(opts.shelfId ? [{ id: opts.shelfId }] : []),
        ],
      },
      select: { id: true, name: true },
    }),
    prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT t AS tag
      FROM "Book" b, LATERAL unnest(b."tags") AS t
      WHERE b."userId" = ${userId}
        AND EXISTS (SELECT 1 FROM "Quote" q WHERE q."bookId" = b."id")`,
  ]);
  const compare = new Intl.Collator(opts.alphabet).compare;
  return {
    shelves: shelves.sort((a, b) => compare(a.name, b.name)),
    tags: tagRows.map((r) => r.tag).sort(compare),
  };
}
