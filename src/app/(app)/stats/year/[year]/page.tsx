import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GoalUnit } from "@prisma/client";
import {
  ArrowLeft,
  BookCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Repeat,
  Star,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPreferences } from "@/lib/current-user";
import { dayKey } from "@/lib/dates";
import { formatDate, formatDayKey, formatNumber } from "@/lib/display";
import { describePace, goalPace, goalProgress, yearClock } from "@/lib/goals";
import { readingStreaks } from "@/lib/progress";
import { dailyPageTotalsForUser } from "@/lib/progress-query";
import { buildPasses, countWindow, ruleNotes, tally } from "@/lib/stats-count";
import { yearWindow } from "@/lib/stats-period";
import { loadStatsInputs, type StatsBook } from "@/lib/stats-query";
import { BookCover } from "@/components/book-card";
import { GoldMedal } from "@/components/gold-medal";
import { Bar, StatCard } from "@/components/stat-blocks";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseYear(raw: string): number | null {
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  return year;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  // Same check as the page, so /stats/year/abc isn't titled "abc in books".
  const parsed = parseYear(year);
  return { title: parsed === null ? "Not found · MyReads" : `${parsed} in books · MyReads` };
}

/** One finished pass through a book, in the review year. */
interface Finish {
  book: StatsBook;
  dateStarted: Date | null;
  dateFinished: Date;
  rating: number | null;
  isReread: boolean;
}

/**
 * The year's wrap-up: everything finished that year — current passes on READ
 * books plus archived re-reads — turned into highlights, distributions, and
 * a top-rated shelf. Linked from the per-year bars on the stats page. What
 * counts follows the reader's "What counts" preferences, as on Stats.
 */
