import Link from "next/link";
import { redirect } from "next/navigation";
import { GoalUnit, ReadingStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setReadingGoal } from "@/lib/actions/goals";
import { getPreferences } from "@/lib/current-user";
import { calendarDay } from "@/lib/dates";
import { FORMAT_LABELS, formatNumber } from "@/lib/display";
import { goalProgress, markRereads } from "@/lib/goals";
import { dailyPageTotalsForUser } from "@/lib/progress-query";
import { GoldMedal } from "@/components/gold-medal";
import { ReadingHeatmap } from "@/components/reading-heatmap";
import { Bar, StatCard } from "@/components/stat-blocks";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats · MyReads" };

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)

  const userId = session.user.id;
  const prefs = await getPreferences();
  const hidden = new Set(prefs.hiddenStats);
  const ratings = prefs.ratingStyle !== "off";

  const [books, pastReads, goals, pageTotals, quoteCount, randomQuotes] =
    await Promise.all([
    prisma.book.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        rating: true,
        pageCount: true,
        dateFinished: true,
        tags: true,
        format: true,
      },
    }),
    // Archived passes from the read-history table: re-reads and pre-app reads.
    prisma.read.findMany({
      where: { book: { userId } },
      select: {
        bookId: true,
        dateFinished: true,
        book: { select: { pageCount: true } },
      },
    }),
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

  const read = books.filter((b) => b.status === ReadingStatus.READ);
  const reading = books.filter((b) => b.status === ReadingStatus.READING);

  // Pages read: every finished pass counts — the current one on each READ
  // book plus every archived past read.
  const pagesRead =
    read.reduce((sum, b) => sum + (b.pageCount ?? 0), 0) +
    pastReads.reduce((sum, r) => sum + (r.book.pageCount ?? 0), 0);

  // Average rating across every rated book (any status), in stars.
  const rated = books.filter((b) => b.rating != null);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, b) => sum + b.rating!, 0) / rated.length / 2
      : null;

  // Every dated finish — current passes and archived past reads — tagged
  // with its calendar year and whether it was a re-read. A 2026 re-read of
  // an old favourite shows up in 2026, and counts toward that year's goal
  // unless the goal leaves re-reads out.
  const finishes = markRereads(
    [
      ...read
        .filter((b) => b.dateFinished)
        .map((b) => ({ bookId: b.id, dateFinished: b.dateFinished!, pageCount: b.pageCount })),
      ...pastReads
        .filter((r) => r.dateFinished)
        .map((r) => ({
          bookId: r.bookId,
          dateFinished: r.dateFinished!,
          pageCount: r.book.pageCount,
        })),
    ],
    new Set(pastReads.filter((r) => !r.dateFinished).map((r) => r.bookId)),
  ).map((f) => ({ ...f, year: Number(calendarDay(f.dateFinished, prefs.timeZone).slice(0, 4)) }));
  const finishesIn = (year: number) => finishes.filter((f) => f.year === year);

  const perYear = new Map<number, number>();
  for (const f of finishes) perYear.set(f.year, (perYear.get(f.year) ?? 0) + 1);
  const years = [...perYear.entries()].sort((a, b) => a[0] - b[0]);
  const maxYear = Math.max(...perYear.values(), 0);

  // Reading goals: progress is derived from each year's finishes, by the
  // goal's own rule (books or pages, with or without re-reads).
  const currentYear = Number(calendarDay(new Date(), prefs.timeZone).slice(0, 4));
  const currentGoal = goals.find((g) => g.year === currentYear) ?? null;
  const progressFor = (g: (typeof goals)[number]) => goalProgress(finishesIn(g.year), g);
  const currentProgress = currentGoal ? progressFor(currentGoal) : 0;
  const goalMet = currentGoal !== null && currentProgress >= currentGoal.target;
  const pastGoals = goals.filter((g) => g.year !== currentYear);
  const unitWord = (unit: GoalUnit, n: number) =>
    unit === GoalUnit.PAGES ? (n === 1 ? "page" : "pages") : n === 1 ? "book" : "books";

  // Genre/tag breakdown, top 10.
  const tagCounts = new Map<string, number>();
  for (const b of books) {
    for (const t of b.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxTag = topTags[0]?.[1] ?? 0;

  // Format breakdown.
  const formatCounts = new Map<string, number>();
  for (const b of books) {
    const label = FORMAT_LABELS[b.format];
    formatCounts.set(label, (formatCounts.get(label) ?? 0) + 1);
  }
  const maxFormat = Math.max(...formatCounts.values(), 0);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>

      <div className={`grid grid-cols-2 gap-4 ${ratings ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <StatCard label="Books in library">{formatNumber(books.length, prefs)}</StatCard>
        <StatCard label="Books read">{formatNumber(read.length, prefs)}</StatCard>
        <StatCard label="Currently reading">{formatNumber(reading.length, prefs)}</StatCard>
        <StatCard label="Pages read">{formatNumber(pagesRead, prefs)}</StatCard>
        {ratings && (
          <StatCard label="Average rating">
            {avgRating != null ? (
              <AverageRating stars={avgRating} style={prefs.ratingStyle} />
            ) : (
              "–"
            )}
          </StatCard>
        )}
      </div>

      {!hidden.has("goal") && (
        <Card>
          <CardHeader>
            <CardTitle>Reading goal {currentYear}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {currentGoal ? (
              <div className="flex flex-wrap items-center gap-6">
                {goalMet && <GoldMedal className="h-20 w-[60px] shrink-0" />}
                <div className="min-w-56 flex-1">
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatNumber(currentProgress, prefs)}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      of {formatNumber(currentGoal.target, prefs)}{" "}
                      {unitWord(currentGoal.unit, currentGoal.target)}
                    </span>
                  </p>
                  <div className="mt-2 h-3 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${goalMet ? "bg-amber-500" : "bg-primary/80"}`}
                      style={{
                        width: `${Math.min((currentProgress / currentGoal.target) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {goalMet
                      ? "Goal achieved — you've earned the gold medal! 🎉"
                      : `${formatNumber(currentGoal.target - currentProgress, prefs)} more ${unitWord(
                          currentGoal.unit,
                          currentGoal.target - currentProgress,
                        )} to go.`}
                    {!currentGoal.countRereads && " Re-reads don't count toward this goal."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set a goal for the year — finish that many books (or pages)
                and earn a gold medal.
              </p>
            )}

            <form action={setReadingGoal} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="year" value={currentYear} />
              <div className="grid gap-1">
                <label
                  htmlFor="goal-target"
                  className="text-xs text-muted-foreground"
                >
                  Goal for {currentYear}
                </label>
                <Input
                  id="goal-target"
                  name="target"
                  type="number"
                  min={0}
                  max={1000000}
                  defaultValue={currentGoal?.target}
                  placeholder="24"
                  className="w-28"
                />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Counting</span>
                <Select name="unit" defaultValue={currentGoal?.unit ?? GoalUnit.BOOKS}>
                  <SelectTrigger className="w-28" aria-label="What the goal counts">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GoalUnit.BOOKS}>Books</SelectItem>
                    <SelectItem value={GoalUnit.PAGES}>Pages</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="countRereads"
                  defaultChecked={currentGoal?.countRereads ?? true}
                  className="size-4 accent-primary"
                />
                Count re-reads
              </label>
              <Button type="submit" variant="outline" size="sm">
                {currentGoal ? "Update goal" : "Set goal"}
              </Button>
              {currentGoal && (
                <span className="pb-2 text-xs text-muted-foreground">
                  Set to 0 to remove the goal.
                </span>
              )}
            </form>
            <p className="-mt-2 text-xs text-muted-foreground">
              A pages goal adds up the page counts of the books you finish.
            </p>

            {pastGoals.length > 0 && (
              <div className="grid gap-1.5 border-t pt-3">
                {pastGoals.map((g) => {
                  const done = progressFor(g);
                  const met = done >= g.target;
                  return (
                    <div key={g.year} className="flex items-center gap-3 text-sm">
                      <span className="w-12 text-muted-foreground">{g.year}</span>
                      <span className="tabular-nums">
                        {formatNumber(done, prefs)} of {formatNumber(g.target, prefs)}
                        {g.unit === GoalUnit.PAGES && " pages"}
                      </span>
                      {met && <GoldMedal className="h-6 w-[18px]" />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!hidden.has("heatmap") && (
        <Card>
          <CardHeader>
            <CardTitle>Reading days</CardTitle>
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
              <CardTitle>Genres &amp; tags</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {topTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tag your books to see the breakdown.
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
              <CardTitle>Formats</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[...formatCounts.entries()].map(([label, count]) => (
                <Bar key={label} label={label} value={count} max={maxFormat} />
              ))}
              {formatCounts.size === 0 && (
                <p className="text-sm text-muted-foreground">No books yet.</p>
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
