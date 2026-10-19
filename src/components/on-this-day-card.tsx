import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { yearsAgoToday, type OnThisDay } from "@/lib/on-this-day";
import { Card, CardContent } from "@/components/ui/card";

const bookLink = "font-medium text-foreground underline-offset-2 hover:underline";

/**
 * "On this day" on Now reading: books finished or started on today's date
 * in earlier years, and a quote saved on it. Only there when something
 * happened.
 */
export function OnThisDayCard({ lines, quote }: OnThisDay) {
  if (lines.length === 0 && !quote) return null;
  return (
    <Card size="sm">
      <CardContent className="grid gap-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CalendarHeart className="size-4 text-primary" aria-hidden="true" />
          On this day
        </h2>
        {lines.length > 0 && (
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {lines.map((line) => (
              <li key={`${line.kind}-${line.bookId}-${line.years}`}>
                {yearsAgoToday(line.years)} you {line.kind}{" "}
                <Link href={`/books/${line.bookId}`} className={bookLink}>
                  {line.title}
                </Link>
                .
              </li>
            ))}
          </ul>
        )}
        {quote && (
          <figure className="grid gap-1.5">
            <blockquote className="long-text line-clamp-4 border-l-2 border-primary/50 pl-3 text-sm leading-relaxed whitespace-pre-line break-words">
              {quote.text}
            </blockquote>
            <figcaption className="pl-3.5 text-xs text-muted-foreground">
              Saved from{" "}
              <Link href={`/books/${quote.bookId}`} className={bookLink}>
                {quote.title}
              </Link>{" "}
              {yearsAgoToday(quote.years).toLowerCase()}
            </figcaption>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
