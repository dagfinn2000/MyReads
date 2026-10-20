"use client";

import { useEffect, useId, useRef } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Elements by key, and which of them to focus once the next render lands.
 * Moving a row up or down re-renders the list, and React moving (or reusing)
 * the row's node drops or strands keyboard focus, so a move asks for the
 * arrow just pressed, or the row's other arrow when that one is now
 * disabled at the end of the list.
 */
export function useRefocus() {
  const nodes = useRef(new Map<string, HTMLElement>());
  const wanted = useRef<string[] | null>(null);

  useEffect(() => {
    const keys = wanted.current;
    if (!keys) return;
    wanted.current = null;
    for (const key of keys) {
      const el = nodes.current.get(key);
      if (el && !(el instanceof HTMLButtonElement && el.disabled)) {
        el.focus();
        return;
      }
    }
  });

  return {
    ref: (key: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
    /** The first of these that can take focus gets it after the next render. */
    focusAfter: (...keys: string[]) => {
      wanted.current = keys;
    },
  };
}

/**
 * A Preferences list to put in order: each row has a Show checkbox and up
 * and down arrows, and a row that's off is struck through. The book page's
 * cards and the top bar's links both use it. `locked` rows keep their
 * checkbox as it is, greyed out, for things this list can't turn off; the
 * reason is the box's description and the row's tooltip.
 */
export function OrderList<T extends string>({
  heading,
  order,
  labels,
  shown,
  locked,
  onShow,
  onReorder,
  children,
}: {
  heading: string;
  /** Every row, in order. */
  order: readonly T[];
  labels: Record<T, string>;
  shown: (item: T) => boolean;
  /** Why a row's checkbox can't be changed here, or undefined when it can. */
  locked?: (item: T) => string | undefined;
  onShow: (item: T, shown: boolean) => void;
  onReorder: (order: T[]) => void;
  /** Notes under the list. */
  children?: React.ReactNode;
}) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const refocus = useRefocus();

  function move(item: T, dir: "up" | "down") {
    const i = order.indexOf(item);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    refocus.focusAfter(`${item}-${dir}`, `${item}-${dir === "up" ? "down" : "up"}`);
    onReorder(next);
  }

  return (
    <div className="grid gap-1.5">
      <p id={headingId} className="text-sm font-medium">
        {heading}
      </p>
      <ul aria-labelledby={headingId} className="grid gap-1">
        {order.map((item, i) => {
          const label = labels[item];
          const on = shown(item);
          const lockedWhy = locked?.(item);
          const whyId = `${baseId}-${item}-why`;
          return (
            <li key={item} className="flex items-center gap-2">
              <label className="flex min-w-0 items-center gap-2 text-sm" title={lockedWhy}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={lockedWhy !== undefined}
                  aria-label={`Show ${label}`}
                  aria-describedby={lockedWhy ? whyId : undefined}
                  onChange={(e) => onShow(item, e.target.checked)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className={cn("truncate", !on && "text-muted-foreground line-through")}>
                  {label}
                </span>
                {lockedWhy && (
                  <span id={whyId} className="sr-only">
                    {lockedWhy}
                  </span>
                )}
              </label>
              <span className="ml-auto flex shrink-0 gap-1">
                <Button
                  ref={refocus.ref(`${item}-up`)}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${label} up`}
                  disabled={i === 0}
                  onClick={() => move(item, "up")}
                >
                  <ArrowUp data-slot="icon" />
                </Button>
                <Button
                  ref={refocus.ref(`${item}-down`)}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${label} down`}
                  disabled={i === order.length - 1}
                  onClick={() => move(item, "down")}
                >
                  <ArrowDown data-slot="icon" />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      {children}
    </div>
  );
}
