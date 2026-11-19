"use client";

import { useState } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { rollPlan } from "@/lib/rolling";

/**
 * Text with numbers in it ("141 of 272 · 52%") whose digits roll like a
 * counter's wheels when it changes: each digit that changed turns over to
 * its new one, upward when the number grew and downward when it fell, the
 * ones further left a moment after the ones on their right, as a carry
 * would. Digits that stayed don't move, and a new one rolls in from blank
 * (globals.css, "Rolling numbers"; lib/rolling.ts plans which roll).
 *
 * Screen readers get the text as it is. With "Logging pages" set to
 * straight away (rollingNumbers) it is simply the text; with animations off
 * the wheels are already at their new digits, since only the start of the
 * roll is animated.
 */
export function RollingNumber({ text, className }: { text: string; className?: string }) {
  const prefs = usePreferences();
  const [shown, setShown] = useState<{ text: string; from: string | null; turn: number }>({
    text,
    from: null,
    turn: 0,
  });
  if (shown.text !== text) setShown({ text, from: shown.text, turn: shown.turn + 1 });

  if (prefs.rollingNumbers === "off" || shown.from === null) {
    return <span className={className}>{text}</span>;
  }
  const plan = rollPlan(shown.from, text);
  if (!plan) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="rolling">
        {plan.map((cell, i) =>
          cell.kind === "still" ? (
            <span key={i}>{cell.char}</span>
          ) : (
            <span
              key={`${i}:${shown.turn}`}
              className="roll-wheel"
              data-dir={cell.dir}
              style={{ "--roll-delay": `${cell.delay * 45}ms` } as React.CSSProperties}
            >
              <span className="roll-sizer">{cell.char}</span>
              <span className="roll-strip">
                {cell.dir === "up" ? (
                  <>
                    <span>{cell.from || " "}</span>
                    <span>{cell.char}</span>
                  </>
                ) : (
                  <>
                    <span>{cell.char}</span>
                    <span>{cell.from || " "}</span>
                  </>
                )}
              </span>
            </span>
          ),
        )}
      </span>
    </span>
  );
}
