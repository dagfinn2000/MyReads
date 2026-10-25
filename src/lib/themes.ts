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
 * and peach. The last four put the accent across the colour wheel from the
 * page: wine with sea-glass, ultramarine with peach, pink with green, lemon
 * with cobalt. The seven after them do the same on grounds no other theme
 * uses: olive with lavender, clay with sky blue, magenta with lime, royal
 * purple with saffron, aqua with red, chartreuse with aubergine, orange
 * with magenta. Then come ten of other kinds: duotones, monochromes, high
 * contrast in both modes, greyscale with one red, mixed pastels, brown
 * paper and blue-ink text. Last is the Silly set, absurd on purpose, which
 * the palette menu lists apart.
 * Dark-mode themes additionally get the `dark` class on <html> so Tailwind
 * `dark:` variants (status badges etc.) follow along.
 */
export interface ThemeDef {
  id: string;
  name: string;
  mode: "light" | "dark";
  /** [background, accent] — used to draw the picker swatch. */
  swatch: [string, string];
  /** Only on the Silly set: a line about the theme, shown on hover. */
  silly?: string;
}

export const THEME_STORAGE_KEY = "myreads-theme";

/** A theme for this browser only ("Only on this device" in the picker):
 *  while one is stored it wins over the account's theme here, and the
 *  account's theme, which other devices keep, is left alone. */
export const DEVICE_THEME_STORAGE_KEY = "myreads-device-theme";

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
  { id: "bordeaux", name: "Bordeaux", mode: "dark", swatch: ["#2c0d14", "#6fd6c6"] },
  { id: "riviera", name: "Riviera", mode: "dark", swatch: ["#0f1640", "#ffb38a"] },
  { id: "provence", name: "Provence", mode: "dark", swatch: ["#21250d", "#c9b6ff"] },
  { id: "terracotta", name: "Terracotta", mode: "dark", swatch: ["#3d1a0c", "#8fd3ff"] },
  { id: "dragonfruit", name: "Dragonfruit", mode: "dark", swatch: ["#3a0a31", "#bff25c"] },
  { id: "iris", name: "Iris", mode: "dark", swatch: ["#2a0c47", "#ffd24d"] },
  { id: "blueprint", name: "Blueprint", mode: "dark", swatch: ["#143668", "#ffffff"] },
  { id: "terminal", name: "Terminal", mode: "dark", swatch: ["#040d07", "#b6ffc8"] },
  {
    id: "high-contrast-dark",
    name: "High Contrast Dark",
    mode: "dark",
    swatch: ["#000000", "#ffe500"],
  },
  { id: "art-deco", name: "Art Deco", mode: "dark", swatch: ["#0d0b07", "#e6be5a"] },
  { id: "chalkboard", name: "Chalkboard", mode: "dark", swatch: ["#223a2e", "#f4e07a"] },

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
  { id: "rhubarb", name: "Rhubarb", mode: "light", swatch: ["#f7e8e6", "#2d6a4a"] },
  { id: "majorelle", name: "Majorelle", mode: "light", swatch: ["#fbf5d2", "#3a3fc8"] },
  { id: "lido", name: "Lido", mode: "light", swatch: ["#d3f2ee", "#b8321a"] },
  { id: "absinthe", name: "Absinthe", mode: "light", swatch: ["#e8f4ac", "#6a2c9e"] },
  { id: "marigold", name: "Marigold", mode: "light", swatch: ["#ffd9a8", "#ad0f68"] },
  {
    id: "high-contrast-light",
    name: "High Contrast Light",
    mode: "light",
    swatch: ["#ffffff", "#0033b3"],
  },
  { id: "newsprint", name: "Newsprint", mode: "light", swatch: ["#dcdcd7", "#b30d29"] },
  { id: "macaron", name: "Macaron", mode: "light", swatch: ["#e2f4e9", "#a8336e"] },
  { id: "kraft", name: "Kraft", mode: "light", swatch: ["#dcc6a0", "#9a1f18"] },
  { id: "notebook", name: "Notebook", mode: "light", swatch: ["#fbfaf5", "#c41e3a"] },

  // The Silly set
  {
    id: "blue-screen",
    name: "Blue Screen",
    mode: "dark",
    swatch: ["#0000aa", "#aaaaaa"],
    silly: "Your library ran into a problem and needs to restart.",
  },
  {
    id: "glowstick",
    name: "Glowstick",
    mode: "dark",
    swatch: ["#0a0012", "#b6ff00"],
    silly: "Every colour at the party, all at once.",
  },
  {
    id: "hot-dog-stand",
    name: "Hot Dog Stand",
    mode: "light",
    swatch: ["#ffd800", "#b30000"],
    silly: "Ketchup and mustard. Fries not included.",
  },
  {
    id: "toxic",
    name: "Toxic",
    mode: "light",
    swatch: ["#39ff14", "#6a00b8"],
    silly: "Glows in the dark. Do not lick.",
  },
  {
    id: "desktop-95",
    name: "Desktop 95",
    mode: "light",
    swatch: ["#c0c0c0", "#000080"],
    silly: "It is now safe to turn off your library.",
  },
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

/** Where a page is in the app, as `data-section` on <html>: for the
 *  reader's own CSS to aim at, and to find the page's own theme. */
export const SECTIONS = [
  "library",
  "book",
  "series",
  "stats",
  "reading",
  "quotes",
  "room",
  "account",
] as const;

