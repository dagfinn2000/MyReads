import { OPTIONAL_NAV, type NavItem, type Preferences } from "@/lib/preferences";

/** Where each top-bar link goes, the word it shows beside its icon on a
 *  wide screen, and its tooltip, which names it while only the icon shows.
 *  The icons are components/nav.tsx's. */
export const NAV_LINKS: Record<NavItem, { href: string; label: string; title: string }> = {
  library: { href: "/books", label: "Library", title: "Library" },
  reading: { href: "/reading", label: "Now reading", title: "Now reading" },
  add: { href: "/books/new", label: "Add book", title: "Add book" },
  check: { href: "/books/check", label: "Check", title: "Do I own this?" },
  quotes: { href: "/quotes", label: "Quotes", title: "Quotes" },
  stats: { href: "/stats", label: "Stats", title: "Stats" },
  room: { href: "/room", label: "Room", title: "Reading room" },
  series: { href: "/series", label: "Series", title: "Series" },
};

/** How many links the bar was laid out for. With more, it tightens up
 *  (components/nav.tsx) so they still fit on one line. */
export const ROOMY_NAV_LINKS = 7;

/** The top-bar links this reader has, in their order: hidden ones left out,
 *  and optional ones (Series) unless they've been turned on. */
export function topBarLinks(
  prefs: Pick<Preferences, "navOrder" | "hiddenNav" | "shownNav">,
): NavItem[] {
  const hidden = new Set<NavItem>(prefs.hiddenNav);
  const off = new Set<NavItem>(OPTIONAL_NAV.filter((item) => !prefs.shownNav.includes(item)));
  return prefs.navOrder.filter((item) => !hidden.has(item) && !off.has(item));
}

/** Which top-bar link a path belongs to (components/nav-link.tsx). A book's
 *  page and its edit page count as the library; adding and checking a book
 *  have links of their own. */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/books") {
    return (
      pathname === "/books" ||
      (pathname.startsWith("/books/") &&
        !pathname.startsWith("/books/new") &&
        !pathname.startsWith("/books/check"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
