"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { BookFormat, ProgressEntry } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteProgressEntry, updateProgressEntry } from "@/lib/actions/progress";
import { calendarDay, dayKey } from "@/lib/dates";
import { formatDate } from "@/lib/display";
import { chartPaceText } from "@/lib/pace";
import { currentPassEntries } from "@/lib/progress";
import {
  formatPosition,
  parseBoxText,
  positionText,
  unitFor,
  type UnitInfo,
} from "@/lib/progress-units";
import { subjectDay } from "@/lib/reading-log";
import { usePreferences } from "@/components/preferences-provider";
import { ProgressField, ProgressNotes, unitLabel } from "@/components/progress-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Sparkline of the current reading pass — page position over time — with a
 * pace line under it: a pace in the book's unit plus a finish forecast while
 * the book is being read (from the whole read or recent days, as set in
 * Preferences), or the retrospective pace once it's finished. Pure display;
 * the reading card shows it above its form.
 */
export function ProgressChart({
  entries,
  status,
  info,
}: {
  entries: Pick<ProgressEntry, "page" | "date">[];
  status: ReadingStatus;
  info: UnitInfo;
}) {
  const prefs = usePreferences();
  if (entries.length < 2) return null;
  const first = entries[0];
  const last = entries[entries.length - 1];

  // Geometry: x spans first→last entry, y spans 0→page count (or the
  // highest logged page when the count is unknown). Positions are pages in
  // every unit, so percent and time draw the same curve.
  const W = 300;
  const H = 60;
  const PAD = 3;
  const maxPage = Math.max(info.pageCount ?? 0, ...entries.map((e) => e.page)) || 1;
  const spanX = Math.max(last.date.getTime() - first.date.getTime(), 1);
  const points = entries.map((e) => {
    const x = PAD + ((e.date.getTime() - first.date.getTime()) / spanX) * (W - 2 * PAD);
    const y = H - PAD - (e.page / maxPage) * (H - 2 * PAD);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastXY = points[points.length - 1].split(",");

  const paceText = chartPaceText({
    status,
    pass: entries,
    info,
    from: prefs.paceFrom,
    now: new Date(),
    prefs,
  });

  return (
    <div className="grid max-w-sm gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Reading progress over time"
      >
        <polygon
          points={`${PAD},${H - PAD} ${points.join(" ")} ${lastXY[0]},${H - PAD}`}
          className="fill-primary/15"
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-primary"
        />
        <circle cx={lastXY[0]} cy={lastXY[1]} r={3} className="fill-primary" />
      </svg>
      {paceText && (
        <p className="text-xs text-muted-foreground tabular-nums">{paceText}</p>
      )}
    </div>
  );
}

/** What the log needs to know about its book. */
export interface LogBook {
  id: string;
  status: ReadingStatus;
  format: BookFormat;
  pageCount: number | null;
  lengthMinutes: number | null;
  dateStarted: Date | null;
}

type LogEntry = Pick<ProgressEntry, "id" | "page" | "date">;

/**
 * The raw reading log, collapsed by default: every logged position, newest
 * first, in the book's unit. Each entry has a pencil to fix its page or day
 * and a delete button; deleting the newest entry of the read in progress
 * moves the book's page back with it. A read's "Started" anchor has
 * neither, since the read's pages are counted from it.
 *
 * Opens by itself when the address ends in #progress-log (the "Full log"
 * link on Now reading).
 */
export function ProgressLog({ entries, book }: { entries: LogEntry[]; book: LogBook }) {
  const prefs = usePreferences();
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#progress-log" && ref.current) ref.current.open = true;
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  if (entries.length === 0) return null;
  const info = unitFor(book, prefs);
  const newestFirst = [...entries].reverse();

  return (
    <details ref={ref} id="progress-log" className="scroll-mt-20">
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        Progress log ({entries.length}{" "}
        {entries.length === 1 ? "entry" : "entries"})
      </summary>
      <ul className="grid gap-1 pt-2">
        {newestFirst.map((e) => {
          const date = formatDate(e.date, prefs);
          return (
            <EntryRow
              key={e.id}
              entry={e}
              book={book}
              info={info}
              dayLabel={date}
              label={e.page === 0 ? "Started" : formatPosition(e.page, info, { capital: true })}
              layout="log"
            />
          );
        })}
      </ul>
    </details>
  );
}

/**
 * The last few entries of the read in progress, newest first, each with the
 * pencil: the short log on a Now reading row.
 */
export function RecentEntries({
  entries,
  book,
  limit = 3,
}: {
  entries: LogEntry[]; // the whole log, oldest first
  book: LogBook;
  limit?: number;
}) {
  const prefs = usePreferences();
  const info = unitFor(book, prefs);
  const today = dayKey(new Date(), prefs.timeZone);
  const recent = currentPassEntries(entries, book.dateStarted, prefs.timeZone)
    .filter((e) => e.page > 0)
    .slice(-limit)
    .reverse();
  if (recent.length === 0) return null;

  return (
    <ul aria-label="Recent entries" className="grid gap-0.5 text-sm">
      {recent.map((e) => (
        <EntryRow
          key={e.id}
          entry={e}
          book={book}
          info={info}
          dayLabel={subjectDay(calendarDay(e.date, prefs.timeZone), today, prefs.dateFormat)}
          label={formatPosition(e.page, info)}
          layout="recent"
        />
      ))}
    </ul>
  );
}

/** One log entry: its position and day, the pencil that turns the row into
 *  an editor, and (in the full log) delete. */
function EntryRow({
  entry,
  book,
  info,
  dayLabel,
  label,
  layout,
}: {
  entry: LogEntry;
  book: LogBook;
  info: UnitInfo;
  dayLabel: string;
  label: string;
  layout: "log" | "recent";
}) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // Focus back on the pencil when the editor closes.
  useEffect(() => {
    if (!editing && wasEditing.current) pencilRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const anchor = entry.page === 0;
  const position = (
    <span className={layout === "log" ? "w-20 shrink-0 tabular-nums" : "w-16 shrink-0 tabular-nums text-foreground"}>
      {label}
    </span>
  );
  const day = (
    <span className={layout === "log" ? "text-muted-foreground" : "w-24 shrink-0 truncate"}>{dayLabel}</span>
  );

  return (
    <li className={layout === "log" ? undefined : "text-muted-foreground"}>
      {editing ? (
        <EntryEditor
          entry={entry}
          book={book}
          info={info}
          onDone={(done) => {
            setMessage(done);
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex min-h-7 items-center gap-3">
          {layout === "log" ? (
            <>
              {position}
              {day}
            </>
          ) : (
            <>
              {day}
              {position}
            </>
          )}
          {!anchor && (
            <span className={layout === "log" ? "ml-auto flex items-center" : "flex items-center"}>
              <Button
                ref={pencilRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Fix the entry for ${dayLabel}`}
                title="Fix this entry"
                onClick={() => {
                  setMessage(null);
                  setEditing(true);
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
              {layout === "log" && <DeleteEntryButton entryId={entry.id} />}
            </span>
          )}
        </div>
      )}
      {/* Always present (and empty takes no room), so the confirmation is
          announced when it appears. */}
      <p aria-live="polite" className="text-xs text-muted-foreground not-empty:mb-1">
        {message}
      </p>
    </li>
  );
}

/** The inline editor behind the pencil: the position in the book's unit and
 *  the day. Enter saves, Escape cancels. */
function EntryEditor({
  entry,
  book,
  info,
  onDone,
}: {
  entry: LogEntry;
  book: LogBook;
  info: UnitInfo;
  /** Closes the editor, with the confirmation to show (null on cancel). */
  onDone: (message: string | null) => void;
}) {
  const prefs = usePreferences();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => positionText(entry.page, info));
  const [day, setDay] = useState(() => calendarDay(entry.date, prefs.timeZone));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = dayKey(new Date(), prefs.timeZone);
  // An entry of the read in progress can't move before its Started day.
  const startKey = book.dateStarted ? calendarDay(book.dateStarted, prefs.timeZone) : null;
  const minDay = startKey && calendarDay(entry.date, prefs.timeZone) >= startKey ? startKey : undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function save() {
    // The entry's own page while the box still shows it, so changing only
    // the day doesn't turn 42% back into a different page.
    const parsed = parseBoxText(text, info, entry.page);
    if (!parsed || "error" in parsed) return setError(parsed?.error ?? "Type where you were.");
    if (parsed.page < 1) return setError("An entry needs at least page 1.");
    if (!day) return setError("Pick a day.");
    setError(null);
    startTransition(async () => {
      const result = await updateProgressEntry(entry.id, { page: parsed.page, day, value: parsed.value });
      if (result.error) setError(result.error);
      else onDone(result.message ?? null);
    });
  }

  return (
    <div className="py-1">
      <form
        noValidate
        aria-label="Fix this entry"
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onDone(null);
          }
        }}
      >
        <ProgressField
          id={id}
          info={info}
          text={text}
          onTextChange={setText}
          inputRef={inputRef}
          ariaLabel={unitLabel(info)}
          compact
        />
        <Input
          type="date"
          aria-label="Day"
          className="w-40"
          min={minDay}
          max={today}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel"
          disabled={pending}
          onClick={() => onDone(null)}
        >
          <X className="size-3.5" />
        </Button>
      </form>
      <ProgressNotes
        id={id}
        info={info}
        text={text}
        bookId={book.id}
        showSaved={text !== positionText(entry.page, info)}
        className="mt-1"
      />
      <p aria-live="polite" className="text-xs text-destructive not-empty:mt-1">
        {error}
      </p>
    </div>
  );
}

/** Trash icon that expands to an inline confirm, same as reads and quotes. */
function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete progress entry"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteProgressEntry(entryId);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "Deleting…" : "Delete entry"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel delete"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        <X className="size-3.5" />
      </Button>
    </span>
  );
}
