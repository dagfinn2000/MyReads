import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPreferences, getSession } from "@/lib/current-user";
import { formatNumber } from "@/lib/display";
import { titleSortKey } from "@/lib/library-sort";
import {
  SERIES_SHOW,
  SERIES_SHOW_LABELS,
  buildSeriesList,
  parseSeriesShow,
  showSeries,
} from "@/lib/series-list";
import { cn } from "@/lib/utils";
import { SeriesCard } from "@/components/series-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Series · MyReads" };

/**
 * Every series in the library on one page: how far through each one you
 * are, the numbers you have no book for, and what to read next. Series
 * under way come first, the one read most recently at the top.
 */
export default async function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;
  const [sp, prefs] = await Promise.all([searchParams, getPreferences()]);
  const show = parseSeriesShow(sp.show);

  const books = await prisma.book.findMany({
    where: { userId, seriesName: { not: null } },
    select: {
      id: true,
      title: true,
      authors: true,
      coverUrl: true,
      seriesName: true,
      seriesNumber: true,
      status: true,
      timesRead: true,
      dateFinished: true,
      updatedAt: true,
    },
  });
  const all = buildSeriesList(books);
  // Names in the library's own order: its alphabet, articles skipped or not.
  const collator = new Intl.Collator(prefs.sortAlphabet);
  const sortOpts = { ignoreArticles: prefs.ignoreArticles, alphabet: prefs.sortAlphabet };
  const shown = showSeries(all, show, (a, b) =>
    collator.compare(titleSortKey(a, sortOpts), titleSortKey(b, sortOpts)),
  );
  const counts = Object.fromEntries(
    SERIES_SHOW.map((s) => [s, s === "all" ? all.length : all.filter((e) => e.state === s).length]),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Series</h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatNumber(all.length, prefs)} in your library
        </span>
      </div>

      {all.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No series yet. Give a book a series name and number on its edit page, and its series
          shows up here with what to read next.
        </p>
      ) : (
        <>
          <nav aria-label="Which series" className="flex gap-1 overflow-x-auto border-b">
            {SERIES_SHOW.map((s) => (
              <Link
                key={s}
                href={s === "all" ? "/series" : `/series?show=${s}`}
                aria-current={show === s ? "page" : undefined}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  show === s && "border-primary font-medium text-foreground",
                )}
              >
                {SERIES_SHOW_LABELS[s]}
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
                  {formatNumber(counts[s], prefs)}
                </span>
              </Link>
            ))}
          </nav>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No series here.</p>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {shown.map((s) => (
                <SeriesCard key={s.key} series={s} prefs={prefs} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
