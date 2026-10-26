/**
 * Theme registry for the picker. The actual palettes live in globals.css as
 * `[data-theme="…"]` CSS-variable blocks; this module only carries the
 * metadata the UI needs (names, light/dark mode, swatch colors).
 *
 * Three palettes (Dracula, Everforest, Solarized Light) are ported from
 * dagfinn2000/dashify; the rest are MyReads' own, and each one claims a
 * look no other theme has. Some put the accent across the colour wheel
 * from the page (wine with sea-glass, olive with lavender, chartreuse with
 * aubergine). Some are a kind of theme rather than a colour: duotones,
 * monochromes, high contrast in both modes, greyscale with one red, mixed
 * pastels, brown paper, blue-ink text. The newest are set apart by more
 * than colour: a picture behind the page, cards in a second colour,
 * outlined cards with hard shadows, a top bar of its own (see "Beyond
 * colour" in globals.css). Last is the Silly set, absurd on purpose, which
 * the palette menu lists apart. Themes that turned out to be lookalikes of
 * another were retired; RETIRED_THEMES sends their readers to the closest
 * one left.
 * Dark-mode themes additionally get the `dark` class on <html> so Tailwind
 * `dark:` variants (status badges etc.) follow along.
 */
export interface ThemeDef {
  id: string;
  name: string;
  mode: "light" | "dark";
  /** [background, accent] — used to draw the picker swatch. */
  swatch: [string, string];
  /** For a theme that is more than two colours: a CSS background drawn
   *  over the swatch's page colour (its page picture, its cards' second
   *  colour, its outlines or rules), so the swatch shows that too. */
  pattern?: string;
  /** Only on the Silly set: a line about the theme, shown on hover. */
  silly?: string;
  /** Brings its own picture behind the page (--page-gradient in its CSS
   *  block), which shows instead of the Background chosen in Preferences
   *  while this theme is on. */
  ownBackground?: true;
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
  { id: "everforest", name: "Everforest", mode: "dark", swatch: ["#2d353b", "#83c092"] },
  { id: "synthwave", name: "Synthwave", mode: "dark", swatch: ["#171122", "#ff5ed0"] },
  { id: "abyss", name: "Abyss", mode: "dark", swatch: ["#05202b", "#2ad4c4"] },
  { id: "sepia", name: "Sepia", mode: "dark", swatch: ["#3b2c21", "#e3b27a"] },
  { id: "bordeaux", name: "Bordeaux", mode: "dark", swatch: ["#2c0d14", "#6fd6c6"] },
  { id: "riviera", name: "Riviera", mode: "dark", swatch: ["#0f1640", "#ffb38a"] },
  { id: "provence", name: "Provence", mode: "dark", swatch: ["#21250d", "#c9b6ff"] },
  { id: "terracotta", name: "Terracotta", mode: "dark", swatch: ["#3d1a0c", "#8fd3ff"] },
  { id: "dragonfruit", name: "Dragonfruit", mode: "dark", swatch: ["#3a0a31", "#bff25c"] },
  { id: "iris", name: "Iris", mode: "dark", swatch: ["#2a0c47", "#ffd24d"] },
  {
    id: "blueprint",
    name: "Blueprint",
    mode: "dark",
    swatch: ["#143668", "#ffffff"],
    pattern:
      "repeating-linear-gradient(rgb(255 255 255 / 0.3) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.3) 0 1px, transparent 1px 6px)",
    ownBackground: true,
  },
  {
    id: "terminal",
    name: "Terminal",
    mode: "dark",
    swatch: ["#040d07", "#b6ffc8"],
    pattern: "repeating-linear-gradient(rgb(134 245 162 / 0.22) 0 1px, transparent 1px 3px)",
    ownBackground: true,
  },
  {
    id: "high-contrast-dark",
    name: "High Contrast Dark",
    mode: "dark",
    swatch: ["#000000", "#ffe500"],
    pattern: "radial-gradient(circle, transparent 0 56%, #ffffff 58% 66%, transparent 68%)",
  },
  {
    id: "art-deco",
    name: "Art Deco",
    mode: "dark",
    swatch: ["#0b1020", "#e6be5a"],
    pattern:
      "radial-gradient(circle, transparent 0 50%, #e6be5a 52% 55%, transparent 57% 62%, #e6be5a 64% 67%, transparent 69%)",
  },
  { id: "chalkboard", name: "Chalkboard", mode: "dark", swatch: ["#223a2e", "#f4e07a"] },
  {
    id: "ember",
    name: "Ember",
    mode: "dark",
    swatch: ["#1d0a07", "#ff8c42"],
    pattern: "radial-gradient(130% 70% at 50% 108%, #8a2a0a, #3a0d08 50%, #140806 85%)",
    ownBackground: true,
  },
  {
    id: "northern-lights",
    name: "Northern Lights",
    mode: "dark",
    swatch: ["#070b14", "#5ef0a8"],
    pattern:
      "radial-gradient(80% 60% at 25% 10%, rgb(46 204 140 / 0.55), transparent 70%), radial-gradient(70% 55% at 80% 15%, rgb(150 90 220 / 0.6), transparent 70%), linear-gradient(#0a1424, #05070d)",
    ownBackground: true,
  },
  {
    id: "lacquer",
    name: "Lacquer",
    mode: "dark",
    swatch: ["#0b0605", "#e8b964"],
    pattern: "radial-gradient(circle, #6b150f 0 50%, transparent 52%)",
  },
  {
    id: "arcade",
    name: "Arcade",
    mode: "dark",
    swatch: ["#16161d", "#00e5ff"],
    pattern:
      "radial-gradient(circle, transparent 0 38%, #00e5ff 40% 47%, transparent 49%), radial-gradient(circle at 58% 58%, transparent 0 38%, #ff2bd6 40% 47%, transparent 49%)",
  },
  { id: "darkroom", name: "Darkroom", mode: "dark", swatch: ["#0a0202", "#ff6a52"] },

