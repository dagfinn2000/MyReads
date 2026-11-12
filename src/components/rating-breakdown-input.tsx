"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RATING_ASPECTS,
  hasAspectRatings,
  shortRating,
  type AspectRatings,
} from "@/lib/rating-breakdown";
import { usePreferences } from "@/components/preferences-provider";
import { StarRatingInput } from "@/components/star-rating-input";

/**
 * The plot, characters and writing on the reading card, under the book's
 * own rating (lib/rating-breakdown.ts). Folded away behind one line until
 * the reader opens it, and open from the start once any of them is rated.
 * Folded, it still sends its values, so saving leaves them as they are.
 *
 * Nothing is drawn with ratings or the breakdown switched off: the form
 * then sends none of the three, and the save keeps what the book has.
 */
export function RatingBreakdownInput({ book }: { book: AspectRatings }) {
  const { ratingStyle, ratingBreakdown } = usePreferences();
  const [open, setOpen] = useState(() => hasAspectRatings(book));
  const id = useId();
  if (ratingStyle === "off" || !ratingBreakdown) return null;

  // Folded with something rated, the line says what: "Plot 4 · Writing 5".
  const summary = RATING_ASPECTS.flatMap(({ key, label }) => {
    const v = book[key];
    return v ? [`${label} ${shortRating(v, ratingStyle)}`] : [];
  }).join(" · ");

  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-ml-1 flex w-fit items-center gap-1 rounded-sm px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronRight
          className={cn("size-4 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        {open || !summary ? "Plot, characters and writing" : summary}
      </button>
      <div id={id} hidden={!open} className="flex flex-wrap gap-x-8 gap-y-3 pl-5">
        {RATING_ASPECTS.map(({ key, label }) => (
          <div key={key} role="group" aria-label={label} className="grid gap-1.5">
            <span className="text-sm font-medium" aria-hidden="true">
              {label}
            </span>
            <StarRatingInput name={key} defaultValue={book[key] ?? 0} label={label} small />
          </div>
        ))}
      </div>
    </div>
  );
}
