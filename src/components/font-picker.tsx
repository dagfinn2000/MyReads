"use client";

import { Select as SelectPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";
import {
  FONT_KINDS,
  FONT_KIND_LABELS,
  fontById,
  fontFamily,
  fontsFor,
  type FontSlot,
} from "@/lib/fonts";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A face for the app's text, headings or long text (Preferences › Text): a
 * list of every face the slot offers, grouped by kind, each name set in its
 * own face so the list is its own sample. The list is only drawn once it's
 * opened (or focused), since drawing it fetches every face in it.
 */
export function FontChoice({
  slot,
  label,
  hint,
  themeLabel,
  value,
  onChange,
}: {
  slot: FontSlot;
  label: string;
  hint?: string;
  /** What "theme" is called in this slot. */
  themeLabel: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const fonts = fontsFor(slot);
  const chosen = fontById(value);
  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Select lazyList value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-72" aria-label={label}>
          <SelectValue>
            {chosen ? <span style={{ fontFamily: fontFamily(chosen) }}>{chosen.name}</span> : themeLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[min(28rem,var(--radix-select-content-available-height))]">
          <SelectGroup>
            <FontItem value="theme" name={themeLabel} />
          </SelectGroup>
          {FONT_KINDS.map((kind) => {
            const ofKind = fonts.filter((f) => f.kind === kind);
            if (ofKind.length === 0) return null;
            return (
              <SelectGroup key={kind}>
                <SelectSeparator />
                <SelectLabel>{FONT_KIND_LABELS[kind]}</SelectLabel>
                {ofKind.map((f) => (
                  <FontItem key={f.id} value={f.id} name={f.name} note={f.note} family={fontFamily(f)} />
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One face in the list: its name in itself, and a note on it in the app's
 *  own face, which stays out of the button once it's picked. */
function FontItem({
  value,
  name,
  note,
  family,
}: {
  value: string;
  name: string;
  note?: string;
  family?: string;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-baseline gap-2 rounded-md py-1.5 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground",
      )}
    >
      <span className="pointer-events-none absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <span className="text-[0.9375rem] leading-snug" style={family ? { fontFamily: family } : undefined}>
        <SelectPrimitive.ItemText>{name}</SelectPrimitive.ItemText>
      </span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </SelectPrimitive.Item>
  );
}

/** A few lines in the faces picked, as the page will set them: a heading,
 *  a passage of long text, and the app's own small words. */
export function FontPreview() {
  return (
    <figure
      aria-label="How the faces look together"
      className="grid max-w-xl gap-1.5 rounded-lg border bg-background/60 px-4 py-3 sm:ml-[15rem]"
    >
      <p className="font-heading text-lg font-semibold leading-tight">Pride and Prejudice</p>
      <p className="text-xs text-muted-foreground">Jane Austen · 1813 · 432 pages</p>
      <blockquote className="long-text border-l-2 border-primary/50 pl-3 text-sm leading-relaxed">
        It is a truth universally acknowledged, that a single man in possession of a good
        fortune, must be in want of a wife.
      </blockquote>
    </figure>
  );
}
