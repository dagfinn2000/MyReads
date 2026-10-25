/**
 * The reader's own CSS (Preferences > Your own CSS): added after the app's
 * own styles on every signed-in page (components/own-css.tsx). It's their
 * own account, so any CSS goes; these rules only keep it inside its
 * <style> element and give a way back from a mistake.
 */

/** The most characters kept. */
export const OWN_CSS_MAX = 20_000;

/** A stored value → the CSS to use: a string, at most OWN_CSS_MAX long. */
export function parseOwnCss(raw: unknown): string {
  return typeof raw === "string" ? raw.slice(0, OWN_CSS_MAX) : "";
}

/**
 * The CSS as it goes inside the <style> element: each "<" written as CSS's
 * own escape for it, `\3C `, which means "<" again wherever CSS has one (a
 * string, a url). Nothing typed can then close the element and carry on as
 * HTML.
 */
export function styleText(css: string): string {
  return css.replace(/</g, "\\3C ");
}

/**
 * Whether the CSS applies on this page. Not on the Account page, where it's
 * edited, so a mistake that hides or breaks a page can always be put right
 * there; and not with ?css=off on the address, for a look at any page
 * without it.
 */
export function ownCssApplies(pathname: string, cssParam: string | null): boolean {
  return pathname !== "/account" && !pathname.startsWith("/account/") && cssParam !== "off";
}
