import { ReadingStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HardDriveDownload } from "lucide-react";
import { setReadingGoal } from "@/lib/actions/goals";
import { FORMAT_LABELS } from "@/lib/display";
import { GoldMedal } from "@/components/gold-medal";
import { RestoreBackup } from "@/components/restore-backup";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats · MyReads" };

/** Simple horizontal CSS bar — no chart library needed at this scale. */
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-5 rounded bg-muted">
        <div
          className="h-full rounded bg-primary/80"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{children}</div>
      </CardContent>
    </Card>
  );
}

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const books = await prisma.book.findMany({
    where: { userId: session.user.id },
    select: {
      status: true,
      rating: true,
      pageCount: true,
      dateFinished: true,
      tags: true,
      format: true,
    },
  });

  const read = books.filter((b) => b.status === ReadingStatus.READ);
  const reading = books.filter((b) => b.status === ReadingStatus.READING);

  // Pages read: sum over finished books that have a page count.
  const pagesRead = read.reduce((sum, b) => sum + (b.pageCount ?? 0), 0);

  // Average rating across every rated book (any status), in stars.
  const rated = books.filter((b) => b.rating != null);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, b) => sum + b.rating!, 0) / rated.length / 2
      : null;

  // Books finished per year.
  const perYear = new Map<number, number>();
  for (const b of read) {
    if (!b.dateFinished) continue;
    const y = b.dateFinished.getFullYear();
    perYear.set(y, (perYear.get(y) ?? 0) + 1);
  }
  const years = [...perYear.entries()].sort((a, b) => a[0] - b[0]);
  const maxYear = Math.max(...perYear.values(), 0);

  // Reading goals: progress is derived from the per-year finished counts.
  const goals = await prisma.readingGoal.findMany({
    where: { userId: session.user.id },
    orderBy: { year: "desc" },
  });
  const currentYear = new Date().getFullYear();
  const currentGoal = goals.find((g) => g.year === currentYear) ?? null;
  const finishedThisYear = perYear.get(currentYear) ?? 0;
  const goalMet = currentGoal !== null && finishedThisYear >= currentGoal.target;
  const pastGoals = goals.filter((g) => g.year !== currentYear);

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Books in library">{books.length}</StatCard>
        <StatCard label="Books read">{read.length}</StatCard>
        <StatCard label="Currently reading">{reading.length}</StatCard>
        <StatCard label="Pages read">{pagesRead.toLocaleString("en")}</StatCard>
        <StatCard label="Average rating">
          {avgRating != null ? (
            <span className="flex items-center gap-2">
              {avgRating.toFixed(1)}
              <Stars value={Math.round(avgRating * 2)} />
            </span>
          ) : (
            "–"
          )}
        </StatCard>
      </div>

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
                  {finishedThisYear}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    of {currentGoal.target} books
                  </span>
                </p>
                <div className="mt-2 h-3 rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${goalMet ? "bg-amber-500" : "bg-primary/80"}`}
                    style={{
                      width: `${Math.min((finishedThisYear / currentGoal.target) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {goalMet
                    ? "Goal achieved — you've earned the gold medal! 🎉"
                    : `${currentGoal.target - finishedThisYear} more to go.`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Set a goal for the year — finish that many books and earn a gold
              medal.
            </p>
          )}

          <form action={setReadingGoal} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="year" value={currentYear} />
            <div className="grid gap-1">
              <label
                htmlFor="goal-target"
                className="text-xs text-muted-foreground"
              >
                Books to read in {currentYear}
              </label>
              <Input
                id="goal-target"
                name="target"
                type="number"
                min={0}
                max={10000}
                defaultValue={currentGoal?.target}
                placeholder="24"
                className="w-28"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              {currentGoal ? "Update goal" : "Set goal"}
            </Button>
            {currentGoal && (
              <span className="pb-2 text-xs text-muted-foreground">
                Set to 0 to remove the goal.
              </span>
            )}
          </form>

          {pastGoals.length > 0 && (
            <div className="grid gap-1.5 border-t pt-3">
              {pastGoals.map((g) => {
                const finished = perYear.get(g.year) ?? 0;
                const met = finished >= g.target;
                return (
                  <div key={g.year} className="flex items-center gap-3 text-sm">
                    <span className="w-12 text-muted-foreground">{g.year}</span>
                    <span className="tabular-nums">
                      {finished} of {g.target}
                    </span>
                    {met && <GoldMedal className="h-6 w-[18px]" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
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
              years.map(([year, count]) => (
                <Bar key={year} label={String(year)} value={count} max={maxYear} />
              ))
            )}
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Backup</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Download your library (books, quotes, shelves, goals — cover
              images included) as a zip, or restore a backup (zip, or JSON
              from older versions). Restoring merges: books you already have
              are skipped.
            </p>
            <div className="flex flex-wrap items-start gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/api/export">
                  <HardDriveDownload data-slot="icon" />
                  Download backup
                </a>
              </Button>
              <RestoreBackup />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
