"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { BookCover } from "@/components/book-card";
import { spineColourOf } from "@/components/book-spine";
import { GoldMedal } from "@/components/gold-medal";
import { usePreferences } from "@/components/preferences-provider";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { drawnSpineHex, spineShape } from "@/lib/book-spine";
import { celebrate } from "@/lib/celebrate";
import { useCoverColours } from "@/lib/cover-colours";
import { dayKey } from "@/lib/dates";
import { formatDayMonth, formatNumber } from "@/lib/display";
import { unitWord } from "@/lib/goals";
import { motionAllowed, subscribeMotion } from "@/lib/motion";
import {
  canSharePictures,
  canvasPicture,
  downloadPicture,
  pictureFonts,
  sharePicture,
  useCoverImages,
} from "@/lib/picture-share";
import { cn } from "@/lib/utils";
import {
  YEAR_CARD_LOOKS,
  YEAR_CARD_LOOK_LABELS,
  drawYearCard,
  pickFigures,
  yearCardFileName,
  type ThemeInk,
  type YearCardFonts,
  type YearCardLook,
  type YearCardShape,
} from "@/lib/year-card";
import {
  busiestMonth,
  daysBetween,
  daysSoFar,
  favouriteAuthor,
  longestAndFastest,
  longestRun,
  pagesYardstick,
  storySlides,
  type StorySlide,
  type WrappedBook,
  type YearWrapped,
} from "@/lib/year-wrapped";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** How long each slide stays before the next, while it plays by itself. */
const SLIDE_MS: Record<StorySlide, number> = {
  intro: 5000,
  books: 7000,
  pages: 6500,
  time: 6000,
  days: 8500,
  months: 7000,
  genres: 6500,
  author: 7000,
  top: 8500,
  longest: 7500,
  goal: 6500,
  picture: 0,
};

/** The look and shape last picked for the picture, in this browser only. */
const CHOICE_KEY = "myreads:year-card";

const LOOK_SWATCHES: Record<YearCardLook, string> = {
  paper: "linear-gradient(135deg, #f5efe2, #e6dac2)",
  night: "linear-gradient(135deg, #1f2547, #0a0d1c)",
  theme: "linear-gradient(135deg, var(--background) 50%, var(--primary) 50%)",
};

/**
 * The button on a Year in review that plays the year back as a story:
 * full-screen slides, one highlight each (books, pages, time, the days you
 * read and your longest streak, the busiest month, genres, the author of
 * the year, the top books, the goal), ending on a picture of the year to
 * download or share (lib/year-card.ts). Slides move on by themselves while
 * animations are on; a tap, a click or the arrow keys move between them.
 */
export function YearStoryButton({ wrapped }: { wrapped: YearWrapped }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Sparkles data-slot="icon" />
          Play your year
        </Button>
      </DialogPrimitive.Trigger>
      {open && <YearStory wrapped={wrapped} />}
    </DialogPrimitive.Root>
  );
}

const serverMotion = () => false;

