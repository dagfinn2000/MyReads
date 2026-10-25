"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, MonitorSmartphone, Palette, SunMoon } from "lucide-react";
import { saveTheme } from "@/lib/actions/theme";
import { motionAllowed } from "@/lib/motion";
import {
  DARK_THEME_IDS,
  DEFAULT_AUTO_THEMES,
  DEVICE_THEME_STORAGE_KEY,
  PART_OF_SECTION,
  THEME_BACKGROUNDS,
  THEME_STORAGE_KEY,
  THEMES,
  applyThemeSetting,
  pageThemeChange,
  parseThemeSetting,
  serializeThemeSetting,
  type ThemeDef,
  type ThemeSetting,
} from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Dashify-style theme picker: a grid of palette swatches in a dropdown.
 * Selection is applied to <html> (data-theme attribute + dark class),
 * persisted in localStorage for this browser, and saved on the account so
 * signing in elsewhere brings the theme along (the root layout server-
 * renders the saved theme; the inline init script covers signed-out pages
 * from localStorage).
 *
 * "Match system" switches to automatic mode: one light and one dark theme,
 * swapped as the phone or computer changes between light and dark. In that
 * mode a click on a theme fills the slot for its kind.
 *
 * "Only on this device" keeps the choice in this browser alone: it wins
 * over the account's theme here, and other devices keep the account's.
 * A part of the app with a theme of its own (Preferences) keeps showing
 * that; the picker then chooses for everywhere else.
 *
 * The themes come in three groups, each under its heading: light, dark,
 * and the Silly set.
 */
/**
 * The picker reads <html>, where the theme lives: `data-theme-account` and
 * `data-theme-device` (the pre-paint script and this picker write them),
 * `data-theme-parts` (server-rendered from Preferences) and `data-section`,
 * plus what's applied, `data-theme` and `data-theme-auto`. That makes it
 * external state React doesn't own, so it's read as such rather than
 * mirrored into component state: a MutationObserver reports changes.
 */
const WATCHED = [
  "data-theme",
  "data-theme-auto",
  "data-theme-account",
  "data-theme-device",
  "data-theme-parts",
  "data-section",
];

/** The palette menu's groups of themes, each under its heading. */
const THEME_GROUPS: { label: string; hint?: string; has: (t: ThemeDef) => boolean }[] = [
  { label: "Light", has: (t) => t.mode === "light" && !t.silly },
  { label: "Dark", has: (t) => t.mode === "dark" && !t.silly },
  { label: "Silly", hint: "not recommended", has: (t) => !!t.silly },
];

function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: WATCHED });
  return () => observer.disconnect();
}

/** The theme chosen for everywhere, as one string so the snapshot
 *  compares by value: this device's own, or else the account's. */
const readTheme = () => {
  const root = document.documentElement;
  return root.getAttribute("data-theme-device") ?? root.getAttribute("data-theme-account") ?? "light";
};

const readDeviceOnly = () => document.documentElement.hasAttribute("data-theme-device");

/** Whether the page shows a theme of its own, from Preferences. */
const readOwnTheme = () => {
  const root = document.documentElement;
  const part = PART_OF_SECTION[root.getAttribute("data-section") as keyof typeof PART_OF_SECTION];
  try {
    return !!part && !!JSON.parse(root.getAttribute("data-theme-parts") || "{}")[part];
  } catch {
    return false;
  }
};

// null and false on the server: the attributes live on an element this
// component's server render can't see, and claiming a selection there
// would mismatch hydration.
const readThemeOnServer = () => null;
const readFalseOnServer = () => false;

/** Which theme of a setting shows right now. */
function showing(setting: ThemeSetting): string {
  if (setting.kind === "fixed") return setting.id;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? setting.dark : setting.light;
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private-mode storage failure just means the choice won't persist
  }
}

/**
 * Runs `change` (the theme switch) inside a view transition that reveals
 * the new colours in a circle growing out of `origin`, the palette button.
 * The browser snapshots the page before and after; the after snapshot is
 * clipped to the growing circle (the `theme-reveal` rule in globals.css
 * turns off the default cross-fade). Browsers without view transitions,
 * and readers with animations off, get the instant switch.
 */
function revealTheme(change: () => void, origin: HTMLElement | null) {
  if (!origin || !document.startViewTransition || !motionAllowed()) {
    change();
    return;
  }
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const root = document.documentElement;
  root.classList.add("theme-reveal");
  const transition = document.startViewTransition(change);
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 550,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    // A transition can be skipped (another one started, the tab was
    // hidden); the change itself has still happened.
    .catch(() => {});
  transition.finished
    .finally(() => root.classList.remove("theme-reveal"))
    .catch(() => {});
}

