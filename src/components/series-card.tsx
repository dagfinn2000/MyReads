import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { ReadingStatus } from "@/lib/enums";
import { formatNumber } from "@/lib/display";
import type { NumberFormat } from "@/lib/preferences";
import { isDoneInSeries } from "@/lib/series";
import { seriesAnchor, type SeriesBook, type SeriesEntry, type SeriesSlot } from "@/lib/series-list";
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
  const reading = series.books.find(
    (b) => b.status === ReadingStatus.READING && !isDoneInSeries(b),
  );
  const href = `/books?series=${encodeURIComponent(series.name)}&group=series`;

  return (
    <Card id={seriesAnchor(series.name)} className="scroll-mt-20 target:ring-2 target:ring-amber-500/60">
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              <Link href={href} className="hover:underline">
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
            {series.state === "finished" ? (
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
            <li key={slot.kind === "gap" ? `gap-${slot.number}` : slot.book.id} className="shrink-0">
              {slot.kind === "gap" ? <Gap number={slot.number} /> : <Place slot={slot} />}
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
            "Every book you have in this series is read."
          ) : (
            "Give the books series numbers to see which comes next."
          )}
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

/** A segment per place: read, being read, still to read, or a gap. */
function SeriesBar({ slots }: { slots: SeriesSlot<SeriesBook>[] }) {
  const label = slots
    .map((s) =>
      s.kind === "gap"
        ? `${numberLabel(s.number)} missing`
        : `${numberLabel(s.book.seriesNumber) || s.book.title}: ${placeState(s.book)}`,
    )
    .join(", ");
  return (
    <div role="img" aria-label={label} className="flex h-2 gap-0.5">
      {slots.map((s) => (
        <span
          key={s.kind === "gap" ? `gap-${s.number}` : s.book.id}
          className={cn(
            "bar-grow h-full min-w-1 flex-1 first:rounded-l-full last:rounded-r-full",
            s.kind === "gap"
              ? "border border-dashed border-muted-foreground/40"
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
  const reading = !done && b.status === ReadingStatus.READING;
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
          <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-amber-500 text-white shadow">
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {tag && (
          <span className="absolute inset-x-0 bottom-0 rounded-b-md bg-amber-500/95 py-0.5 text-center text-[10px] font-semibold tracking-wide text-white uppercase">
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

/** A number the library has no book for. */
function Gap({ number }: { number: number }) {
  return (
    <Link
      href="/books/new"
      className="group grid w-20 gap-1"
      title={`No book for ${numberLabel(number)}. Add it`}
    >
      <span className="grid aspect-[2/3] w-20 place-items-center rounded-md border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors group-hover:border-muted-foreground/60 group-hover:text-foreground">
        <span className="grid justify-items-center gap-1">
          <span className="text-lg font-semibold tabular-nums">{numberLabel(number)}</span>
          <Plus className="size-4" aria-hidden="true" />
        </span>
      </span>
      <span className="text-xs leading-tight text-muted-foreground group-hover:text-foreground">
        Not in your library
      </span>
    </Link>
  );
}
