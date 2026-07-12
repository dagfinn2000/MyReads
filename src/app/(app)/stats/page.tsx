import { ReadingStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FORMAT_LABELS } from "@/lib/display";
import { Stars } from "@/components/stars";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats · Bibliotek" };

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
      </div>
    </div>
  );
}
