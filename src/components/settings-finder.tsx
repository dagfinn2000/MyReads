"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { matchScore } from "@/lib/quick-find";
import { SETTINGS, queryForms } from "@/lib/settings-index";
import { motionAllowed } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Find a setting: a box at the top of the Account page that finds any
 * setting on it as you type, and takes you to it. It reads the page itself
 * (every Preferences row, section heading and card title inside
 * [data-settings-root]), so a new setting is found without being listed
 * anywhere. The words a setting also goes by come from lib/settings-index.ts.
 * /account?find=<words> (quick find's settings) jumps to the best match.
 */

interface Found {
  title: string;
  section: string | null;
  row: HTMLElement;
  score: number;
}

const LIMIT = 8;

function text(el: Element | null | undefined): string {
  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** Every setting on the page: its row, its name, its section and hint. */
function scan(root: HTMLElement): Omit<Found, "score">[] {
  const rows = new Map<HTMLElement, Omit<Found, "score">>();
  const candidates = root.querySelectorAll<HTMLElement>(
    "[data-setting], section > h3, [data-slot=card-title], label, p.font-medium, legend",
  );
  for (const el of candidates) {
    if (el.closest("[data-settings-finder]")) continue;
    const titled = el.closest<HTMLElement>("[data-setting]");
    const row =
      titled ??
      (el.matches("section > h3")
        ? el.closest("section")!
        : el.matches("[data-slot=card-title]")
          ? (el.closest<HTMLElement>("[data-slot=card]") ?? el)
          : (el.parentElement ?? el));
    if (rows.has(row)) continue;
    const title = titled?.dataset.setting || text(el);
    if (!title || title.length > 80) continue;
    const heading = el.matches("section > h3") ? null : row.closest("section")?.querySelector(":scope > h3");
    rows.set(row, { title, section: heading ? text(heading) : null, row });
  }
  return [...rows.values()];
}

/** Other words for a setting, from the index, by its name. */
const AKA = new Map(SETTINGS.map((s) => [s.label, s.aka ?? []]));

function rank(all: Omit<Found, "score">[], q: string): Found[] {
  const forms = queryForms(q);
  const score = (name: string) => Math.max(...forms.map((f) => matchScore(name, f)));
  return all
    .map((f) => {
      const hint = f.row.querySelector(".text-xs.text-muted-foreground")?.textContent ?? "";
      const best = Math.max(
        score(f.title) * 3,
        ...(AKA.get(f.title) ?? []).map((a) => score(a) * 2),
        score(hint) * 0.5,
        f.section ? score(`${f.section} ${f.title}`) : 0,
      );
      return { ...f, score: best };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMIT);
}

/** Scrolls to a setting, marks it for a moment and puts focus on it. */
function goTo(row: HTMLElement) {
  row.scrollIntoView({ block: "center", behavior: motionAllowed() ? "smooth" : "auto" });
  row.classList.remove("setting-found");
  // Restart the mark when the same setting is found again.
  void row.offsetWidth;
  row.classList.add("setting-found");
  window.setTimeout(() => row.classList.remove("setting-found"), 2400);
  const control = row.querySelector<HTMLElement>(
    "button, [role=combobox], input:not([type=hidden]), select, textarea, a[href]",
  );
  control?.focus({ preventScroll: true });
}

export function SettingsFinder() {
  const params = useSearchParams();
  const asked = params.get("find");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback((value: string) => {
    const root = document.querySelector<HTMLElement>("[data-settings-root]");
    const next = root && value.trim() ? rank(scan(root), value) : [];
    setFound(next);
    setActive(0);
    return next;
  }, []);

  // Sent here by quick find, or a link: find it and go there once the page
  // has laid itself out.
  useEffect(() => {
    if (!asked) return;
    const t = window.setTimeout(() => {
      setQ(asked);
      const hits = search(asked);
      if (hits[0]) goTo(hits[0].row);
    }, 150);
    return () => window.clearTimeout(t);
  }, [asked, search]);

  const pick = (f: Found) => {
    setOpen(false);
    goTo(f.row);
  };

  const showing = open && q.trim() !== "";
  return (
    <div data-settings-finder="" className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showing && found[active] ? `${listId}-${active}` : undefined}
        aria-label="Find a setting"
        placeholder="Find a setting: ribbon, fonts, time zone…"
        value={q}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          search(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            if (found.length) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : found.length - 1)) % found.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (found[active]) pick(found[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-lg border bg-card pr-3 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      {showing && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Settings"
          className="absolute inset-x-0 top-full z-30 mt-1 grid max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {found.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground" role="presentation">
              No setting by that name.
            </li>
          ) : (
            found.map((f, i) => (
              <li
                key={`${f.section}:${f.title}:${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(f)}
                className={cn(
                  "flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-3 py-2 text-sm",
                  i === active && "bg-accent text-accent-foreground",
                )}
              >
                <span className="truncate font-medium">{f.title}</span>
                {f.section && <span className="shrink-0 text-xs text-muted-foreground">{f.section}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
