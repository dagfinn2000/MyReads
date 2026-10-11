/**
 * Theme registry for the picker. The actual palettes live in globals.css as
 * `[data-theme="…"]` CSS-variable blocks; this module only carries the
 * metadata the UI needs (names, light/dark mode, swatch colors).
 *
 * Most palettes are ported from dagfinn2000/dashify so both apps share a
 * look. The rest are additions that deliberately sit outside that family —
 * the ported set is entirely muted editor colourschemes, with every light a
 * warm cream and every dark a low-saturation grey or violet. Each addition
 * claims a hue or character the set didn't have: neon, deep water, true
 * black, brown, forest green, and tinted papers in pink, blue, green, violet
 * and peach.
 * Dark-mode themes additionally get the `dark` class on <html> so Tailwind
 * `dark:` variants (status badges etc.) follow along.
 */
export interface ThemeDef {
  id: string;
  name: string;
  mode: "light" | "dark";
  /** [background, accent] — used to draw the picker swatch. */
  swatch: [string, string];
}

export const THEME_STORAGE_KEY = "myreads-theme";

export const THEMES: ThemeDef[] = [
  // Built-in shadcn bases (no data-theme CSS block needed).
  { id: "light", name: "Light", mode: "light", swatch: ["#ffffff", "#343434"] },
  { id: "dark", name: "Dark", mode: "dark", swatch: ["#252525", "#ebebeb"] },

  // Dark palettes
  { id: "dracula", name: "Dracula", mode: "dark", swatch: ["#282a36", "#bd93f9"] },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", mode: "dark", swatch: ["#1e1e2e", "#cba6f7"] },
  { id: "gruvbox", name: "Gruvbox", mode: "dark", swatch: ["#282828", "#fabd2f"] },
  { id: "everforest", name: "Everforest", mode: "dark", swatch: ["#2d353b", "#83c092"] },
  { id: "kanagawa", name: "Kanagawa", mode: "dark", swatch: ["#1f1f28", "#e6c384"] },
  { id: "rose-pine", name: "Rosé Pine", mode: "dark", swatch: ["#191724", "#ebbcba"] },
  { id: "zenburn", name: "Zenburn", mode: "dark", swatch: ["#3f3f3f", "#dfaf8f"] },
  { id: "synthwave", name: "Synthwave", mode: "dark", swatch: ["#171122", "#ff5ed0"] },
  { id: "abyss", name: "Abyss", mode: "dark", swatch: ["#05202b", "#2ad4c4"] },
  { id: "obsidian", name: "Obsidian", mode: "dark", swatch: ["#000000", "#4c8dff"] },
  { id: "sepia", name: "Sepia", mode: "dark", swatch: ["#241a15", "#d9a066"] },
  { id: "evergreen", name: "Evergreen", mode: "dark", swatch: ["#0d1f16", "#7ee787"] },

  // Light palettes
  { id: "everforest-light", name: "Everforest Light", mode: "light", swatch: ["#fdf6e3", "#35a77c"] },
  { id: "gruvbox-light", name: "Gruvbox Light", mode: "light", swatch: ["#f2e5bc", "#af3a03"] },
  { id: "kanagawa-lotus", name: "Kanagawa Lotus", mode: "light", swatch: ["#e5ddb0", "#624c83"] },
  { id: "selenized-light", name: "Selenized Light", mode: "light", swatch: ["#ece3cc", "#c25d1e"] },
  { id: "solarized-light", name: "Solarized Light", mode: "light", swatch: ["#fdf6e3", "#b58900"] },
  { id: "catppuccin-latte", name: "Catppuccin Latte", mode: "light", swatch: ["#eff1f5", "#8839ef"] },
  { id: "rose-pine-dawn", name: "Rosé Pine Dawn", mode: "light", swatch: ["#faf4ed", "#907aa9"] },
  { id: "blossom", name: "Blossom", mode: "light", swatch: ["#fff5f7", "#c2185b"] },
  { id: "cyanotype", name: "Cyanotype", mode: "light", swatch: ["#eef4fb", "#1b4f9c"] },
  { id: "sage", name: "Sage", mode: "light", swatch: ["#f0f5f0", "#2f6b46"] },
  { id: "lilac", name: "Lilac", mode: "light", swatch: ["#f5f2fc", "#6d40c4"] },
  { id: "apricot", name: "Apricot", mode: "light", swatch: ["#fff2e8", "#b8502d"] },
];

export const DARK_THEME_IDS = THEMES.filter((t) => t.mode === "dark").map(
  (t) => t.id,
);

