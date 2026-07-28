"use client";

import { useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";
import { saveTheme } from "@/lib/actions/theme";
import { THEMES, THEME_STORAGE_KEY } from "@/lib/themes";
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
 */
/**
 * The applied theme is the `data-theme` attribute on <html> — written by the
 * root layout on the server, by the pre-paint init script, and by this
 * picker. That makes it external state React doesn't own, so it's read as
 * one rather than mirrored into component state: a MutationObserver reports
 * changes, and the picker stays correct no matter which of the three wrote
 * the value.
 */
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

const readTheme = () =>
  document.documentElement.getAttribute("data-theme") ?? "light";

// null on the server: the attribute lives on an element this component's
// server render can't see, and claiming a selection there would mismatch
// hydration.
const readThemeOnServer = () => null;

export function ThemePicker() {
  const current = useSyncExternalStore(
    subscribeToTheme,
    readTheme,
    readThemeOnServer,
  );

  function apply(id: string) {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", id);
    root.classList.toggle("dark", theme.mode === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // private-mode storage failure just means the choice won't persist
    }
    // Fire-and-forget account sync; a no-op when signed out (login page)
    // and nothing the picker needs to wait for.
    saveTheme(id).catch(() => {});
    // No setState: the attribute write above is the state change, and the
    // observer re-renders from it.
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Theme">
          <Palette />
          <span className="sr-only">Choose theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => apply(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border p-1.5 text-left text-xs transition-colors hover:border-ring/60",
                current === t.id && "border-primary ring-1 ring-primary",
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
              {current === t.id && <Check className="size-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
