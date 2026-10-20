import Link from "next/link";
import { formatNumber } from "@/lib/display";
import type { ChallengeSource } from "@/lib/challenges";
import type { DateFormat, NumberFormat } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { ChallengeActions, ChallengeForm } from "@/components/challenge-form";
import { GoldMedal } from "@/components/gold-medal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** A challenge as the card draws it, with its progress worked out. */
export interface ChallengeView {
  id: string;
  name: string;
  year: number;
  target: number;
  done: number;
  met: boolean;
  /** How the pace is going, as a sentence. */
  paceText: string;
  /** The challenge's books in the library. */
  href: string;
  /** The books that count, first finished first. */
  books: { id: string; title: string; coverUrl: string | null; authors: string[] }[];
}

/** Covers shown under a challenge before "and N more". */
const COVERS = 10;

/**
 * Challenges on the Stats page: goals for a slice of the library, such as
 * "6 classics in 2026", each with its bar and the covers of the books that
 * count so far. This year's and next year's are shown in full, earlier ones
 * as a list.
 */
export function ChallengesCard({
  challenges,
  currentYear,
  sources,
  prefs,
}: {
  challenges: ChallengeView[];
  currentYear: number;
  sources: { group: string; sources: ChallengeSource[] }[];
  prefs: { dateFormat: DateFormat; numberFormat: NumberFormat };
}) {
  const fmt = (n: number) => formatNumber(n, prefs);
  const active = challenges.filter((c) => c.year >= currentYear);
  const past = challenges.filter((c) => c.year < currentYear);

  return (
    <Card id="challenges">
      <CardHeader>
        <CardTitle>Challenges</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground">
            A goal for part of your library: read 6 books tagged classics this year, say, or
            finish the shelf by your bed.
          </p>
        )}
        {active.map((c) => (
          <div key={c.id} className="grid gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {c.met && <GoldMedal className="h-8 w-6 shrink-0" />}
              <p className="font-medium">
                {c.name}
                {c.year !== currentYear && (
                  <span className="font-normal text-muted-foreground"> · {c.year}</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {fmt(c.done)} of {fmt(c.target)} {c.target === 1 ? "book" : "books"}
              </p>
              <ChallengeActions id={c.id} name={c.name} target={c.target} />
            </div>
            <div
              role="img"
              aria-label={`${fmt(c.done)} of ${fmt(c.target)} books`}
              className="h-2.5 rounded-full bg-muted"
            >
              <div
                className={cn(
                  "bar-grow h-full rounded-full",
                  c.met ? "bg-amber-500" : "bg-primary/80",
                )}
                style={{ width: `${Math.min(c.done / c.target, 1) * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {c.paceText}{" "}
              <Link href={c.href} className="underline underline-offset-2 hover:text-foreground">
                See the books
              </Link>
            </p>
            {c.books.length > 0 && (
              <ul className="flex flex-wrap items-end gap-1.5">
                {c.books.slice(0, COVERS).map((b) => (
                  <li key={b.id}>
                    <BookLink bookId={b.id} className="lift-cover block" title={b.title}>
                      <BookCover book={b} className="cover-shadow aspect-[2/3] w-10" />
                    </BookLink>
                  </li>
                ))}
                {c.books.length > COVERS && (
                  <li className="pb-1 text-xs text-muted-foreground">
                    and {fmt(c.books.length - COVERS)} more
                  </li>
                )}
              </ul>
            )}
          </div>
        ))}

        <ChallengeForm sources={sources} currentYear={currentYear} />

        {past.length > 0 && (
          <div className="grid gap-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Past challenges</p>
            {past.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-muted-foreground">{c.year}</span>
                <Link href={c.href} className="min-w-0 truncate hover:underline">
                  {c.name}
                </Link>
                <span className="tabular-nums text-muted-foreground">
                  {fmt(c.done)} of {fmt(c.target)}
                </span>
                {c.met && <GoldMedal className="h-6 w-[18px]" />}
                <span className="ml-auto">
                  <ChallengeActions id={c.id} name={c.name} target={c.target} />
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
