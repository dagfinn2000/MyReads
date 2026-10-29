"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { spriteIconHtml } from "@/components/icon-sprite";
import { usePreferences } from "@/components/preferences-provider";

/** A row of five stars' markup for each size and fill, made once. */
const ROWS = new Map<string, { __html: string }>();

/**
 * Five stars in a row. Ten stars per rating add up on a page of books, so
 * these are sprite icons (components/icon-sprite.tsx), handed over as
 * markup: as components each row was six of them and ten elements for
 * React to build one by one, some 860 components on a library of rated
 * books. Called as a function, not drawn as a component, for the same
 * reason; it keeps no state.
 *
 * w-max + shrink-0 keep the row at its natural width inside the clipping
 * container — without them the filled row's stars shrink to fit the
 * clipped width instead of being cut off, drifting out of alignment with
 * the outline row underneath.
 */
function starRow(sizeClass: string, filled = false) {
  const key = `${sizeClass}\n${filled}`;
  let html = ROWS.get(key);
  if (!html) {
    const icon = spriteIconHtml("star", cn(sizeClass, "shrink-0", filled && "fill-current"));
    ROWS.set(key, (html = { __html: icon.repeat(5) }));
  }
  return <div className="flex w-max" dangerouslySetInnerHTML={html} />;
}

/**
 * A rating shown the way the reader chose in Preferences: stars, "7/10", or
 * nothing at all when ratings are switched off. `value` is the stored 1–10.
 */
export function Stars(props: {
  value: number;
  size?: "sm" | "lg";
  className?: string;
  starClassName?: string;
}) {
  const { ratingStyle } = usePreferences();
  if (ratingStyle === "off") return null;
  if (ratingStyle === "ten") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 tabular-nums",
          props.size === "lg" ? "text-base" : "text-xs",
          props.className,
        )}
        role="img"
        aria-label={`${props.value} out of 10`}
      >
        <Star
          className={cn(
            props.size === "lg" ? "size-5" : "size-3.5",
            "fill-current text-amber-500",
          )}
        />
        {props.value}/10
      </span>
    );
  }
  return <StarGraphic {...props} />;
}

/**
 * Read-only star display with half-star precision.
 * `value` is in half-star units (0–10); rendered by clipping a filled star
 * row to `value * 10%` width over a muted outline row — the stars are laid
 * out gap-free so the percentage maps exactly onto half stars.
 */
export function StarGraphic({
  value,
  size = "sm",
  className,
  starClassName,
}: {
  value: number;
  size?: "sm" | "lg";
  className?: string;
  /** Overrides the size preset — lets the rating input use responsive
   *  star sizes (bigger touch targets on phones) without a new preset. */
  starClassName?: string;
}) {
  const sizeClass = starClassName ?? (size === "lg" ? "size-6" : "size-4");
  return (
    <div
      className={cn("relative inline-flex text-muted-foreground/30", className)}
      role="img"
      aria-label={`${value / 2} out of 5 stars`}
    >
      {starRow(sizeClass)}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden text-amber-500"
        style={{ width: `${value * 10}%` }}
      >
        {starRow(sizeClass, true)}
      </div>
    </div>
  );
}
