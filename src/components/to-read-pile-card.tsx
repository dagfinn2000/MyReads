"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePreferences } from "@/components/preferences-provider";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/display";
import { PILE_AGES, pileLastsText, sinceMonth, type PileSummary } from "@/lib/to-read-pile";

/** The pile with the oldest waiting first, in the library. */
const PILE_HREF = "/books?shelf=WANT_TO_READ&sort=createdAt&dir=asc";

/** "Nov 2025" for "2025-11", or "November 2025". */
function monthLabel(month: string, long = false): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return date.toLocaleDateString("en-GB", {
    month: long ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Your to-read pile on Stats (lib/to-read-pile.ts): how many books wait,
 * the pile over twelve months as a small line, what went on and came off,
 * how long the books have waited, and the ones waiting longest.
 */
export function ToReadPileCard({
  pile,
  perYear,
}: {
  pile: PileSummary;
  /** Books finished in the last twelve months: the pace the pile goes by. */
  perYear: number;
}) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const change = pile.monthly.at(-1)!.size - pile.monthly[0].size;
  const lasts = pileLastsText(pile.size, perYear);
  const maxAge = Math.max(...pile.ages, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your to-read pile</CardTitle>
      </CardHeader>
      <CardContent>
        {pile.size === 0 && pile.added === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing waits on Want to Read. Books you add to read later pile up here, with how long
            they&apos;ve waited.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
            <div className="grid content-start gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-heading text-3xl font-semibold tabular-nums">{fmt(pile.size)}</p>
                <p className="text-sm text-muted-foreground">
                  {pile.size === 1 ? "book waits" : "books wait"} to be read
                  {change !== 0 && (
                    <>
                      {" · "}
                      <span className="text-foreground">
                        {change > 0 ? `${fmt(change)} more` : `${fmt(-change)} fewer`}
                      </span>{" "}
                      than a year ago
                    </>
                  )}
                </p>
              </div>
              <PileLine monthly={pile.monthly} fmt={fmt} />
              <p className="text-sm text-muted-foreground">
                In the last twelve months you added{" "}
                <span className="font-medium text-foreground">{fmt(pile.added)}</span> and started{" "}
                <span className="font-medium text-foreground">{fmt(pile.started)}</span>.
                {lasts && (
                  <>
                    {" "}
                    At your pace of {fmt(perYear)} {perYear === 1 ? "book" : "books"} a year, the pile
                    lasts <span className="font-medium text-foreground">{lasts}</span>.
                  </>
                )}
              </p>
            </div>

            <div className="grid content-start gap-5">
              {pile.size > 0 && (
                <div className="grid gap-2">
                  <h3 className="text-sm text-muted-foreground">How long they&apos;ve waited</h3>
                  <ul className="grid gap-1.5">
                    {PILE_AGES.map((age, i) => (
                      <li key={age.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{age.label}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted">
                          <span
                            className="bar-grow block h-full rounded-full bg-primary/70"
                            style={{ width: `${(pile.ages[i] / maxAge) * 100}%` }}
                          />
                        </span>
                        <span className="text-right tabular-nums">{fmt(pile.ages[i])}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pile.oldest.length > 0 && (
                <div className="grid gap-2">
                  <h3 className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
                    Waiting longest
                    <Link
                      href={PILE_HREF}
                      prefetch={false}
                      className="text-xs underline-offset-4 hover:text-foreground hover:underline"
                    >
                      See the whole pile
                    </Link>
                  </h3>
                  <ul className="flex gap-3">
                    {pile.oldest.map((b) => (
                      <li key={b.id} className="w-20 shrink-0">
                        <BookLink bookId={b.id} className="group grid gap-1" title={b.title}>
                          <BookCover book={b} className="aspect-[2/3] w-20" />
                          <span className="line-clamp-2 text-xs leading-tight group-hover:underline">{b.title}</span>
                          <span className="text-[11px] text-muted-foreground">
                            Since {sinceMonth(b.createdAt, prefs.timeZone)}
                          </span>
                        </BookLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const W = 320;
const H = 72;
const PAD = 4;

/**
 * The pile at the end of each month as a line over a soft area, with the
 * month and its count on hover or focus. A single series: the card's title
 * names it, so it has no legend; first and last months are labelled.
 */
function PileLine({ monthly, fmt }: { monthly: PileSummary["monthly"]; fmt: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const max = Math.max(...monthly.map((m) => m.size), 1);
  const x = (i: number) => PAD + (i / (monthly.length - 1)) * (W - PAD * 2);
  const y = (n: number) => H - PAD - (n / max) * (H - PAD * 2);
  const line = monthly.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(m.size).toFixed(1)}`).join("");
  const area = `${line}L${x(monthly.length - 1).toFixed(1)},${H - PAD}L${x(0).toFixed(1)},${H - PAD}Z`;
  const shown = hover ?? monthly.length - 1;

  return (
    <figure className="grid gap-1">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-20 w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Books waiting at the end of each month: ${monthly
            .map((m) => `${monthLabel(m.month, true)} ${m.size}`)
            .join(", ")}`}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - box.left) / box.width) * (monthly.length - 1));
            setHover(Math.min(Math.max(i, 0), monthly.length - 1));
          }}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradient})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD}
              y2={H - PAD}
              stroke="var(--muted-foreground)"
              strokeOpacity="0.4"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* The dot sits outside the stretched drawing, so it stays round. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
          style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(monthly[shown].size) / H) * 100}%` }}
        />
      </div>
      <figcaption className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{monthLabel(monthly[0].month)}</span>
        <span className="text-foreground" aria-live="polite">
          {hover !== null
            ? `${monthLabel(monthly[hover].month, true)}: ${fmt(monthly[hover].size)}`
            : `Now: ${fmt(monthly.at(-1)!.size)}`}
        </span>
        <span>Now</span>
      </figcaption>
    </figure>
  );
}
