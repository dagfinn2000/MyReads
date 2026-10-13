"use client";

import { cn } from "@/lib/utils";

/** The controls of the Decorate panel on the Room page (room-view.tsx,
 *  avatar-maker.tsx). */

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

/** A labelled row of controls: the label to the left on wider screens. */
export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** A row of round colour buttons. An option called "style" keeps the house
 *  style's own colour. */
export function Swatches<T extends string>({
  label,
  hint,
  value,
  options,
  swatches,
  labels,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly T[];
  swatches: Record<string, string>;
  labels: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            aria-label={labels[o] ?? o}
            title={labels[o] ?? o}
            onClick={() => onChange(o)}
            className={cn(
              "h-7 rounded-full border-2 border-background ring-1 ring-border transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              o === "style" ? "bg-muted px-2.5 text-xs" : "w-7",
              value === o && "ring-2 ring-foreground",
            )}
            style={o === "style" ? undefined : { background: swatches[o] }}
          >
            {o === "style" ? "Style's own" : null}
          </button>
        ))}
      </div>
    </Row>
  );
}

/** Square picture buttons, one of which is chosen (radio) or each of which
 *  is on or off (checkbox). */
export function Tiles<T extends string>({
  label,
  hint,
  options,
  labels,
  chosen,
  multiple = false,
  onPick,
  children,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  labels: Record<string, string>;
  chosen: (o: T) => boolean;
  multiple?: boolean;
  onPick: (o: T) => void;
  /** The picture on each tile. */
  children: (o: T) => React.ReactNode;
}) {
  return (
    <Row label={label} hint={hint}>
      <div role={multiple ? "group" : "radiogroup"} aria-label={label} className="flex flex-wrap items-start gap-1.5">
        {options.map((o) => {
          const on = chosen(o);
          return (
            <button
              key={o}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={on}
              title={labels[o] ?? o}
              onClick={() => onPick(o)}
              className="group grid w-14 justify-items-center gap-1.5 rounded-lg text-[11px] leading-tight text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "room-scene room-avatar-tile grid size-14 place-items-center items-end overflow-hidden rounded-md border ring-offset-2 ring-offset-card transition-shadow group-hover:border-ring/60",
                  on && "ring-2 ring-foreground",
                )}
              >
                {children(o)}
              </span>
              <span className={cn("text-center", on && "font-medium text-foreground")}>{labels[o] ?? o}</span>
            </button>
          );
        })}
      </div>
    </Row>
  );
}
