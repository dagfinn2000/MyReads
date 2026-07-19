"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";

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
 */
export function StarRatingInput({
  name,
  defaultValue = 0,
}: {
  name: string;
  defaultValue?: number;
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

  /** Pointer x → half-star value 1–10 (clamped; can't scrub to 0). */
  function valueAt(clientX: number): number {
    const rect = rowRef.current!.getBoundingClientRect();
    const fraction = (clientX - rect.left) / rect.width;
    return Math.min(10, Math.max(1, Math.ceil(fraction * 10)));
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
        <Stars value={preview} starClassName="size-8 sm:size-6" />
        {/* ten half-star hitboxes (keyboard access + hover preview) */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: 10 }, (_, i) => (
            <button
              key={i}
              type="button"
              className="h-full w-[10%]"
              aria-label={`${(i + 1) / 2} stars`}
              onMouseEnter={() => setHover(i + 1)}
              onFocus={() => setHover(i + 1)}
              onBlur={() => setHover(null)}
              onClick={() => {
                if (suppressClick.current) return;
                setValue(i + 1);
              }}
            />
          ))}
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
