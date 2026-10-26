"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { syncPageTheme } from "@/lib/themes";

/**
 * Keeps <html> right as the reader moves around without a full page load:
 * `data-section` for the page they're on, and that page's theme (a part's
 * own theme, from Preferences). On a full load the pre-paint script does
 * this (lib/themes.ts). A layout effect, so the new page never paints in
 * the old page's theme.
 *
 * `account` is the account's theme as the server last rendered it, and
 * `parts` the part themes as JSON: when either changes (Preferences, or the
 * theme picked on another device), the theme is worked out again. The
 * account's theme is only taken when it changed (syncPageTheme), since a
 * move to another page leaves it as it was at the first load.
 */
export function ThemeSync({ account, parts }: { account: string | null; parts: string }) {
  const pathname = usePathname();
  const before = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    syncPageTheme(pathname, account, before.current);
    before.current = account;
  }, [pathname, account, parts]);
  return null;
}
