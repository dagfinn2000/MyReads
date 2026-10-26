"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import {
  DARK_THEME_IDS,
  OWN_BACKGROUND_IDS,
  THEME_BACKGROUNDS,
  THEME_PARTS,
  THEMES,
  applyThemeSetting,
  pageThemeChange,
  parseThemeSetting,
  serializeThemeSetting,
  type PartThemes,
  type ThemeDef,
  type ThemePart,
} from "@/lib/themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeSwatches } from "@/components/theme-swatches";

const PARTS: Record<ThemePart, { label: string; hint?: string }> = {
  library: { label: "Library", hint: "The book list, book pages, Add book and Series." },
  stats: { label: "Stats", hint: "And the year in review." },
  reading: { label: "Now reading" },
  quotes: { label: "Quotes" },
  room: { label: "Reading room" },
  account: { label: "Account", hint: "This page." },
};

/** No theme of its own: the part follows the theme used everywhere. */
const SAME = "same";
/** No second theme: the part's one theme, whatever the system says. */
const ONE = "one";

/** A theme's colours in small, as in the palette menu. */
function Swatch({ theme }: { theme: ThemeDef }) {
  return (
    <span
      className="flex h-3.5 w-5 shrink-0 items-center justify-center rounded-sm border border-black/10"
      style={{ backgroundColor: theme.swatch[0], backgroundImage: theme.pattern }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: theme.swatch[1] }} />
    </span>
  );
}

/**
 * A field that opens the same swatches as the palette menu: `themes`, and
 * above them `none` (no theme of its own, or no second theme), which the
 * line over the swatches then explains in `none.caption`.
 */
function ThemeChoice({
  value,
  themes,
  none,
  label,
  icon,
  onChange,
}: {
  value: string;
  themes: ThemeDef[];
  none: { value: string; label: string; caption: string };
  label: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const theme = THEMES.find((t) => t.id === value);
  const name = theme?.name ?? none.label;

  function choose(next: string) {
    setOpen(false);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${name}`}
          className="select-like flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-56 dark:bg-input/30 dark:hover:bg-input/50"
        >
          {icon}
          {theme && <Swatch theme={theme} />}
          <span className="min-w-0 flex-1 truncate text-left">{name}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-(--radix-popover-content-available-height) overflow-y-auto"
      >
        <button
          type="button"
          onClick={() => choose(none.value)}
          className="-mx-1.5 -mt-1.5 mb-2 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="flex-1">{none.label}</span>
          {!theme && <Check className="size-3.5 shrink-0" />}
        </button>
        <ThemeSwatches
          themes={themes}
          isSelected={(t) => t.id === value}
          onPick={(t) => choose(t.id)}
          caption={theme?.name ?? none.caption}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * One part's theme: the theme used everywhere, or one of its own. A part
 * with its own theme can add a second, of the other kind, for when the
 * device is in the other mode: an automatic pair, as in the palette menu.
 */
function PartTheme({
  part,
  value,
  onChange,
}: {
  part: ThemePart;
  value: string | undefined;
  onChange: (value: string | null) => void;
}) {
  const setting = parseThemeSetting(value);
  // A pair shows as its light theme with the dark one second.
  const first = setting ? (setting.kind === "fixed" ? setting.id : setting.light) : SAME;
  const second = setting?.kind === "auto" ? setting.dark : ONE;
  const firstMode = THEMES.find((t) => t.id === first)?.mode;
  const otherMode = firstMode === "light" ? "dark" : "light";
  const { label, hint } = PARTS[part];
  const OtherIcon = otherMode === "dark" ? Moon : Sun;

  /** A new first theme of the same kind keeps the second one. */
  function pickFirst(id: string) {
    if (id === SAME) onChange(null);
    else if (second !== ONE && THEMES.find((t) => t.id === id)?.mode === firstMode) {
      pair(id, second);
    } else onChange(id);
  }

  function pair(one: string, other: string) {
    const [light, dark] = otherMode === "dark" ? [one, other] : [other, one];
    onChange(serializeThemeSetting({ kind: "auto", light, dark }));
  }

  function pickSecond(id: string) {
    if (id === ONE) onChange(first);
    else pair(first, id);
  }

  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-start sm:gap-4">
      <div className="sm:pt-1.5">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <ThemeChoice
          value={first}
          themes={THEMES}
          none={{ value: SAME, label: "Same as everywhere", caption: "No theme of its own" }}
          label={`Theme for ${label}`}
          onChange={pickFirst}
        />
        {firstMode && (
          <ThemeChoice
            value={second}
            themes={THEMES.filter((t) => t.mode === otherMode)}
            none={{
              value: ONE,
              label: `Same in ${otherMode} mode`,
              caption: `No second theme for ${otherMode} mode`,
            }}
            label={`Theme for ${label} when your device is ${otherMode}`}
            icon={<OtherIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            onChange={pickSecond}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Themes for parts of the app (Preferences > Theme). A change shows at
 * once, then saves: the page's own theme is worked out again from the new
 * list, as the pre-paint script and ThemeSync do.
 */
export function PartThemesForm({
  value,
  onChange,
}: {
  value: PartThemes;
  onChange: (value: PartThemes) => void;
}) {
  function set(part: ThemePart, setting: string | null) {
    const next: PartThemes = { ...value };
    if (setting) next[part] = setting;
    else delete next[part];
    const root = document.documentElement;
    if (Object.keys(next).length > 0) root.setAttribute("data-theme-parts", JSON.stringify(next));
    else root.removeAttribute("data-theme-parts");
    const change = pageThemeChange(root.getAttribute("data-section") ?? "");
    if (change) applyThemeSetting(change, DARK_THEME_IDS, THEME_BACKGROUNDS, OWN_BACKGROUND_IDS);
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium">Themes for parts of the app</p>
        <p className="text-xs text-muted-foreground">
          A part with a theme of its own shows it on every device, whatever the palette menu
          says. Add a second theme to switch with your device’s light and dark mode.
        </p>
      </div>
      {THEME_PARTS.map((part) => (
        <PartTheme
          key={part}
          part={part}
          value={value[part]}
          onChange={(setting) => set(part, setting)}
        />
      ))}
    </div>
  );
}
