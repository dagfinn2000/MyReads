/**
 * The way back from a book's page to the library it was opened from: the X
 * on the book page (components/close-book-button.tsx).
 *
 * Clicking a book in the library notes which book, the library's address
 * (with its filters, sort and "Show more" count) and how far down it was
 * scrolled. The reading room, the library drawn as a house, notes the same
 * for a spine clicked there. The book page shows its X only when that note
 * is for its own book, so a book opened from Now reading, Stats or another
 * book's series strip looks as it always did.
 *
 * The note lives in sessionStorage: it belongs to this tab, survives a
 * reload of the book page, and is gone when the tab closes.
 */

const STORAGE_KEY = "myreads:library-return";

export interface LibraryReturn {
  /** The book that was opened. */
  bookId: string;
  /** The library page it was opened from, path and query: "/books?sort=title",
   *  or the reading room, "/room". */
  href: string;
  /** How far down the library was scrolled. */
  scrollY: number;
  /** Where the clicked cover sat on the page, so a book shown in two groups
   *  flies back to the one that was clicked. */
  coverY: number;
}

/** True for the library page itself, with or without a query, and for the
 *  reading room. Anything else (a book, /books/new, another site) is not
 *  somewhere the X should go. */
export function isLibraryHref(href: string): boolean {
  return href === "/books" || href.startsWith("/books?") || href === "/room";
}

/** The note as stored, or null when it is missing, from an older version of
 *  the app, or not for this book. */
export function parseLibraryReturn(raw: string | null, bookId: string): LibraryReturn | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.bookId !== bookId) return null;
  if (typeof v.href !== "string" || !isLibraryHref(v.href)) return null;
  const scrollY = typeof v.scrollY === "number" && Number.isFinite(v.scrollY) ? v.scrollY : 0;
  const coverY = typeof v.coverY === "number" && Number.isFinite(v.coverY) ? v.coverY : scrollY;
  return { bookId, href: v.href, scrollY: Math.max(0, scrollY), coverY };
}

/** What following a book link from `pathname` does to the note: the
 *  library and the reading room write a new one; a book page's series strip
 *  keeps it, so Back from the next book still finds the X on this one;
 *  anywhere else (Now reading, Stats) forgets it. */
export function noteAction(pathname: string): "write" | "keep" | "forget" {
  if (pathname === "/books" || pathname === "/room") return "write";
  if (/^\/books\/(?!new$|check$)[^/]+$/.test(pathname)) return "keep";
  return "forget";
}

/** Called as a book link is followed (components/book-link.tsx). */
export function noteBookOpened(bookId: string, cover: HTMLElement | null): void {
  try {
    const action = noteAction(location.pathname);
    if (action === "keep") return;
    if (action === "forget") {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const note: LibraryReturn = {
      bookId,
      href: location.pathname + location.search,
      scrollY: window.scrollY,
      coverY: cover ? cover.getBoundingClientRect().top + window.scrollY : window.scrollY,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(note));
  } catch {
    // Storage blocked (private mode, a full quota): no X, nothing else lost.
  }
}

/** The stored note, unparsed. A string, so it can be a
 *  useSyncExternalStore snapshot. */
export function readLibraryReturn(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The slice of the Navigation API used here. Not in TypeScript's DOM types
 *  yet, and not in every browser. */
interface NavigationHistory {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
}

/**
 * Whether going back one step lands on `href`: true when the book page was
 * opened straight from that library page and nothing has been pushed since.
 * The X then goes back through history, so the browser's own Back button
 * afterwards leaves the library rather than reopening the book.
 *
 * Only the Navigation API can see the previous entry. Without it this says
 * no, and the X opens the library as a new page instead, which looks the
 * same.
 */
export function previousEntryIs(href: string): boolean {
  const nav = (window as { navigation?: NavigationHistory }).navigation;
  const index = nav?.currentEntry?.index;
  if (!nav || index == null || index < 1) return false;
  const url = nav.entries()[index - 1]?.url;
  if (!url) return false;
  const previous = new URL(url);
  return previous.origin === location.origin && previous.pathname + previous.search === href;
}
