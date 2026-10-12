"use client";

import { useId, type Ref } from "react";
import { ChevronDown } from "lucide-react";
import { MISSING_FILTERS, MISSING_LABELS, type LibraryFilters } from "@/lib/library-filters";
import type { RatingStyle } from "@/lib/preferences";
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
 * year a book was finished, rating (including unrated) and a missing detail
 * to clean up. Each change applies straight away; the menu stays open.
 */
export function MoreFilters({
  values,
  finishedYears,
  ratingStyle,
  onChange,
  triggerRef,
  className,
}: {
  values: Pick<LibraryFilters, "finished" | "minRating" | "missing">;
  /** Newest first. */
  finishedYears: number[];
  ratingStyle: RatingStyle;
  onChange: (patch: Partial<LibraryFilters>) => void;
  /** The trigger, so focus has somewhere to go when the last chip goes. */
  triggerRef?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  const id = useId();
  const count = [values.finished, values.minRating, values.missing].filter(Boolean).length;
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
      </PopoverContent>
    </Popover>
  );
}
