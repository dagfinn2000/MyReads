import Link from "next/link";
import type { GoalUnit } from "@prisma/client";
import { formatDayKey, formatNumber } from "@/lib/display";
import { describePace, unitWord, type GoalPace, type YearClock } from "@/lib/goals";
import type { DateFormat, NumberFormat } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { GoalForm } from "@/components/goal-form";
import { GoalReached } from "@/components/goal-reached";
import { GoalYearSelect } from "@/components/goal-year-select";
import { GoldMedal } from "@/components/gold-medal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Goal {
  target: number;
  unit: GoalUnit;
  countRereads: boolean;
}

/**
 * The reading goal on the stats page, for one year at a time: this year
 * with a "today" tick on the bar and how the pace is going, next year to
 * set ahead, or a past year opened from its Edit link.
 */
export function GoalCard({
  year,
  currentYear,
  goal,
  done,
  pace,
  clock,
  nextYear,
  past,
  yearOptions,
  ruleLine,
  prefs,
}: {
  year: number;
  currentYear: number;
  goal: Goal | null;
  /** Progress toward `goal` (see goalProgress). */
  done: number;
  pace: GoalPace | null;
  clock: YearClock;
  /** Next year's goal, when one is set, with the link that opens it. */
  nextYear: (Goal & { href: string }) | null;
  past: (Omit<Goal, "countRereads"> & {
    year: number;
    done: number;
    met: boolean;
    editHref: string;
  })[];
  yearOptions: { year: number; href: string }[];
  /** What a pages goal counts, by the "What counts" preferences. */
  ruleLine: string;
  prefs: { dateFormat: DateFormat; numberFormat: NumberFormat };
}) {
  const fmt = (n: number) => formatNumber(n, prefs);
  const amount = (n: number, unit: GoalUnit) => `${fmt(n)} ${unitWord(unit, n)}`;
  const startsOn = formatDayKey(`${year}-01-01`, prefs.dateFormat);
  const met = goal !== null && clock.when !== "future" && done >= goal.target;

  return (
    <Card id="goal">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex items-center gap-2">
            Goal for <GoalYearSelect year={year} options={yearOptions} />
          </CardTitle>
          {clock.when === "current" && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {fmt(clock.elapsed)} of {fmt(clock.total)} days gone
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {clock.when === "future" ? (
          <p className={cn("text-sm", !goal && "text-muted-foreground")}>
            {goal
              ? `${amount(goal.target, goal.unit)} · starts counting on ${startsOn}.`
              : `No goal for ${year} yet. It starts counting on ${startsOn}.`}
          </p>
        ) : goal && pace ? (
          <div className="flex flex-wrap items-center gap-6">
            {met &&
              (clock.when === "current" ? (
                <GoalReached year={year}>
                  <GoldMedal animate className="h-20 w-[60px] shrink-0" />
                </GoalReached>
              ) : (
                <GoldMedal className="h-20 w-[60px] shrink-0" />
              ))}
            <div className="min-w-56 flex-1">
              <p className="text-2xl font-semibold tabular-nums">
                {fmt(done)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  of {fmt(goal.target)} {unitWord(goal.unit, goal.target)}
                </span>
              </p>
              <GoalBar
                done={done}
                goal={goal}
                met={met}
                today={clock.when === "current" ? clock.fraction : null}
                fmt={fmt}
              />
              <p
                className={cn(
                  "mt-2 text-sm",
                  pace.kind === "reached" || pace.kind === "ahead"
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {describePace(pace, goal.unit, fmt, startsOn)}
              </p>
              {((clock.when === "current" && !met) || !goal.countRereads) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {clock.when === "current" && !met && (
                    <>
                      {fmt(goal.target - done)} more {unitWord(goal.unit, goal.target - done)} to
                      go.
                    </>
                  )}
                  {!goal.countRereads && " Re-reads don't count toward this goal."}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set a goal for the year: finish that many books (or pages) and earn a gold medal.
          </p>
        )}

        {year === currentYear && nextYear && (
          <p className="text-sm text-muted-foreground">
            Next year: {amount(nextYear.target, nextYear.unit)} ·{" "}
            <Link
              href={nextYear.href}
              scroll={false}
              aria-label={`Edit the ${currentYear + 1} goal`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Edit
            </Link>
          </p>
        )}

        <GoalForm
          key={year}
          year={year}
          currentYear={currentYear}
          goal={
            goal && { target: goal.target, unit: goal.unit, countRereads: goal.countRereads }
          }
        />
        <p className="-mt-2 text-xs text-muted-foreground">
          {ruleLine}{" "}
          <Link
            href="/account#what-counts"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Change what counts
          </Link>
        </p>

        {past.length > 0 && (
          <div className="grid gap-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Past goals</p>
            {past.map((g) => (
              <div key={g.year} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-muted-foreground">{g.year}</span>
                <span className="tabular-nums">
                  {amount(g.target, g.unit)} · read {fmt(g.done)}
                </span>
                {g.met && <GoldMedal className="h-6 w-[18px]" />}
                <Link
                  href={g.editHref}
                  aria-label={`Edit the ${g.year} goal`}
                  className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Progress bar with a tick for today's place in the year (this year only). */
function GoalBar({
  done,
  goal,
  met,
  today,
  fmt,
}: {
  done: number;
  goal: Goal;
  met: boolean;
  /** How far through the year today is, 0–1; null for a past year. */
  today: number | null;
  fmt: (n: number) => string;
}) {
  const share = done / goal.target;
  const label =
    `${fmt(done)} of ${fmt(goal.target)} ${unitWord(goal.unit, goal.target)}, ` +
    `${Math.round(share * 100)}% of the goal.` +
    (today === null ? "" : ` Today is ${Math.round(today * 100)}% of the way through the year.`);
  // Keep the "today" label inside the card near either end of the year.
  const shift = today === null ? "" : today < 0.06 ? "0" : today > 0.94 ? "-100%" : "-50%";

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative h-3 rounded-full bg-muted", today === null ? "mt-2" : "mt-5")}
    >
      <div
        className={`bar-grow h-full rounded-full ${met ? "bg-amber-500" : "bg-primary/80"}`}
        style={{ width: `${Math.min(share * 100, 100)}%` }}
      />
      {today !== null && (
        <>
          <span
            aria-hidden="true"
            className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${today * 100}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute -top-5 text-[10px] leading-none text-muted-foreground"
            style={{ left: `${today * 100}%`, transform: `translateX(${shift})` }}
          >
            today
          </span>
        </>
      )}
    </div>
  );
}
