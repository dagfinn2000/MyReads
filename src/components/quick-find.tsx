"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookCopy,
  Bookmark,
  CalendarHeart,
  CornerDownLeft,
  Feather,
  Search,
  Settings2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { topBarLinks } from "@/lib/nav";
import { NAV_ITEMS } from "@/lib/preferences";
import {
  EMPTY_RESULT,
  QUICK_FIND_EVENT,
  QUICK_FIND_MAX_QUERY,
  matchPages,
  matchScore,
  quickHref,
  quickPages,
  type QuickBook,
  type QuickFindResult,
  type QuickPage,
} from "@/lib/quick-find";
import { isQuickFindKey } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";
import { BookCover } from "@/components/book-card";
import { NAV_ICONS } from "@/components/nav-icons";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fineText } from "@/lib/fine-type";

/** How long typing pauses before the server is asked. */
const DEBOUNCE_MS = 120;

/** Opens quick find from anywhere: the top bar's button, or Ctrl+K
 *  (components/keyboard-shortcuts.tsx). Nothing can ask while it's open:
 *  it covers the page, and keys go to its box. */
export function openQuickFind() {
  window.dispatchEvent(new Event(QUICK_FIND_EVENT));
}

/**
 * The top bar's magnifier, where the bar has room for it. How much room
 * the links take depends on how many there are, the screen and the theme
 * (some restyled themes set them in a wide face), so it measures: it shows
 * only while the bar doesn't overflow with it, and checks again when the
 * window, the theme or a font changes. It starts out hidden, so a bar
 * that has no room never spills over while the page loads. Ctrl+K opens
 * quick find either way.
 */
export function QuickFindButton({ className }: { className?: string }) {
  const mac = useIsMac();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const button = ref.current;
    const bar = button?.closest(".top-bar")?.firstElementChild;
    if (!button || !(bar instanceof HTMLElement)) return;
    const fit = () => {
      button.style.display = "";
      if (bar.scrollWidth > bar.clientWidth + 1) button.style.display = "none";
    };
    fit();
    // Not the button's own group, whose size this changes.
    const sizes = new ResizeObserver(fit);
    sizes.observe(bar);
    for (const link of bar.querySelectorAll(":scope > a")) sizes.observe(link);
    const theme = new MutationObserver(fit);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-text-size"] });
    let live = true;
    document.fonts?.ready.then(() => live && fit());
    return () => {
      live = false;
      sizes.disconnect();
      theme.disconnect();
    };
  }, []);
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="sm"
      className={cn("quick-find-button", className)}
      style={{ display: "none" }}
      title={`Find a book, author or page (${mac ? "⌘K" : "Ctrl+K"})`}
      onClick={openQuickFind}
    >
      <Search data-slot="icon" />
      <span className="sr-only">Quick find</span>
    </Button>
  );
}

const noSubscribe = () => () => {};

/** Whether this is a Mac (or iPhone or iPad), whose keyboards say ⌘ for
 *  Ctrl. False on the server. */
export function useIsMac(): boolean {
  return useSyncExternalStore(noSubscribe, isMac, () => false);
}

function isMac(): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform;
  return /mac|iphone|ipad/i.test(platform);
}

type Option =
  | { kind: "book"; key: string; href: string; book: QuickBook }
  | { kind: "author" | "series"; key: string; href: string; name: string; count: number }
  | { kind: "shelf"; key: string; href: string; name: string; smart: boolean }
  | { kind: "page"; key: string; href: string; page: QuickPage }
  | { kind: "search"; key: string; href: string; q: string };

type Group = { title: string; options: Option[] };

type Answer = { data: QuickFindResult; failed: "offline" | "error" | null };
/** The server's answers since quick find opened, by query, and the one
 *  that came last (shown while the next is on its way). */
type Answers = { byQuery: Record<string, Answer>; last: string | null };
const NO_ANSWERS: Answers = { byQuery: {}, last: null };

/** The list's groups, in the order they show, from the server's finds and
 *  the pages. With nothing typed: the books being read, and every page. */
