import Link from "next/link";
import { Check } from "lucide-react";
import { MONTHS_SHORT, formatNumber, formatOneDecimal, type FormatPrefs } from "@/lib/display";
import { calendarDay } from "@/lib/dates";
import {
  authorAnchor,
  authorBookState,
  type AuthorBook,
  type AuthorBookState,
  type AuthorEntry,
} from "@/lib/authors-list";
import type { RatingStyle } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { StarGraphic } from "@/components/stars";
import { Card, CardContent } from "@/components/ui/card";

/** Covers a card draws before the rest become "+N". */
const COVERS_SHOWN = 9;

const STATE_WORDS: Record<AuthorBookState, string> = {
  read: "read",
  reading: "reading now",
  stopped: "put down",
  waiting: "not read yet",
};

/** "Mar 2026": when, roughly, without the day. */
function monthYear(d: Date, timeZone?: string): string {
  const [y, m] = calendarDay(d, timeZone).split("-");
  return `${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

/**
 * One author on the Authors page: how many of their books are read, a
 * segment of the bar and a cover for each (in the order they were read,
 * then what's still waiting), the average rating given them, and what of
 * theirs to read next.
 */
export function AuthorCard({
  author,
  prefs,
}: {
  author: AuthorEntry;
  prefs: FormatPrefs & { ratingStyle: RatingStyle };
}) {
  const fmt = (n: number) => formatNumber(n, prefs);
  const total = author.books.length;
  const shown = author.books.slice(0, COVERS_SHOWN);
  const more = total - shown.length;
  const href = `/books?author=${encodeURIComponent(author.name)}`;
  const ratings = prefs.ratingStyle !== "off" && author.averageRating !== null;

  const facts: React.ReactNode[] = [];
  if (ratings) {
    const avg = author.averageRating!;
    facts.push(
      <span key="rating" className="inline-flex items-center gap-1.5">
        <span className="font-medium text-foreground tabular-nums">
          {prefs.ratingStyle === "ten"
            ? `${formatOneDecimal(avg, prefs)}/10`
            : formatOneDecimal(avg / 2, prefs)}
        </span>
        {prefs.ratingStyle !== "ten" && <StarGraphic value={avg} />}
        <span>
          {author.rated === 1 ? "from 1 rating" : `average of ${fmt(author.rated)}`}
        </span>
      </span>,
    );
  }
  if (author.pagesRead > 0) {
    facts.push(
      <span key="pages">
        <span className="font-medium text-foreground tabular-nums">{fmt(author.pagesRead)}</span>{" "}
        pages read
      </span>,
    );
  }
  if (author.lastFinished) {
    const first = monthYear(author.firstFinished!, prefs.timeZone);
    const last = monthYear(author.lastFinished, prefs.timeZone);
    facts.push(
      <span key="when">
        {author.read > 1 && first !== last ? `Read from ${first} to ${last}` : `Last read ${last}`}
      </span>,
    );
  }

  return (
    <Card
      id={authorAnchor(author.name)}
      className="scroll-mt-20 data-[arrived]:ring-2 data-[arrived]:ring-amber-500/60"
    >
      <CardContent className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="min-w-0 text-lg font-semibold leading-tight wrap-anywhere">
            {/* No prefetching: see BookLink. */}
            <Link href={href} prefetch={false} className="hover:underline">
              {author.name}
            </Link>
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {author.read > 0 && author.read === total ? (
              <span className="font-medium text-foreground">
                {total === 1 ? "Read" : `All ${fmt(total)} read`}
              </span>
            ) : (
              <>
                <span className="font-medium text-foreground">{fmt(author.read)}</span> of{" "}
                {fmt(total)} read
              </>
            )}
          </p>
        </div>

        <AuthorBar books={author.books} />

        <ol className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pt-1 pb-2">
          {shown.map((b) => (
            <li key={b.id} className="shrink-0">
              <Cover book={b} next={b === author.next && !author.current} />
            </li>
          ))}
          {more > 0 && (
            <li className="shrink-0">
              <Link
                href={href}
                prefetch={false}
                className="grid aspect-[2/3] w-14 place-items-center rounded-md border-2 border-dashed border-muted-foreground/30 text-sm font-medium text-muted-foreground tabular-nums transition-colors hover:border-muted-foreground/60 hover:text-foreground"
                title={`${fmt(more)} more by ${author.name}`}
              >
                +{fmt(more)}
              </Link>
            </li>
          )}
        </ol>

        {/* A div, not a p: the stars are a div. No dots between the facts,
            so a wrapped line never starts with one. */}
        {facts.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {facts}
          </div>
        )}

        <NextLine author={author} />
      </CardContent>
    </Card>
  );
}

/** "Reading X now." or "Next: X". Nothing when nothing of theirs waits. */
function NextLine({ author }: { author: AuthorEntry }) {
  const { current, next } = author;
  if (current) {
    return (
      <p className="text-sm text-muted-foreground">
        Reading{" "}
        <BookLink bookId={current.id} className="font-medium text-foreground hover:underline">
          {current.title}
        </BookLink>{" "}
        now.
      </p>
    );
  }
  if (next) {
    return (
      <p className="text-sm text-muted-foreground">
        Next:{" "}
        <BookLink bookId={next.id} className="font-medium text-foreground hover:underline">
          {next.title}
        </BookLink>
        {next.ownership === "WISHLIST" && " (on your wishlist)"}
      </p>
    );
  }
  return null;
}

/** A segment per book, read in amber like a series. Never wider than the
 *  card: with many books the segments just get thin. */
function AuthorBar({ books }: { books: AuthorBook[] }) {
  const counts = new Map<AuthorBookState, number>();
  for (const b of books) {
    const s = authorBookState(b);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const label = (["read", "reading", "stopped", "waiting"] as const)
    .filter((s) => counts.get(s))
    .map((s) => `${counts.get(s)} ${STATE_WORDS[s]}`)
    .join(", ");
  return (
    <div role="img" aria-label={label} className="flex h-2 min-w-0 gap-0.5 overflow-hidden">
      {books.map((b) => {
        const s = authorBookState(b);
        return (
          <span
            key={b.id}
            className={cn(
              "bar-grow h-full min-w-px flex-1 first:rounded-l-full last:rounded-r-full",
              s === "read"
                ? "bg-amber-500"
                : s === "reading"
                  ? "bg-primary/70"
                  : s === "stopped"
                    ? "bg-muted-foreground/40"
                    : "bg-muted",
            )}
          />
        );
      })}
    </div>
  );
}

/** A book's cover with a tick once read, and a "Reading" or "Next" tag. */
function Cover({ book, next }: { book: AuthorBook; next: boolean }) {
  const state = authorBookState(book);
  const tag = state === "reading" ? "Reading" : next ? "Next" : null;
  return (
    <BookLink
      bookId={book.id}
      className="group grid w-14 gap-1"
      title={`${book.title} · ${STATE_WORDS[state]}`}
    >
      <span
        className={cn(
          "relative block rounded-md",
          tag && "ring-2 ring-amber-500 ring-offset-2 ring-offset-card",
        )}
      >
        <BookCover
          book={book}
          className={cn(
            "cover-shadow aspect-[2/3] w-14 transition-opacity",
            state === "waiting" && !tag && "opacity-60 group-hover:opacity-100",
            state === "stopped" && "opacity-60 grayscale group-hover:opacity-100",
          )}
        />
        {state === "read" && (
          <span className="on-amber absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-amber-500 shadow">
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {tag && (
          <span className="on-amber absolute inset-x-0 bottom-0 rounded-b-md bg-amber-500 py-px text-center text-[9px] font-semibold tracking-wide uppercase">
            {tag}
          </span>
        )}
      </span>
    </BookLink>
  );
}
