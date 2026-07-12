"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";

/**
 * Interactive 1–5 star rating input with half-star steps.
 *
 * Renders a Stars display with ten invisible half-star hitboxes on top;
 * hovering previews, clicking commits. The chosen value (half-star units,
 * 0 = unrated) is submitted through a hidden input so the surrounding form
 * can stay a plain <form action={…}>.
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

  const preview = hover ?? value;

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <div
        className="relative w-fit cursor-pointer"
        onMouseLeave={() => setHover(null)}
      >
        <Stars value={preview} size="lg" />
        {/* ten half-star hitboxes */}
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
              onClick={() => setValue(i + 1)}
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
