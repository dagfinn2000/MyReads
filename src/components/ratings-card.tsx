import Link from "next/link";
import type { RatingStyle } from "@/lib/preferences";
import { ratingLabel } from "@/lib/library-sort";
import type { AspectBook, AspectSummary, RatingBucket, ratingLean } from "@/lib/rating-breakdown";
import { BookCover } from "@/components/book-card";
import { StarGraphic } from "@/components/stars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CardBook = AspectBook & { coverUrl: string | null; authors: string[] };

/**
 * Ratings on Stats (lib/rating-breakdown.ts): how the overall ratings spread
 * across the reader's scale, as columns, and beside them the plot,
 * characters and writing, each with its average and the book rated best
 * for it. `aspects` is null with the breakdown switched off in Preferences.
 */
export function RatingsCard({
  words,
  style,
  buckets,
  aspects,
  lean,
  fmt,
  allTime,
}: {
  /** "this year", "all time". */
  words: string;
  style: Exclude<RatingStyle, "off">;
  buckets: RatingBucket[];
  aspects: AspectSummary<CardBook>[] | null;
  lean: ReturnType<typeof ratingLean>;
  fmt: (n: number) => string;
  allTime: boolean;
}) {
  const rated = buckets.reduce((sum, b) => sum + b.count, 0);
  const aspectsRated = aspects?.some((a) => a.count > 0) ?? false;
  const empty = rated === 0 && !aspectsRated;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Ratings <span className="font-normal text-muted-foreground">· {words}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">
            {allTime
              ? "Rate the books you read, and this shows how you rate them."
              : "No rated books finished in this period."}
          </p>
        ) : (
          <div
            className={
              aspects
                ? "grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10"
                : "grid"
            }
          >
            <Spread buckets={buckets} rated={rated} style={style} fmt={fmt} />
            {aspects && (
              <Aspects aspects={aspects} lean={lean} style={style} fmt={fmt} allTime={allTime} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** The overall ratings as columns, one per step of the scale. */
function Spread({
  buckets,
  rated,
  style,
  fmt,
}: {
  buckets: RatingBucket[];
  rated: number;
  style: Exclude<RatingStyle, "off">;
  fmt: (n: number) => string;
}) {
  if (rated === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No overall ratings yet: give a book its own rating as well, and they
        show here.
      </p>
    );
  }
  const max = Math.max(...buckets.map((b) => b.count));
  // The most given, and on a tie the higher of them.
  const top = buckets.reduce((a, b) => (b.count >= a.count ? b : a));
  const books = (n: number) => `${fmt(n)} ${n === 1 ? "book" : "books"}`;

  return (
    <div className="grid content-start gap-3">
      <p className="text-sm text-muted-foreground">
        You most often give{" "}
        <span className="font-medium text-foreground">{ratingLabel(top.value, style)}</span>
        {rated > 1 && <> ({books(top.count)} of {fmt(rated)})</>}.
      </p>
      <ul className="flex h-36 items-stretch border-b pt-5" aria-label="How many books got each rating">
        {buckets.map((b, i) => {
          const pct = b.count > 0 ? Math.max((b.count / max) * 100, 4) : 0;
          const isTop = b === top;
          return (
            <li
              key={b.value}
              // Focusable so a tap (or Tab) shows the count, as hover does.
              tabIndex={0}
              className="group relative flex min-w-0 flex-1 items-end justify-center rounded-sm outline-none focus-visible:bg-accent/40"
            >
              <span className="sr-only">
                {ratingLabel(b.value, style)}: {books(b.count)}
              </span>
              <span
                aria-hidden="true"
                className={`bar-rise relative block w-full max-w-6 rounded-t-sm ${
                  isTop ? "bg-linear-to-t from-primary/80 to-primary" : "bg-primary/35"
                }`}
                style={{ height: `${pct}%`, animationDelay: `${i * 35}ms` }}
              >
                {b.count > 0 && (
                  <span
                    className={`absolute inset-x-[-0.5rem] bottom-full mb-1 text-center text-xs tabular-nums transition-opacity ${
                      isTop
                        ? "font-medium text-foreground"
                        : "text-muted-foreground opacity-0 group-hover:opacity-100 group-focus:opacity-100"
                    }`}
                  >
                    {fmt(b.count)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="-mt-1.5 flex" aria-hidden="true">
        {buckets.map((b) => (
          <span
            key={b.value}
            className={`min-w-0 flex-1 text-center text-xs tabular-nums ${
              b === top ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The plot, characters and writing: average, how many, the best book. */
function Aspects({
  aspects,
  lean,
  style,
  fmt,
  allTime,
}: {
  aspects: AspectSummary<CardBook>[];
  lean: ReturnType<typeof ratingLean>;
  style: Exclude<RatingStyle, "off">;
  fmt: (n: number) => string;
  allTime: boolean;
}) {
  if (!aspects.some((a) => a.count > 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        {allTime
          ? "Rate the plot, characters and writing under a book's own rating, and how each averages out shows here."
          : "None of the books finished in this period is rated for its plot, characters or writing."}
      </p>
    );
  }
  return (
    <div className="grid content-start gap-5">
      <dl className="grid gap-4">
        {aspects.map((a) => (
          <div key={a.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3">
            <dt className="text-sm text-muted-foreground">{a.label}</dt>
            <dd className="grid gap-1">
              {a.average == null ? (
                <span className="text-sm text-muted-foreground">Not rated yet</span>
              ) : (
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-heading text-2xl font-semibold tabular-nums">
                    {style === "ten" ? (
                      <>
                        {a.average.toFixed(1)}
                        <span className="text-base font-normal text-muted-foreground">/10</span>
                      </>
                    ) : (
                      (a.average / 2).toFixed(1)
                    )}
                  </span>
                  {style !== "ten" && <StarGraphic value={a.average} />}
                  <span className="text-xs text-muted-foreground">
                    {fmt(a.count)} {a.count === 1 ? "book" : "books"}
                  </span>
                </span>
              )}
              {a.best && a.count > 1 && (
                <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <BookCover book={a.best} className="aspect-[2/3] w-5 shrink-0 rounded-[3px]" />
                  <span className="flex min-w-0 gap-1 whitespace-nowrap">
                    <span>Best:</span>
                    <Link
                      href={`/books/${a.best.id}`}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {a.best.title}
                    </Link>
                    <span>· {ratingLabel(a.best[a.key]!, style)}</span>
                  </span>
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {lean && (
        <div className="grid gap-0.5 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Your overall rating rises and falls most with{" "}
            <span className="font-medium text-foreground">{lean.phrase}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Going by the {fmt(lean.books)} books rated for both.
          </p>
        </div>
      )}
    </div>
  );
}