  // Light palettes
  { id: "solarized-light", name: "Solarized Light", mode: "light", swatch: ["#fdf6e3", "#b58900"] },
  { id: "blossom", name: "Blossom", mode: "light", swatch: ["#f9d7e3", "#a8124f"] },
  { id: "cyanotype", name: "Cyanotype", mode: "light", swatch: ["#cfe1f6", "#17468c"] },
  { id: "sage", name: "Sage", mode: "light", swatch: ["#d4e0cb", "#2b5e3c"] },
  { id: "lilac", name: "Lilac", mode: "light", swatch: ["#e2d7fa", "#5c2db3"] },
  { id: "rhubarb", name: "Rhubarb", mode: "light", swatch: ["#f6cfc4", "#225c3d"] },
  { id: "majorelle", name: "Majorelle", mode: "light", swatch: ["#fae78a", "#2f35b8"] },
  { id: "lido", name: "Lido", mode: "light", swatch: ["#bdebe4", "#b0301a"] },
  { id: "absinthe", name: "Absinthe", mode: "light", swatch: ["#d6f28a", "#6a2c9e"] },
  { id: "marigold", name: "Marigold", mode: "light", swatch: ["#ffd9a8", "#ad0f68"] },
  {
    id: "high-contrast-light",
    name: "High Contrast Light",
    mode: "light",
    swatch: ["#ffffff", "#0033b3"],
    pattern: "radial-gradient(circle, transparent 0 56%, #000000 58% 66%, transparent 68%)",
  },
  {
    id: "newsprint",
    name: "Newsprint",
    mode: "light",
    swatch: ["#dcdcd7", "#b30d29"],
    pattern: "linear-gradient(transparent 30%, #121212 30% 36%, transparent 36% 42%, #121212 42% 45%, transparent 45%)",
    ownBackground: true,
  },
  { id: "macaron", name: "Macaron", mode: "light", swatch: ["#e2f4e9", "#a8336e"] },
  { id: "kraft", name: "Kraft", mode: "light", swatch: ["#dcc6a0", "#9a1f18"] },
  {
    id: "notebook",
    name: "Notebook",
    mode: "light",
    swatch: ["#fbfaf5", "#c41e3a"],
    pattern:
      "linear-gradient(90deg, transparent 22%, #e8a0a8 22% 26%, transparent 26%), repeating-linear-gradient(transparent 0 4px, #b9c6ea 4px 5px)",
    ownBackground: true,
  },
  {
    id: "pinstripe",
    name: "Pinstripe",
    mode: "light",
    swatch: ["#eeeeee", "#1c5fc8"],
    pattern:
      "radial-gradient(circle at 50% 50%, #e8f4ff 0 12%, #6aaaf2 30%, #1c5fc8 46%, transparent 48%), repeating-linear-gradient(#f5f5f5 0 1px, #dcdcdc 1px 2px)",
    ownBackground: true,
  },
  {
    id: "sunset",
    name: "Sunset",
    mode: "light",
    swatch: ["#ffd3cf", "#9c3300"],
    pattern: "linear-gradient(170deg, #ffe3c4, #ffc9cf 48%, #e9cdf3)",
    ownBackground: true,
  },
  {
    id: "opal",
    name: "Opal",
    mode: "light",
    swatch: ["#e2ecf2", "#0b5f70"],
    pattern: "linear-gradient(125deg, #ffd9ec, #fff1c7 25%, #d3f5e4 50%, #cfe7ff 75%, #e7dbff)",
    ownBackground: true,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    mode: "light",
    swatch: ["#f5b8fd", "#0a0a0a"],
    pattern:
      "radial-gradient(circle at 45% 45%, #ffffff 0 32%, transparent 34%), radial-gradient(circle at 59% 59%, #0a0a0a 0 32%, transparent 34%)",
  },
  {
    id: "mondrian",
    name: "Mondrian",
    mode: "light",
    swatch: ["#fbfaf6", "#d6001c"],
    pattern:
      "linear-gradient(90deg, transparent 27%, #111111 27% 32%, transparent 32%), linear-gradient(transparent 27%, #111111 27% 32%, transparent 32%), conic-gradient(from 0deg at 30% 30%, #ffd400 0 25%, #fbfaf6 0 50%, #1d4ed8 0 75%, #d6001c 0)",
  },

