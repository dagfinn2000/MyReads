"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { descriptionMayOverflow } from "@/lib/book-page";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A book's description cut to its first four lines, with a More button when
 * there is more (Preferences > Book page). The cut is only visual, so a
 * screen reader still reads the whole text. Whether it runs over is guessed
 * on the server, so a long description has its button from the first paint,
 * then measured, and measured again when the width changes.
 */
export function BookDescription({ text }: { text: string }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(() => descriptionMayOverflow(text));

  // Only while cut: opened up, it never overflows, and the button must stay.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded || typeof ResizeObserver === "undefined") return;
    // Fires once on observe, then on every resize.
    const observer = new ResizeObserver(() => {
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div className="grid grid-cols-1 gap-1">
      {/* break-words: imported descriptions can contain long raw URLs,
          which would otherwise refuse to wrap and overflow on phones. */}
      <p
        ref={ref}
        id={id}
        className={cn(
          "long-text max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground",
          !expanded && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto justify-self-start p-0"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Less" : "More"}
        </Button>
      )}
    </div>
  );
}
