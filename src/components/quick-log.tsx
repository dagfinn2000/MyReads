"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { BookFormat } from "@prisma/client";
import { logPage, moveFromReading } from "@/lib/actions/progress";
import { celebrate } from "@/lib/confetti";
import { calendarDay, dayKey, shiftDayKey } from "@/lib/dates";
import {
  addStep,
  formatPosition,
  pageToUnit,
  parseBoxText,
  positionText,
  stepsFor,
  unitFor,
  type ProgressUnit,
} from "@/lib/progress-units";
import { recentDays, type MoveResult } from "@/lib/reading-log";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";
import { ProgressField, ProgressNotes, unitLabel } from "@/components/progress-input";
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
 * finished.
 *
 * Its own form, outside the reading card's, so Enter in the box logs and
 * none of these buttons can submit the reading form.
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

  const text = draft ?? positionText(book.currentPage, info);
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
    const parsed = parseBoxText(text, info, book.currentPage);
    if (!parsed) return fail(EMPTY[info.unit]);
    if ("error" in parsed) return fail(parsed.error);
    if (parsed.page < 1) return fail(AT_LEAST[info.unit]);
    const when = day === "other" ? otherDay : day;
    if (!when) return fail("Pick a day.");
    // A percent or a minute can be less than a page; say so instead of
    // "Already at", which would read as if nothing was typed.
    if (
      when === "today" &&
      draft !== null &&
      book.currentPage != null &&
      info.unit !== "page" &&
      parsed.page === book.currentPage &&
      parsed.value !== pageToUnit(book.currentPage, info)
    ) {
      return fail(`That's still page ${parsed.page} of ${info.pageCount}. Log a little further.`);
    }

    startTransition(async () => {
      const result = await logPage(book.id, { page: parsed.page, day: when, value: parsed.value });
      if ("error" in result) return fail(result.error);
      setDraft(null);
      setDay("today");
      if (result.lastPage) {
        setMessage(null);
        setLastPage(result.page);
      } else {
        setMessage({ text: result.message, error: false });
      }
    });
  }

  function move(to: "READ" | "DNF", origin: HTMLElement) {
    setMessage(null);
    startTransition(async () => {
      const result = await moveFromReading(book.id, to);
      if ("error" in result) return fail(result.error);
      // Before the row goes away with the move.
      if (result.finished) celebrate(origin);
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
              onClick={() => setDraft(addStep(text, s.amount, book.currentPage, info))}
            >
              {s.label}
            </Button>
          ))}
          {days.length > 1 && (
            <Select
              value={day}
              onValueChange={(v) => {
                setDay(v);
                if (v === "other" && !otherDay) setOtherDay(shiftDayKey(today, -4));
              }}
            >
              <SelectTrigger aria-label="Which day">
                <SelectValue />
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
          showSaved={text !== positionText(book.currentPage, info)}
        />
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
