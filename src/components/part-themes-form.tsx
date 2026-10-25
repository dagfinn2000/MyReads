"use client";

import { Moon, Sun } from "lucide-react";
import {
  DARK_THEME_IDS,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      style={{ backgroundColor: theme.swatch[0] }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: theme.swatch[1] }} />
    </span>
  );
}

function ThemeItems({ mode }: { mode: ThemeDef["mode"] }) {
  return (
    <SelectGroup>
      <SelectLabel>{mode === "light" ? "Light" : "Dark"}</SelectLabel>
      {THEMES.filter((t) => t.mode === mode).map((t) => (
        <SelectItem key={t.id} value={t.id}>
          <Swatch theme={t} />
          {t.name}
        </SelectItem>
      ))}
    </SelectGroup>
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
        <Select value={first} onValueChange={pickFirst}>
          <SelectTrigger className="w-full sm:w-56" aria-label={`Theme for ${label}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SAME}>Same as everywhere</SelectItem>
            <ThemeItems mode="light" />
            <ThemeItems mode="dark" />
          </SelectContent>
        </Select>
        {firstMode && (
          <Select value={second} onValueChange={pickSecond}>
            <SelectTrigger
              className="w-full justify-start sm:w-56 [&>svg:last-child]:ml-auto"
              aria-label={`Theme for ${label} when your device is ${otherMode}`}
            >
              <OtherIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ONE}>Same in {otherMode} mode</SelectItem>
              <ThemeItems mode={otherMode} />
            </SelectContent>
          </Select>
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
    if (change) applyThemeSetting(change, DARK_THEME_IDS, THEME_BACKGROUNDS);
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
