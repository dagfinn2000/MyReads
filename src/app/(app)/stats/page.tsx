import Link from "next/link";
import { BookCheck, BookOpenText, FileText, LibraryBig, Star } from "lucide-react";
import { redirect } from "next/navigation";
import { ReadingStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPreferences } from "@/lib/current-user";
import { dayKey } from "@/lib/dates";
import { FORMAT_LABELS, formatNumber } from "@/lib/display";
import { goalPace, goalProgress, splitGoals, yearClock } from "@/lib/goals";
import { dailyPageTotalsForUser } from "@/lib/progress-query";
import {
  booksReadAllTime,
  buildPasses,
  countWindow,
  goalRuleLine,
  ruleNotes,
  tally,
} from "@/lib/stats-count";
import {
  ALL_TIME,
  PERIOD_WORDS,
  parseGoalYear,
  parsePeriod,
  periodWindow,
  statsHref,
  yearWindow,
} from "@/lib/stats-period";
import { loadStatsInputs } from "@/lib/stats-query";
import { GoalCard } from "@/components/goal-card";
import { ReadingHeatmap } from "@/components/reading-heatmap";
import { Bar, StatCard } from "@/components/stat-blocks";
import { StatsPeriodNav } from "@/components/stats-period-nav";
import { Stars } from "@/components/stars";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats · MyReads" };

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)

  const userId = session.user.id;
  const sp = await searchParams;
  const prefs = await getPreferences();
  const hidden = new Set(prefs.hiddenStats);
  const ratings = prefs.ratingStyle !== "off";
  const fmt = (n: number) => formatNumber(n, prefs);

  // Today, and the period the buttons (or Preferences) chose, in the
  // reader's zone.
  const todayKey = dayKey(new Date(), prefs.timeZone);
  const currentYear = Number(todayKey.slice(0, 4));
  const period = parsePeriod(sp.period, prefs.statsPeriod);
  const words = PERIOD_WORDS[period];

  const [inputs, goals, pageTotals, quoteCount, randomQuotes] = await Promise.all([
    // Books, past reads and the log by book and day: what lib/stats-count.ts
    // turns into passes, by the "What counts" preferences.
    loadStatsInputs(userId, prefs.timeZone),
    prisma.readingGoal.findMany({
      where: { userId },
      orderBy: { year: "desc" },
    }),
    // Pages-per-day for the heatmap, aggregated in SQL — one row per reading
    // day rather than every log entry ever written. See lib/progress-query.ts
    // for why this is not simply a date-bounded findMany.
    dailyPageTotalsForUser(userId, prefs.timeZone),
    prisma.quote.count({ where: { book: { userId } } }),
    // A random quote for the serendipity card — new one on every visit.
    // ORDER BY random() picks uniformly in one query, where the previous
    // count-then-skip needed the count first (a second round-trip).
    prisma.$queryRaw<
      { id: string; text: string; page: number | null; bookId: string; bookTitle: string }[]
    >`
      SELECT q."id", q."text", q."page", b."id" AS "bookId", b."title" AS "bookTitle"
      FROM "Quote" q
      JOIN "Book" b ON b."id" = q."bookId"
      WHERE b."userId" = ${userId}
      ORDER BY random()
      LIMIT 1`,
  ]);

  const randomQuote = randomQuotes[0] ?? null;
  const { books } = inputs;
  const reading = books.filter((b) => b.status === ReadingStatus.READING);

  // Every pass through every book, counted all time and in the period.
  const passes = buildPasses(inputs, prefs, prefs.timeZone);
  const allTime = countWindow(passes, ALL_TIME, prefs);
  const counted =
    period === "all" ? allTime : countWindow(passes, periodWindow(period, todayKey), prefs);
  const totals = tally(counted);

  // Books read: all time it's the books on the Read shelf, each once. In a
  // period it's finishes, re-reads included, so it says "Books finished".
  const readAllTime = booksReadAllTime(books, prefs);
  const notes = ruleNotes(
    prefs,
    period === "all"
      ? { putDown: readAllTime.putDown }
      : { rereads: totals.rereads, putDown: totals.putDown },
    fmt,
  );
  const booksLabel =
    period === "all" || prefs.statsStoppedBooks === "book" ? "Books read" : "Books finished";

  // Average rating: all time, every rated book (any status); in a period,
  // the rated finishes in it.
  const ratingValues =
    period === "all"
      ? books
          .filter((b) => !(prefs.statsAudiobooks === "out" && b.format === "AUDIOBOOK"))
          .flatMap((b) => (b.rating != null ? [b.rating] : []))
      : counted.flatMap((i) =>
          i.books > 0 && i.pass.kind === "finished" && i.pass.rating != null
            ? [i.pass.rating]
            : [],
        );
  const avgRating =
    ratingValues.length > 0
      ? ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length / 2
      : null;

  // Books per year: every dated pass that counts as a book, re-reads
  // included. A 2026 re-read of an old favourite shows up in 2026.
  const perYear = new Map<number, number>();
  for (const i of allTime) {
    if (i.books === 0 || !i.pass.day) continue;
    const year = Number(i.pass.day.slice(0, 4));
    perYear.set(year, (perYear.get(year) ?? 0) + i.books);
  }
  const years = [...perYear.entries()].sort((a, b) => a[0] - b[0]);
  const maxYear = Math.max(...perYear.values(), 0);

  // Reading goals: one year at a time (this year unless the address picks
  // next year or a past one), with progress by the goal's own rule and the
  // same counting as the cards.
  const { upcoming, past } = splitGoals(goals, currentYear);
  const goalYear = parseGoalYear(sp.goalYear, currentYear, new Set(past.map((g) => g.year)));
  const shownYear = goalYear ?? currentYear;
  const shownGoal = goals.find((g) => g.year === shownYear) ?? null;
  const progressFor = (g: (typeof goals)[number]) =>
    goalProgress(countWindow(passes, yearWindow(g.year), prefs), g);
  const clock = yearClock(todayKey, shownYear);
  const goalDone = shownGoal ? progressFor(shownGoal) : 0;
  const nextGoal = upcoming.find((g) => g.year === currentYear + 1) ?? null;

  // Genres and formats: every book in the library, or (Preferences) the
  // books read in the period, each once however many times it was read.
  const byPeriod = prefs.statsBreakdown === "period";
  const breakdownBooks = byPeriod
    ? [
        ...new Map(
          counted.filter((i) => i.books > 0).map((i) => [i.pass.book.id, i.pass.book]),
        ).values(),
      ]
    : books;
  const breakdownNote = byPeriod
    ? `books read · ${words}`
    : period === "all"
      ? null
      : "every book in the library";
  const nothingRead = period === "all" ? "Nothing read yet." : "Nothing in this period.";

  // Genre/tag breakdown, top 10.
  const tagCounts = new Map<string, number>();
  for (const b of breakdownBooks) {
    for (const t of b.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxTag = topTags[0]?.[1] ?? 0;

  // Format breakdown.
  const formatCounts = new Map<string, number>();
  for (const b of breakdownBooks) {
    const label = FORMAT_LABELS[b.format];
    formatCounts.set(label, (formatCounts.get(label) ?? 0) + 1);
  }
  const maxFormat = Math.max(...formatCounts.values(), 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <StatsPeriodNav period={period} goalYear={goalYear} />
      </div>

      <div className="grid gap-3">
        <div className={`grid grid-cols-2 gap-4 max-lg:[&>:last-child:nth-child(odd)]:col-span-2 ${ratings ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          <StatCard label="Books in library" icon={LibraryBig}>{fmt(books.length)}</StatCard>
          <StatCard label={`${booksLabel} · ${words}`} icon={BookCheck} note={notes.books.join(" · ")}>
            {fmt(period === "all" ? readAllTime.books : totals.books)}
          </StatCard>
          <StatCard label="Currently reading" icon={BookOpenText}>{fmt(reading.length)}</StatCard>
          <StatCard
            label={`Pages read · ${words}${notes.pagesSuffix}`}
            icon={FileText}
            note={notes.pages.join(" · ")}
          >
            {fmt(totals.pages)}
          </StatCard>
          {ratings && (
            <StatCard
              label={`Average rating · ${words}`}
              icon={Star}
              note={`${fmt(ratingValues.length)} rated`}
            >
              {avgRating != null ? (
                <AverageRating stars={avgRating} style={prefs.ratingStyle} />
              ) : (
                "–"
              )}
            </StatCard>
          )}
        </div>
        {period === "year" && (
          <p className="text-sm">
            <Link
              href={`/stats/year/${currentYear}`}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              See {currentYear} in review
            </Link>
          </p>
        )}
      </div>

      {!hidden.has("goal") && (
        <GoalCard
          year={shownYear}
          currentYear={currentYear}
          goal={shownGoal}
          done={goalDone}
          pace={
            shownGoal ? goalPace(goalDone, shownGoal.target, shownGoal.unit, clock) : null
          }
          clock={clock}
          nextYear={
            nextGoal && { ...nextGoal, href: statsHref({ period, goalYear: nextGoal.year }) }
          }
          past={past.map((g) => {
            const done = progressFor(g);
            return {
              year: g.year,
              target: g.target,
              unit: g.unit,
              done,
              met: done >= g.target,
              editHref: statsHref({ period, goalYear: g.year, hash: "goal" }),
            };
          })}
          yearOptions={[...new Set([currentYear, currentYear + 1, shownYear])]
            .sort((a, b) => a - b)
            .map((y) => ({
              year: y,
              href: statsHref({ period, goalYear: y === currentYear ? null : y }),
            }))}
          ruleLine={goalRuleLine(prefs)}
          prefs={prefs}
        />
      )}

      {!hidden.has("heatmap") && (
        <Card>
          <CardHeader>
            <CardTitle>
              Reading days
              {/* The calendar is always the last 12 months. */}
              {(period === "year" || period === "30d") && (
                <span className="font-normal text-muted-foreground"> · last 12 months</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReadingHeatmap totals={pageTotals} prefs={prefs} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {!hidden.has("perYear") && (
          <Card>
            <CardHeader>
              <CardTitle>Books read per year</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {years.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Finish a book (with a finished date) and it shows up here.
                </p>
              ) : (
                <>
                  {years.map(([year, count]) => (
                    <Link
                      key={year}
                      href={`/stats/year/${year}`}
                      className="-mx-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-accent/50"
                      title={`${year} in review`}
                    >
                      <Bar label={String(year)} value={count} max={maxYear} />
                    </Link>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Click a year for its full wrap-up.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!hidden.has("tags") && (
          <Card>
            <CardHeader>
              <CardTitle>
                Genres &amp; tags
                {breakdownNote && (
                  <span className="font-normal text-muted-foreground"> · {breakdownNote}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {topTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {byPeriod && breakdownBooks.length === 0
                    ? nothingRead
                    : "Tag your books to see the breakdown."}
                </p>
              ) : (
                topTags.map(([tag, count]) => (
                  <Bar key={tag} label={tag} value={count} max={maxTag} />
                ))
              )}
            </CardContent>
          </Card>
        )}

        {!hidden.has("formats") && (
          <Card>
            <CardHeader>
              <CardTitle>
                Formats
                {breakdownNote && (
                  <span className="font-normal text-muted-foreground"> · {breakdownNote}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[...formatCounts.entries()].map(([label, count]) => (
                <Bar key={label} label={label} value={count} max={maxFormat} />
              ))}
              {formatCounts.size === 0 && (
                <p className="text-sm text-muted-foreground">
                  {byPeriod ? nothingRead : "No books yet."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {randomQuote && !hidden.has("quote") && (
          <Card>
            <CardHeader>
              <CardTitle>From your quotes</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              <blockquote className="long-text whitespace-pre-line break-words border-l-2 border-primary/50 pl-3 text-sm leading-relaxed">
                {randomQuote.text}
              </blockquote>
              <p className="text-sm text-muted-foreground">
                —{" "}
                <Link
                  href={`/books/${randomQuote.bookId}`}
                  className="font-medium hover:underline"
                >
                  {randomQuote.bookTitle}
                </Link>
                {randomQuote.page != null && `, p. ${randomQuote.page}`}
                {" · "}
                <Link href="/quotes" className="hover:underline">
                  browse all {quoteCount}
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** The average rating in the reader's rating style: "3.6" with stars, or
 *  "7.2/10". */
function AverageRating({ stars, style }: { stars: number; style: string }) {
  if (style === "ten") return <>{(stars * 2).toFixed(1)}/10</>;
  return (
    <span className="flex items-center gap-2">
      {stars.toFixed(1)}
      <Stars value={Math.round(stars * 2)} />
    </span>
  );
}
