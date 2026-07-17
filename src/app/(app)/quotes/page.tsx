import Link from "next/link";
import { Quote } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/display";
import { BookCover } from "@/components/book-card";
import { QuotesSearch } from "@/components/quotes-search";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes · MyReads" };

/**
 * Every quote in the library on one page, newest first — the commonplace
 * book view. Search covers the quote text, the personal note, and the book
 * (via its searchText blob, so authors and series match too).
 */
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";

  const quotes = await prisma.quote.findMany({
    where: {
      book: { userId },
      ...(q && {
        OR: [
          { text: { contains: q, mode: "insensitive" as const } },
          { note: { contains: q, mode: "insensitive" as const } },
          { book: { is: { searchText: { contains: q.toLowerCase() } } } },
        ],
      }),
    },
    include: {
      book: { select: { id: true, title: true, authors: true, coverUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          {quotes.length}
          {q ? ` matching` : ""}
        </span>
        <div className="w-full sm:ml-auto sm:w-auto">
          <QuotesSearch initial={q} />
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Quote className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {q
              ? "No quotes match that search."
              : "No quotes yet — add passages worth keeping from any book page."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Card>
                <CardContent className="grid gap-3 pt-0">
                  <blockquote className="whitespace-pre-line border-l-2 border-primary/50 pl-3 text-sm leading-relaxed">
                    {quote.text}
                  </blockquote>
                  {quote.note && (
                    <p className="text-sm italic text-muted-foreground">
                      {quote.note}
                    </p>
                  )}
                  <Link
                    href={`/books/${quote.book.id}`}
                    className="group flex items-center gap-2.5 text-sm"
                  >
                    <BookCover
                      book={quote.book}
                      className="aspect-[2/3] w-7 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">
                        {quote.book.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {quote.book.authors.join(", ")}
                        {quote.page != null && ` · p. ${quote.page}`}
                        {quote.createdAt && ` · added ${formatDate(quote.createdAt)}`}
                      </span>
                    </span>
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
