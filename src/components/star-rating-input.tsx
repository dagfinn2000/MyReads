"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { motionAllowed } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";
import { StarGraphic } from "@/components/stars";
import { Button } from "@/components/ui/button";

/** A quick bounce when a rating is picked. Skipped when animations are off. */
function pop(el: Element | null | undefined) {
  if (!el || !motionAllowed()) return;
  el.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
    { duration: 320, easing: "cubic-bezier(0.3, 1.6, 0.5, 1)" },
  );
}

/**
 * Interactive 1–5 star rating input with half-star steps.
 *
 * Three ways to pick a value:
 *  - click a half-star hitbox (hovering previews, clicking commits),
 *  - scrub: press or touch anywhere on the stars and drag — the value
 *    tracks the pointer with live preview and commits on release, which is
 *    what makes half-star precision workable on a phone,
 *  - keyboard: the ten hitboxes are focusable buttons.
 *
 * The chosen value (half-star units, 0 = unrated) is submitted through a
 * hidden input so the surrounding form can stay a plain <form action={…}>.
 * Stars render larger below the sm breakpoint — a roomier first touch.
 *
 * Follows the rating style in Preferences: whole stars only (steps of 2),
 * a row of 1–10 buttons, or — with ratings switched off — just the hidden
 * input, so saving the form keeps whatever rating the book already had.
 */
export function StarRatingInput({
  name,
  defaultValue = 0,
}: {
  name: string;
  defaultValue?: number;
}) {
  const { ratingStyle } = usePreferences();
  if (ratingStyle === "off") return <input type="hidden" name={name} value={defaultValue} />;
  if (ratingStyle === "ten") return <TenPointInput name={name} defaultValue={defaultValue} />;
  return (
    <StarInput name={name} defaultValue={defaultValue} whole={ratingStyle === "whole"} />
  );
}

function StarInput({
  name,
  defaultValue,
  whole,
}: {
  name: string;
  defaultValue: number;
  /** Whole stars only: every value is even. */
  whole: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  // Pointer capture retargets the post-gesture click to the row, but some
  // browsers still deliver it to the hitbox under the finger — swallow it
  // so a scrub isn't followed by a stray button commit.
  const suppressClick = useRef(false);

  const preview = hover ?? value;

  const steps = whole ? 5 : 10;
  const unit = 10 / steps; // half-star units per hitbox

  /** Pointer x → value 1–10 (clamped; can't scrub to 0), whole stars
   *  rounding up to the next even value. */
  function valueAt(clientX: number): number {
    const rect = rowRef.current!.getBoundingClientRect();
    const fraction = (clientX - rect.left) / rect.width;
    return Math.min(10, Math.max(unit, Math.ceil(fraction * steps) * unit));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    scrubbing.current = true;
    try {
      rowRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail if the pointer is already gone (or in synthetic
      // event dispatch); scrubbing still works, just without retargeting.
    }
    setHover(valueAt(e.clientX));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!scrubbing.current) return;
    setHover(valueAt(e.clientX));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    setValue(valueAt(e.clientX));
    setHover(null);
    pop(rowRef.current);
  }

  function onPointerCancel() {
    // The browser claimed the gesture (it became a vertical page scroll,
    // thanks to touch-pan-y) — drop the preview without committing.
    scrubbing.current = false;
    setHover(null);
  }

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <div
        ref={rowRef}
        // touch-pan-y: vertical swipes still scroll the page; horizontal
        // movement belongs to the scrub.
        className="relative w-fit cursor-pointer select-none touch-pan-y"
        onMouseLeave={() => setHover(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <StarGraphic value={preview} starClassName="size-8 sm:size-6" />
        {/* one hitbox per step — half stars, or whole ones (keyboard
            access + hover preview) */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: steps }, (_, i) => {
            const v = (i + 1) * unit;
            return (
              <button
                key={i}
                type="button"
                className={whole ? "h-full w-[20%]" : "h-full w-[10%]"}
                aria-label={`${v / 2} stars`}
                onMouseEnter={() => setHover(v)}
                onFocus={() => setHover(v)}
                onBlur={() => setHover(null)}
                onClick={() => {
                  if (suppressClick.current) return;
                  setValue(v);
                  pop(rowRef.current);
                }}
              />
            );
          })}
        </div>
      </div>
      <span className="w-8 text-sm text-muted-foreground tabular-nums">
        {preview > 0 ? preview / 2 : "–"}
      </span>
      {value > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Clear rating"
          onClick={() => setValue(0)}
        >
          <X data-slot="icon" />
        </Button>
      )}
    </div>
  );
}

/** "Out of 10": ten numbered buttons, the chosen one highlighted. */
function TenPointInput({ name, defaultValue }: { name: string; defaultValue: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input type="hidden" name={name} value={value} />
      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          aria-label={`${v} out of 10`}
          onClick={(e) => {
            setValue(v);
            pop(e.currentTarget);
          }}
          className={cn(
            "size-8 rounded-md border text-sm tabular-nums transition-colors hover:border-ring/60 sm:size-7",
            value === v && "border-primary bg-primary text-primary-foreground",
            value > v && "bg-muted",
          )}
        >
          {v}
        </button>
      ))}
      {value > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Clear rating"
          onClick={() => setValue(0)}
        >
          <X data-slot="icon" />
        </Button>
      )}
    </div>
  );
}