/**
 * The section a path is in, or "" outside them (the sign-in pages). Add
 * book and Check count as the library; a book's page and its edit page as
 * "book". Self-contained, like applyThemeSetting below: the pre-paint
 * script runs its source.
 */
export function sectionOf(pathname: string): string {
  const parts = pathname.split("/");
  if (parts[1] === "books") {
    return parts[2] && parts[2] !== "new" && parts[2] !== "check" ? "book" : "library";
  }
  return ["series", "stats", "reading", "quotes", "room", "account"].indexOf(parts[1]) > -1
    ? parts[1]
    : "";
}

/** The parts of the app that can have a theme of their own (Preferences). */
export const THEME_PARTS = ["library", "stats", "reading", "quotes", "room", "account"] as const;
export type ThemePart = (typeof THEME_PARTS)[number];
export type PartThemes = Partial<Record<ThemePart, string>>;

/** Which part's theme each section shows: the library's covers its books
 *  and the Series page too. */
export const PART_OF_SECTION: Record<(typeof SECTIONS)[number], ThemePart> = {
  library: "library",
  book: "library",
  series: "library",
  stats: "stats",
  reading: "reading",
  quotes: "quotes",
  room: "room",
  account: "account",
};

/**
 * The theme setting a page shows: its part's own theme, or else this
 * device's theme, or else the account's. `parts` is the reader's part
 * themes as JSON (`data-theme-parts` on <html>, from Preferences); the
 * device's and the account's settings are read from <html>, where the
 * pre-paint script and the picker keep them. Self-contained, for the
 * pre-paint script.
 */
export function pageThemeSetting(
  section: string,
  parts: string | null,
  partOf: Record<string, string>,
): string {
  const root = document.documentElement;
  let own = "";
  try {
    own = (JSON.parse(parts || "{}") as Record<string, string>)[partOf[section]] || "";
  } catch {}
  return (
    own ||
    root.getAttribute("data-theme-device") ||
    root.getAttribute("data-theme-account") ||
    "light"
  );
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
 * that is the account's theme, mirrored into localStorage so signed-out
 * pages keep the look. Without one, the localStorage copy is. It goes on
 * <html> as `data-theme-account`, this device's own theme (if it has one)
 * as `data-theme-device`, and the page's section as `data-section`; then
 * the page's theme (pageThemeSetting) is applied. Also listens for the
 * system switching between light and dark, which only matters while an
 * automatic pair is showing. Same self-contained rule as applyThemeSetting.
 */
function themeInit(
  storageKey: string,
  deviceKey: string,
  partOf: Record<string, string>,
  darkIds: string[],
  backgrounds: Record<string, string>,
  apply: typeof applyThemeSetting,
  sectionFor: typeof sectionOf,
  pageTheme: typeof pageThemeSetting,
): void {
  try {
    const root = document.documentElement;
    const auto = root.getAttribute("data-theme-auto");
    let account = auto ? "auto:" + auto : root.getAttribute("data-theme");
    let device: string | null = null;
    try {
      // localStorage can throw in some privacy modes.
      if (account) localStorage.setItem(storageKey, account);
      else account = localStorage.getItem(storageKey);
      device = localStorage.getItem(deviceKey);
    } catch {}
    // Nothing stored anywhere means the default theme, applied all the
    // same so the title bar gets its colour.
    root.setAttribute("data-theme-account", account || "light");
    // A device theme naming a theme that no longer exists is ignored.
    const known = function (setting: string) {
      const ids = setting.indexOf("auto:") === 0 ? setting.slice(5).split(":") : [setting];
      return ids.every(function (id) {
        return Object.prototype.hasOwnProperty.call(backgrounds, id);
      });
    };
    if (device && known(device)) root.setAttribute("data-theme-device", device);
    const section = sectionFor(location.pathname);
    if (section) root.setAttribute("data-section", section);
    apply(pageTheme(section, root.getAttribute("data-theme-parts"), partOf), darkIds, backgrounds);
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
export const THEME_INIT_SCRIPT = `(${themeInit.toString()})(${[
  THEME_STORAGE_KEY,
  DEVICE_THEME_STORAGE_KEY,
  PART_OF_SECTION,
  DARK_THEME_IDS,
  THEME_BACKGROUNDS,
]
  .map((value) => JSON.stringify(value))
  .join(",")},${applyThemeSetting.toString()},${sectionOf.toString()},${pageThemeSetting.toString()});`;

/**
 * The theme setting the page in `section` should show now
 * (pageThemeSetting), or null when it already shows it. For after
 * something it depends on changed: the page, the picker, Preferences.
 */
export function pageThemeChange(section: string): string | null {
  const root = document.documentElement;
  const next = pageThemeSetting(section, root.getAttribute("data-theme-parts"), PART_OF_SECTION);
  const auto = root.getAttribute("data-theme-auto");
  return next === (auto ? "auto:" + auto : root.getAttribute("data-theme")) ? null : next;
}

/** The reader's part themes, checked: a part's setting that doesn't parse
 *  (a theme since removed) is dropped, so the part follows the rest. */
export function parsePartThemes(raw: unknown): PartThemes {
  const out: PartThemes = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const part of THEME_PARTS) {
    const value = (raw as Record<string, unknown>)[part];
    const setting = typeof value === "string" ? parseThemeSetting(value) : null;
    if (setting) out[part] = serializeThemeSetting(setting);
  }
  return out;
}
