"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ownCssApplies, styleText } from "@/lib/own-css";

/**
 * The reader's own CSS (Preferences), after the app's own styles: it comes
 * later in the page, so it wins over a rule as specific as its own. Not on
 * the Account page or with ?css=off (lib/own-css.ts).
 */
export function OwnCss({ css }: { css: string }) {
  const pathname = usePathname();
  const cssParam = useSearchParams().get("css");
  if (!css || !ownCssApplies(pathname, cssParam)) return null;
  return <style data-own-css="">{styleText(css)}</style>;
}
