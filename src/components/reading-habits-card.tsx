import type { ReadingHabits } from "@/lib/reading-habits";
import { Duration } from "@/components/stat-blocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Reading habits on Stats: pages by day of the week as bars, with the
 * figures beside them (lib/reading-habits.ts). The timer's two only show
 * once something has been timed in the period.
 */
export function ReadingHabitsCard({
  habits: h,
  words,
  fmt,
  emptyText,
}: {
  habits: ReadingHabits;
  /** "this year", "all time". */
  words: string;
  fmt: (n: number) => string;
  emptyText: string;
}) {
  const max = Math.max(...h.weekdays.map((w) => w.pages), 0);
  const empty = h.readingDays === 0 && !h.bookDays && !h.sitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Reading habits <span className="font-normal text-muted-foreground">· {words}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
            <div className="grid content-start gap-3">
              <p className="text-sm text-muted-foreground">
                {h.topWeekday ? (
                  <>
                    You read most on <span className="font-medium text-foreground">{h.topWeekday.plural}</span>.
                  </>
                ) : h.readingDays > 0 ? (
                  "Pages by day of the week."
                ) : (
                  "Log pages as you read to see which days you read on."
                )}
              </p>
              <ul className="flex h-32 items-end gap-1.5 sm:gap-2.5">
                {h.weekdays.map((w, i) => {
                  const top = w === h.topWeekday;
                  const pct = max > 0 && w.pages > 0 ? Math.max((w.pages / max) * 100, 3) : 0;
                  return (
                    <li key={w.short} className="grid h-full min-w-0 flex-1 grid-rows-[1fr_auto] gap-1.5">
                      <span className="flex items-end" title={`${w.plural}: ${fmt(w.pages)} pages on ${fmt(w.days)} ${w.days === 1 ? "day" : "days"}`}>
                        <span
                          className={`bar-rise block w-full rounded-t-md ${
                            top ? "bg-linear-to-t from-primary/80 to-primary" : "bg-primary/35"
                          }`}
                          style={{ height: `${pct}%`, animationDelay: `${i * 45}ms` }}
                        />
                      </span>
                      <span
                        className={`text-center text-xs ${top ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        <span aria-hidden="true">{w.short}</span>
                        <span className="sr-only">
                          {w.plural}: {fmt(w.pages)} pages
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-5">
              {h.pagesPerReadingDay !== null && (
                <Fact
                  label="Pages on a reading day"
                  note={`${fmt(h.readingDays)} reading ${h.readingDays === 1 ? "day" : "days"}`}
                >
                  {fmt(Math.round(h.pagesPerReadingDay))}
                </Fact>
              )}
              {h.bookDays && (
                <Fact
                  label="A book takes you"
                  note={`from start to finish (${fmt(h.bookDays.books)} ${h.bookDays.books === 1 ? "book" : "books"})`}
                >
                  {fmt(Math.round(h.bookDays.median))}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    {Math.round(h.bookDays.median) === 1 ? "day" : "days"}
                  </span>
                </Fact>
              )}
              {h.sitting && (
                <Fact
                  label="An average sitting"
                  note={`${fmt(h.sitting.sittings)} timed ${h.sitting.sittings === 1 ? "sitting" : "sittings"}`}
                >
                  <Duration minutes={Math.max(Math.round(h.sitting.minutes), 1)} />
                </Fact>
              )}
              {h.pagesPerHour !== null && (
                <Fact label="Pages an hour" note="with the timer">
                  {fmt(Math.round(h.pagesPerHour))}
                </Fact>
              )}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl font-semibold tabular-nums">{children}</dd>
      <dd className="text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}
