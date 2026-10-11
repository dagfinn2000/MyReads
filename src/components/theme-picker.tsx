"use client";

import { useSyncExternalStore } from "react";
import { Check, Palette, SunMoon } from "lucide-react";
import { saveTheme } from "@/lib/actions/theme";
import {
  DARK_THEME_IDS,
  DEFAULT_AUTO_THEMES,
  THEME_BACKGROUNDS,
  THEME_STORAGE_KEY,
  THEMES,
  applyThemeSetting,
  parseThemeSetting,
  serializeThemeSetting,
  type ThemeDef,
  type ThemeSetting,
} from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Dashify-style theme picker: a grid of palette swatches in a dropdown.
 * Selection is applied to <html> (data-theme attribute + dark class),
 * persisted in localStorage for this browser, and saved on the account so
 * signing in elsewhere brings the theme along (the root layout server-
 * renders the saved theme; the inline init script covers signed-out pages
 * from localStorage).
 *
 * "Match system" switches to automatic mode: one light and one dark theme,
 * swapped as the phone or computer changes between light and dark. In that
 * mode a click on a theme fills the slot for its kind.
 */
/**
 * The applied theme is the `data-theme` attribute on <html> — written by the
 * root layout on the server, by the pre-paint init script, and by this
 * picker — plus `data-theme-auto` while automatic mode is on. That makes it
 * external state React doesn't own, so it's read as one rather than
 * mirrored into component state: a MutationObserver reports changes, and the
 * picker stays correct no matter which of the three wrote the value.
 */
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-auto"],
  });
  return () => observer.disconnect();
}

/** The setting as one string, so the snapshot compares by value. */
const readTheme = () => {
  const root = document.documentElement;
  const auto = root.getAttribute("data-theme-auto");
  return auto ? `auto:${auto}` : (root.getAttribute("data-theme") ?? "light");
};

// null on the server: the attribute lives on an element this component's
// server render can't see, and claiming a selection there would mismatch
// hydration.
const readThemeOnServer = () => null;

export function ThemePicker() {
  const raw = useSyncExternalStore(subscribeToTheme, readTheme, readThemeOnServer);
  const current: ThemeSetting | null = raw === null ? null : parseThemeSetting(raw);
  const auto = current?.kind === "auto" ? current : null;

  function apply(setting: ThemeSetting) {
    const value = serializeThemeSetting(setting);
    applyThemeSetting(value, DARK_THEME_IDS, THEME_BACKGROUNDS);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // private-mode storage failure just means the choice won't persist
    }
    // Fire-and-forget account sync; a no-op when signed out (login page)
    // and nothing the picker needs to wait for.
    saveTheme(value).catch(() => {});
    // No setState: the attribute write above is the state change, and the
    // observer re-renders from it.
  }

  function pick(theme: ThemeDef) {
    if (auto) apply({ ...auto, [theme.mode]: theme.id });
    else apply({ kind: "fixed", id: theme.id });
  }

  function toggleAuto() {
    const applied = document.documentElement.getAttribute("data-theme") ?? "light";
    if (auto) {
      // Back to one fixed theme: keep whichever one is showing right now.
      apply({ kind: "fixed", id: applied });
      return;
    }
    // The theme in use takes its own slot; the other starts at the default.
    const mode = THEMES.find((t) => t.id === applied)?.mode;
    apply({
      kind: "auto",
      light: mode === "light" ? applied : DEFAULT_AUTO_THEMES.light,
      dark: mode === "dark" ? applied : DEFAULT_AUTO_THEMES.dark,
    });
  }

  const isSelected = (t: ThemeDef) =>
    auto ? auto[t.mode] === t.id : current?.kind === "fixed" && current.id === t.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Theme">
          <Palette />
          <span className="sr-only">Choose theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <button
          type="button"
          role="switch"
          aria-checked={!!auto}
          onClick={toggleAuto}
          className="mb-2 flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:border-ring/60"
        >
          <SunMoon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            Match system light/dark
            {auto && (
              <span className="block text-xs text-muted-foreground">
                Pick one light and one dark theme below.
              </span>
            )}
          </span>
          <span
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full bg-muted transition-colors",
              auto && "bg-primary",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow transition-transform",
                auto && "translate-x-4",
              )}
            />
          </span>
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t)}
              className={cn(
                "flex items-center gap-2 rounded-md border p-1.5 text-left text-xs transition-colors hover:border-ring/60",
                isSelected(t) && "border-primary ring-1 ring-primary",
              )}
            >
              <span
                className="flex h-6 w-8 shrink-0 items-center justify-center rounded border border-black/10"
                style={{ backgroundColor: t.swatch[0] }}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: t.swatch[1] }}
                />
              </span>
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              {isSelected(t) && <Check className="size-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
