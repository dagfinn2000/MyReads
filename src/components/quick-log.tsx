"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CircleAlert, CloudUpload, X } from "lucide-react";
import type { BookFormat } from "@/lib/enums";
import { logPage, moveFromReading } from "@/lib/actions/progress";
import { celebrate } from "@/lib/celebrate";
import { calendarDay, dayKey, shiftDayKey } from "@/lib/dates";
import {
  addToOutbox,
  isConnectionError,
  newClientId,
  pendingPage,
  removeFromOutbox,
  type OutboxItem,
} from "@/lib/outbox";
import {
  addStep,
  formatLength,
  formatPosition,
  formatUnitValue,
  pageToUnit,
  parseBoxText,
  pastTheEnd,
  positionText,
  stepsFor,
  unitFor,
  type ProgressUnit,
} from "@/lib/progress-units";
import { describeDay, recentDays, type LogPageResult, type MoveResult } from "@/lib/reading-log";
import { cn } from "@/lib/utils";
import { useOffline, usePendingItems } from "@/components/offline-provider";
import { usePreferences } from "@/components/preferences-provider";
import { ProgressField, ProgressNotes, unitLabel } from "@/components/progress-input";
import { ReadingTimer, giveBackTime, useReadingTimer } from "@/components/reading-timer";
import { useSound } from "@/components/sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface QuickLogBook {
  id: string;
  title: string;
  format: BookFormat;
  pageCount: number | null;
  lengthMinutes: number | null;
  currentPage: number | null;
  dateStarted: Date | null;
}

export type MovedResult = Extract<MoveResult, { ok: true }>;

const EMPTY: Record<ProgressUnit, string> = {
  page: "Type a page first.",
  percent: "Type a percent first.",
  time: "Type how long you've listened first.",
};

const AT_LEAST: Record<ProgressUnit, string> = {
  page: "Log at least page 1.",
  percent: "Log at least 1%.",
  time: "Log at least 0:01.",
};

/**
 * The quick-log row for a book being read: the progress box in the book's
 * unit, step buttons, which day, and Log. On Now reading it also has
 * Finished and Stopped. Logging the last page asks whether the book is
 * finished. Under it, the reading timer: its time goes with the next log,
 * or with Finished or Stopped.
 *
 * Its own form, outside the reading card's, so Enter in the box logs and
 * none of these buttons can submit the reading form.
 *
 * Without a connection, a log (or Finished, or Stopped) is saved on this
 * device instead (lib/outbox.ts) and sent when the server answers again;
 * the row lists what's waiting, and the box and bar already show the page.
 * While anything for the book waits, new logs wait behind it, so they
 * reach the server in the order they were made.
 */
