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

/** A row of round colour buttons, smaller when there are lots. An option
 *  called "style" keeps the house style's own colour, or whatever
 *  `styleText` says it keeps. */
export function Swatches<T extends string>({
  label,
  hint,
  value,
  options,
  swatches,
  labels,
  styleText = "Style's own",
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly T[];
  swatches: Record<string, string>;
  labels: Record<string, string>;
  styleText?: string;
  onChange: (value: T) => void;
}) {
  const small = options.length > 15;
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
              small ? "h-6" : "h-7",
              "rounded-full border-2 border-background ring-1 ring-border transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              o === "style" ? "bg-muted px-2.5 text-xs" : small ? "w-6" : "w-7",
              value === o && "ring-2 ring-foreground",
            )}
            style={o === "style" ? undefined : { background: swatches[o] }}
          >
            {o === "style" ? styleText : null}
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
  tall = false,
  onPick,
  children,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  labels: Record<string, string>;
  chosen: (o: T) => boolean;
  multiple?: boolean;
  /** Twice as tall, for a whole figure. */
  tall?: boolean;
  onPick: (o: T) => void;
  /** The picture on each tile. */
  children: (o: T) => React.ReactNode;
}) {
  return (
    <Row label={label} hint={hint}>
      <div
        role={multiple ? "group" : "radiogroup"}
        aria-label={label}
        className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] items-start gap-1.5"
      >
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
              className="group grid justify-items-center gap-1.5 rounded-lg text-[11px] leading-tight text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "room-scene room-avatar-tile grid w-14 place-items-center items-end overflow-hidden rounded-md border ring-offset-2 ring-offset-card transition-shadow group-hover:border-ring/60",
                  tall ? "h-24" : "h-14",
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

/** Small tabs within a part of the panel, each opening a panel `${id}-${tab}`.
 *  The arrow keys, Home and End move between them. */
export function SubTabs<T extends string>({
  id,
  label,
  tabs,
  value,
  onChange,
}: {
  id: string;
  label: string;
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const go = (i: number) => {
    const next = tabs[(i + tabs.length) % tabs.length].value;
    onChange(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {tabs.map((t, i) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          id={`${id}-tab-${t.value}`}
          aria-selected={value === t.value}
          aria-controls={`${id}-${t.value}`}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const to =
              e.key === "ArrowLeft"
                ? i - 1
                : e.key === "ArrowRight"
                  ? i + 1
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? tabs.length - 1
                      : null;
            if (to === null) return;
            e.preventDefault();
            go(to);
          }}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            value === t.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
