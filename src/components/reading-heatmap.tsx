"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Flame, Sparkles, Trophy, X, type LucideIcon } from "lucide-react";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { shiftDayKey } from "@/lib/dates";
import { MONTHS_SHORT, formatLongDay, formatNumber, formatShortDay } from "@/lib/display";
import {
  heatmapLegend,
  heatmapLevel,
  heatmapThresholds,
  type HeatmapUnit,
} from "@/lib/heatmap";
import type { Preferences } from "@/lib/preferences";
import {
  calendarWeeks,
  calendarYears,
  currentRun,
  daysBetween,
  longestRun,
  monthColumns,
  runDays,
  runYear,
  runsIn,
  streakRuns,
  windowRange,
  type CalendarData,
  type CalendarWindow,
  type WindowRange,
} from "@/lib/reading-calendar";
import { cn } from "@/lib/utils";

type Prefs = Pick<Preferences, "weekStart" | "heatmapScale" | "dateFormat" | "numberFormat">;
type Streak = "current" | "longest";

/** Cell tint per intensity level (0 = no reading that day). */
const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
];

/** Day-of-week labels down the side, every other row. */
const DAY_LABELS = {
  monday: ["Mon", "", "Wed", "", "Fri", "", ""],
  sunday: ["", "Mon", "", "Wed", "", "Fri", ""],
};

/** "35 min", "1 h 5 min". */
function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** "75%", or "Under 1%" for a little that would round to nothing. */
function share(part: number, whole: number): string {
  const pct = whole > 0 ? (part / whole) * 100 : 0;
  return part > 0 && pct < 0.5 ? "Under 1%" : `${Math.round(pct)}%`;
}

/**
 * The reading calendar on Stats: one square a day, shaded by how much you
 * read, for the last twelve months or any year you read in. Above it, your
 * streaks: point at one (or tap it) and its days light up on the calendar
 * while the rest fade. Point at a day for its pages and time; click or tap
 * it, or move to it with the arrow keys, to see which books you read.
 *
 * Everything comes from the server at once (lib/reading-calendar.ts), so
 * nothing here waits on the network. Days are the reader's (their zone,
 * their first weekday), shades follow their Calendar shading preference,
 * and the calendar sweeps in from the left as it opens — a single mask
 * animation, which the app's Animations setting and reduced motion turn
 * off like any other.
 */
