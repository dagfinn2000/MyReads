"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DARK_THEME_IDS,
  THEME_BACKGROUNDS,
  applyThemeSetting,
  pageThemeChange,
  sectionOf,
} from "@/lib/themes";

/**
 * Keeps <html> right as the reader moves around without a full page load:
 * `data-section` for the page they're on, and that page's theme (a part's
 * own theme, from Preferences). On a full load the pre-paint script does
 * this (lib/themes.ts). A layout effect, so the new page never paints in
 * the old page's theme.
 *
 * `account` is the account's theme as the server last rendered it, and
 * `parts` the part themes as JSON: when either changes (Preferences, or the
 * theme picked on another device), the theme is worked out again.
 */
export function ThemeSync({ account, parts }: { account: string | null; parts: string }) {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const section = sectionOf(pathname);
    if (section) root.setAttribute("data-section", section);
    else root.removeAttribute("data-section");
    if (account) root.setAttribute("data-theme-account", account);
    const next = pageThemeChange(section);
    if (next) applyThemeSetting(next, DARK_THEME_IDS, THEME_BACKGROUNDS);
  }, [pathname, account, parts]);
  return null;
}
