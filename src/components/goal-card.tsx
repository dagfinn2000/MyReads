import Link from "next/link";
import type { GoalUnit } from "@/lib/enums";
import { MONTHS_LONG, MONTHS_SHORT, formatDayKey, formatNumber } from "@/lib/display";
import { describePace, unitWord, type GoalPace, type YearClock } from "@/lib/goals";
import { monthsMet, type MonthProgress } from "@/lib/goal-progress";
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
 * set ahead, or a past year opened from its Edit link. Under it, the
 * year's monthly goal, if any, month by month.
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
  monthly,
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
  /** Earlier years with a goal for the year, for each month, or both. */
  past: {
    year: number;
    yearly: (Omit<Goal, "countRereads"> & { done: number; met: boolean }) | null;
    monthly: (Omit<Goal, "countRereads"> & { met: number; of: number }) | null;
    editHref: string;
  }[];
  yearOptions: { year: number; href: string }[];
  /** What a pages goal counts, by the "What counts" preferences. */
  ruleLine: string;
  /** The year's goal for each month, and how each month went. */
  monthly: { goal: Goal | null; months: MonthProgress[] };
  prefs: { dateFormat: DateFormat; numberFormat: NumberFormat };
}) {
  const fmt = (n: number) => formatNumber(n, prefs);
  const amount = (n: number, unit: GoalUnit) => `${fmt(n)} ${unitWord(unit, n)}`;
  const startsOn = formatDayKey(`${year}-01-01`, prefs.dateFormat);
  const met = goal !== null && clock.when !== "future" && done >= goal.target;
  // Re-reads mean nothing to a reading-days goal.
  const leavesOutRereads = goal !== null && !goal.countRereads && goal.unit !== "DAYS";

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
              {((clock.when === "current" && !met) || leavesOutRereads) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {clock.when === "current" && !met && (
                    <>
                      {fmt(goal.target - done)} more {unitWord(goal.unit, goal.target - done)} to
                      go.
                    </>
                  )}
                  {leavesOutRereads && " Re-reads don't count toward this goal."}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set a goal for the year: finish that many books (or pages, or read on that many
            days) and earn a gold medal.
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

        <MonthlyGoal year={year} currentYear={currentYear} monthly={monthly} prefs={prefs} />

        {past.length > 0 && (
          <div className="grid gap-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Past goals</p>
            {past.map((g) => (
              <div key={g.year} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                <span className="w-12 text-muted-foreground">{g.year}</span>
                {g.yearly && (
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">
                      {amount(g.yearly.target, g.yearly.unit)} · read{" "}
                      {g.yearly.unit === "DAYS" && "on "}
                      {fmt(g.yearly.done)}
                    </span>
                    {g.yearly.met && <GoldMedal className="h-6 w-[18px]" />}
                  </span>
                )}
                {g.monthly && (
                  <span className="tabular-nums text-muted-foreground">
                    {amount(g.monthly.target, g.monthly.unit)} a month · met in{" "}
                    {fmt(g.monthly.met)} of {fmt(g.monthly.of)}
                  </span>
                )}
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

/** The monthly goal: a cell for each month, how this month is going, and
 *  the form that sets it. */
function MonthlyGoal({
  year,
  currentYear,
  monthly,
  prefs,
}: {
  year: number;
  currentYear: number;
  monthly: { goal: Goal | null; months: MonthProgress[] };
  prefs: { dateFormat: DateFormat; numberFormat: NumberFormat };
}) {
  const fmt = (n: number) => formatNumber(n, prefs);
  const { goal, months } = monthly;
  const current = months.find((m) => m.clock.when === "current");
  const tally = monthsMet(months);

  return (
    <div className="grid gap-3 border-t pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">
          Every month
          {goal && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {fmt(goal.target)} {unitWord(goal.unit, goal.target)}
            </span>
          )}
        </p>
        {goal && tally.of > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            Met in {fmt(tally.met)} of {fmt(tally.of)} {tally.of === 1 ? "month" : "months"}
          </p>
        )}
      </div>

      {goal ? (
        <>
          <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {months.map((m) => (
              <MonthCell key={m.month} m={m} unit={goal.unit} fmt={fmt} />
            ))}
          </ol>
          {current && (
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground">
                {MONTHS_LONG[current.month - 1]}: {fmt(current.done)} of {fmt(goal.target)}{" "}
                {unitWord(goal.unit, goal.target)}.
              </span>{" "}
              {describePace(
                current.pace,
                goal.unit,
                fmt,
                formatDayKey(`${year}-${String(current.month).padStart(2, "0")}-01`, prefs.dateFormat),
              )}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          A goal for each month keeps the year going a little at a time: say 2 books, or
          reading on 20 days.
        </p>
      )}

      <GoalForm
        key={`${year}-month`}
        year={year}
        currentYear={currentYear}
        span="MONTH"
        goal={goal && { target: goal.target, unit: goal.unit, countRereads: goal.countRereads }}
      />
    </div>
  );
}

/** One month: its name, how far it got, a little bar, and amber once met. */
function MonthCell({
  m,
  unit,
  fmt,
}: {
  m: MonthProgress;
  unit: GoalUnit;
  fmt: (n: number) => string;
}) {
  const name = MONTHS_SHORT[m.month - 1];
  const future = m.clock.when === "future";
  const share = Math.min(m.done / m.target, 1);
  const label = future
    ? `${MONTHS_LONG[m.month - 1]}: still to come`
    : `${MONTHS_LONG[m.month - 1]}: ${fmt(m.done)} of ${fmt(m.target)} ${unitWord(unit, m.target)}${
        m.met ? ", goal met" : ""
      }`;
  return (
    <li
      aria-label={label}
      title={label}
      className={cn(
        "grid gap-1 rounded-md border px-1 py-1.5 text-center",
        m.met && "border-amber-400/70 bg-amber-50/60 dark:border-amber-700/70 dark:bg-amber-950/30",
        m.clock.when === "current" && "ring-2 ring-primary/40",
        future && "opacity-50",
      )}
    >
      <span className="text-[11px] leading-none text-muted-foreground">{name}</span>
      <span className="text-sm font-medium leading-none tabular-nums">
        {future ? "–" : fmt(m.done)}
      </span>
      <span aria-hidden="true" className="mx-1 h-1 rounded-full bg-muted">
        {!future && (
          <span
            className={cn("bar-grow block h-full rounded-full", m.met ? "bg-amber-500" : "bg-primary/70")}
            style={{ width: `${share * 100}%` }}
          />
        )}
      </span>
    </li>
  );
}