/** A setting in the menu, drawn as a switch. */
function SwitchRow({
  icon: Icon,
  label,
  hint,
  checked,
  onClick,
}: {
  icon: typeof SunMoon;
  label: string;
  hint: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:border-ring/60"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        {label}
        {checked && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full bg-muted transition-colors",
          checked && "bg-primary",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

export function ThemePicker() {
  const raw = useSyncExternalStore(subscribeToTheme, readTheme, readThemeOnServer);
  const deviceOnly = useSyncExternalStore(subscribeToTheme, readDeviceOnly, readFalseOnServer);
  const ownTheme = useSyncExternalStore(subscribeToTheme, readOwnTheme, readFalseOnServer);
  const current: ThemeSetting | null = raw === null ? null : parseThemeSetting(raw);
  const auto = current?.kind === "auto" ? current : null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  /** Shows the page's theme again, after what it's made from changed. */
  function show() {
    const next = pageThemeChange(document.documentElement.getAttribute("data-section") ?? "");
    if (next) {
      revealTheme(
        () => applyThemeSetting(next, DARK_THEME_IDS, THEME_BACKGROUNDS),
        triggerRef.current,
      );
    }
  }

  function apply(setting: ThemeSetting) {
    const value = serializeThemeSetting(setting);
    const root = document.documentElement;
    if (deviceOnly) {
      root.setAttribute("data-theme-device", value);
      store(DEVICE_THEME_STORAGE_KEY, value);
    } else {
      root.setAttribute("data-theme-account", value);
      store(THEME_STORAGE_KEY, value);
      // Fire-and-forget account sync; a no-op when signed out (login page)
      // and nothing the picker needs to wait for.
      saveTheme(value).catch(() => {});
    }
    // No setState: the attribute writes are the state change, and the
    // observer re-renders from them.
    show();
  }

  function pick(theme: ThemeDef) {
    if (auto) apply({ ...auto, [theme.mode]: theme.id });
    else apply({ kind: "fixed", id: theme.id });
  }

  function toggleAuto() {
    const applied = current ? showing(current) : "light";
    if (auto) {
      // Back to one fixed theme: keep whichever one is showing right now.
      apply({ kind: "fixed", id: applied });
      return;
    }
    // The theme in use takes its own slot; the other starts at the default.
    const mode = THEMES.find((t) => t.id === applied)?.mode;
    apply({
      kind: "auto",
      light: mode === "light" ? applied : DEFAULT_AUTO_THEMES.light,
      dark: mode === "dark" ? applied : DEFAULT_AUTO_THEMES.dark,
    });
  }

  /** On: this device starts from the theme it shows now, which stays
   *  until something else is picked. Off: back to the account's theme. */
  function toggleDeviceOnly() {
    const root = document.documentElement;
    if (deviceOnly) {
      root.removeAttribute("data-theme-device");
      store(DEVICE_THEME_STORAGE_KEY, null);
    } else {
      const value = raw ?? "light";
      root.setAttribute("data-theme-device", value);
      store(DEVICE_THEME_STORAGE_KEY, value);
    }
    show();
  }

  const isSelected = (t: ThemeDef) =>
    auto ? auto[t.mode] === t.id : current?.kind === "fixed" && current.id === t.id;

  const themeButton = (t: ThemeDef) => (
    <button
      key={t.id}
      type="button"
      onClick={() => pick(t)}
      title={t.silly}
      className={cn(
        "flex items-center gap-2 rounded-md border p-1.5 text-left text-xs transition-colors hover:border-ring/60",
        isSelected(t) && "border-primary ring-1 ring-primary",
      )}
    >
      <span
        className="flex h-6 w-8 shrink-0 items-center justify-center rounded border border-black/10"
        style={{ backgroundColor: t.swatch[0] }}
      >
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: t.swatch[1] }}
        />
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{t.name}</span>
      {isSelected(t) && <Check className="size-3.5 shrink-0" />}
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="ghost" size="icon" title="Theme">
          <Palette />
          <span className="sr-only">Choose theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-76 p-2">
        <div className="mb-2 grid gap-1.5">
          <SwitchRow
            icon={SunMoon}
            label="Match system light/dark"
            hint="Pick one light and one dark theme below."
            checked={!!auto}
            onClick={toggleAuto}
          />
          <SwitchRow
            icon={MonitorSmartphone}
            label="Only on this device"
            hint="Your other devices keep your account’s theme."
            checked={deviceOnly}
            onClick={toggleDeviceOnly}
          />
          {ownTheme && (
            <p className="rounded-md bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
              This page has a theme of its own, set in{" "}
              <Link
                href="/account#themes"
                onClick={() => setOpen(false)}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Preferences
              </Link>
              . What you pick here shows everywhere else.
            </p>
          )}
        </div>
        {THEME_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mt-3 mb-1.5 px-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{group.label}</span>
              {group.hint && ` · ${group.hint}`}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {THEMES.filter(group.has).map(themeButton)}
            </div>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
