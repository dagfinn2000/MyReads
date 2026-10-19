import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReadingStatus } from "@/lib/enums";
import { BookOpenText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPreferences, getSession } from "@/lib/current-user";
import { dailyGoalLines, dailyGoalStatus, dailyGoalTarget } from "@/lib/daily-goal";
import { dayKey } from "@/lib/dates";
import { formatWeekdayDay } from "@/lib/display";
import { onThisDay } from "@/lib/on-this-day";
import { onThisDayCandidates } from "@/lib/on-this-day-query";
import {
  bookDayPageTotalsForUser,
  dayMinuteTotals,
  dayPageTotals,
  minutesByDayForUser,
} from "@/lib/stats-query";
import { upNext, upNextWithPicks } from "@/lib/up-next";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { DailyGoalRing } from "@/components/daily-goal-ring";
import { NowReading } from "@/components/now-reading";
import { OnThisDayCard } from "@/components/on-this-day-card";
import { UpNextEditor } from "@/components/up-next-editor";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Now reading · MyReads" };

const UP_NEXT = 10;

/**
 * Every book being read on one page, each with the quick-log row, so
 * telling the app where you are doesn't mean opening each book. Under them,
 * what happened on this day in earlier years, and the Want to Read books
 * that are up next: the reader's own picks, then suggestions
 * (lib/up-next.ts).
 */
export default async function NowReadingPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;
  const prefs = await getPreferences();
  const goal = dailyGoalTarget(prefs);
  const todayKey = dayKey(new Date(), prefs.timeZone);

  const [reading, wantToRead, seriesBooks, goalByDay, memories] = await Promise.all([
    prisma.book.findMany({
      where: { userId, status: ReadingStatus.READING },
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        status: true,
        format: true,
        pageCount: true,
        lengthMinutes: true,
        currentPage: true,
        dateStarted: true,
        // Oldest first, page breaking same-instant ties (the anchor first).
        progress: {
          orderBy: [{ date: "asc" }, { page: "asc" }],
          select: { id: true, page: true, date: true, minutes: true },
        },
      },
    }),
    prisma.book.findMany({
      where: { userId, status: ReadingStatus.WANT_TO_READ },
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        status: true,
        timesRead: true,
        seriesName: true,
        seriesNumber: true,
        upNextRank: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    // For "next in the series": every book that has a series.
    prisma.book.findMany({
      where: { userId, seriesName: { not: null } },
      select: { seriesName: true, seriesNumber: true, status: true, timesRead: true },
    }),
    // The daily goal's unit by day, across every book (one finished today
    // still counts): pages as the reading calendar counts them, or minutes
    // from the reading timer.
    goal === null
      ? null
      : goal.unit === "pages"
        ? bookDayPageTotalsForUser(userId, prefs.timeZone).then(dayPageTotals)
        : minutesByDayForUser(userId, prefs.timeZone).then((rows) => dayMinuteTotals(rows)),
    onThisDayCandidates(userId, todayKey),
  ]);
  const goalStatus = goal && goalByDay && dailyGoalStatus(goalByDay, goal, todayKey);

  // The book read most recently first: its newest log entry, or when it
  // was started.
  const lastTouched = (b: (typeof reading)[number]) =>
    (b.progress[b.progress.length - 1]?.date ?? b.dateStarted)?.getTime() ?? 0;
  reading.sort((a, b) => lastTouched(b) - lastTouched(a) || a.title.localeCompare(b.title));

  const { picks, suggested } = upNextWithPicks(wantToRead, seriesBooks, UP_NEXT);
  const next = [...picks, ...suggested];
  // What the list editor offers to add: the suggestions first, then the
  // rest of Want to Read, newest first.
  const unpicked = wantToRead.filter((b) => b.upNextRank === null);
  const suggestedFirst = upNext(unpicked, seriesBooks, unpicked.length);
  const others = [...suggestedFirst, ...unpicked.filter((b) => !suggestedFirst.includes(b))];
  const editorItem = ({ id, title, authors, coverUrl }: (typeof wantToRead)[number]) => ({
    id,
    title,
    authors,
    coverUrl,
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Now reading</h1>
        <span className="text-sm text-muted-foreground">{formatWeekdayDay(new Date(), prefs)}</span>
      </div>

      {goal && goalStatus && (
        <DailyGoalRing
          target={goal}
          today={goalStatus.today}
          met={goalStatus.met}
          {...dailyGoalLines(goalStatus, goal)}
        />
      )}

      <NowReading
        books={reading}
        empty={
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
            <BookOpenText className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">You&apos;re not reading anything right now.</p>
            {next.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Pick one from Up next below and set it to Currently Reading on its page.
              </p>
            ) : (
              <Button asChild size="sm">
                <Link href="/books/new">Add a book</Link>
              </Button>
            )}
          </div>
        }
      />

      <OnThisDayCard {...onThisDay(memories.events, memories.quotes, todayKey, prefs.timeZone)} />

      {next.length > 0 && (
        <section className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-sm font-medium text-muted-foreground">Up next</h2>
            <span className="flex flex-wrap items-baseline gap-x-4">
              <UpNextEditor picks={picks.map(editorItem)} others={others.map(editorItem)} />
              <Link
                href="/books?shelf=WANT_TO_READ"
                className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                All Want to Read
              </Link>
            </span>
          </div>
          {/* Scrolls inside its own box on a phone, never the page. */}
          <ul className="relative flex gap-3 overflow-x-auto pb-1">
            {next.map((b, i) => (
              <Fragment key={b.id}>
                {/* The reader's picks, then the suggestions. */}
                {i === picks.length && i > 0 && (
                  <li aria-hidden="true" className="my-3 w-px shrink-0 self-stretch bg-border" />
                )}
                <li className="shrink-0">
                  <BookLink bookId={b.id} className="lift-cover block w-16 sm:w-20" title={b.title}>
                    <span className="relative block">
                      <BookCover book={b} className="cover-shadow aspect-[2/3] w-full" />
                      {i < picks.length && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums shadow-sm ring-2 ring-background/70"
                        >
                          {i + 1}
                        </span>
                      )}
                    </span>
                    {/* A cover this small has no room for its own title. */}
                    <span aria-hidden="true" className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                      {b.title}
                    </span>
                    {/* A cover image is named by its alt text; a drawn one isn't. */}
                    {!b.coverUrl && <span className="sr-only">{b.title}</span>}
                    {i < picks.length && <span className="sr-only">, number {i + 1} on your list</span>}
                  </BookLink>
                </li>
              </Fragment>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
