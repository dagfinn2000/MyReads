"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  fallbackHint,
  formatDuration,
  pageToPercent,
  parseBoxText,
  parseUnitText,
  positionText,
  type UnitInfo,
} from "@/lib/progress-units";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The progress box in the book's own unit: a page number, a percent, or
 * time listened (h:mm). Controlled: the caller keeps the text, so the step
 * buttons and a reset after logging are plain state changes, and the box
 * never remounts under a keyboard user. Whatever the unit, what gets saved
 * is a page (see lib/progress-units.ts).
 *
 * Split in two so the quick-log row can keep the box inline and put the
 * notes (an error, "Saves as page N", a hint) under the whole row:
 * ProgressField is the box and its suffix, ProgressNotes the lines under it.
 * Both take the same `id`.
 */

/** What the box is called: "Page" in the quick row, "Current page" in the
 *  reading form, "Progress" for percent, "Listened" for time. */
export function unitLabel(info: UnitInfo, form = false): string {
  if (info.unit === "percent") return "Progress";
  if (info.unit === "time") return "Listened";
  return form ? "Current page" : "Page";
}

function suffixText(page: number | null, info: UnitInfo, compact: boolean): string | null {
  if (info.unit === "percent") return "%";
  const count = info.pageCount;
  if (count == null) return null;
  const pct = page != null ? ` · ${pageToPercent(page, count)}%` : "";
  if (info.unit === "time") {
    return `of ${formatDuration(info.lengthMinutes!)}${compact ? "" : pct}`;
  }
  return compact ? null : `of ${count}${pct}`;
}

export function ProgressField({
  id,
  info,
  text,
  onTextChange,
  inputRef,
  compact = false,
  ariaLabel,
}: {
  id: string;
  info: UnitInfo;
  text: string;
  onTextChange: (text: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** The quick row: no "of 412 · 51%" (the figure above says it). */
  compact?: boolean;
  /** For a box without a visible label. */
  ariaLabel?: string;
}) {
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const parsed = parseUnitText(text, info);
  const error = parsed && "error" in parsed ? parsed.error : null;
  const page = parsed && "page" in parsed ? parsed.page : null;
  const suffix = suffixText(page, info, compact);

  // An invalid box blocks the reading form's Save rather than letting it
  // send an empty page, which would clear the progress.
  useEffect(() => {
    ref.current?.setCustomValidity(error ?? "");
  }, [ref, error]);

  const describedBy = [suffix && `${id}-of`, `${id}-notes`].filter(Boolean).join(" ");
  const common = {
    id,
    ref,
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onTextChange(e.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-label": ariaLabel,
    autoComplete: "off",
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      {info.unit === "time" ? (
        <Input {...common} type="text" inputMode="decimal" placeholder="h:mm" className="w-20" />
      ) : info.unit === "percent" ? (
        <Input {...common} type="number" inputMode="numeric" min={0} max={100} step={1} className="w-16" />
      ) : (
        <Input
          {...common}
          type="number"
          inputMode="numeric"
          min={0}
          max={info.pageCount ?? 100000}
          className="w-20"
        />
      )}
      {suffix && (
        <span id={`${id}-of`} className="text-sm text-muted-foreground tabular-nums">
          {suffix}
        </span>
      )}
    </span>
  );
}

/** The lines under a progress box: why the text can't be saved, the page it
 *  is saved as (percent and time), and a hint when the chosen unit needs
 *  something the book doesn't have yet. */
export function ProgressNotes({
  id,
  info,
  text,
  bookId,
  showSaved = true,
  className,
}: {
  id: string;
  info: UnitInfo;
  text: string;
  bookId: string;
  /** Off while the box just shows where the book is. */
  showSaved?: boolean;
  className?: string;
}) {
  const parsed = parseUnitText(text, info);
  const hint = fallbackHint(info);
  let note: React.ReactNode = null;
  if (parsed && "error" in parsed) {
    note = <p className="text-destructive">{parsed.error}</p>;
  } else if (parsed && info.unit !== "page" && showSaved) {
    note = (
      <p className="text-muted-foreground tabular-nums">
        Saves as page {parsed.page} of {info.pageCount}.
      </p>
    );
  }
  return (
    <div id={`${id}-notes`} className={cn("grid gap-0.5 text-xs empty:hidden", className)}>
      {note}
      {hint && (
        <p className="text-muted-foreground">
          {hint.before}
          <Link href={`/books/${bookId}/edit`} className="underline underline-offset-2 hover:text-foreground">
            Edit page
          </Link>
          {hint.after}
        </p>
      )}
    </div>
  );
}

/**
 * The reading form's progress field, for any status but Currently Reading
 * (which logs through the quick row instead). The page goes to the server
 * in a hidden field; the box itself has no name.
 */
export function CurrentPageField({
  bookId,
  info,
  initialPage,
}: {
  bookId: string;
  info: UnitInfo;
  initialPage: number | null;
}) {
  const [text, setText] = useState(() => positionText(initialPage, info));
  // Untouched, the box saves the page it was given (not 42% turned back
  // into a page), so saving a rating never moves progress.
  const edited = text !== positionText(initialPage, info);
  const parsed = parseBoxText(text, info, initialPage);
  const page = parsed && "page" in parsed ? parsed.page : null;
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor="currentPage">{unitLabel(info, true)}</Label>
      <ProgressField id="currentPage" info={info} text={text} onTextChange={setText} />
      <input type="hidden" name="currentPage" value={page ?? ""} />
      <ProgressNotes
        id="currentPage"
        info={info}
        text={text}
        bookId={bookId}
        showSaved={edited}
        className="max-w-56"
      />
    </div>
  );
}
