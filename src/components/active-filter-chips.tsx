"use client";

import { useEffect, useRef, type RefObject } from "react";
import { X } from "lucide-react";
import type { FilterChip } from "@/lib/library-filters";
import { Button } from "@/components/ui/button";

/**
 * The filters in play that have no control of their own on the bar (author,
 * tags in or out, year, rating, missing detail, series), one removable chip
 * each, plus "Clear all" when there are several. Nothing at all when none.
 *
 * Removing a chip re-renders the bar from the server, so the button that
 * had focus is gone: focus moves to the chip that took its place, or to
 * `fallbackFocus` when no chips are left.
 */
export function ActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
  fallbackFocus,
}: {
  chips: FilterChip[];
  onRemove: (chip: FilterChip) => void;
  onClearAll: () => void;
  fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  /** Where focus goes once the chips change: the removed chip's place. */
  const pendingFocus = useRef<number | null>(null);
  const chipKey = chips.map((c) => c.id).join("\n");

  useEffect(() => {
    const i = pendingFocus.current;
    if (i === null) return;
    pendingFocus.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-chip]");
    if (buttons && buttons.length > 0) buttons[Math.min(i, buttons.length - 1)].focus();
    else fallbackFocus.current?.focus();
  }, [chipKey, fallbackFocus]);

  if (chips.length === 0) return null;

  return (
    <div
      ref={listRef}
      role="group"
      aria-label="Active filters"
      className="flex w-full flex-wrap items-center gap-2"
    >
      {chips.map((chip, i) => (
        <button
          key={chip.id}
          type="button"
          data-chip
          onClick={() => {
            pendingFocus.current = i;
            onRemove(chip);
          }}
          aria-label={`Remove ${chip.label}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm"
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <X className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
      ))}
      {chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            pendingFocus.current = 0;
            onClearAll();
          }}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