  // The Silly set
  {
    id: "blue-screen",
    name: "Blue Screen",
    mode: "dark",
    swatch: ["#0000aa", "#aaaaaa"],
    silly: "Your library ran into a problem.",
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
    pattern: "radial-gradient(circle, transparent 0 50%, #008080 52%)",
    silly: "It is now safe to turn off your library.",
    ownBackground: true,
  },
  {
    id: "under-construction",
    name: "Under Construction",
    mode: "dark",
    swatch: ["#1c1c1c", "#ffd400"],
    pattern:
      "linear-gradient(transparent 34%, #1c1c1c 34%), repeating-linear-gradient(-45deg, #ffd400 0 4px, #111111 4px 8px)",
    silly: "Best viewed in Netscape Navigator.",
  },
  {
    id: "ugly-sweater",
    name: "Ugly Sweater",
    mode: "dark",
    swatch: ["#730d16", "#ffd34d"],
    pattern: "radial-gradient(circle, #0d4a26 0 50%, transparent 52%)",
    silly: "Grandma knitted it. You have to wear it.",
    ownBackground: true,
  },
  {
    id: "spreadsheet",
    name: "Spreadsheet",
    mode: "light",
    swatch: ["#ffffff", "#217346"],
    pattern:
      "linear-gradient(#217346 0 30%, transparent 30%), repeating-linear-gradient(#d0d0d0 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, #d0d0d0 0 1px, transparent 1px 9px)",
    silly: "It’s not a library, it’s a workbook.",
    ownBackground: true,
  },
  {
    id: "party",
    name: "Party",
    mode: "light",
    swatch: ["#fffaf0", "#7b2cbf"],
    pattern:
      "radial-gradient(circle at 25% 28%, #ff5c8a 0 2px, transparent 2.5px), radial-gradient(circle at 74% 26%, #ffc93c 0 2px, transparent 2.5px), radial-gradient(circle at 28% 74%, #3ccfcf 0 2px, transparent 2.5px), radial-gradient(circle at 76% 72%, #5cd65c 0 2px, transparent 2.5px)",
    silly: "Somebody’s birthday, probably.",
    ownBackground: true,
  },
  {
    id: "camouflage",
    name: "Camouflage",
    mode: "dark",
    swatch: ["#262d19", "#ff7a1a"],
    pattern:
      "radial-gradient(40% 28% at 28% 30%, #32281a 98%, transparent), radial-gradient(38% 26% at 72% 70%, #161a0e 98%, transparent), radial-gradient(30% 22% at 76% 24%, #2a3217 98%, transparent), radial-gradient(30% 22% at 24% 76%, #161a0e 98%, transparent)",
    silly: "Your books can’t see you either.",
    ownBackground: true,
  },
  {
    id: "quest",
    name: "Quest",
    mode: "dark",
    swatch: ["#080818", "#ffd84a"],
    pattern: "radial-gradient(circle, #2438b8 0 44%, #f0f0f8 46% 54%, transparent 56%)",
    silly: "Your library gained a level!",
    ownBackground: true,
  },
];

