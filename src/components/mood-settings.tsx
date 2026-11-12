"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Preferences } from "@/lib/preferences";
import {
  BUILT_IN_MOODS,
  MAX_CUSTOM_MOODS,
  MOOD_ICONS,
  MOOD_NAME_MAX,
  allMoods,
  cleanMoodName,
  isBuiltInMood,
  type CustomMood,
  type MoodIcon as MoodIconName,
} from "@/lib/moods";
import { STATUS_COLORS, STATUS_COLOR_DOT, STATUS_COLOR_LABELS, type StatusColor } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import { MoodIcon } from "@/components/mood-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** "party-popper" as "Party popper", for the icon buttons' names. */
function iconLabel(icon: MoodIconName): string {
  const words = icon.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A key no mood has yet, built-in or the reader's own. */
function freshKey(taken: readonly CustomMood[]): string {
  for (;;) {
    const key = Math.random().toString(36).slice(2, 8);
    if (key && !isBuiltInMood(key) && !taken.some((m) => m.key === key)) return key;
  }
}

/** Why `name` can't be a mood's name, or null when it can: every mood the
 *  reader could see in one list needs a name of its own. */
function nameError(name: string | null, prefs: Preferences, except?: string): string | null {
  if (!name) return `Give it a name of up to ${MOOD_NAME_MAX} characters.`;
  const taken = allMoods(prefs)
    .filter((m) => m.key !== except)
    .find((m) => m.name.toLowerCase() === name.toLowerCase());
  return taken ? `There is already a mood called “${taken.name}”.` : null;
}

/** The icon picker: a grid of every mood icon, in a popover. */
function IconPicker({
  value,
  color,
  label,
  onChange,
}: {
  value: MoodIconName;
  color: StatusColor;
  label: string;
  onChange: (icon: MoodIconName) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={label} title={label}>
          <MoodIcon mood={{ icon: value, color }} className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} aria-label={label} className="w-auto">
        <div className="grid grid-cols-8 gap-1">
          {MOOD_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              aria-pressed={icon === value}
              aria-label={iconLabel(icon)}
              title={iconLabel(icon)}
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
              className={cn(
                "grid size-8 place-items-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
                icon === value && "bg-muted ring-1 ring-foreground/20",
              )}
            >
              <MoodIcon mood={{ icon, color }} className="size-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A colour menu, as the reader's own statuses have. */
function ColorSelect({
  value,
  label,
  onChange,
}: {
  value: StatusColor;
  label: string;
  onChange: (color: StatusColor) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusColor)}>
      <SelectTrigger className="w-28" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_COLORS.map((color) => (
          <SelectItem key={color} value={color}>
            <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_COLOR_DOT[color])} />
            {STATUS_COLOR_LABELS[color]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Icons for new moods, beyond the built-in moods' own: the first one no
 *  mood of the reader's has yet. */
const NEW_ICONS = MOOD_ICONS.filter((icon) => !BUILT_IN_MOODS.some((m) => m.icon === icon));
const NEW_COLORS: StatusColor[] = [
  "teal", "violet", "pink", "sky", "orange", "lime", "indigo", "rose", "amber", "slate",
];

/**
 * Preferences › Moods: which built-in moods are offered for books and in the
 * library's filter, and moods of the reader's own (lib/moods.ts). Names
 * save when the field is left; the rest saves at once.
 */
export function MoodSettings({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  const customs = prefs.customMoods;
  const hidden = new Set(prefs.hiddenMoods);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  function setShown(key: string, shown: boolean) {
    update({
      hiddenMoods: shown
        ? prefs.hiddenMoods.filter((k) => k !== key)
        : [...prefs.hiddenMoods.filter((k) => k !== key), key],
    });
  }

  function change(key: string, patch: Partial<CustomMood>) {
    update({ customMoods: customs.map((m) => (m.key === key ? { ...m, ...patch } : m)) });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = cleanMoodName(newName);
    const problem = nameError(name, prefs);
    if (problem) {
      setError(problem);
      return;
    }
    const usedIcons = new Set(customs.map((m) => m.icon));
    const usedColors = new Set(customs.map((m) => m.color));
    update({
      customMoods: [
        ...customs,
        {
          key: freshKey(customs),
          name: name!,
          icon: NEW_ICONS.find((i) => !usedIcons.has(i)) ?? "smile",
          color: NEW_COLORS.find((c) => !usedColors.has(c)) ?? "slate",
        },
      ],
    });
    setNewName("");
    setError(null);
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Give books moods on their page, then find the right one for your mood with the library’s
        Moods filter. Untick a mood to stop offering it; books that have it keep it.
      </p>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Moods to offer</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {BUILT_IN_MOODS.map((m) => (
            <label key={m.key} className="flex min-h-7 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!hidden.has(m.key)}
                onChange={(e) => setShown(m.key, e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
              <MoodIcon mood={m} className="size-4" />
              <span className={cn("truncate", hidden.has(m.key) && "text-muted-foreground")}>
                {m.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Your own moods</p>
        {customs.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="grid gap-2">
            {customs.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center gap-2 text-sm">
                {removing === m.key ? (
                  <>
                    <span className="min-w-0">
                      Remove “{m.name}”? It comes off every book that has it.
                    </span>
                    <span className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setRemoving(null);
                          update({ customMoods: customs.filter((x) => x.key !== m.key) });
                        }}
                      >
                        Remove
                      </Button>
                      <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                    </span>
                  </>
                ) : (
                  <>
                    <IconPicker
                      value={m.icon}
                      color={m.color}
                      label={`Icon of “${m.name}”`}
                      onChange={(icon) => change(m.key, { icon })}
                    />
                    <ColorSelect
                      value={m.color}
                      label={`Colour of “${m.name}”`}
                      onChange={(color) => change(m.key, { color })}
                    />
                    <Input
                      key={m.name}
                      defaultValue={m.name}
                      maxLength={MOOD_NAME_MAX}
                      aria-label={`Name of “${m.name}”`}
                      onBlur={(e) => {
                        const name = cleanMoodName(e.currentTarget.value);
                        if (name === m.name) return;
                        const problem = nameError(name, prefs, m.key);
                        if (problem) {
                          setError(problem);
                          e.currentTarget.value = m.name;
                          return;
                        }
                        setError(null);
                        change(m.key, { name: name! });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      className="h-8 min-w-0 flex-1 basis-40 sm:w-60 sm:flex-none"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={`Remove “${m.name}”`}
                      aria-label={`Remove “${m.name}”`}
                      onClick={() => setRemoving(m.key)}
                    >
                      <Trash2 data-slot="icon" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {customs.length < MAX_CUSTOM_MOODS ? (
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={MOOD_NAME_MAX}
              placeholder="New mood"
              aria-label="New mood"
              className="h-8 min-w-0 flex-1 basis-40 sm:w-60 sm:flex-none"
            />
            <Button type="submit" size="sm" variant="outline">
              Add
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">
            That&apos;s the most there can be ({MAX_CUSTOM_MOODS}).
          </p>
        )}
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    </>
  );
}
