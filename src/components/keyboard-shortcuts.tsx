"use client";

import { Fragment, useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_LINKS, topBarLinks } from "@/lib/nav";
import type { NavItem } from "@/lib/preferences";
import { readShortcut, shortcutGroups, type Pending } from "@/lib/shortcuts";
import { usePreferences } from "@/components/preferences-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The library's search box (components/filter-bar.tsx). */
const SEARCH_BOX = "[data-library-search]";

/** Anything open over the page that keys belong to while it's there: Radix
 *  dialogs, popovers, menus and select lists, on their way in or open. */
const OVERLAY =
  ':is([role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]):not([data-state="closed"]), dialog[open]';

/** Where a key is typing, not a shortcut: text fields, selects, editable
 *  text, and Radix selects, which pick an option by its first letter. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches('input, textarea, select, [role="combobox"], [role="textbox"], [role="searchbox"]'))
  );
}

/**
 * Focuses the library's search box, going to the library first when this
 * page hasn't one: it then waits for the box to arrive, up to ten seconds.
 * Returns a function that stops the wait.
 */
function focusLibrarySearch(goToLibrary: () => void): () => void {
  const focus = (box: HTMLInputElement) => {
    box.focus();
    box.select();
  };
  const here = document.querySelector<HTMLInputElement>(SEARCH_BOX);
  if (here) {
    focus(here);
    return () => {};
  }
  const observer = new MutationObserver(() => {
    const box = document.querySelector<HTMLInputElement>(SEARCH_BOX);
    if (!box) return;
    stop();
    focus(box);
  });
  const timer = window.setTimeout(() => stop(), 10_000);
  function stop() {
    observer.disconnect();
    window.clearTimeout(timer);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  goToLibrary();
  return stop;
}

/**
 * Keyboard shortcuts on every signed-in page, unless turned off in
 * Preferences. Nothing shows for them: ? opens the list. The rules for which
 * key does what are lib/shortcuts.ts's; this listens, and carries them out.
 * Keys go to the page first, so a field, menu or dialog that handles one
 * (and Escape closing a dialog) keeps it.
 */
export function KeyboardShortcuts() {
  const prefs = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const links = topBarLinks(prefs);
  const [open, setOpen] = useState(false);
  const pending = useRef<Pending>(null);
  /** Stops waiting for the library's search box, while / waits for it. */
  const stopWaiting = useRef<(() => void) | null>(null);
  /** Where the focus was when ? opened the list, to put it back after. */
  const returnFocus = useRef<HTMLElement | null>(null);

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const result = readShortcut(
      {
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        repeat: e.repeat,
        isComposing: e.isComposing,
        defaultPrevented: e.defaultPrevented,
        typing: isTyping(e.target),
        overlay: document.querySelector(OVERLAY) !== null,
      },
      pending.current,
      performance.now(),
      { links, pathname },
    );
    pending.current = result.pending;
    const { action } = result;
    if (!action) {
      // g itself: claimed, so a browser's find-as-you-type doesn't start.
      if (result.pending !== null && e.key === "g") e.preventDefault();
      return;
    }
    e.preventDefault();
    stopWaiting.current?.();
    stopWaiting.current = null;
    switch (action.type) {
      case "help":
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(true);
        break;
      case "search":
        stopWaiting.current = focusLibrarySearch(() => router.push(NAV_LINKS.library.href));
        break;
      case "go":
        router.push(NAV_LINKS[action.to].href);
        break;
      case "edit":
        router.push(action.href);
        break;
    }
  });

  const on = prefs.keyboardShortcuts;
  useEffect(() => {
    if (!on) return;
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
      stopWaiting.current?.();
    };
  }, [on]);

  // Leaving for somewhere other than the library ends a wait for its box.
  useEffect(() => {
    if (pathname === NAV_LINKS.library.href) return;
    stopWaiting.current?.();
    stopWaiting.current = null;
  }, [pathname]);

  if (!on) return null;
  return (
    <ShortcutsDialog
      links={links}
      open={open}
      onOpenChange={setOpen}
      onCloseAutoFocus={(e) => {
        const el = returnFocus.current;
        returnFocus.current = null;
        if (el?.isConnected) {
          e.preventDefault();
          el.focus();
        }
      }}
    />
  );
}

/** A key as it's printed on the keyboard. */
function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 border-foreground/15 bg-muted px-1.5 font-mono text-xs font-medium text-foreground">
      {children}
    </kbd>
  );
}

/**
 * The list of shortcuts, in groups, with the g keys for the reader's own
 * top-bar links. Opened with ? on any page, or from its trigger (the link in
 * Preferences).
 */
export function ShortcutsDialog({
  links,
  trigger,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  links: readonly NavItem[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            They work whenever you&apos;re not typing in a box. You can turn
            them off in Preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {shortcutGroups(links).map((group) => (
            <section key={group.title} className="grid gap-1.5">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.title}
              </h3>
              <dl className="grid gap-1.5">
                {group.items.map((item) => (
                  <div key={item.keys.join(" ")} className="flex items-center justify-between gap-4">
                    <dt>{item.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {item.keys.map((key, i) => (
                        <Fragment key={key}>
                          {i > 0 && <span>then</span>}
                          <Kbd>{key}</Kbd>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