export function QuickLog({
  book,
  showMoveButtons = false,
  onMoved,
  autoFocus = false,
}: {
  book: QuickLogBook;
  /** Finished and Stopped, for Now reading. */
  showMoveButtons?: boolean;
  onMoved?: (result: MovedResult) => void;
  /** Focus the box on mount (a row brought back by Undo). */
  autoFocus?: boolean;
}) {
  const prefs = usePreferences();
  const info = unitFor(book, prefs);
  const steps = stepsFor(prefs.quickLogSteps, info);
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const markRef = useRef<HTMLButtonElement>(null);
  // Null while the box just shows where the book is; text once typed in.
  const [draft, setDraft] = useState<string | null>(null);
  const [day, setDay] = useState("today");
  const [otherDay, setOtherDay] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  // The page just logged when it was the last one: asks "Mark as Read?".
  const [lastPage, setLastPage] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useReadingTimer(book.id, book.dateStarted ? book.dateStarted.getTime() : null);
  const sound = useSound();
  const offline = useOffline();
  const saved = usePendingItems(book.id);
  // Where the book is with what this device saved and hasn't sent yet.
  const currentPage = pendingPage([...saved.items, ...saved.held], book.id, book.currentPage);
  const waiting = saved.items.some((i) => !i.error);

  const text = draft ?? positionText(currentPage, info);
  const today = dayKey(new Date(), prefs.timeZone);
  const startKey = book.dateStarted ? calendarDay(book.dateStarted, prefs.timeZone) : null;
  const { days, more } = recentDays(today, startKey, prefs.dateFormat);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // The buttons that asked go away; focus goes to the question's answer.
  useEffect(() => {
    if (lastPage !== null) markRef.current?.focus();
  }, [lastPage]);

  function fail(text: string) {
    setMessage({ text, error: true });
  }

  function log() {
    setLastPage(null);
    // The book's own page while the box still shows it, not that page
    // turned into a percent and back.
    const parsed = parseBoxText(text, info, currentPage);
    if (!parsed) return fail(EMPTY[info.unit]);
    if ("error" in parsed) return fail(parsed.error);
    if (parsed.page < 1) return fail(AT_LEAST[info.unit]);
    if (book.pageCount != null && parsed.page > book.pageCount) {
      return fail(pastTheEnd(parsed.page, book.pageCount));
    }
    const when = day === "other" ? otherDay : day;
    if (!when) return fail("Pick a day.");
    // A percent or a minute can be less than a page; say so instead of
    // "Already at", which would read as if nothing was typed.
    if (
      when === "today" &&
      draft !== null &&
      currentPage != null &&
      info.unit !== "page" &&
      parsed.page === currentPage &&
      parsed.value !== pageToUnit(currentPage, info)
    ) {
      return fail(`That's still page ${parsed.page} of ${info.pageCount}. Log a little further.`);
    }
    const timed = timer.minutesForLog();
    if ("error" in timed) return fail(timed.error);

    const id = newClientId();
    const done = (lastPage: boolean, message: string) => {
      if (timed.minutes) timer.consumed();
      sound("logged");
      setDraft(null);
      setDay("today");
      if (lastPage) {
        setMessage(null);
        setLastPage(parsed.page);
      } else {
        setMessage({ text: message, error: false });
      }
    };
    // No connection: keep it here, for the day it was meant for.
    const keepHere = () => {
      if (!offline) return fail("Couldn't reach MyReads. Try again.");
      const key = when === "today" ? today : when === "yesterday" ? shiftDayKey(today, -1) : when;
      const label = formatUnitValue(parsed.value, info);
      addToOutbox({
        kind: "log",
        id,
        bookId: book.id,
        page: parsed.page,
        day: key,
        value: parsed.value,
        minutes: timed.minutes,
        at: Date.now(),
        userId: offline.userId,
        title: book.title,
        label,
      });
      done(
        book.pageCount != null && parsed.page === book.pageCount,
        `Saved ${label} for ${describeDay(key, today, prefs.dateFormat)} on this device. It's sent once you're back online.`,
      );
    };
    if (offline && (!offline.online || waiting)) return keepHere();

    startTransition(async () => {
      let result: LogPageResult;
      try {
        result = await logPage(book.id, {
          page: parsed.page,
          day: when,
          value: parsed.value,
          minutes: timed.minutes,
          clientId: id,
        });
      } catch (err) {
        // The connection went on the way: kept here, and sent again with
        // the same id, so it's written once even if this one got through.
        if (offline && isConnectionError(err)) return keepHere();
        throw err;
      }
      if ("error" in result) return fail(result.error);
      done(result.lastPage, result.message);
    });
  }

  function move(to: "READ" | "DNF", origin: HTMLElement) {
    setMessage(null);
    const timed = timer.minutesForLog();
    if ("error" in timed) return fail(timed.error);
    const finishing = to === "READ";
    const keepHere = () => {
      if (!offline) return fail("Couldn't reach MyReads. Try again.");
      addToOutbox({
        kind: "move",
        id: newClientId(),
        bookId: book.id,
        to,
        minutes: timed.minutes,
        at: Date.now(),
        userId: offline.userId,
        title: book.title,
        label: finishing ? "Finished" : "Stopped",
      });
      if (timed.minutes) timer.consumed();
      setLastPage(null);
      // Now reading turns the row into a line with Undo; the book page
      // says what happened here.
      if (!onMoved) {
        setMessage({
          text: `${finishing ? "Marked as Read" : "Moved to Did Not Finish"} on this device. It's sent once you're back online.`,
          error: false,
        });
      }
      if (finishing) {
        celebrate(origin);
        sound("finished");
      }
    };
    if (offline && (!offline.online || waiting)) return keepHere();
    startTransition(async () => {
      let result: MoveResult;
      try {
        result = await moveFromReading(book.id, to, timed.minutes);
      } catch (err) {
        // Sent again later; a book already moved then has nothing to do.
        if (offline && isConnectionError(err)) return keepHere();
        throw err;
      }
      if ("error" in result) return fail(result.error);
      if (timed.minutes) timer.consumed();
      // Before the row goes away with the move.
      if (result.finished) {
        celebrate(origin);
        sound("finished");
      }
      onMoved?.(result);
    });
  }

  function notYet() {
    if (lastPage === null) return;
    setMessage({
      text: `Logged ${formatPosition(lastPage, info)}. It stays in Currently Reading.`,
      error: false,
    });
    setLastPage(null);
    inputRef.current?.focus();
  }

  return (
    <div>
      <div className="grid gap-2">
        <form
          noValidate
          aria-label={`Log progress for ${book.title}`}
          onSubmit={(e) => {
            e.preventDefault();
            log();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <Label htmlFor={id}>{unitLabel(info)}</Label>
          <ProgressField
            id={id}
            info={info}
            text={text}
            onTextChange={setDraft}
            inputRef={inputRef}
            compact
          />
          {steps.map((s) => (
            <Button
              key={s.label}
              type="button"
              variant="outline"
              aria-label={s.ariaLabel}
              onClick={() => setDraft(addStep(text, s.amount, currentPage, info))}
            >
              {s.label}
            </Button>
          ))}
          {days.length > 1 && (
            // Drawn when wanted (ui/select.tsx): a page of rows each drew
            // its closed list as it loaded.
            <Select
              lazyList
              value={day}
              onValueChange={(v) => {
                setDay(v);
                if (v === "other" && !otherDay) setOtherDay(shiftDayKey(today, -4));
              }}
            >
              <SelectTrigger aria-label="Which day">
                <SelectValue>
                  {day === "other" ? "Another day…" : days.find((d) => d.value === day)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
                {more && <SelectItem value="other">Another day…</SelectItem>}
              </SelectContent>
            </Select>
          )}
          {day === "other" && (
            <Input
              type="date"
              aria-label="Day"
              className="w-40"
              min={startKey ?? undefined}
              max={today}
              value={otherDay}
              onChange={(e) => setOtherDay(e.target.value)}
            />
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Logging…" : "Log"}
          </Button>
          {showMoveButtons && (
            <span className="ml-auto flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={(e) => move("READ", e.currentTarget)}
              >
                Finished
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={(e) => move("DNF", e.currentTarget)}
              >
                Stopped
              </Button>
            </span>
          )}
        </form>
        <ProgressNotes
          id={id}
          info={info}
          text={text}
          bookId={book.id}
          showSaved={text !== positionText(currentPage, info)}
        />
        <ReadingTimer control={timer} />
        {saved.items.length > 0 && (
          <ul aria-label="Saved on this device" className="grid gap-1">
            {saved.items.map((item) => (
              <PendingLine key={item.id} item={item} sending={offline?.state === "sending"} />
            ))}
          </ul>
        )}
        {lastPage !== null && (
          <div
            role="group"
            aria-labelledby={`${id}-ask`}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
          >
            <span id={`${id}-ask`}>That&apos;s the last page. Mark as Read?</span>
            <Button
              ref={markRef}
              type="button"
              size="sm"
              disabled={pending}
              onClick={(e) => move("READ", e.currentTarget)}
            >
              Mark as Read
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={notYet}>
              Not yet
            </Button>
          </div>
        )}
      </div>
      {/* Outside the grid so it takes no room while empty, and always
          there, so a new message is announced. */}
      <p
        aria-live="polite"
        className={cn(
          "text-sm not-empty:mt-2",
          message?.error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </p>
    </div>
  );
}

/**
 * Something saved on this device for this book: waiting to be sent, or
 * refused by the server with its reason. Either can be removed; a waiting
 * one gives its reading time back to the timer.
 */
function PendingLine({ item, sending }: { item: OutboxItem; sending: boolean }) {
  const prefs = usePreferences();
  const today = dayKey(new Date(), prefs.timeZone);
  const what =
    item.kind === "log"
      ? `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)} for ${describeDay(item.day, today, prefs.dateFormat)}`
      : item.label;
  const time = item.minutes ? ` · ${formatLength(item.minutes)}` : "";
  const Icon = item.error ? CircleAlert : CloudUpload;
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs",
        item.error ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="font-medium text-foreground">
          {what}
          {time}
        </span>
        {" · "}
        {item.error ?? (sending ? "sending…" : "waiting to be sent")}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="-my-1 -mr-1.5 shrink-0"
        aria-label={`Remove ${what}`}
        title="Remove"
        onClick={() => {
          const removed = removeFromOutbox(item.id);
          if (removed?.minutes && !removed.error) giveBackTime(removed.bookId, removed.minutes);
        }}
      >
        <X />
      </Button>
    </li>
  );
}