function buildGroups(q: string, result: QuickFindResult, pages: QuickPage[]): Group[] {
  const typed = q.trim() !== "";
  const groups: Group[] = [
    {
      title: typed ? "Books" : "Reading now",
      options: result.books.map((book) => ({
        kind: "book",
        key: `b:${book.id}`,
        href: quickHref.book(book.id),
        book,
      })),
    },
    {
      title: "Authors",
      options: result.authors.map((a) => ({
        kind: "author",
        key: `a:${a.name}`,
        href: quickHref.author(a.name),
        name: a.name,
        count: a.count,
      })),
    },
    {
      title: "Series",
      options: result.series.map((s) => ({
        kind: "series",
        key: `s:${s.name}`,
        href: quickHref.series(s.name),
        name: s.name,
        count: s.count,
      })),
    },
    {
      title: "Shelves",
      options: result.shelves.map((s) => ({
        kind: "shelf",
        key: `h:${s.id}`,
        href: quickHref.shelf(s.id),
        name: s.name,
        smart: s.smart,
      })),
    },
    {
      title: "Go to",
      options: (typed ? matchPages(pages, q) : pages).map((page) => ({
        kind: "page",
        key: `p:${page.key}`,
        href: page.href,
        page,
      })),
    },
  ];
  // Books first when a title matches; when they only match by their
  // author or series, that author or series comes first.
  if (typed && !result.books.some((b) => matchScore(b.title, q) > 0)) {
    const [books, authors, series] = groups.splice(0, 3);
    groups.unshift(authors, series, books);
  }
  if (typed) {
    groups.push({
      title: "",
      options: [{ kind: "search", key: "q", href: quickHref.search(q), q: q.trim() }],
    });
  }
  return groups.filter((g) => g.options.length > 0);
}

/**
 * Quick find: a box over the page that finds a book, author, series, shelf
 * or page as you type, and opens it with Enter or a tap. Ctrl+K or ⌘K
 * opens it (with keyboard shortcuts on), and so does the top bar's
 * magnifier. The arrow keys move through the list; the last line searches
 * the whole library for what was typed.
 */