export function ReadingHeatmap({
  data,
  today,
  initialWindow,
  prefs,
}: {
  data: CalendarData;
  /** The reader's today ("2026-11-12"), from the server. */
  today: string;
  initialWindow: CalendarWindow;
  prefs: Prefs;
}) {
  const [shown, setShown] = useState<CalendarWindow>(initialWindow);
  const [unit, setUnit] = useState<HeatmapUnit>("pages");
  const [selected, setSelected] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Streak | null>(null);
  const [hovered, setHovered] = useState<Streak | null>(null);
  const [tip, setTip] = useState<{ key: string; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  const fmt = useCallback((n: number) => formatNumber(n, prefs), [prefs]);
  const goal = useMemo(() => new Set(data.goalDays), [data.goalDays]);
  const allRuns = useMemo(() => streakRuns(Object.keys(data.days)), [data.days]);
  const years = useMemo(() => calendarYears(Object.keys(data.days), today), [data.days, today]);

  // Everything the window and unit decide.
  const view = useMemo(() => {
    const range = windowRange(shown, today);
    const weeks = calendarWeeks(range, prefs.weekStart);
    const amount = (key: string) => {
      const d = data.days[key];
      return d ? (unit === "pages" ? d[0] : d[1]) : 0;
    };
    const keys = Object.keys(data.days)
      .filter((k) => k >= range.from && k <= range.last)
      .sort();
    const thresholds = heatmapThresholds(prefs.heatmapScale, keys.map(amount), unit);
    // Any reading at all is at least the first shade, even a day whose
    // only reading doesn't count in this unit (time with no pages moved).
    const levels = new Map(keys.map((k) => [k, Math.max(1, heatmapLevel(amount(k), thresholds))]));
    let best: { key: string; amount: number } | null = null;
    let total = 0;
    for (const k of keys) {
      const a = amount(k);
      total += a;
      if (a > 0 && (!best || a >= best.amount)) best = { key: k, amount: a };
    }
    const runs = runsIn(allRuns, range);
    const current = range.last === today ? currentRun(allRuns, today) : null;
    return {
      range,
      weeks,
      months: monthColumns(weeks, range),
      levels,
      legend: heatmapLegend(thresholds, unit),
      daysRead: keys.length,
      daysSoFar: daysBetween(range.from, range.last),
      goalMet: keys.filter((k) => goal.has(k)).length,
      total,
      best,
      longest: longestRun(runs),
      current,
    };
  }, [shown, today, prefs.weekStart, prefs.heatmapScale, data.days, unit, allRuns, goal]);

  const ever = longestRun(allRuns);
  const spot = hovered ?? pinned;
  const spotRun = spot === "current" ? view.current : spot === "longest" ? view.longest : null;
  const spotDays = useMemo(() => {
    if (!spotRun) return null;
    // A run that started before the window shows its part inside.
    const from = spotRun.from < view.range.from ? view.range.from : spotRun.from;
    return new Set(runDays({ ...spotRun, from }));
  }, [spotRun, view.range.from]);

  const describe = useCallback(
    (key: string) => {
      const [pages = 0, minutes = 0] = data.days[key] ?? [];
      const parts: string[] = [];
      if (pages > 0) parts.push(`${fmt(pages)} ${plural(pages, "page")}`);
      if (minutes > 0) parts.push(minutesText(minutes));
      if (data.days[key] && parts.length === 0) parts.push("read");
      if (goal.has(key)) parts.push("daily goal met");
      return parts;
    },
    [data.days, fmt, goal],
  );

  const pick = (w: CalendarWindow) => {
    setShown(w);
    setSelected(null);
    setFocusKey(null);
    setPinned(null);
    setTip(null);
  };

  // The tab stop: the day last moved to, the open day, or the latest day.
  const tabKey = focusKey ?? selected ?? view.range.last;

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${tabKey}"]`)?.focus();
  }, [tabKey]);

  const showTip = useCallback((cell: HTMLElement) => {
    const wrap = wrapRef.current;
    const key = cell.dataset.day;
    if (!wrap || !key) return;
    const w = wrap.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    setTip({ key, x: c.left + c.width / 2 - w.left, y: c.top - w.top });
  }, []);

  const onPointerOver = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-day]");
      if (cell) showTip(cell);
      // Over a label or a day still to come, but not in the gaps between
      // squares, where it would flicker.
      else if (e.target !== e.currentTarget) setTip(null);
    },
    [showTip],
  );

  const onFocus = useCallback(
    (e: React.FocusEvent) => {
      const cell = e.target as HTMLElement;
      if (cell.dataset.day && cell.matches(":focus-visible")) showTip(cell);
    },
    [showTip],
  );

  const onClick = useCallback((e: React.MouseEvent) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>("[data-day]")?.dataset.day;
    if (!key) return;
    setFocusKey(key);
    setSelected((s) => (s === key ? null : key));
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const key = (e.target as HTMLElement).dataset.day;
      if (!key) return;
      const { from, last } = view.range;
      let next: string | null = null;
      if (e.key === "ArrowUp") next = shiftDayKey(key, -1);
      else if (e.key === "ArrowDown") next = shiftDayKey(key, 1);
      else if (e.key === "ArrowLeft") next = shiftDayKey(key, -7);
      else if (e.key === "ArrowRight") next = shiftDayKey(key, 7);
      else if (e.key === "Home") next = from;
      else if (e.key === "End") next = last;
      else if (e.key === "Escape") {
        setSelected(null);
        setTip(null);
        return;
      } else return;
      e.preventDefault();
      if (next < from) next = from;
      if (next > last) next = last;
      if (next === key) return;
      moveFocus.current = true;
      setFocusKey(next);
      // An open day follows along.
      setSelected((s) => (s ? next : s));
    },
    [view.range],
  );

  if (Object.keys(data.days).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Update a book&apos;s current page as you read — every day you log
        progress lights up here.
      </p>
    );
  }

  const isPast = view.range.last !== today;
  const where =
    shown === "recent"
      ? "in the last 12 months"
      : isPast
        ? `in ${shown}`
        : `so far in ${shown}`;
  const amountText = (n: number) =>
    unit === "pages" ? `${fmt(n)} ${plural(n, "page")}` : minutesText(n);
  const { current, longest, best } = view;
  const day = (key: string) => formatShortDay(key, prefs.dateFormat, true);
  // Dates go without the year when it's the year shown (or this year).
  const year = shown === "recent" ? today.slice(0, 4) : String(shown);
  const shortDay = (key: string) => formatShortDay(key, prefs.dateFormat, key.slice(0, 4) !== year);
  const currentNote = !current
    ? "Read today to start one"
    : current.waiting
      ? "Read today to keep it going"
      : current.from === today
        ? "Started today"
        : `Since ${shortDay(current.from)}`;
  const longestNote = !longest
    ? "–"
    : longest.days === 1
      ? shortDay(longest.from)
      : `${shortDay(longest.from)} – ${shortDay(longest.to)}`;
  // A longer streak in another year: a way there.
  const everYear =
    ever && ever.days > (longest?.days ?? 0) && runYear(ever) !== shown ? runYear(ever) : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {(["recent", ...years] as CalendarWindow[]).map((w) => (
            <Chip key={w} pressed={w === shown} onClick={() => pick(w)}>
              {w === "recent" ? "Last 12 months" : w}
            </Chip>
          ))}
        </div>
        {data.timed && (
          <div
            role="group"
            aria-label="Shade by"
            className="inline-flex rounded-full border p-0.5 text-xs"
          >
            {(["pages", "minutes"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  unit === u
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {u === "pages" ? "Pages" : "Time"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {isPast ? (
          <Tile icon={CalendarCheck} label={unit === "pages" ? "Pages read" : "Time read"}>
            <Big
              value={unit === "pages" ? fmt(view.total) : minutesText(view.total)}
              unit={unit === "pages" ? plural(view.total, "page") : undefined}
            />
            <Note>{where}</Note>
          </Tile>
        ) : (
          <StreakTile
            streak="current"
            icon={Flame}
            label="Current streak"
            description={`Current streak: ${current ? `${fmt(current.days)} ${plural(current.days, "day")}` : "none"}`}
            disabled={!current}
            pinned={pinned}
            setPinned={setPinned}
            setHovered={setHovered}
          >
            <Big value={fmt(current?.days ?? 0)} unit={plural(current?.days ?? 0, "day")} />
            <Note>{currentNote}</Note>
          </StreakTile>
        )}

        <StreakTile
          streak="longest"
          icon={Trophy}
          label="Longest streak"
          description={`Longest streak ${where}: ${longest ? `${fmt(longest.days)} ${plural(longest.days, "day")}, ${longestNote}` : "none"}`}
          disabled={!longest}
          pinned={pinned}
          setPinned={setPinned}
          setHovered={setHovered}
          extra={
            everYear !== null && (
              <button
                type="button"
                onClick={() => {
                  pick(everYear);
                  setPinned("longest");
                }}
                className="mt-0.5 rounded-sm text-left text-xs text-muted-foreground underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Best ever {fmt(ever!.days)} days, in {everYear}
              </button>
            )
          }
        >
          <Big value={fmt(longest?.days ?? 0)} unit={plural(longest?.days ?? 0, "day")} />
          <Note>{longestNote}</Note>
        </StreakTile>

        <Tile icon={CalendarCheck} label="Days read">
          <Big value={fmt(view.daysRead)} unit={`of ${fmt(view.daysSoFar)}`} />
          <Note>{share(view.daysRead, view.daysSoFar)} of the days</Note>
        </Tile>

        <Tile
          icon={Sparkles}
          label="Best day"
          onClick={
            best
              ? () => {
                  setFocusKey(best.key);
                  setSelected(best.key);
                }
              : undefined
          }
          pressed={!!best && selected === best.key}
        >
          <Big
            value={
              !best ? "–" : unit === "pages" ? fmt(best.amount) : minutesText(best.amount)
            }
            unit={best && unit === "pages" ? plural(best.amount, "page") : undefined}
          />
          <Note>{best ? shortDay(best.key) : "Nothing logged"}</Note>
        </Tile>
      </div>

      <div ref={wrapRef} className="relative min-w-0" onPointerLeave={() => setTip(null)}>
        {/* Right to left so a narrow screen opens on the latest weeks. */}
        <div dir="rtl" className="overflow-x-auto pb-1">
          {/* As wide as the squares at their smallest, or the card. */}
          <div dir="ltr" className="w-max min-w-full">
            <CalendarGrid
              key={String(shown)}
              gridRef={gridRef}
              weeks={view.weeks}
              months={view.months}
              range={view.range}
              levels={view.levels}
              today={today}
              selected={selected}
              tabKey={tabKey}
              spotDays={spotDays}
              weekStart={prefs.weekStart}
              describe={describe}
              dateFormat={prefs.dateFormat}
              onPointerOver={onPointerOver}
              onFocus={onFocus}
              onBlur={() => setTip(null)}
              onClick={onClick}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
        {tip && (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
            style={{
              left: `clamp(4.5rem, ${tip.x}px, calc(100% - 4.5rem))`,
              top: tip.y - 6,
            }}
          >
            <p className="font-medium">{day(tip.key)}</p>
            <p className="text-muted-foreground">
              {describe(tip.key).join(" · ") || "No reading"}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1 text-[10px]">
          <span className="mr-1">Less</span>
          {LEVEL_CLASS.map((cls, i) => (
            <span
              key={cls}
              className={cn("heat-cell size-3 rounded-[min(22%,var(--radius))]", cls)}
              title={view.legend[i]}
            />
          ))}
          <span className="ml-1">More</span>
        </div>
        <p>
          {/* A past year's total is a tile of its own already. */}
          {view.total > 0 && !isPast && (
            <>
              <span className="font-medium text-foreground tabular-nums">
                {amountText(view.total)}
              </span>{" "}
              {where}
            </>
          )}
          {view.goalMet > 0 && (
            <>
              {view.total > 0 && !isPast ? " · daily goal met on " : "Daily goal met on "}
              <span className="font-medium text-foreground tabular-nums">{fmt(view.goalMet)}</span>{" "}
              {plural(view.goalMet, "day")}
            </>
          )}
        </p>
      </div>

      {selected && (
        <DayDetail
          key={selected}
          dayKey={selected}
          data={data}
          title={formatLongDay(selected, prefs.dateFormat)}
          summary={describe(selected)}
          fmt={fmt}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** The calendar itself. Kept apart, and memoised, so moving the tooltip
 *  along doesn't redraw 371 squares. */
const CalendarGrid = memo(function CalendarGrid({
  gridRef,
  weeks,
  months,
  range,
  levels,
  today,
  selected,
  tabKey,
  spotDays,
  weekStart,
  describe,
  dateFormat,
  onPointerOver,
  onFocus,
  onBlur,
  onClick,
  onKeyDown,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  weeks: string[][];
  months: (number | null)[];
  range: WindowRange;
  levels: Map<string, number>;
  today: string;
  selected: string | null;
  tabKey: string;
  spotDays: Set<string> | null;
  weekStart: Prefs["weekStart"];
  describe: (key: string) => string[];
  dateFormat: Prefs["dateFormat"];
  onPointerOver: (e: React.PointerEvent) => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
  onClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div
      ref={gridRef}
      role="group"
      aria-label="Reading calendar"
      data-spotlight={spotDays ? "" : undefined}
      className="heat-reveal grid grid-flow-col grid-rows-[auto_repeat(7,auto)] gap-[3px]"
      style={{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(11px, 1fr))` }}
      onPointerOver={onPointerOver}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {/* The weekday column. */}
      <span aria-hidden="true" />
      {DAY_LABELS[weekStart].map((d, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="self-center pr-1 text-[10px] leading-none text-muted-foreground"
        >
          {d}
        </span>
      ))}
      {weeks.map((week, i) => [
        <span key={`m${i}`} aria-hidden="true" className="relative h-3.5">
          {months[i] !== null && (
            <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-none text-muted-foreground">
              {MONTHS_SHORT[months[i]!]}
            </span>
          )}
        </span>,
        ...week.map((key) => {
          if (key < range.from || key > range.to) {
            return <span key={key} aria-hidden="true" />;
          }
          if (key > range.last) {
            return (
              <span
                key={key}
                aria-hidden="true"
                className="heat-cell heat-future aspect-square rounded-[min(22%,var(--radius))]"
              />
            );
          }
          const level = levels.get(key) ?? 0;
          const parts = describe(key);
          return (
            <button
              key={key}
              type="button"
              data-day={key}
              tabIndex={key === tabKey ? 0 : -1}
              aria-pressed={key === selected}
              aria-label={`${formatLongDay(key, dateFormat)}: ${parts.join(", ") || "no reading"}`}
              className={cn(
                "heat-cell aspect-square rounded-[min(22%,var(--radius))] outline-none",
                LEVEL_CLASS[level],
                spotDays && !spotDays.has(key) && "heat-dim",
                key === today && "heat-today",
              )}
            />
          );
        }),
      ])}
    </div>
  );
});

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs tabular-nums transition-colors outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const TILE = "flex min-w-0 flex-col items-start rounded-lg border px-3 py-2.5 text-left";
const TILE_BUTTON =
  "transition-colors outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function TileHead({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex w-full items-start justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-3" aria-hidden="true" />
      </span>
    </span>
  );
}

function Big({ value, unit }: { value: string; unit?: string }) {
  return (
    <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
      {value}
      {unit && <span className="text-sm font-normal text-muted-foreground"> {unit}</span>}
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

/** A plain tile, or one that does something when clicked. */
function Tile({
  icon,
  label,
  onClick,
  pressed,
  children,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  if (!onClick) {
    return (
      <div className={TILE}>
        <TileHead icon={icon} label={label} />
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(TILE, TILE_BUTTON, pressed && "border-primary bg-primary/10")}
    >
      <TileHead icon={icon} label={label} />
      {children}
    </button>
  );
}

/** A streak tile: pointing at it lights the streak's days on the
 *  calendar, and clicking (or tapping) keeps them lit. The whole tile is
 *  one button laid over its text; `extra` (a link to another year) sits
 *  above that button, so it is a control of its own rather than one
 *  inside another. */
function StreakTile({
  streak,
  icon,
  label,
  description,
  disabled,
  pinned,
  setPinned,
  setHovered,
  extra,
  children,
}: {
  streak: Streak;
  icon: LucideIcon;
  label: string;
  /** What the button says to a screen reader: the tile's text. */
  description: string;
  disabled: boolean;
  pinned: Streak | null;
  setPinned: (s: Streak | null) => void;
  setHovered: (s: Streak | null) => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const on = pinned === streak;
  return (
    <div
      onPointerEnter={(e) => !disabled && e.pointerType === "mouse" && setHovered(streak)}
      onPointerLeave={() => setHovered(null)}
      className={cn(
        TILE,
        "relative",
        !disabled &&
          "transition-colors has-[>button:hover]:border-ring/60 has-[>button:focus-visible]:border-ring has-[>button:focus-visible]:ring-3 has-[>button:focus-visible]:ring-ring/50",
        on && "border-primary bg-primary/10",
      )}
    >
      <TileHead icon={icon} label={label} />
      {children}
      {!disabled && (
        <button
          type="button"
          aria-pressed={on}
          aria-label={`${description}. Show it on the calendar`}
          title={on ? "Click to stop showing it" : "Show it on the calendar"}
          onClick={() => setPinned(on ? null : streak)}
          className="absolute inset-0 cursor-pointer rounded-[inherit] outline-none"
        />
      )}
      {extra && <span className="relative">{extra}</span>}
    </div>
  );
}

/** What was read on one day: the day's pages and time, and each book. */
function DayDetail({
  dayKey,
  data,
  title,
  summary,
  fmt,
  onClose,
}: {
  dayKey: string;
  data: CalendarData;
  title: string;
  summary: string[];
  fmt: (n: number) => string;
  onClose: () => void;
}) {
  const books = data.days[dayKey]?.[2] ?? [];
  return (
    <section aria-label={title} aria-live="polite" className="page-in rounded-lg border px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {summary.length > 0 ? summary.join(" · ") : "Nothing logged this day."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {books.length > 0 && (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {books.map(([i, pages, minutes]) => {
            const book = data.books[i];
            const parts = [
              pages > 0 && `${fmt(pages)} ${plural(pages, "page")}`,
              minutes > 0 && minutesText(minutes),
            ].filter(Boolean);
            return (
              <li key={book.id}>
                <BookLink
                  bookId={book.id}
                  className="flex items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-accent/50"
                >
                  <BookCover
                    book={{ ...book, authors: book.author ? [book.author] : [] }}
                    className="aspect-[2/3] w-7 shrink-0 rounded-sm"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{book.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[book.author, ...parts].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </BookLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
