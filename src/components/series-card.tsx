import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { ReadingStatus } from "@/lib/enums";
import { formatNumber } from "@/lib/display";
import type { NumberFormat } from "@/lib/preferences";
import { isDoneInSeries } from "@/lib/series";
import {
  seriesAnchor,
  settledInSeries,
  type SeriesBook,
  type SeriesEntry,
  type SeriesSlot,
} from "@/lib/series-list";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { Card, CardContent } from "@/components/ui/card";

/** "#3", "#1.5": how a series number reads. */
function numberLabel(n: number | null): string {
  return n === null ? "" : `#${n}`;
}

/**
 * One series on the Series page: its name and author, how much of it is
 * read, a segment of the bar for each book (and each gap), and the books in
 * order with the next one marked. A number the library has no book for
 * gets an empty place, with a link to add it.
 */
export function SeriesCard({
  series,
  prefs,
}: {
  series: SeriesEntry;
  prefs: { numberFormat: NumberFormat };
}) {
  const fmt = (n: number) => formatNumber(n, prefs);
  const { progress: p, next } = series;
  // The book being read, by the library heading's rule ("reading #2"):
  // the lowest-numbered one, re-reads included.
  const reading =
    p.reading === null
      ? undefined
      : series.books.find(
          (b) => b.status === ReadingStatus.READING && b.seriesNumber === p.reading,
        );
  // Asking for numbers only helps when a book still to read has none.
  const settled = settledInSeries(series.books);
  const unnumbered = series.books.some((b) => b.seriesNumber === null && !settled.has(b));
  const href = `/books?series=${encodeURIComponent(series.name)}&group=series`;

  return (
    <Card
      id={seriesAnchor(series.name)}
      className="scroll-mt-20 data-[arrived]:ring-2 data-[arrived]:ring-amber-500/60"
    >
      <CardContent className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight wrap-anywhere">
              {/* No prefetching, here or below: see BookLink. */}
              <Link href={href} prefetch={false} className="hover:underline">
                {series.name}
              </Link>
            </h2>
            {series.authors.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {series.authors.slice(0, 2).join(" & ")}
                {series.authors.length > 2 && " and others"}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {p.total > 0 && p.read === p.total ? (
              <span className="font-medium text-foreground">All read</span>
            ) : (
              <>
                <span className="font-medium text-foreground">{fmt(p.read)}</span> of{" "}
                {fmt(p.total)} read
              </>
            )}
          </p>
        </div>

        <SeriesBar slots={series.slots} />

        <ol className="-mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-2">
          {series.slots.map((slot) => (
            <li key={slot.kind === "gap" ? `gap-${slot.from}` : slot.book.id} className="shrink-0">
              {slot.kind === "gap" ? <Gap from={slot.from} to={slot.to} /> : <Place slot={slot} />}
            </li>
          ))}
        </ol>

        <p className="text-sm text-muted-foreground">
          {reading ? (
            <>
              Reading{" "}
              <BookLink bookId={reading.id} className="font-medium text-foreground hover:underline">
                {numberLabel(reading.seriesNumber)} {reading.title}
              </BookLink>{" "}
              now.
            </>
          ) : next ? (
            <>
              Next:{" "}
              <BookLink bookId={next.id} className="font-medium text-foreground hover:underline">
                {numberLabel(next.seriesNumber)} {next.title}
              </BookLink>
            </>
          ) : series.state === "finished" ? (
            p.read === p.total ? (
              "Every book you have in this series is read."
            ) : (
              "Nothing left to read in this series."
            )
          ) : unnumbered ? (
            "Give the books series numbers to see which comes next."
          ) : null}
          {p.missing.length > 0 && (
            <span>
              {" "}
              · {p.missing.length === 1 ? "No book for " : "No books for "}
              {p.missing.slice(0, 5).map(numberLabel).join(", ")}
              {p.missing.length > 5 && ` and ${fmt(p.missing.length - 5)} more`}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

/** "#3", or "#3–#59" for a run. */
function gapLabel(from: number, to: number): string {
  return from === to ? numberLabel(from) : `${numberLabel(from)}–${numberLabel(to)}`;
}

/** A segment per place: read, being read, still to read, or a gap. Never
 *  wider than the card: with many places the segments just get thin. */
function SeriesBar({ slots }: { slots: SeriesSlot<SeriesBook>[] }) {
  const label = slots
    .map((s) =>
      s.kind === "gap"
        ? `${gapLabel(s.from, s.to)} missing`
        : `${numberLabel(s.book.seriesNumber) || s.book.title}: ${placeState(s.book)}`,
    )
    .join(", ");
  return (
    <div role="img" aria-label={label} className="flex h-2 min-w-0 gap-0.5 overflow-hidden">
      {slots.map((s) => (
        <span
          key={s.kind === "gap" ? `gap-${s.from}` : s.book.id}
          className={cn(
            "bar-grow h-full min-w-px flex-1 first:rounded-l-full last:rounded-r-full",
            s.kind === "gap"
              ? "border border-dashed border-muted-foreground/40"
              : s.book.status === ReadingStatus.DNF
                ? "bg-muted-foreground/40"
                : isDoneInSeries(s.book)
                ? "bg-amber-500"
                : s.book.status === ReadingStatus.READING
                  ? "bg-primary/70"
                  : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function placeState(b: SeriesBook): string {
  if (b.status === ReadingStatus.DNF) return "put down";
  if (isDoneInSeries(b)) return "read";
  if (b.status === ReadingStatus.READING) return "reading";
  return "not read yet";
}

/** A book's place: its cover with its number, a tick once read, and a
 *  "Next" or "Reading" tag. */
function Place({ slot }: { slot: Extract<SeriesSlot<SeriesBook>, { kind: "book" }> }) {
  const b = slot.book;
  const done = isDoneInSeries(b);
  // A re-read keeps its tick and gets the tag as well.
  const reading = b.status === ReadingStatus.READING;
  const tag = reading ? "Reading" : slot.next ? "Next" : null;
  return (
    <BookLink
      bookId={b.id}
      className="group grid w-20 gap-1"
      title={`${numberLabel(b.seriesNumber)} ${b.title} · ${placeState(b)}`.trim()}
    >
      <span
        className={cn(
          "relative block rounded-md",
          (slot.next || reading) && "ring-2 ring-amber-500 ring-offset-2 ring-offset-card",
        )}
      >
        <BookCover
          book={b}
          className={cn(
            "cover-shadow aspect-[2/3] w-20 transition-opacity",
            !done && !reading && !slot.next && "opacity-60 group-hover:opacity-100",
            b.status === ReadingStatus.DNF && "grayscale",
          )}
        />
        {done && b.status !== ReadingStatus.DNF && (
          <span className="on-amber absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-amber-500 shadow">
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {tag && (
          <span className="on-amber absolute inset-x-0 bottom-0 rounded-b-md bg-amber-500 py-0.5 text-center text-[10px] font-semibold tracking-wide uppercase">
            {tag}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-xs leading-tight text-muted-foreground group-hover:text-foreground">
        {b.seriesNumber !== null && (
          <span className="font-medium text-foreground tabular-nums">
            {numberLabel(b.seriesNumber)}{" "}
          </span>
        )}
        {b.title}
      </span>
    </BookLink>
  );
}

/** Numbers the library has no book for: one, or a run of them. */
function Gap({ from, to }: { from: number; to: number }) {
  const label = gapLabel(from, to);
  return (
    <Link
      href="/books/new"
      prefetch={false}
      className="group grid w-20 gap-1"
      title={from === to ? `No book for ${label}. Add it` : `No books for ${label}. Add one`}
    >
      <span className="grid aspect-[2/3] w-20 place-items-center rounded-md border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors group-hover:border-muted-foreground/60 group-hover:text-foreground">
        <span className="grid justify-items-center gap-1 px-1 text-center">
          <span
            className={cn(
              "font-semibold tabular-nums",
              from === to ? "text-lg" : "text-xs leading-tight break-all",
            )}
          >
            {label}
          </span>
          <Plus className="size-4" aria-hidden="true" />
        </span>
      </span>
      <span className="text-xs leading-tight text-muted-foreground group-hover:text-foreground">
        Not in your library
      </span>
    </Link>
  );
}
