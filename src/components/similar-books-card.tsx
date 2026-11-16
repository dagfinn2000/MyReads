import { ReadingStatus } from "@/lib/enums";
import type { Preferences } from "@/lib/preferences";
import { moodOf } from "@/lib/moods";
import { similarReasonText, type SimilarBook, type SimilarCandidate } from "@/lib/similar-books";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * "More like this" on a book's page (lib/similar-books.ts): a row of the
 * reader's own books that share its genres, moods or author, each with
 * what it shares under its cover. Books still to read come first and say
 * so. Nothing shows when nothing is alike enough.
 */
export function SimilarBooksCard({
  similar,
  prefs,
}: {
  similar: SimilarBook<SimilarCandidate>[];
  prefs: Pick<Preferences, "customMoods">;
}) {
  if (similar.length === 0) return null;
  const moodName = (key: string) => moodOf(key, prefs)?.name ?? null;
  return (
    <Card className="similar-books">
      <CardHeader>
        <CardTitle>More like this</CardTitle>
        <CardDescription>
          From your own shelves, by the genres, moods and authors they share.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* One row that scrolls, like the series strip above. */}
        <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {similar.map(({ book, reason }) => {
            const why = similarReasonText(reason, moodName);
            const waiting = book.status === ReadingStatus.WANT_TO_READ;
            return (
              <li key={book.id} className="w-24 shrink-0">
                <BookLink bookId={book.id} className="group grid gap-1" title={book.title}>
                  <span className="relative">
                    <BookCover book={book} className="aspect-[2/3] w-24" />
                    {waiting && (
                      <span className="absolute top-1 left-1 rounded-full bg-background/90 px-1.5 text-[10px] leading-4 font-medium text-foreground shadow-sm">
                        To read
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs leading-tight font-medium group-hover:underline">
                    {book.title}
                  </span>
                  {why && (
                    <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                      {why}
                    </span>
                  )}
                </BookLink>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