/**
 * Themes retired as lookalikes of another, and the theme each one's readers
 * get instead: the closest one left. Kept so a choice stored before (on the
 * account, in this browser, for a part of the app, in a backup) still shows
 * something like what was picked.
 */
export const RETIRED_THEMES: Record<string, string> = {
  "catppuccin-mocha": "dracula",
  kanagawa: "dracula",
  "rose-pine": "synthwave",
  zenburn: "dark",
  gruvbox: "dark",
  obsidian: "high-contrast-dark",
  evergreen: "everforest",
  "catppuccin-latte": "lilac",
  "rose-pine-dawn": "lilac",
  "selenized-light": "solarized-light",
  "everforest-light": "sage",
  "kanagawa-lotus": "kraft",
  "gruvbox-light": "solarized-light",
  apricot: "solarized-light",
};

/** A theme id, or the one that replaced it if it was retired. */
const currentId = (id: string) =>
  Object.hasOwn(RETIRED_THEMES, id) ? RETIRED_THEMES[id] : id;

export const DARK_THEME_IDS = THEMES.filter((t) => t.mode === "dark").map(
  (t) => t.id,
);

/** The themes with a picture of their own behind the page, which wins
 *  over the Background chosen in Preferences. */
export const OWN_BACKGROUND_IDS = THEMES.filter((t) => t.ownBackground).map((t) => t.id);

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

/** Stored string → a setting whose ids all exist, or null. A retired theme
 *  reads as the one that replaced it. An auto pair has to be one light and
 *  one dark theme, or the switch would do nothing. */