function YearStory({ wrapped }: { wrapped: YearWrapped }) {
  const slides = useMemo(() => storySlides(wrapped), [wrapped]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  const motion = useSyncExternalStore(subscribeMotion, motionAllowed, serverMotion);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ at: number; x: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The washes behind the slides take the colours of the year's covers.
  const coverUrls = useMemo(
    () => [...new Set(wrapped.finishes.flatMap((f) => (f.book.coverUrl ? [f.book.coverUrl] : [])))],
    [wrapped.finishes],
  );
  const known = useCoverColours(coverUrls);
  const palette = useMemo(() => {
    const seen = new Set<string>();
    return [...wrapped.top, ...wrapped.finishes]
      .map((f) => f.book)
      .filter((b) => !seen.has(b.id) && seen.add(b.id))
      .slice(0, 12)
      .map((b) => spineColourOf(b, known));
  }, [wrapped.top, wrapped.finishes, known]);

  const slide = slides[index];
  const last = index === slides.length - 1;
  // Slides move on by themselves only while animations are on; the reader
  // who turned them off moves through at their own pace.
  const auto = motion && !last;
  const running = auto && !paused && !held && !hidden;

  const go = (n: number) => setIndex(Math.max(0, Math.min(slides.length - 1, n)));
  const next = () => go(index + 1);
  const back = () => go(index - 1);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    const onControl = (e.target as Element).closest("button, a, input, [role=radio]");
    if (e.key === "ArrowRight" || e.key === "PageDown") next();
    else if (e.key === "ArrowLeft" || e.key === "PageUp") back();
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slides.length - 1);
    else if (e.key === " " && !onControl) setPaused((p) => !p);
    else return;
    e.preventDefault();
  }

  /** A tap on the left third goes back, anywhere else on; a press held
   *  down pauses until it's let go. Controls on a slide take their own
   *  taps, and the picture at the end stays put. */
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || slide === "picture") return;
    if ((e.target as Element).closest("button, a, input, [role=radio]")) return;
    press.current = { at: performance.now(), x: e.clientX };
    holdTimer.current = setTimeout(() => setHeld(true), 220);
  }
  function onPointerUp() {
    const down = press.current;
    press.current = null;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHeld(false);
    if (!down || performance.now() - down.at > 220) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect && down.x - rect.left < rect.width / 3) back();
    else next();
  }
  function onPointerCancel() {
    press.current = null;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHeld(false);
  }

  const title = `${wrapped.year} in books`;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="story-backdrop fixed inset-0 z-50 bg-black/70" />
      <DialogPrimitive.Content
        className="fixed inset-0 z-50 grid place-items-center outline-none"
        aria-describedby={undefined}
        ref={contentRef}
        onKeyDown={onKeyDown}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogPrimitive.Title className="sr-only">
          {title}, as a story
        </DialogPrimitive.Title>
        <div className="relative flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="story-side text-white hover:bg-white/15 hover:text-white max-sm:sr-only"
            onClick={back}
            disabled={index === 0}
            aria-label="Back"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <div
            ref={stageRef}
            className="story-stage relative flex flex-col overflow-hidden bg-background text-foreground select-none"
            data-slide={slide}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerCancel}
            onContextMenu={(e) => press.current && e.preventDefault()}
          >
            <div
              key={`glow-${index}`}
              className="story-glow"
              aria-hidden="true"
              style={
                palette.length
                  ? ({
                      "--glow-a": palette[index % palette.length],
                      "--glow-b": palette[(index + 3) % palette.length],
                    } as React.CSSProperties)
                  : undefined
              }
            />
            <div className="relative z-10 grid gap-2.5 px-3 pt-3">
              <div className="flex gap-1" aria-hidden="true">
                {slides.map((s, i) => (
                  <span key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/20">
                    <span
                      key={i === index ? `now-${index}` : "fill"}
                      className={cn(
                        "story-fill block h-full origin-left rounded-full bg-foreground",
                        i < index || (i === index && !auto) ? "scale-x-100" : "scale-x-0",
                        i === index && auto && "story-fill-run",
                      )}
                      style={
                        i === index && auto
                          ? {
                              animationDuration: `${SLIDE_MS[s]}ms`,
                              animationPlayState: running ? "running" : "paused",
                            }
                          : undefined
                      }
                      onAnimationEnd={i === index && auto ? next : undefined}
                    />
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                  {title}
                  {wrapped.current && ", so far"}
                </p>
                <span className="ml-auto" />
                {auto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={paused ? "Play" : "Pause"}
                    title={paused ? "Play" : "Pause"}
                  >
                    {paused ? <Play /> : <Pause />}
                  </Button>
                )}
                <DialogPrimitive.Close asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" title="Close">
                    <X />
                  </Button>
                </DialogPrimitive.Close>
              </div>
            </div>
            <section
              key={`${slide}-${index}`}
              className={cn(
                "story-slide relative z-10 flex min-h-0 flex-1 flex-col justify-center px-7",
                slide === "picture" ? "pb-5" : "pb-12",
              )}
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
              aria-live={running ? "off" : "polite"}
            >
              <Slide kind={slide} wrapped={wrapped} onReplay={() => go(0)} />
            </section>
            {index === 0 && (
              <p className="story-rise pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center text-xs text-muted-foreground" style={{ "--d": "1400ms" } as React.CSSProperties}>
                <span className="pointer-coarse:hidden">Click, or use the arrow keys, to go on</span>
                <span className="hidden pointer-coarse:inline">Tap to go on, or hold to pause</span>
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="story-side text-white hover:bg-white/15 hover:text-white max-sm:sr-only"
            onClick={next}
            disabled={last}
            aria-label="Next"
          >
            <ChevronRight className="size-6" />
          </Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** An entrance delay for `.story-rise` and friends (globals.css). */
function delay(ms: number): React.CSSProperties {
  return { "--d": `${ms}ms` } as React.CSSProperties;
}

/** Counts up to `value` as the slide opens, when animations are on. The
 *  slides only ever draw in the browser, so motionAllowed can be asked at
 *  once. */
function useCountUp(value: number, wait = 250, duration = 1100): number {
  const [moving] = useState(() => motionAllowed() && value > 0);
  const [t, setT] = useState(moving ? 0 : 1);
  useEffect(() => {
    if (!moving) return;
    let frame = 0;
    const start = performance.now() + wait;
    const tick = (now: number) => {
      const at = Math.min(1, Math.max(0, (now - start) / duration));
      setT(at);
      if (at < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving, wait, duration]);
  return Math.round(value * (1 - (1 - t) ** 3));
}

/** A big number that counts up, read out whole. */
function Count({ value, wait }: { value: number; wait?: number }) {
  const prefs = usePreferences();
  const shown = useCountUp(value, wait);
  return (
    <>
      <span aria-hidden="true">{formatNumber(shown, prefs)}</span>
      <span className="sr-only">{formatNumber(value, prefs)}</span>
    </>
  );
}

function Kicker({ children, at = 0 }: { children: React.ReactNode; at?: number }) {
  return (
    <p className="story-rise text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase" style={delay(at)}>
      {children}
    </p>
  );
}

function Big({ children, at = 150, className }: { children: React.ReactNode; at?: number; className?: string }) {
  return (
    <p
      className={cn("story-rise mt-3 font-heading text-6xl leading-none font-bold tracking-tight tabular-nums sm:text-7xl", className)}
      style={delay(at)}
    >
      {children}
    </p>
  );
}

function Line({ children, at = 500, className }: { children: React.ReactNode; at?: number; className?: string }) {
  return (
    <p className={cn("story-rise mt-4 text-base text-pretty text-muted-foreground sm:text-lg", className)} style={delay(at)}>
      {children}
    </p>
  );
}

function Slide({ kind, wrapped, onReplay }: { kind: StorySlide; wrapped: YearWrapped; onReplay: () => void }) {
  switch (kind) {
    case "intro":
      return <IntroSlide w={wrapped} />;
    case "books":
      return <BooksSlide w={wrapped} />;
    case "pages":
      return <PagesSlide w={wrapped} />;
    case "time":
      return <TimeSlide w={wrapped} />;
    case "days":
      return <DaysSlide w={wrapped} />;
    case "months":
      return <MonthsSlide w={wrapped} />;
    case "genres":
      return <GenresSlide w={wrapped} />;
    case "author":
      return <AuthorSlide w={wrapped} />;
    case "top":
      return <TopSlide w={wrapped} />;
    case "longest":
      return <LongestSlide w={wrapped} />;
    case "goal":
      return <GoalSlide w={wrapped} />;
    case "picture":
      return <PictureSlide w={wrapped} onReplay={onReplay} />;
  }
}

/** Where the opening slide's covers lie, around the year. */
const SCATTER: { left: string; top?: string; bottom?: string; turn: number }[] = [
  { left: "5%", top: "9%", turn: -9 },
  { left: "38%", top: "6%", turn: -2 },
  { left: "70%", top: "10%", turn: 8 },
  { left: "-4%", bottom: "11%", turn: 7 },
  { left: "36%", bottom: "7%", turn: 3 },
  { left: "76%", bottom: "12%", turn: -7 },
];

function IntroSlide({ w }: { w: YearWrapped }) {
  // The top books if there are any, else the year's last finishes.
  const seen = new Set<string>();
  const covers = [...w.top, ...[...w.finishes].reverse()]
    .map((f) => f.book)
    .filter((b) => !seen.has(b.id) && seen.add(b.id))
    .slice(0, SCATTER.length);
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {covers.map((book, i) => (
          <div
            key={book.id}
            className="story-float absolute w-[24%] opacity-85"
            style={{ left: SCATTER[i].left, top: SCATTER[i].top, bottom: SCATTER[i].bottom, "--turn": `${SCATTER[i].turn}deg`, "--d": `${i * 120}ms` } as React.CSSProperties}
          >
            <BookCover book={book} className="cover-shadow aspect-[2/3] w-full" loading="eager" />
          </div>
        ))}
      </div>
      <div className="story-hush relative -mx-7 px-7 py-10 text-center">
        <Kicker>Your year in books</Kicker>
        <p className="story-rise mt-2 font-heading text-8xl leading-none font-bold tracking-tighter tabular-nums sm:text-9xl" style={delay(150)}>
          {w.year}
        </p>
        <Line at={600}>{w.current ? "So far, anyway. Here's how it's going." : "Here's how it went."}</Line>
      </div>
    </>
  );
}

function BooksSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const covers = w.finishes.slice(0, 18);
  const every = w.books >= 2 ? Math.round(daysSoFar(w.year, dayKey(new Date(), prefs.timeZone)) / w.books) : 0;
  return (
    <>
      <Kicker>You {w.bookWord}</Kicker>
      <Big>
        <Count value={w.books} />{" "}
        <span className="text-3xl font-semibold tracking-normal">{w.books === 1 ? "book" : "books"}</span>
      </Big>
      <Line>
        {w.rereads > 0 && `${fmt(w.rereads)} of them ${w.rereads === 1 ? "was a re-read" : "were re-reads"}. `}
        {every >= 1 && `That's one every ${every === 1 ? "day" : `${fmt(every)} days`}.`}
      </Line>
      {covers.length > 0 && (
        <div className="mt-7 grid grid-cols-6 gap-2" aria-hidden="true">
          {covers.map((f, i) => (
            <div key={`${f.book.id}-${i}`} className="story-pop" style={delay(700 + i * 55)}>
              <BookCover book={f.book} className="cover-shadow aspect-[2/3] w-full" loading="eager" />
            </div>
          ))}
        </div>
      )}
      {w.finishes.length > covers.length && (
        <Line at={700 + covers.length * 55} className="mt-3 text-sm sm:text-sm">
          and {fmt(w.finishes.length - covers.length)} more
        </Line>
      )}
    </>
  );
}

function PagesSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const yardstick = pagesYardstick(w.pages);
  const days = daysSoFar(w.year, dayKey(new Date(), prefs.timeZone));
  const perDay = days > 0 ? Math.round(w.pages / days) : 0;
  return (
    <>
      <OpenBook />
      <Kicker>Page after page</Kicker>
      <Big>
        <Count value={w.pages} />{" "}
        <span className="text-3xl font-semibold tracking-normal">{w.pages === 1 ? "page" : "pages"}</span>
      </Big>
      {yardstick && (
        <Line>
          As many as <i>{yardstick.title}</i>, {fmt(yardstick.times)} times over.
        </Line>
      )}
      {perDay >= 1 && (
        <Line at={800} className="mt-2">
          About {fmt(perDay)} {perDay === 1 ? "page" : "pages"} a day.
        </Line>
      )}
    </>
  );
}

/** A book lying open with its leaves turning, over the pages slide. */
function OpenBook() {
  return (
    <div className="story-rise mb-8 self-start" style={delay(0)} aria-hidden="true">
      <div className="story-book">
        <span className="story-book-page story-book-left" />
        <span className="story-book-page story-book-right" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="story-book-page story-leaf" style={{ "--leaf": i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

function TimeSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const hours = Math.round(w.minutes / 60);
  const wholeDays = Math.floor(w.minutes / 1440);
  return (
    <>
      <div className="story-rise mb-8 self-start" style={delay(0)} aria-hidden="true">
        <svg viewBox="0 0 64 64" className="size-16 text-foreground">
          <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="32" y1="6.5" x2="32" y2={i % 3 === 0 ? 11 : 9} stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" transform={`rotate(${i * 30} 32 32)`} />
          ))}
          <line className="story-hand-hour" x1="32" y1="32" x2="32" y2="19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line className="story-hand-minute" x1="32" y1="32" x2="32" y2="12" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="32" r="2.5" fill="currentColor" />
        </svg>
      </div>
      <Kicker>With the timer running</Kicker>
      <Big>
        <Count value={hours} />{" "}
        <span className="text-3xl font-semibold tracking-normal">{hours === 1 ? "hour" : "hours"}</span>
      </Big>
      <Line>
        {wholeDays >= 1
          ? `That's ${wholeDays === 1 ? "a whole day" : `${fmt(wholeDays)} whole days`} with a book.`
          : `${fmt(w.minutes)} minutes in all.`}
      </Line>
    </>
  );
}

function DaysSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const run = longestRun(w.days);
  const read = new Set(w.days);
  const streak = new Set(run && run.length > 1 ? daysBetween(run.start, run.end) : []);
  const todayKey = dayKey(new Date(), prefs.timeZone);
  let lit = 0;
  return (
    <>
      <Kicker>You read on</Kicker>
      <Big>
        <Count value={w.days.length} />{" "}
        <span className="text-3xl font-semibold tracking-normal">{w.days.length === 1 ? "day" : "days"}</span>
      </Big>
      {run && run.length > 1 && (
        <Line>
          Your longest streak was <b className="font-semibold text-foreground">{fmt(run.length)} days in a row</b>,{" "}
          {formatDayMonth(run.start, prefs.dateFormat)} to {formatDayMonth(run.end, prefs.dateFormat)}.
        </Line>
      )}
      <div className="story-calendar mt-7 grid gap-[3px]" role="img" aria-label={`A calendar of ${w.year} with the ${fmt(w.days.length)} days you read marked`}>
        {MONTH_NAMES.map((name, m) => {
          const length = new Date(Date.UTC(w.year, m + 1, 0)).getUTCDate();
          return (
            <div key={name} className="story-rise flex items-center gap-1.5" style={delay(600 + m * 45)}>
              <span className="w-3 shrink-0 text-[0.6rem] leading-none text-muted-foreground">{name[0]}</span>
              <span className="grid flex-1 grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
                {Array.from({ length }, (_, d) => {
                  const key = `${w.year}-${String(m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
                  const inStreak = streak.has(key);
                  return (
                    <span
                      key={key}
                      className={cn(
                        "story-day aspect-square rounded-[2px]",
                        inStreak ? "story-day-streak" : read.has(key) ? "bg-foreground/55" : key > todayKey ? "bg-foreground/[0.05]" : "bg-foreground/[0.12]",
                      )}
                      style={inStreak ? delay(1500 + lit++ * 28) : undefined}
                    />
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MonthsSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const best = busiestMonth(w.months)!;
  const max = Math.max(...w.months);
  return (
    <>
      <Kicker>Your busiest month</Kicker>
      <Big>{MONTH_NAMES[best]}</Big>
      <Line>
        {fmt(w.months[best])} {w.months[best] === 1 ? "book" : "books"} {w.bookWord}.
      </Line>
      <div className="mt-8 grid h-40 grid-cols-12 items-end gap-1.5" aria-hidden="true">
        {w.months.map((n, m) => (
          <div key={m} className="flex h-full flex-col justify-end gap-1.5">
            <span
              className={cn("story-grow block rounded-t-[3px]", m === best ? "bg-primary" : "bg-foreground/25")}
              style={{ height: `${max ? Math.max(n ? 6 : 2, (n / max) * 100) : 2}%`, ...delay(500 + m * 60) }}
            />
            <span className={cn("text-center text-[0.65rem] leading-none", m === best ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {MONTH_NAMES[m][0]}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function GenresSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const [first, ...rest] = w.genres;
  return (
    <>
      <Kicker>{w.genres.length === 1 ? "Your favourite genre" : "Your favourite genres"}</Kicker>
      <Big className="text-5xl text-balance break-words sm:text-6xl">{first.tag}</Big>
      <Line>
        {fmt(first.count)} {first.count === 1 ? "book" : "books"}
      </Line>
      {rest.length > 0 && (
        <ol className="mt-8 grid gap-4">
          {rest.map((g, i) => (
            <li key={g.tag} className="story-rise flex items-baseline gap-4" style={delay(800 + i * 200)}>
              <span className="font-heading text-2xl font-bold text-muted-foreground tabular-nums">{i + 2}</span>
              <span className="min-w-0">
                <span className="block font-heading text-2xl font-semibold break-words sm:text-3xl">{g.tag}</span>
                <span className="text-sm text-muted-foreground">
                  {fmt(g.count)} {g.count === 1 ? "book" : "books"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function AuthorSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const author = favouriteAuthor(w.finishes)!;
  const shown = author.books.slice(0, 5);
  const mid = (shown.length - 1) / 2;
  return (
    <>
      <div className="relative mb-10 flex h-44 justify-center" aria-hidden="true">
        {shown.map((book, i) => (
          <div
            key={book.id}
            className="story-fan absolute bottom-0 w-24 origin-bottom"
            style={{ "--fan": `${(i - mid) * 8}deg`, "--shift": `${(i - mid) * 50}px`, ...delay(150 + i * 90), zIndex: i } as React.CSSProperties}
          >
            <BookCover book={book} className="cover-shadow aspect-[2/3] w-full" loading="eager" />
          </div>
        ))}
      </div>
      <Kicker at={400}>Your author of the year</Kicker>
      <Big at={550} className="text-5xl text-balance break-words sm:text-6xl">
        {author.name}
      </Big>
      <Line at={850}>
        {formatNumber(author.books.length, prefs)} of their books, {w.current ? "so far" : "in one year"}.
      </Line>
    </>
  );
}

function TopSlide({ w }: { w: YearWrapped }) {
  const [first, ...rest] = w.top;
  return (
    <>
      <Kicker>{w.top.length === 1 ? "Your top book" : "Your top books"}</Kicker>
      <div className="story-drop mt-6 flex items-end gap-5" style={delay(200)}>
        <BookCover book={first.book} className="cover-shadow aspect-[2/3] w-32 shrink-0 sm:w-36" loading="eager" />
        <div className="min-w-0 pb-1">
          <p className="font-heading text-2xl leading-tight font-bold text-balance break-words sm:text-3xl">{first.book.title}</p>
          {first.book.authors.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{first.book.authors.join(", ")}</p>
          )}
          {first.rating != null && <Stars value={first.rating} className="mt-2" />}
        </div>
      </div>
      {rest.length > 0 && (
        <ol className="mt-8 grid grid-cols-4 gap-3">
          {rest.map((f, i) => (
            <li key={f.book.id} className="story-rise min-w-0" style={delay(900 + i * 140)}>
              <BookCover book={f.book} className="cover-shadow aspect-[2/3] w-full" loading="eager" />
              <p className="mt-1.5 flex gap-1 text-xs leading-tight">
                <span className="font-semibold tabular-nums">{i + 2}</span>
                <span className="line-clamp-2 text-muted-foreground">{f.book.title}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function LongestSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const { longest, fastest } = longestAndFastest(w.finishes);
  const rows: { label: string; book: WrappedBook; figure: string }[] = [];
  if (longest) rows.push({ label: "The longest", book: longest.book, figure: `${fmt(longest.book.pageCount!)} pages` });
  if (fastest && fastest.book.id !== longest?.book.id)
    rows.push({ label: "The quickest", book: fastest.book, figure: fastest.days === 1 ? "in a day" : `in ${fmt(fastest.days!)} days` });
  else if (fastest && longest)
    rows[0].figure += `, and the quickest, ${fastest.days === 1 ? "in a day" : `in ${fmt(fastest.days!)} days`}`;
  else if (fastest)
    rows.push({ label: "The quickest", book: fastest.book, figure: fastest.days === 1 ? "in a day" : `in ${fmt(fastest.days!)} days` });
  return (
    <>
      <Kicker>Highlights</Kicker>
      <div className="mt-6 grid gap-7">
        {rows.map((r, i) => (
          <div key={r.label} className="story-rise flex items-center gap-5" style={delay(250 + i * 350)}>
            <BookCover book={r.book} className="cover-shadow aspect-[2/3] w-24 shrink-0" loading="eager" />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{r.label}</p>
              <p className="mt-1 font-heading text-2xl leading-tight font-bold text-balance break-words">{r.book.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.figure}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function GoalSlide({ w }: { w: YearWrapped }) {
  const prefs = usePreferences();
  const fmt = (n: number) => formatNumber(n, prefs);
  const medal = useRef<HTMLDivElement>(null);
  const goal = w.goal!;
  useEffect(() => {
    const at = setTimeout(() => celebrate(medal.current), 650);
    return () => clearTimeout(at);
  }, []);
  const word = goal.unit === "DAYS" ? (goal.target === 1 ? "reading day" : "reading days") : unitWord(goal.unit, goal.target);
  const over = goal.done - goal.target;
  return (
    <>
      <div ref={medal} className="-ml-2 mb-8 self-start">
        <GoldMedal animate className="h-28 w-[84px]" />
      </div>
      <Kicker at={300}>Goal reached</Kicker>
      <Big at={450} className="text-5xl sm:text-6xl">
        {fmt(goal.done)} <span className="text-3xl font-semibold tracking-normal text-muted-foreground">of {fmt(goal.target)}</span>
      </Big>
      <Line at={750}>
        {word} toward your {w.year} goal.
        {over > 0 && ` ${fmt(over)} more than you planned.`}
      </Line>
    </>
  );
}

// ── The picture at the end ────────────────────────────────────────────────

function loadChoice(): { look: YearCardLook; shape: YearCardShape } {
  const fallback = { look: "paper" as YearCardLook, shape: "tall" as YearCardShape };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "{}");
    if (!saved || typeof saved !== "object") return fallback;
    const { look, shape } = saved as Record<string, unknown>;
    return {
      look: YEAR_CARD_LOOKS.includes(look as YearCardLook) ? (look as YearCardLook) : fallback.look,
      shape: shape === "square" || shape === "tall" ? shape : fallback.shape,
    };
  } catch {
    return fallback;
  }
}

/** The theme's colours as a canvas can use them, read off the page. */
function themeInk(): ThemeInk | null {
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return null;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    if (!value) return fallback;
    probe.fillStyle = fallback;
    probe.fillStyle = value;
    probe.clearRect(0, 0, 1, 1);
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    return a === 0 ? fallback : `rgb(${r} ${g} ${b})`;
  };
  return {
    background: read("--background", "#ffffff"),
    foreground: read("--foreground", "#111111"),
    muted: read("--muted-foreground", "#666666"),
    accent: read("--primary", "#333333"),
  };
}

/** The theme's heading face, as the page draws it. */
function headingFace(): string {
  const probe = document.createElement("span");
  probe.className = "font-heading";
  probe.hidden = true;
  document.body.append(probe);
  const face = getComputedStyle(probe).fontFamily;
  probe.remove();
  return face;
}

function PictureSlide({ w, onReplay }: { w: YearWrapped; onReplay: () => void }) {
  const prefs = usePreferences();
  const [choice, setChoice] = useState(loadChoice);
  const [fonts, setFonts] = useState<{ book: YearCardFonts; theme: YearCardFonts } | null>(null);
  const [theme] = useState(themeInk);
  const [canShare] = useState(canSharePictures);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const coverUrls = useMemo(
    () => [...new Set(w.finishes.flatMap((f) => (f.book.coverUrl ? [f.book.coverUrl] : [])))],
    [w.finishes],
  );
  const known = useCoverColours(coverUrls);
  const rowBooks = useMemo(() => {
    const seen = new Set<string>();
    const source = w.top.length ? w.top : [...w.finishes].reverse();
    return source.map((f) => f.book).filter((b) => !seen.has(b.id) && seen.add(b.id)).slice(0, 5);
  }, [w.top, w.finishes]);
  const images = useCoverImages(useMemo(() => rowBooks.flatMap((b) => (b.coverUrl ? [b.coverUrl] : [])), [rowBooks]));

  useEffect(() => {
    const serif = pictureFonts().serif;
    const heading = headingFace();
    const faces = [serif, heading];
    const ready = Promise.all(
      faces.flatMap((face) =>
        ["italic 400 40px", "400 40px", "500 40px", "600 40px", "700 40px"].map((weight) =>
          document.fonts.load(`${weight} ${face}`).catch(() => []),
        ),
      ),
    );
    let live = true;
    void ready.then(() => live && setFonts({ book: { serif, heading: serif }, theme: { serif, heading } }));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!fonts || !canvasRef.current) return;
    const author = favouriteAuthor(w.finishes);
    drawYearCard(
      canvasRef.current,
      {
        year: w.year,
        current: w.current,
        figures: pickFigures(w, (n) => formatNumber(n, prefs)),
        genres: w.genres.map((g) => g.tag),
        author: author?.name ?? null,
        books: rowBooks.map((b) => ({
          title: b.title,
          colour: (b.coverUrl && known[b.coverUrl]) || drawnSpineHex(b.title),
          cover: (b.coverUrl && images[b.coverUrl]) || null,
        })),
        booksLabel: w.top.length ? (w.top.length === 1 ? "Top book" : "Top books") : "Last finished",
        spines: w.finishes.map((f) => {
          const shape = spineShape(f.book);
          return {
            colour: (f.book.coverUrl && known[f.book.coverUrl]) || drawnSpineHex(f.book.title),
            width: shape.width,
            height: shape.height,
            design: shape.design,
          };
        }),
      },
      choice.look,
      choice.shape,
      choice.look === "theme" ? fonts.theme : fonts.book,
      theme,
    );
  }, [fonts, choice, w, prefs, known, images, rowBooks, theme]);

  function choose(next: Partial<typeof choice>) {
    const value = { ...choice, ...next };
    setChoice(value);
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(value));
    } catch {
      // Not kept: it starts on Paper next time.
    }
  }

  async function download() {
    setBusy(true);
    const blob = await canvasPicture(canvasRef.current);
    setBusy(false);
    if (blob) downloadPicture(blob, yearCardFileName(w.year));
  }

  async function share() {
    setBusy(true);
    const blob = await canvasPicture(canvasRef.current);
    setBusy(false);
    if (blob) await sharePicture(blob, yearCardFileName(w.year), `${w.year} in books`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 pt-2">
      <div>
        <Kicker>Your year, to keep</Kicker>
        <p className="story-rise mt-1.5 text-sm text-muted-foreground" style={delay(100)}>
          A picture to save or share. It is made here, on your device.
        </p>
      </div>
      <div className="story-rise relative min-h-0 flex-1" style={delay(200)}>
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          role="img"
          aria-label={`${w.year} in books: ${pickFigures(w, (n) => formatNumber(n, prefs)).map((f) => `${f.value} ${f.label}`).join(", ")}`}
          className={cn("absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full rounded-sm shadow-lg", !fonts && "invisible")}
        />
      </div>
      <div className="story-rise grid gap-3" style={delay(300)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Look" className="flex flex-wrap gap-1.5">
            {YEAR_CARD_LOOKS.map((look) => (
              <button
                key={look}
                type="button"
                role="radio"
                aria-checked={choice.look === look}
                onClick={() => choose({ look })}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover:border-ring/60",
                  choice.look === look && "border-foreground font-medium",
                )}
              >
                <span aria-hidden="true" className="size-4 shrink-0 rounded-sm border" style={{ background: LOOK_SWATCHES[look] }} />
                {YEAR_CARD_LOOK_LABELS[look]}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Shape" className="flex gap-1 rounded-md border p-0.5">
            {(["tall", "square"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={choice.shape === s}
                onClick={() => choose({ shape: s })}
                className={cn(
                  "rounded px-2 py-0.5 text-xs text-muted-foreground",
                  choice.shape === s && "bg-muted font-medium text-foreground",
                )}
              >
                {s === "tall" ? "Tall" : "Square"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onReplay}>
            <RotateCcw data-slot="icon" />
            Play again
          </Button>
          <span className="ml-auto" />
          {canShare && (
            <Button type="button" variant="outline" onClick={share} disabled={!fonts || busy}>
              <Share2 data-slot="icon" />
              Share
            </Button>
          )}
          <Button type="button" onClick={download} disabled={!fonts || busy}>
            <Download data-slot="icon" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