export function QuickFind() {
  const prefs = usePreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [active, setActive] = useState(0);
  const mac = useIsMac();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  /** Where the focus was when it opened, to put it back after. */
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = () => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    window.addEventListener(QUICK_FIND_EVENT, show);
    return () => window.removeEventListener(QUICK_FIND_EVENT, show);
  }, []);

  const query = q.trim().slice(0, QUICK_FIND_MAX_QUERY);
  const answered = query in answers.byQuery;
  useEffect(() => {
    if (!open || answered) return;
    const controller = new AbortController();
    const settle = (answer: Answer) =>
      setAnswers((a) => ({ byQuery: { ...a.byQuery, [query]: answer }, last: query }));
    const timer = window.setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/quick-find?q=${encodeURIComponent(query)}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) throw new Error(String(res.status));
          settle({ data: (await res.json()) as QuickFindResult, failed: null });
        } catch {
          if (controller.signal.aborted) return;
          settle({ data: EMPTY_RESULT, failed: navigator.onLine ? "error" : "offline" });
        }
      },
      query === "" ? 0 : DEBOUNCE_MS,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, answered]);

  const pages = useMemo(() => {
    const year = new Date().getFullYear();
    const all = quickPages(year);
    // With nothing typed, the reader's own top bar, in its order, then the rest.
    const order = [...topBarLinks(prefs), ...NAV_ITEMS, "account", "year"];
    return [...all].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [prefs]);

  // While the answer for what's typed is on its way, the last one stays.
  const answer = answers.byQuery[query] ?? (answers.last !== null ? answers.byQuery[answers.last] : undefined);
  const stale = !answered && answer !== undefined;
  const shown = answer?.data ?? EMPTY_RESULT;
  const failed = answer?.failed ?? null;
  const groups = useMemo(() => buildGroups(query, shown, pages), [query, shown, pages]);
  const options = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const current = Math.min(active, Math.max(options.length - 1, 0));

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [current]);

  /** Closes it, forgetting its answers: the next time it opens, it looks
   *  again, as books may have changed since. */
  function close() {
    setOpen(false);
    setAnswers(NO_ANSWERS);
    setActive(0);
  }

  function pick(option: Option | undefined, newTab = false) {
    if (!option) return;
    if (newTab) {
      window.open(option.href, "_blank", "noopener");
      return;
    }
    returnFocus.current = null;
    close();
    setQ("");
    router.push(option.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (isQuickFindKey(e)) {
      e.preventDefault();
      close();
      return;
    }
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(options.length ? (current + 1) % options.length : 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(options.length ? (current - 1 + options.length) % options.length : 0);
        break;
      case "PageDown":
      case "PageUp": {
        e.preventDefault();
        const step = e.key === "PageDown" ? 5 : -5;
        setActive(Math.min(Math.max(current + step, 0), Math.max(options.length - 1, 0)));
        break;
      }
      case "Enter":
        e.preventDefault();
        pick(options[current], e.ctrlKey || e.metaKey);
        break;
    }
  }

  const activeKey = options[current]?.key;
  let index = 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="quick-find top-[max(1rem,10vh)] max-h-[min(36rem,calc(100dvh-2rem))] translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const input = (e.currentTarget as HTMLElement | null)?.querySelector("input");
          input?.focus();
          input?.select();
        }}
        onCloseAutoFocus={(e) => {
          const el = returnFocus.current;
          returnFocus.current = null;
          if (el?.isConnected) {
            e.preventDefault();
            el.focus();
          } else if (!el) {
            e.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">Quick find</DialogTitle>
        <DialogDescription className="sr-only">
          Type part of a title, author, series, shelf or page, then pick it with the arrow keys and
          Enter.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeKey ? `${listId}-${current}` : undefined}
            aria-autocomplete="list"
            aria-label="Find a book, author, series, shelf or page"
            placeholder="Find a book, author, series, shelf or page"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={QUICK_FIND_MAX_QUERY}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          <kbd className="hidden shrink-0 rounded border border-b-2 border-foreground/15 bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Matches"
          className={cn(
            "quick-find-list overflow-y-auto overscroll-contain p-1.5 transition-opacity",
            stale && "opacity-70",
          )}
        >
          {failed && (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              {failed === "offline"
                ? "You’re offline, so only pages can be found just now."
                : "Couldn’t look through your library just now."}
            </p>
          )}
          {answered && query !== "" && options.length === 1 && !failed && (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">Nothing in your library has “{query}”.</p>
          )}
          {groups.map((group) => (
            <div key={group.title || "last"} role="group" aria-label={group.title || undefined} className="py-0.5">
              {group.title && (
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase" aria-hidden="true">
                  {group.title}
                </p>
              )}
              {group.options.map((option) => {
                const i = index++;
                return (
                  <Link
                    key={option.key}
                    id={`${listId}-${i}`}
                    href={option.href}
                    prefetch={false}
                    role="option"
                    aria-selected={i === current}
                    data-index={i}
                    tabIndex={-1}
                    onMouseMove={() => i !== current && setActive(i)}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      pick(option);
                    }}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm outline-none",
                      i === current && "bg-accent text-accent-foreground",
                    )}
                  >
                    <OptionBody option={option} />
                    {i === current && (
                      <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground max-sm:hidden" aria-hidden="true" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground max-sm:hidden">
          <span>
            <Key>↑</Key> <Key>↓</Key> to move
          </span>
          <span>
            <Key>Enter</Key> to open
          </span>
          <span>
            <Key>{mac ? "⌘" : "Ctrl"}</Key> <Key>Enter</Key> in a new tab
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-b-2 border-foreground/15 bg-background px-1 font-mono">
      {children}
    </kbd>
  );
}

const KIND_ICONS: Record<"author" | "series", LucideIcon> = { author: Feather, series: BookCopy };

/** Icons for the pages that aren't top-bar links. */
const PAGE_ICONS: Record<string, LucideIcon> = { account: Settings2, year: CalendarHeart };

function OptionBody({ option }: { option: Option }) {
  switch (option.kind) {
    case "book": {
      const { book } = option;
      const series =
        book.seriesName && `${book.seriesName}${book.seriesNumber != null ? ` #${book.seriesNumber}` : ""}`;
      return (
        <>
          <BookCover book={book} className="aspect-[2/3] w-7 shrink-0 rounded-[3px]" />
          <span className="grid min-w-0 flex-1">
            <span className="truncate font-medium">{fineText(book.title)}</span>
            <span className="truncate text-xs text-muted-foreground">
              {[book.authors.join(", "), series].filter(Boolean).join(" · ")}
            </span>
          </span>
          <StatusBadge
            status={book.status}
            statusKey={book.statusKey}
            className="max-w-36 shrink-0 max-[420px]:hidden"
          />
        </>
      );
    }
    case "author":
    case "series": {
      const Icon = KIND_ICONS[option.kind];
      return (
        <>
          <OptionIcon icon={Icon} />
          <span className="min-w-0 flex-1 truncate">{option.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {option.count} {option.count === 1 ? "book" : "books"}
          </span>
        </>
      );
    }
    case "shelf":
      return (
        <>
          <OptionIcon icon={option.smart ? Sparkles : Bookmark} />
          <span className="min-w-0 flex-1 truncate">{option.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{option.smart ? "Smart shelf" : "Shelf"}</span>
        </>
      );
    case "page": {
      const Icon =
        NAV_ICONS[option.page.key as keyof typeof NAV_ICONS] ?? PAGE_ICONS[option.page.key] ?? Search;
      return (
        <>
          <OptionIcon icon={Icon} />
          <span className="min-w-0 flex-1 truncate">{option.page.label}</span>
        </>
      );
    }
    case "search":
      return (
        <>
          <OptionIcon icon={Search} />
          <span className="min-w-0 flex-1 truncate">
            Search the library for <span className="font-medium">“{option.q}”</span>
          </span>
        </>
      );
  }
}

function OptionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex w-7 shrink-0 justify-center text-muted-foreground" aria-hidden="true">
      <Icon className="size-4" />
    </span>
  );
}
