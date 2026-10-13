"use client";

import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { flyCoverHome } from "@/lib/cover-flight";
import {
  parseLibraryReturn,
  previousEntryIs,
  readLibraryReturn,
} from "@/lib/library-return";
import { Button } from "@/components/ui/button";

/** The note only changes as a book link is followed, which mounts a new page
 *  anyway, so there is nothing to subscribe to. */
const subscribe = () => () => {};

/** Escape shouldn't leave the page while it means "stop typing here". */
function isEditable(el: Element | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || el.matches("input, textarea, select"))
  );
}

/**
 * The X on a book's page, shown when the book was opened from the library
 * or the reading room (lib/library-return.ts). It goes back to the library with the same
 * filters and scroll position, and the cover flies back into its card
 * (lib/cover-flight.ts). Escape does the same, unless a menu or dialog is
 * open or the cursor is in a text field.
 *
 * Rendered on the server as nothing: the note is in this tab's storage, so
 * the X appears once the page is running in the browser.
 */
export function CloseBookButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, readLibraryReturn, () => null);
  const back = parseLibraryReturn(raw, bookId);
  const closing = useRef(false);

  const close = () => {
    if (!back || closing.current) return;
    closing.current = true;
    const historyBack = previousEntryIs(back.href);
    flyCoverHome(back, () =>
      historyBack ? router.back() : router.push(back.href, { scroll: false }),
    );
  };

  // Radix menus, selects and dialogs close on Escape and mark it handled,
  // so a key that closed one of those leaves the page alone.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.repeat || e.defaultPrevented) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isEditable(document.activeElement)) return;
    close();
  });
  const shown = back !== null;
  useEffect(() => {
    if (!shown) return;
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [shown]);

  if (!back) return null;
  const place = back.href === "/room" ? "the reading room" : "the library";
  return (
    <Button
      variant="outline"
      size="icon-lg"
      // The page's top right corner: beside the cover on a phone, beside
      // the title (which leaves room for it, globals.css) on a wider screen.
      className="close-book absolute top-0 right-0 z-10 rounded-full bg-background/80 shadow-xs backdrop-blur-sm"
      onClick={close}
      title={`Back to ${place} (Esc)`}
      aria-label={`Close, back to ${place}`}
    >
      <X className="size-5" />
    </Button>
  );
}
