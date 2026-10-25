"use client";

import { useState, type KeyboardEvent } from "react";
import { THEMES, type ThemeDef } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** The groups the swatches come in, each under its heading. */
const GROUPS: { label: string; hint?: string; has: (t: ThemeDef) => boolean }[] = [
  { label: "Light", has: (t) => t.mode === "light" && !t.silly },
  { label: "Dark", has: (t) => t.mode === "dark" && !t.silly },
  { label: "Silly", hint: "not recommended", has: (t) => !!t.silly },
];

/** Moves focus to the next swatch in the arrow's direction: along the row,
 *  or to the nearest one in the row above or below. */
function move(e: KeyboardEvent<HTMLDivElement>) {
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-swatch]")];
  const at = buttons.indexOf(e.target as HTMLButtonElement);
  if (at < 0) return;
  let next: HTMLButtonElement | undefined;
  if (e.key === "ArrowLeft") next = buttons[at - 1];
  else if (e.key === "ArrowRight") next = buttons[at + 1];
  else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const from = buttons[at].getBoundingClientRect();
    const sign = e.key === "ArrowDown" ? 1 : -1;
    let best = Infinity;
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      const dy = (r.top - from.top) * sign;
      if (dy < 1) continue;
      // The nearest row first, then the nearest swatch in it.
      const score = dy * 1000 + Math.abs(r.left - from.left);
      if (score < best) {
        best = score;
        next = b;
      }
    }
  } else return;
  e.preventDefault();
  next?.focus();
}

/**
 * Themes as small round swatches, eight to a row, under Light, Dark and
 * Silly headings: the theme's page colour with its accent as a dot. Names
 * don't fit under swatches this small, so the lines above them name the
 * swatch under the pointer or the keyboard (and tell a silly one's joke),
 * and otherwise show `caption`, what's chosen now. On a phone a tap picks
 * the theme, and the lines then name it. Screen readers get each name as
 * its button's label.
 */
export function ThemeSwatches({
  themes = THEMES,
  isSelected,
  onPick,
  caption,
}: {
  themes?: ThemeDef[];
  isSelected: (t: ThemeDef) => boolean;
  onPick: (t: ThemeDef) => void;
  caption: string;
}) {
  const [shown, setShown] = useState<ThemeDef | null>(null);

  return (
    <div
      onKeyDown={move}
      onPointerLeave={() => setShown(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setShown(null);
      }}
    >
      <div className="px-0.5 leading-5">
        <p className="truncate text-sm font-medium">{shown?.name ?? caption}</p>
        <p className="truncate text-xs text-muted-foreground">
          {shown ? (
            (shown.silly ?? `${shown.mode === "light" ? "Light" : "Dark"} theme`)
          ) : (
            <>
              <span className="pointer-coarse:hidden">Point at a colour for its name</span>
              <span className="hidden pointer-coarse:inline">Tap a colour to choose it</span>
            </>
          )}
        </p>
      </div>
      {GROUPS.map((group) => {
        const members = themes.filter(group.has);
        if (members.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="mt-2 mb-1 px-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{group.label}</span>
              {group.hint && ` · ${group.hint}`}
            </p>
            <div className="grid grid-cols-8 gap-1.5">
              {members.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-swatch
                  aria-label={t.name}
                  aria-pressed={isSelected(t)}
                  onClick={() => onPick(t)}
                  onPointerEnter={() => setShown(t)}
                  onFocus={() => setShown(t)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full border border-foreground/15 ring-offset-2 ring-offset-popover outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected(t) && "ring-2 ring-primary",
                  )}
                  style={{ backgroundColor: t.swatch[0] }}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: t.swatch[1] }}
                  />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
