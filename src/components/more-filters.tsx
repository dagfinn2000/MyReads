"use client";

import { useId, useState, type Ref } from "react";
import { ChevronDown } from "lucide-react";
import { MISSING_FILTERS, MISSING_LABELS, type LibraryFilters } from "@/lib/library-filters";
import type { RatingStyle } from "@/lib/preferences";
import {
  parseFieldFilter,
  serializeFieldFilter,
  type BookField,
  type FieldFilter,
} from "@/lib/book-fields";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Minimum-rating choices, worded in the reader's rating style. Values are
 *  the stored 1–10. */
const RATING_OPTIONS: Record<Exclude<RatingStyle, "off">, { value: string; label: string }[]> = {
  half: [
    { value: "all", label: "Any rating" },
    { value: "4", label: "≥ 2 stars" },
    { value: "6", label: "≥ 3 stars" },
    { value: "8", label: "≥ 4 stars" },
    { value: "9", label: "≥ 4.5 stars" },
    { value: "10", label: "5 stars" },
  ],
  whole: [
    { value: "all", label: "Any rating" },
    { value: "4", label: "≥ 2 stars" },
    { value: "6", label: "≥ 3 stars" },
    { value: "8", label: "≥ 4 stars" },
    { value: "10", label: "5 stars" },
  ],
  ten: [
    { value: "all", label: "Any rating" },
    { value: "5", label: "≥ 5/10" },
    { value: "6", label: "≥ 6/10" },
    { value: "7", label: "≥ 7/10" },
    { value: "8", label: "≥ 8/10" },
    { value: "9", label: "≥ 9/10" },
    { value: "10", label: "10/10" },
  ],
};

/** A minimum rating as the menu words it ("≥ 4 stars"), or out of ten when
 *  the reader's style has no such choice (or ratings are off). */
export function minRatingLabel(value: string, style: RatingStyle): string {
  if (value === "unrated") return "Unrated";
  const option = style === "off" ? undefined : RATING_OPTIONS[style].find((o) => o.value === value);
  return option?.label ?? `≥ ${value}/10`;
}

/**
 * The filters most people reach for less often, behind one button: the
 * year a book was finished, rating (including unrated), a missing detail
 * to clean up, and one of the reader's own fields. Each change applies
 * straight away; the menu stays open.
 */
