"use client";

import { useState } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatOneDecimal, formatShortDay } from "@/lib/display";
import { shiftDayKey } from "@/lib/dates";
import { changeText, onCourseFor, type YearSide, type YearVersus } from "@/lib/year-versus";
import { cn } from "@/lib/utils";

/**
 * This year against last on Stats (lib/year-versus.ts): books, pages,
 * reading days, time and the average rating so far this year beside last
 * year by the same day, and both years' books as two lines through the
 * year.
 */
export function YearVersusCard({ versus: v }: { versus: YearVersus }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const rated = prefs.ratingStyle !== "off";
  const course = onCourseFor(v);
  const byDay = formatShortDay(v.today, prefs.dateFormat, false).replace(/^\S+ /, "");

  const rows: { label: string; now: number | null; then: number | null; show: (n: number) => string }[] = [
    { label: "Books", now: v.now.books, then: v.then.books, show: fmt },
    { label: "Pages", now: v.now.pages, then: v.then.pages, show: fmt },
    { label: "Reading days", now: v.now.days, then: v.then.days, show: fmt },
  ];
  if (v.now.minutes !== null) {
    rows.push({ label: "Time read", now: v.now.minutes, then: v.then.minutes, show: hoursText });
  }
  if (rated && (v.now.rating !== null || v.then.rating !== null)) {
    rows.push({
      label: "Average rating",
      now: v.now.rating,
      then: v.then.rating,
      // Stored out of 10; shown as stars (out of 5) unless rated out of 10.
      show: (n) => formatOneDecimal(prefs.ratingStyle === "ten" ? n : n / 2, prefs),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {v.now.year} against {v.then.year}{" "}
          <span className="font-normal text-muted-foreground">· by {byDay}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-10">
        <div className="grid content-start gap-3">
          <p className="text-sm text-muted-foreground">
            {headline(v.now, v.then, fmt)}
            {course !== null && (
              <>
                {" "}
                At this pace you&apos;ll finish about{" "}
                <span className="font-medium text-foreground">{fmt(course)}</span> this year, against{" "}
                {fmt(v.thenFullYear)} in all of {v.then.year}.
              </>
            )}
          </p>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="pb-1 text-left font-normal">
                  <span className="sr-only">Measure</span>
                </th>
                <th scope="col" className="pb-1 text-right font-medium text-foreground">
                  {v.now.year}
                </th>
                <th scope="col" className="pb-1 text-right font-normal">
                  {v.then.year}
                </th>
                <th scope="col" className="pb-1 text-right font-normal">
                  <span className="sr-only">Change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border/60">
                  <th scope="row" className="py-1.5 text-left font-normal text-muted-foreground">
                    {r.label}
                  </th>
                  <td className="py-1.5 text-right font-medium">{r.now === null ? "–" : r.show(r.now)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{r.then === null ? "–" : r.show(r.then)}</td>
                  <td className="w-16 py-1.5 text-right text-xs">
                    {r.now !== null && r.then !== null && <Change now={r.now} then={r.then} show={r.show} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <YearLines v={v} fmt={fmt} dateFormat={prefs.dateFormat} />
      </CardContent>
    </Card>
  );
}

function headline(now: YearSide, then: YearSide, fmt: (n: number) => string): string {
  const d = now.books - then.books;
  if (d === 0) return `${fmt(now.books)} ${now.books === 1 ? "book" : "books"}, the same as by this day last year.`;
  const more = d > 0;
  const n = Math.abs(d);
  return `${fmt(now.books)} ${now.books === 1 ? "book" : "books"} so far: ${fmt(n)} ${more ? "more" : "fewer"} than by this day last year.`;
}

function hoursText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10} h`;
}

/** The change as a signed figure, with an arrow, never by colour alone. */
function Change({ now, then, show }: { now: number; then: number; show: (n: number) => string }) {
  const text = changeText(Math.round(now * 100), Math.round(then * 100), (n) => show(n / 100));
  const up = now > then;
  return (
    <span className={cn("whitespace-nowrap", now === then ? "text-muted-foreground" : "text-foreground")}>
      {now !== then && <span aria-hidden="true">{up ? "▲ " : "▼ "}</span>}
      {text}
    </span>
  );
}

// Wide and low, so the drawing fills its column without stretching.
const W = 480;
const H = 190;
const PAD = { top: 8, right: 4, bottom: 2, left: 4 };
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Both years' books, added up day by day: this year solid in the theme's
 * colour up to today, last year dashed and quieter through December. A
 * crosshair follows the pointer with both counts for that day. Each line is
 * named at its end, and the legend under it says which is which.
 */
function YearLines({
  v,
  fmt,
  dateFormat,
}: {
  v: YearVersus;
  fmt: (n: number) => string;
  dateFormat: Parameters<typeof formatShortDay>[1];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const days = v.thenByDay.length;
  const max = Math.max(v.thenByDay.at(-1) ?? 0, v.nowByDay.at(-1) ?? 0, 1);
  const x = (i: number) => PAD.left + (i / (Math.max(days, 365) - 1)) * (W - PAD.left - PAD.right);
  const y = (n: number) => H - PAD.bottom - (n / max) * (H - PAD.top - PAD.bottom);
  const path = (series: number[]) =>
    series.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join("");
  const today = v.nowByDay.length - 1;
  const at = hover ?? today;
  const nowAt = at <= today ? v.nowByDay[at] : null;
  const thenAt = v.thenByDay[Math.min(at, v.thenByDay.length - 1)];
  const dayKey = shiftDayKey(`${v.now.year}-01-01`, at);

  return (
    <figure className="grid content-start gap-1">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Books finished through the year: ${fmt(v.nowByDay[today])} so far in ${v.now.year}, ${fmt(v.thenByDay[Math.min(today, v.thenByDay.length - 1)])} by this day in ${v.then.year}, ${fmt(v.thenFullYear)} in all of ${v.then.year}.`}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const sx = ((e.clientX - box.left) / box.width) * W;
            const i = Math.round(((sx - PAD.left) / (W - PAD.left - PAD.right)) * (Math.max(days, 365) - 1));
            setHover(Math.min(Math.max(i, 0), days - 1));
          }}
        >
          {/* Recessive month ticks and a baseline. */}
          {MONTH_STARTS.slice(1).map((d) => (
            <line
              key={d}
              x1={x(d)}
              x2={x(d)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--border)"
              strokeOpacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={H - PAD.bottom}
            y2={H - PAD.bottom}
            stroke="var(--border)"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path(v.thenByDay)}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeOpacity="0.75"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path(v.nowByDay)}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {hover !== null && (
            <line
              x1={x(at)}
              x2={x(at)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--foreground)"
              strokeOpacity="0.3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Dots and month letters sit outside the drawing, so they keep
            their size on a phone. */}
        {thenAt !== undefined && <Dot x={x(at)} y={y(thenAt)} className="size-2 bg-muted-foreground" />}
        {nowAt !== null && <Dot x={x(at)} y={y(nowAt)} className="size-2.5 bg-primary" />}
      </div>
      <div aria-hidden="true" className="relative h-4 text-[11px] text-muted-foreground">
        {MONTH_STARTS.map((d, i) => (
          <span key={d} className="absolute -translate-x-1/2" style={{ left: `${(x(d + 15) / W) * 100}%` }}>
            {MONTH_LETTERS[i]}
          </span>
        ))}
      </div>
      <figcaption className="grid gap-1 text-xs text-muted-foreground">
        <p className="text-foreground tabular-nums" aria-live="polite">
          By {formatShortDay(dayKey, dateFormat, false).replace(/^\S+ /, "")}:{" "}
          {nowAt !== null && (
            <>
              <span className="font-medium">{fmt(nowAt)}</span> in {v.now.year} ·{" "}
            </>
          )}
          {fmt(thenAt ?? 0)} in {v.then.year}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden="true">
              <line x1="1" x2="17" y1="2" y2="2" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {v.now.year}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden="true">
              <line x1="1" x2="17" y1="2" y2="2" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            {v.then.year}
          </span>
        </p>
      </figcaption>
    </figure>
  );
}

function Dot({ x, y, className }: { x: number; y: number; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
        className,
      )}
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
    />
  );
}