/** Each theme's page background, for the browser's title bar colour
 *  (the installed app's top bar on a phone). */
export const THEME_BACKGROUNDS: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.swatch[0]]),
);

/**
 * A stored theme choice. Either one fixed theme ("dracula"), or "auto" with
 * one light and one dark theme that follow the system's light/dark mode —
 * written "auto:<light id>:<dark id>" in User.theme and localStorage, so the
 * existing column and storage key hold both kinds.
 */
export type ThemeSetting =
  | { kind: "fixed"; id: string }
  | { kind: "auto"; light: string; dark: string };

export const DEFAULT_AUTO_THEMES = { light: "light", dark: "dark" } as const;

/** Stored string → a setting whose ids all exist, or null. An auto pair has
 *  to be one light and one dark theme, or the switch would do nothing. */
export function parseThemeSetting(raw: string | null | undefined): ThemeSetting | null {
  if (!raw) return null;
  const mode = (id: string) => THEMES.find((t) => t.id === id)?.mode;
  if (raw.startsWith("auto:")) {
    const [light, dark] = raw.slice(5).split(":");
    if (mode(light) !== "light" || mode(dark) !== "dark") return null;
    return { kind: "auto", light, dark };
  }
  return mode(raw) ? { kind: "fixed", id: raw } : null;
}

export function serializeThemeSetting(setting: ThemeSetting): string {
  return setting.kind === "auto" ? `auto:${setting.light}:${setting.dark}` : setting.id;
}

/**
 * Puts a stored theme setting on <html>: the `data-theme` palette, the
 * `dark` class Tailwind's `dark:` variants key on, the browser title bar
 * colour, and — for automatic mode — `data-theme-auto`, which remembers the
 * pair so a later system switch can pick the other one.
 *
 * Used both by the theme picker and, as source text, by the pre-paint script
 * below. That second use is why it takes everything as arguments and touches
 * nothing outside its own body: the script is this function's code, run
 * before any module has loaded.
 */
export function applyThemeSetting(
  setting: string,
  darkIds: string[],
  backgrounds: Record<string, string>,
): void {
  const root = document.documentElement;
  let id = setting;
  if (setting.indexOf("auto:") === 0) {
    const pair = setting.slice(5).split(":");
    root.setAttribute("data-theme-auto", pair[0] + ":" + pair[1]);
    id = window.matchMedia("(prefers-color-scheme: dark)").matches ? pair[1] : pair[0];
  } else {
    root.removeAttribute("data-theme-auto");
  }
  root.setAttribute("data-theme", id);
  root.classList.toggle("dark", darkIds.indexOf(id) > -1);

  // The title bar colour. This tag is only ever written here: if the server
  // rendered one too, React would manage it and the two would fight.
  const color = backgrounds[id];
  if (!color) return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

/**
 * Body of the pre-paint script. The server puts the signed-in user's saved
 * setting on <html> (`data-theme`, or `data-theme-auto` for automatic mode);
 * that wins and is mirrored into localStorage so signed-out pages keep the
 * look. Without one, the localStorage copy applies. Also listens for the
 * system switching between light and dark, which only matters while
 * automatic mode is on. Same self-contained rule as applyThemeSetting.
 */
function themeInit(
  storageKey: string,
  darkIds: string[],
  backgrounds: Record<string, string>,
  apply: typeof applyThemeSetting,
): void {
  try {
    const root = document.documentElement;
    const auto = root.getAttribute("data-theme-auto");
    let setting = auto ? "auto:" + auto : root.getAttribute("data-theme");
    try {
      // localStorage can throw in some privacy modes.
      if (setting) localStorage.setItem(storageKey, setting);
      else setting = localStorage.getItem(storageKey);
    } catch {}
    // Nothing stored anywhere means the default theme, applied all the
    // same so the title bar gets its colour.
    apply(setting || "light", darkIds, backgrounds);
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function () {
        const pair = root.getAttribute("data-theme-auto");
        if (pair) apply("auto:" + pair, darkIds, backgrounds);
      });
  } catch {}
}

/**
 * Inline script injected before hydration so the stored theme applies on
 * first paint (no flash of the default theme). Built from the two functions
 * above, so the picker and the first paint can never disagree about what a
 * setting means.
 */
export const THEME_INIT_SCRIPT = `(${themeInit.toString()})(${JSON.stringify(
  THEME_STORAGE_KEY,
)},${JSON.stringify(DARK_THEME_IDS)},${JSON.stringify(
  THEME_BACKGROUNDS,
)},${applyThemeSetting.toString()});`;