export function parseThemeSetting(raw: string | null | undefined): ThemeSetting | null {
  if (!raw) return null;
  const mode = (id: string) => THEMES.find((t) => t.id === id)?.mode;
  if (raw.startsWith("auto:")) {
    const [light, dark] = raw.slice(5).split(":").map(currentId);
    if (mode(light) !== "light" || mode(dark) !== "dark") return null;
    return { kind: "auto", light, dark };
  }
  const id = currentId(raw);
  return mode(id) ? { kind: "fixed", id } : null;
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
 * The class on <html> naming the theme showing, alongside `data-theme`.
 * Rules that style what's inside the page for one theme start from this
 * class rather than the attribute (`.theme-is-quest .card`, not
 * `[data-theme="quest"] .card`). The two say the same, but a browser can
 * rule out a class nobody on the page has without looking, so another
 * theme's rules cost almost nothing; an attribute's value it has to check
 * from every element up to <html>, for every rule. With the restyled
 * themes that came to 40% of the time spent styling the library.
 */
export const THEME_CLASS_PREFIX = "theme-is-";

/**
 * Puts a stored theme setting on <html>: the `data-theme` palette, its
 * `theme-is-<id>` class (what restyles.css and the theme rules in
 * globals.css hang off; see THEME_CLASS_PREFIX), the `dark` class
 * Tailwind's `dark:` variants key on, `data-own-background`
 * while the theme brings its own picture behind the page (which then
 * replaces the reader's Background), the browser title bar colour, and —
 * for automatic mode — `data-theme-auto`, which remembers the pair so a
 * later system switch can pick the other one.
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
  ownBackgroundIds: string[],
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
  // A theme showing already, and this is another: nothing eases from the
  // old colours to the new ones (globals.css, "Theme changes"). Otherwise
  // every card, badge and button would start a transition for each colour
  // that changed, two thousand on a big library, each one three events
  // React handles, for a fade the theme's own reveal already covers. Let
  // go two frames on, once the new theme has been styled.
  const before = root.getAttribute("data-theme");
  if (before && before !== id && typeof requestAnimationFrame === "function") {
    root.setAttribute("data-theme-changing", "");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.removeAttribute("data-theme-changing");
      });
    });
  }
  // THEME_CLASS_PREFIX, written out: this body runs on its own. Any other
  // theme's class goes, not just the one `data-theme` names, as React may
  // have rewritten the classes from a newer server render.
  const themeClass = "theme-is-" + id;
  const stale = root.className.split(" ").filter(function (name) {
    return name.indexOf("theme-is-") === 0 && name !== themeClass;
  });
  for (let i = 0; i < stale.length; i++) root.classList.toggle(stale[i], false);
  root.setAttribute("data-theme", id);
  root.classList.toggle(themeClass, true);
  root.classList.toggle("dark", darkIds.indexOf(id) > -1);
  if (ownBackgroundIds.indexOf(id) > -1) root.setAttribute("data-own-background", "");
  else root.removeAttribute("data-own-background");

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
 * the page's theme (pageThemeSetting) is applied. A retired theme kept in
 * this browser reads as the one that replaced it (`retired`), as
 * parseThemeSetting does on the server. Also listens for the system
 * switching between light and dark, which only matters while an automatic
 * pair is showing. Same self-contained rule as applyThemeSetting.
 */
function themeInit(
  storageKey: string,
  deviceKey: string,
  partOf: Record<string, string>,
  darkIds: string[],
  backgrounds: Record<string, string>,
  ownBackgroundIds: string[],
  retired: Record<string, string>,
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
    const upgrade = function (setting: string | null) {
      if (!setting) return setting;
      const auto = setting.indexOf("auto:") === 0;
      const ids = (auto ? setting.slice(5) : setting).split(":").map(function (id) {
        return Object.prototype.hasOwnProperty.call(retired, id) ? retired[id] : id;
      });
      return (auto ? "auto:" : "") + ids.join(":");
    };
    account = upgrade(account);
    device = upgrade(device);
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
    apply(
      pageTheme(section, root.getAttribute("data-theme-parts"), partOf),
      darkIds,
      backgrounds,
      ownBackgroundIds,
    );
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function () {
        const pair = root.getAttribute("data-theme-auto");
        if (pair) apply("auto:" + pair, darkIds, backgrounds, ownBackgroundIds);
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
  OWN_BACKGROUND_IDS,
  RETIRED_THEMES,
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

/**
 * Puts <html> right for the page at `pathname` after a move without a full
 * load, or after the server rendered the layout again (ThemeSync):
 * `data-section`, the account's theme and the theme the page shows.
 *
 * `account` is the account's theme as the layout was last rendered, and
 * `before` what it was the last time this ran (undefined the first time).
 * It's only written when it changed: a move between pages doesn't render
 * the layout again, so `account` is still the theme from the first load,
 * and a theme picked since (the picker writes `data-theme-account` itself)
 * would be put back to it.
 */
export function syncPageTheme(
  pathname: string,
  account: string | null,
  before: string | null | undefined,
): void {
  const root = document.documentElement;
  const section = sectionOf(pathname);
  if (section) root.setAttribute("data-section", section);
  else root.removeAttribute("data-section");
  if (account && account !== before) root.setAttribute("data-theme-account", account);
  const next = pageThemeChange(section);
  if (next) applyThemeSetting(next, DARK_THEME_IDS, THEME_BACKGROUNDS, OWN_BACKGROUND_IDS);
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