export default async function YearInReviewPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;

  const { year: rawYear } = await params;
  const year = parseYear(rawYear);
  if (year === null) notFound();
  const prefs = await getPreferences();
  const ratings = prefs.ratingStyle !== "off";
  const fmt = (n: number) => formatNumber(n, prefs);

  // Fetch everything and slice by year in JS, with the same counting the
  // stats page uses (lib/stats-count.ts), so the numbers always agree.
  const [inputs, goal, pageTotals] = await Promise.all([
    loadStatsInputs(userId, prefs.timeZone),
    prisma.readingGoal.findUnique({
      where: { userId_year: { userId, year } },
    }),
    // Pages per day, as the reading calendar counts them. No date bound:
    // deltas need each entry's predecessor, so the year slice comes after.
    dailyPageTotalsForUser(userId, prefs.timeZone),
  ]);

  // Every pass that counts in this year: dated finishes (re-reads tagged,
  // see markRereads), plus books put down and pages logged when the "What
  // counts" preferences say so.
  const passes = buildPasses(inputs, prefs, prefs.timeZone);
  const counted = countWindow(passes, yearWindow(year), prefs);
  const totals = tally(counted);
  const notes = ruleNotes(prefs, { putDown: totals.putDown }, fmt);
  /** Passes that add a book this year: finishes, and books put down when
   *  they count as books. */
  const bookItems = counted.filter((i) => i.books > 0);

  const finishes: Finish[] = bookItems
    .filter((i) => i.pass.kind === "finished")
    .map((i) => ({
      book: i.pass.book,
      dateStarted: i.pass.dateStarted,
      dateFinished: i.pass.date!,
      rating: i.pass.rating,
      isReread: i.isReread,
    }));
  finishes.sort((a, b) => a.dateFinished.getTime() - b.dateFinished.getTime());

  // Books put down this year, dated by their finish date or last log entry.
  const putDown =
    prefs.statsStoppedBooks === "none"
      ? []
      : counted
          .filter((i) => i.pass.kind === "stopped" && i.pass.day?.startsWith(`${year}-`))
          .sort((a, b) => (a.pass.day! < b.pass.day! ? -1 : a.pass.day! > b.pass.day! ? 1 : 0));

  // The reading-log rhythm for this year. Day keys are "YYYY-MM-DD", so
  // slicing by prefix matches the same local-time bucketing the heatmap uses.
  const yearDays = [...pageTotals]
    .filter(([key]) => key.startsWith(`${year}-`))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  // The goal, with the pace while the year is under way.
  const goalDone = goal ? goalProgress(counted, goal) : 0;
  const clock = yearClock(dayKey(new Date(), prefs.timeZone), year);
  const pace = goal ? goalPace(goalDone, goal.target, goal.unit, clock) : null;
  const goalMet = pace?.kind === "reached";
  const goalLine = goal && pace && (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 pt-0">
        {goalMet && <GoldMedal animate className="h-14 w-[42px] shrink-0" />}
        <p className="text-sm">
          <span className="font-semibold tabular-nums">
            {fmt(goalDone)} of {fmt(goal.target)}
          </span>{" "}
          {goal.unit === GoalUnit.PAGES ? "pages" : "books"} toward the {year} goal
          {!goal.countRereads && " (first reads only)"}.{" "}
          {describePace(pace, goal.unit, fmt, formatDayKey(`${year}-01-01`, prefs.dateFormat))}
          {goalMet && " 🎉"}
        </p>
      </CardContent>
    </Card>
  );

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild variant="ghost" size="sm">
        <Link href="/stats">
          <ArrowLeft data-slot="icon" />
          Stats
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">
        {year} in books
      </h1>
      <span className="ml-auto flex items-center gap-1">
        <Button asChild variant="ghost" size="icon-sm" title={`${year - 1} in books`}>
          <Link href={`/stats/year/${year - 1}`}>
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon-sm" title={`${year + 1} in books`}>
          <Link href={`/stats/year/${year + 1}`}>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </span>
    </div>
  );

  if (counted.length === 0 && yearDays.length === 0) {
    return (
      <div className="grid gap-6">
        {header}
        <p className="text-sm text-muted-foreground">
          Nothing finished in {year}. No dated reads landed in this year.
        </p>
        {goalLine}
      </div>
    );
  }

  // Headline numbers.
  const rated = finishes.filter((f) => f.rating != null);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, f) => sum + f.rating!, 0) / rated.length / 2
      : null;

  // Highlights.
  const paged = finishes.filter((f) => f.book.pageCount != null);
  const longest = paged.length
    ? paged.reduce((a, b) => (b.book.pageCount! > a.book.pageCount! ? b : a))
    : null;
  const shortest = paged.length
    ? paged.reduce((a, b) => (b.book.pageCount! < a.book.pageCount! ? b : a))
    : null;
  const timed = finishes
    .map((f) => ({
      finish: f,
      days:
        f.dateStarted && f.dateStarted <= f.dateFinished
          ? Math.max(
              1,
              Math.round(
                (f.dateFinished.getTime() - f.dateStarted.getTime()) / 86_400_000,
              ),
            )
          : null,
    }))
    .filter((t): t is { finish: Finish; days: number } => t.days !== null);
  const fastest = timed.length
    ? timed.reduce((a, b) => (b.days < a.days ? b : a))
    : null;
  const first = finishes[0] ?? null;
  const last = finishes[finishes.length - 1] ?? null;

  // Top rated: best pass per book, once per book, top 6.
  const bestByBook = new Map<string, Finish>();
  for (const f of rated) {
    const prev = bestByBook.get(f.book.id);
    if (!prev || f.rating! > prev.rating!) bestByBook.set(f.book.id, f);
  }
  const topRated = [...bestByBook.values()]
    .sort((a, b) => b.rating! - a.rating!)
    .slice(0, 6);

  // Distributions.
  const perMonth = Array.from({ length: 12 }, () => 0);
  for (const i of bookItems) perMonth[Number(i.pass.day!.slice(5, 7)) - 1] += i.books;
  const maxMonth = Math.max(...perMonth);

  const ratingCounts = new Map<number, number>();
  for (const f of rated) {
    ratingCounts.set(f.rating!, (ratingCounts.get(f.rating!) ?? 0) + 1);
  }
  const ratingRows = [...ratingCounts.entries()].sort((a, b) => b[0] - a[0]);
  const maxRatingCount = ratingRows[0]
    ? Math.max(...ratingRows.map(([, c]) => c))
    : 0;

  const tagCounts = new Map<string, number>();
  for (const i of bookItems) {
    for (const t of i.pass.book.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxTag = topTags[0]?.[1] ?? 0;

  // Reading-log rhythm for this year: pages per day/month, biggest day, and
  // the longest streak.
  const readingDays = yearDays.length;
  const pagesLogged = yearDays.reduce((sum, [, pages]) => sum + pages, 0);
  const pagesPerMonth = Array.from({ length: 12 }, () => 0);
  for (const [key, pages] of yearDays) {
    pagesPerMonth[Number(key.slice(5, 7)) - 1] += pages;
  }
  const maxPagesMonth = Math.max(...pagesPerMonth);
  const biggestDay = yearDays.reduce<[string, number] | null>(
    (best, day) => (best === null || day[1] > best[1] ? day : best),
    null,
  );
  const { longest: longestStreak } = readingStreaks(
    new Set(yearDays.map(([key]) => key)),
    new Date(),
    prefs.timeZone,
  );
  const biggestDayDate = biggestDay
    ? formatDate(new Date(`${biggestDay[0]}T00:00:00Z`), prefs)
    : null;

  return (
    <div className="grid gap-6">
      {header}

      <div className={`grid grid-cols-2 gap-4 max-lg:[&>:last-child:nth-child(odd)]:col-span-2 ${ratings ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <StatCard
          label={prefs.statsStoppedBooks === "book" ? "Books read" : "Books finished"}
          icon={BookCheck}
          note={notes.books.join(" · ")}
        >
          {fmt(totals.books)}
        </StatCard>
        <StatCard
          label={`Pages read${notes.pagesSuffix}`}
          icon={FileText}
          note={notes.pages.join(" · ")}
        >
          {fmt(totals.pages)}
        </StatCard>
        <StatCard label="Re-reads" icon={Repeat}>{fmt(totals.rereads)}</StatCard>
        {ratings && (
          <StatCard label="Average rating" icon={Star}>
            {avgRating == null ? (
              "–"
            ) : prefs.ratingStyle === "ten" ? (
              `${(avgRating * 2).toFixed(1)}/10`
            ) : (
              <span className="flex items-center gap-2">
                {avgRating.toFixed(1)}
                <Stars value={Math.round(avgRating * 2)} />
              </span>
            )}
          </StatCard>
        )}
      </div>

      {goalLine}

      {ratings && topRated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Best of {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {topRated.map((f) => (
                <Link
                  key={f.book.id}
                  href={`/books/${f.book.id}`}
                  className="group w-24"
                  title={f.book.title}
                >
                  <BookCover book={f.book} className="aspect-[2/3] w-24" />
                  <Stars value={f.rating!} className="mt-1.5" />
                  <p className="mt-1 line-clamp-2 text-xs leading-tight text-muted-foreground group-hover:text-foreground">
                    {f.book.title}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(first || putDown.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {longest && (
              <Highlight label="Longest book">
                <BookLink book={longest.book} /> · {longest.book.pageCount} pages
              </Highlight>
            )}
            {shortest && shortest.book.id !== longest?.book.id && (
              <Highlight label="Shortest book">
                <BookLink book={shortest.book} /> · {shortest.book.pageCount} pages
              </Highlight>
            )}
            {fastest && (
              <Highlight label="Fastest read">
                <BookLink book={fastest.finish.book} /> · {fastest.days}{" "}
                {fastest.days === 1 ? "day" : "days"}
              </Highlight>
            )}
            {first && (
              <Highlight label="First finish">
                <BookLink book={first.book} /> · {formatDate(first.dateFinished, prefs)}
              </Highlight>
            )}
            {first && last && last.book.id !== first.book.id && (
              <Highlight label="Last finish">
                <BookLink book={last.book} /> · {formatDate(last.dateFinished, prefs)}
              </Highlight>
            )}
            {putDown.length > 0 && (
              <Highlight label="Put down">
                {putDown.slice(0, 5).map((i, n) => (
                  <span key={i.pass.book.id}>
                    {n > 0 && ", "}
                    <BookLink book={i.pass.book} />
                    {i.pass.book.currentPage != null && ` (p. ${i.pass.book.currentPage})`}
                  </span>
                ))}
                {putDown.length > 5 && ` and ${fmt(putDown.length - 5)} more`}
              </Highlight>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>By month</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {perMonth.map((count, i) => (
                <Bar key={MONTHS[i]} label={MONTHS[i]} value={count} max={maxMonth} />
              ))}
            </CardContent>
          </Card>

          {readingDays > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reading days</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2 text-sm">
                  <Highlight label="Days reading">
                    <span className="tabular-nums">{readingDays}</span> ·{" "}
                    {formatNumber(pagesLogged, prefs)} pages logged
                  </Highlight>
                  {biggestDay && (
                    <Highlight label="Biggest day">
                      <span className="tabular-nums">{biggestDay[1]}</span> pages
                      · {biggestDayDate}
                    </Highlight>
                  )}
                  {longestStreak > 1 && (
                    <Highlight label="Longest streak">
                      <span className="tabular-nums">{longestStreak}</span> days
                      in a row
                    </Highlight>
                  )}
                </div>
                <div className="grid gap-2">
                  <p className="text-xs text-muted-foreground">Pages per month</p>
                  {pagesPerMonth.map((pages, i) => (
                    <Bar
                      key={MONTHS[i]}
                      label={MONTHS[i]}
                      value={pages}
                      max={maxPagesMonth}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          {ratings && ratingRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ratings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {ratingRows.map(([value, count]) => (
                  <Bar
                    key={value}
                    label={prefs.ratingStyle === "ten" ? `${value}/10` : `${value / 2} ★`}
                    value={count}
                    max={maxRatingCount}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {topTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Genres &amp; tags</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {topTags.map(([tag, count]) => (
                  <Bar key={tag} label={tag} value={count} max={maxTag} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Highlight({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-baseline gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function BookLink({ book }: { book: Pick<StatsBook, "id" | "title"> }) {
  return (
    <Link
      href={`/books/${book.id}`}
      className="font-medium hover:underline"
    >
      {book.title}
    </Link>
  );
}
