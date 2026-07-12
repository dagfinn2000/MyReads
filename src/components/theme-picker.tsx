"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
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
 * Selection is applied to <html> (data-theme attribute + dark class) and
 * persisted in localStorage; the inline script in the root layout re-applies
 * it before first paint on subsequent visits. Purely client-side — nothing
 * is stored on the server.
 */
export function ThemePicker() {
  // null until mounted — the server doesn't know the stored theme, so
  // rendering a selection before mount would mismatch hydration.
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(localStorage.getItem(THEME_STORAGE_KEY) ?? "light");
  }, []);

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
    setCurrent(id);
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