export function MoreFilters({
  values,
  finishedYears,
  ratingStyle,
  fields = [],
  onChange,
  triggerRef,
  className,
}: {
  values: Pick<LibraryFilters, "finished" | "minRating" | "missing" | "field">;
  /** Newest first. */
  finishedYears: number[];
  ratingStyle: RatingStyle;
  /** The reader's own fields (lib/book-fields.ts). */
  fields?: BookField[];
  onChange: (patch: Partial<LibraryFilters>) => void;
  /** The trigger, so focus has somewhere to go when the last chip goes. */
  triggerRef?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  const id = useId();
  const count = [values.finished, values.minRating, values.missing, values.field].filter(Boolean).length;
  const rating = values.minRating || "all";
  // A filter set under another style (≥ 4.5 stars, say) still shows, so the
  // active filter is never invisible.
  const ratingOptions =
    ratingStyle === "off"
      ? []
      : [
          ...RATING_OPTIONS[ratingStyle],
          { value: "unrated", label: "Unrated" },
          ...(rating === "unrated" || RATING_OPTIONS[ratingStyle].some((o) => o.value === rating)
            ? []
            : [{ value: rating, label: minRatingLabel(rating, ratingStyle) }]),
        ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          className={cn("justify-between border-input bg-transparent font-normal", className)}
        >
          <span className="min-w-0 truncate">
            {count > 0 ? `More filters (${count})` : "More filters"}
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        aria-label="More filters"
        className="grid gap-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-finished`}>Finished in</Label>
          <Select
            value={values.finished || "any"}
            onValueChange={(v) => onChange({ finished: v === "any" ? "" : v })}
          >
            <SelectTrigger id={`${id}-finished`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any year</SelectItem>
              {finishedYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Books you finished that year, re-reads included. Uses your time zone.
          </p>
        </div>

        {ratingStyle !== "off" && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-rating`}>Rating</Label>
            <Select
              value={rating}
              onValueChange={(v) => onChange({ minRating: v === "all" ? "" : v })}
            >
              <SelectTrigger id={`${id}-rating`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ratingOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-missing`}>Missing</Label>
          <Select
            value={values.missing || "none"}
            onValueChange={(v) => onChange({ missing: v === "none" ? "" : v })}
          >
            <SelectTrigger id={`${id}-missing`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nothing</SelectItem>
              {MISSING_FILTERS.map((m) => (
                <SelectItem key={m} value={m}>
                  {MISSING_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {fields.length > 0 && (
          <FieldFilterControls
            // Fresh range boxes whenever the filter changes from elsewhere.
            key={values.field}
            value={values.field}
            fields={fields}
            onChange={(field) => onChange({ field })}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A filter on one of the reader's own fields: books with a value or
 * without one, with a given choice or yes/no, or with a number or date in
 * a range. The range applies when a box is left or Enter is pressed.
 */
function FieldFilterControls({
  value,
  fields,
  onChange,
}: {
  value: string;
  fields: BookField[];
  onChange: (field: string) => void;
}) {
  const id = useId();
  const parsed = parseFieldFilter(value);
  const field = parsed ? fields.find((f) => f.id === parsed.id) : undefined;
  const [min, setMin] = useState(parsed?.op === "range" ? parsed.min : "");
  const [max, setMax] = useState(parsed?.op === "range" ? parsed.max : "");
  // "Between…" shows its boxes before either end is typed.
  const [showRange, setShowRange] = useState(parsed?.op === "range");
  const ranged = field?.type === "number" || field?.type === "date";
  const set = (f: FieldFilter) => onChange(serializeFieldFilter(f));

  const which =
    showRange && ranged ? "range" : !parsed ? "any" : parsed.op === "is" ? `is:${parsed.value}` : parsed.op;
  const items = !field
    ? []
    : [
        { value: "any", label: "With a value" },
        { value: "none", label: "Without a value" },
        ...(field.type === "yesno"
          ? [
              { value: "is:yes", label: "Yes" },
              { value: "is:no", label: "No" },
            ]
          : field.options.map((o) => ({ value: `is:${o}`, label: o }))),
        ...(ranged ? [{ value: "range", label: field.type === "date" ? "Between dates…" : "Between…" }] : []),
      ];

  function pick(v: string) {
    if (!field) return;
    setShowRange(v === "range");
    if (v === "any" || v === "none") set({ id: field.id, op: v });
    else if (v.startsWith("is:")) set({ id: field.id, op: "is", value: v.slice(3) });
    // A range waits for its first end.
    else if (min || max) set({ id: field.id, op: "range", min, max });
  }

  function commitRange() {
    if (!field) return;
    if (min || max) set({ id: field.id, op: "range", min, max });
    else if (parsed?.op === "range") set({ id: field.id, op: "any" });
  }

  const boxProps = {
    type: field?.type === "date" ? "date" : "number",
    step: field?.type === "number" ? "any" : undefined,
    className: "min-w-0",
    onBlur: commitRange,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRange();
      }
    },
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-field`}>Your fields</Label>
      <Select
        value={field?.id ?? "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : v)}
      >
        <SelectTrigger id={`${id}-field`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Any field</SelectItem>
          {fields.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {field && (
        <Select value={which} onValueChange={pick}>
          <SelectTrigger aria-label={`Books by “${field.name}”`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {ranged && which === "range" && (
        // One end a row: two date boxes side by side don't fit the menu.
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
          <label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">
            From
          </label>
          <Input {...boxProps} id={`${id}-min`} value={min} onChange={(e) => setMin(e.target.value)} />
          <label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
            To
          </label>
          <Input {...boxProps} id={`${id}-max`} value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
      )}
    </div>
  );
}
