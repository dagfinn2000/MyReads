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
 * outlined cards with hard shadows, cards under glass, a top bar of its
 * own (see "Beyond colour" in globals.css). Last is the Silly set, absurd
 * on purpose, which the palette menu lists apart. The palette menu sorts
 * the rest by kind (THEME_CATEGORIES). Several come as a light and a dark
 * pair, the second sharing the first's rules: Terminal and Terminal
 * Light, Blueprint and Whiteprint, Newsprint, Notebook, E-Paper and
 * Letterpress and their Dark sides. Themes that turned out
 * to be lookalikes of another, or too busy to live with, were retired;
 * RETIRED_THEMES sends their readers to the closest one left.
 * Dark-mode themes additionally get the `dark` class on <html> so Tailwind
 * `dark:` variants (status badges etc.) follow along.
 */
/** The kinds of theme the palette menu sorts them into, in its order.
 *  Within a kind the light themes come first, then the dark ones. */
export const THEME_CATEGORIES = [
  { id: "plain", label: "Plain" },
  { id: "reading", label: "Easy reading" },
  { id: "glass", label: "Glass" },
  { id: "pairs", label: "Colour pairs" },
  { id: "craft", label: "Design and craft" },
  { id: "paper", label: "Paper and print" },
  { id: "scenes", label: "Scenes" },
  { id: "screens", label: "Desktops and screens" },
  { id: "silly", label: "Silly", hint: "not recommended" },
] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES)[number]["id"];

export interface ThemeDef {
  id: string;
  name: string;
  mode: "light" | "dark";
  /** Which kind of theme it is, for the palette menu (THEME_CATEGORIES).
   *  The Silly set is "silly", and only it. */
  category: ThemeCategory;
  /** A few words on what the theme is for, or which theme it's the light
   *  or dark side of, shown on hover after "Light theme" or "Dark theme". */
  note?: string;
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

/** A kind's themes in the order the menu shows them: the light ones
 *  first, then the dark, each in the order THEMES lists them. */
export function themesOfCategory(themes: ThemeDef[], category: ThemeCategory): ThemeDef[] {
  const members = themes.filter((t) => t.category === category);
  return [...members.filter((t) => t.mode === "light"), ...members.filter((t) => t.mode === "dark")];
}

/** What the second line says about a theme under the pointer: a silly
 *  one's joke, or whether it's light or dark and its note, if it has one. */
export function themeLine(t: ThemeDef): string {
  if (t.silly) return t.silly;
  const mode = `${t.mode === "light" ? "Light" : "Dark"} theme`;
  return t.note ? `${mode} · ${t.note}` : mode;
}

export const THEME_STORAGE_KEY = "myreads-theme";

/** A theme for this browser only ("Only on this device" in the picker):
 *  while one is stored it wins over the account's theme here, and the
 *  account's theme, which other devices keep, is left alone. */
export const DEVICE_THEME_STORAGE_KEY = "myreads-device-theme";

export const THEMES: ThemeDef[] = [
  // Built-in shadcn bases (no data-theme CSS block needed).
  { id: "light", name: "Light", mode: "light", category: "plain", swatch: ["#ffffff", "#343434"] },
  { id: "dark", name: "Dark", mode: "dark", category: "plain", swatch: ["#252525", "#ebebeb"] },

  // Dark palettes
  { id: "dracula", name: "Dracula", mode: "dark", category: "plain", swatch: ["#282a36", "#bd93f9"] },
  { id: "everforest", name: "Everforest", mode: "dark", category: "plain", swatch: ["#2d353b", "#83c092"] },
  { id: "synthwave", name: "Synthwave", mode: "dark", category: "plain", swatch: ["#171122", "#ff5ed0"] },
  { id: "abyss", name: "Abyss", mode: "dark", category: "plain", swatch: ["#05202b", "#2ad4c4"] },
  { id: "sepia", name: "Sepia", mode: "dark", category: "reading", swatch: ["#3b2c21", "#e3b27a"] },
  { id: "bordeaux", name: "Bordeaux", mode: "dark", category: "pairs", swatch: ["#2c0d14", "#6fd6c6"] },
  { id: "riviera", name: "Riviera", mode: "dark", category: "pairs", swatch: ["#0f1640", "#ffb38a"] },
  { id: "provence", name: "Provence", mode: "dark", category: "pairs", swatch: ["#21250d", "#c9b6ff"] },
  { id: "terracotta", name: "Terracotta", mode: "dark", category: "pairs", swatch: ["#3d1a0c", "#8fd3ff"] },
  { id: "dragonfruit", name: "Dragonfruit", mode: "dark", category: "pairs", swatch: ["#3a0a31", "#bff25c"] },
  { id: "iris", name: "Iris", mode: "dark", category: "pairs", swatch: ["#2a0c47", "#ffd24d"] },
  {
    id: "blueprint",
    name: "Blueprint",
    mode: "dark",
    category: "paper",
    swatch: ["#143668", "#ffffff"],
    pattern:
      "repeating-linear-gradient(rgb(255 255 255 / 0.3) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.3) 0 1px, transparent 1px 6px)",
    ownBackground: true,
  },
  {
    id: "terminal",
    name: "Terminal",
    mode: "dark",
    category: "screens",
    swatch: ["#040d07", "#b6ffc8"],
    pattern: "repeating-linear-gradient(rgb(134 245 162 / 0.22) 0 1px, transparent 1px 3px)",
    ownBackground: true,
  },
  {
    id: "high-contrast-dark",
    name: "High Contrast Dark",
    mode: "dark",
    category: "reading",
    swatch: ["#000000", "#ffe500"],
    pattern: "radial-gradient(circle, transparent 0 56%, #ffffff 58% 66%, transparent 68%)",
  },
  {
    id: "art-deco",
    name: "Art Deco",
    mode: "dark",
    category: "craft",
    swatch: ["#0b1020", "#e6be5a"],
    pattern:
      "radial-gradient(circle, transparent 0 50%, #e6be5a 52% 55%, transparent 57% 62%, #e6be5a 64% 67%, transparent 69%)",
  },
  { id: "chalkboard", name: "Chalkboard", mode: "dark", category: "paper", swatch: ["#223a2e", "#f4e07a"] },
  {
    id: "ember",
    name: "Ember",
    mode: "dark",
    category: "scenes",
    swatch: ["#1d0a07", "#ff8c42"],
    pattern: "radial-gradient(130% 70% at 50% 108%, #8a2a0a, #3a0d08 50%, #140806 85%)",
    ownBackground: true,
  },
  {
    id: "northern-lights",
    name: "Northern Lights",
    mode: "dark",
    category: "scenes",
    swatch: ["#070b14", "#5ef0a8"],
    pattern:
      "radial-gradient(80% 60% at 25% 10%, rgb(46 204 140 / 0.55), transparent 70%), radial-gradient(70% 55% at 80% 15%, rgb(150 90 220 / 0.6), transparent 70%), linear-gradient(#0a1424, #05070d)",
    ownBackground: true,
  },
  {
    id: "lacquer",
    name: "Lacquer",
    mode: "dark",
    category: "craft",
    swatch: ["#0b0605", "#e8b964"],
    pattern: "radial-gradient(circle, #6b150f 0 50%, transparent 52%)",
  },
  {
    id: "arcade",
    name: "Arcade",
    mode: "dark",
    category: "screens",
    swatch: ["#16161d", "#00e5ff"],
    pattern:
      "radial-gradient(circle, transparent 0 38%, #00e5ff 40% 47%, transparent 49%), radial-gradient(circle at 58% 58%, transparent 0 38%, #ff2bd6 40% 47%, transparent 49%)",
  },
  { id: "darkroom", name: "Darkroom", mode: "dark", category: "reading", swatch: ["#0a0202", "#ff6a52"] },
  {
    id: "hyprland",
    name: "Hyprland",
    mode: "dark",
    category: "screens",
    swatch: ["#1e1e2e", "#74c7ec"],
    pattern:
      "radial-gradient(circle, #1e1e2e 0 49%, transparent 51% 65%, #0b1120 67%), linear-gradient(157deg, #33ccff, #00ff99)",
    ownBackground: true,
  },
  {
    id: "fluent",
    name: "Fluent",
    mode: "dark",
    category: "screens",
    swatch: ["#1d1b22", "#c9a8ff"],
    pattern:
      "radial-gradient(circle at 62% 56%, #fff4fd 0 6%, transparent 18%), conic-gradient(from 20deg at 62% 56%, #5a2fd6, #e05cc8, #4b45e6, #b04ff0, #5a2fd6), linear-gradient(#1d1b22, #1d1b22)",
    ownBackground: true,
  },
  {
    id: "vision",
    name: "visionOS",
    mode: "dark",
    category: "screens",
    swatch: ["#252e2c", "#f5f5f7"],
    pattern:
      "linear-gradient(transparent 22%, rgb(60 70 68 / 0.85) 22% 78%, transparent 78%), linear-gradient(#7fb0e0 0 40%, #8ea3b8 40% 55%, #2f5240 55% 78%, #5f8fa6 78%)",
    ownBackground: true,
  },
  {
    id: "mojave",
    name: "Mojave",
    mode: "dark",
    category: "screens",
    swatch: ["#1f2024", "#409cff"],
    pattern:
      "radial-gradient(120% 60% at 25% 100%, #3d4f88 0 45%, transparent 46%), radial-gradient(110% 55% at 90% 100%, #2b3c74 0 50%, transparent 51%), linear-gradient(#0d1838, #3a4a7e)",
    ownBackground: true,
  },
  {
    id: "metro",
    name: "Metro",
    mode: "dark",
    category: "screens",
    swatch: ["#1d1d1d", "#1ba1e2"],
    pattern:
      "linear-gradient(90deg, transparent 46%, #1d1d1d 46% 54%, transparent 54%), linear-gradient(transparent 46%, #1d1d1d 46% 54%, transparent 54%), conic-gradient(#008a00 0 25%, #d80073 0 50%, #a20025 0 75%, #0050ef 0)",
  },
  {
    id: "noir",
    name: "Noir",
    mode: "dark",
    category: "scenes",
    swatch: ["#0d0e11", "#e9dfc9"],
    pattern:
      "radial-gradient(circle at 100% 0%, transparent 18%, #0d0e11 74%), repeating-linear-gradient(-22deg, rgb(241 228 198 / 0.5) 0 2.5px, transparent 2.5px 4.5px)",
    ownBackground: true,
  },
  {
    id: "fernery",
    name: "Fernery",
    mode: "dark",
    category: "scenes",
    swatch: ["#0b1712", "#f3a9a0"],
    pattern:
      "radial-gradient(circle at 0% 100%, transparent 0 46%, #0b1712 70%), repeating-linear-gradient(55deg, #2c5a45 0 1.5px, transparent 1.5px 3.5px), repeating-linear-gradient(-35deg, #1d4031 0 1.5px, transparent 1.5px 3.5px)",
    ownBackground: true,
  },
  {
    id: "gallery",
    name: "Gallery",
    mode: "dark",
    category: "scenes",
    swatch: ["#0f2a2e", "#e3c48a"],
    pattern:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='6' y='4' width='12' height='16' fill='%23c9a352'/%3E%3Crect x='7.5' y='5.5' width='9' height='13' fill='%23efe7d6'/%3E%3Crect x='9' y='7' width='6' height='10' fill='%238c3b2a'/%3E%3C/svg%3E\")",
    ownBackground: true,
  },
  {
    id: "editor",
    name: "Editor",
    mode: "dark",
    category: "screens",
    swatch: ["#1e1f22", "#4ec9b0"],
    pattern:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='7' height='24' fill='%232b2d30'/%3E%3Crect x='9' y='6' width='7' height='2' fill='%23569cd6'/%3E%3Crect x='11' y='10' width='9' height='2' fill='%23dcdcaa'/%3E%3Crect x='11' y='14' width='6' height='2' fill='%23ce9178'/%3E%3Crect x='9' y='18' width='5' height='2' fill='%234ec9b0'/%3E%3C/svg%3E\")",
  },
  {
    id: "ubuntu",
    name: "Ubuntu",
    mode: "dark",
    category: "screens",
    swatch: ["#2c2c2c", "#f2814b"],
    pattern:
      "linear-gradient(90deg, #161616 0 24%, transparent 24%), linear-gradient(transparent 0 16%, #2c2c2c 16% 84%, transparent 84%), radial-gradient(130% 100% at 95% 100%, #f47a3a, #e95420 22%, #77216f 62%, #2c001e)",
    ownBackground: true,
  },
  {
    id: "eclipse",
    name: "Eclipse",
    mode: "dark",
    category: "scenes",
    swatch: ["#06070b", "#d3def5"],
    pattern:
      "radial-gradient(circle at 62% 40%, #06070b 0 22%, #f4f7ff 24%, rgb(186 202 245 / 0.4) 32%, rgb(140 160 220 / 0.12) 44%, transparent 58%)",
    ownBackground: true,
  },
  {
    id: "rooftops",
    name: "Rooftops",
    mode: "dark",
    category: "scenes",
    swatch: ["#151b28", "#ffd27a"],
    pattern:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M0 24V15l4-3 4 3v-2h3v-3l5 4v2h4l4-3v11z' fill='%230b0f18'/%3E%3Crect x='5' y='17' width='1.6' height='2' fill='%23ffd27a'/%3E%3Crect x='17' y='19' width='1.6' height='2' fill='%23ffd27a'/%3E%3C/svg%3E\")",
    ownBackground: true,
  },
  {
    id: "transit",
    name: "Transit",
    mode: "dark",
    category: "craft",
    swatch: ["#14171c", "#ff8f3f"],
    pattern:
      "radial-gradient(circle, #ffffff 0 13%, #ff8f3f 14% 24%, transparent 25%), linear-gradient(transparent 44%, #ff8f3f 44% 56%, transparent 56%), linear-gradient(90deg, transparent 44%, #3ecf8e 44% 56%, transparent 56%)",
  },
  {
    id: "sashiko",
    name: "Sashiko",
    mode: "dark",
    category: "craft",
    swatch: ["#16203a", "#ece3d0"],
    pattern:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='4' y='4' width='16' height='16' fill='%231d2845'/%3E%3Crect x='6' y='6' width='12' height='12' fill='none' stroke='%23ece3d0' stroke-width='.8' stroke-dasharray='2.2 1.3'/%3E%3C/svg%3E\")",
  },
  {
    id: "halo",
    name: "Halo",
    mode: "dark",
    category: "craft",
    swatch: ["#0c0d14", "#b3b8ff"],
    pattern: "radial-gradient(circle, #161823 0 32%, rgb(150 156 255 / 0.6) 38%, rgb(150 156 255 / 0.15) 52%, transparent 64%)",
  },
  {
    id: "lamplight",
    name: "Lamplight",
    mode: "dark",
    category: "scenes",
    swatch: ["#15100c", "#7ad6a3"],
    pattern:
      "radial-gradient(45% 22% at 24% 0%, rgb(120 214 160 / 0.55), transparent), radial-gradient(100% 90% at 20% 0%, rgb(255 196 128 / 0.5), transparent 72%)",
    ownBackground: true,
  },
  {
    id: "fireflies",
    name: "Fireflies",
    mode: "dark",
    category: "scenes",
    swatch: ["#0b1a1b", "#d4f06a"],
    pattern:
      "radial-gradient(circle at 30% 62%, #f0ffaa 0 5%, rgb(214 240 106 / 0.35) 12%, transparent 22%), radial-gradient(circle at 70% 44%, #f0ffaa 0 4%, rgb(214 240 106 / 0.3) 10%, transparent 18%), radial-gradient(circle at 58% 80%, #f0ffaa 0 3%, rgb(214 240 106 / 0.3) 8%, transparent 15%)",
    ownBackground: true,
  },
  {
    id: "graphite",
    name: "Graphite",
    mode: "dark",
    category: "screens",
    swatch: ["#2a2d33", "#ff8fae"],
    pattern:
      "radial-gradient(circle at 36% 34%, #3b3f47 0 22%, transparent 48%), radial-gradient(circle at 66% 68%, #15171b 0 18%, transparent 46%)",
  },
  {
    id: "midnight",
    name: "Midnight",
    mode: "dark",
    category: "glass",
    swatch: ["#0c1828", "#a6dcff"],
    pattern:
      "radial-gradient(circle at 15% 10%, rgb(48 96 180 / 0.75), transparent 62%), radial-gradient(circle at 90% 90%, rgb(104 72 184 / 0.65), transparent 62%)",
    ownBackground: true,
  },
  {
    id: "smoke",
    name: "Smoke",
    mode: "dark",
    category: "glass",
    swatch: ["#1c1a19", "#ecc9a8"],
    pattern:
      "radial-gradient(circle at 90% 90%, rgb(196 116 48 / 0.6), transparent 62%), radial-gradient(circle at 10% 10%, rgb(140 128 116 / 0.3), transparent 55%)",
    ownBackground: true,
  },
  {
    id: "dusk",
    name: "Dusk",
    mode: "dark",
    category: "glass",
    swatch: ["#1b1830", "#f4b6a6"],
    pattern:
      "linear-gradient(180deg, #17152b 0%, #2a1b3a 55%, #6a2c3a 100%)",
    ownBackground: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    mode: "dark",
    category: "glass",
    swatch: ["#0a1f19", "#c8f2dc"],
    pattern:
      "radial-gradient(circle at 85% 10%, rgb(30 150 100 / 0.65), transparent 62%), radial-gradient(circle at 10% 90%, rgb(16 112 96 / 0.6), transparent 62%)",
    ownBackground: true,
  },
  {
    id: "velvet",
    name: "Velvet",
    mode: "dark",
    category: "craft",
    swatch: ["#24121c", "#f2b8c6"],
    pattern:
      "radial-gradient(circle at 30% 22%, rgb(255 200 222 / 0.2), transparent 55%), linear-gradient(180deg, transparent 50%, rgb(0 0 0 / 0.25))",
  },
  {
    id: "copper",
    name: "Copper",
    mode: "dark",
    category: "craft",
    swatch: ["#17242a", "#e8a07a"],
    pattern:
      "radial-gradient(circle, transparent 0 60%, #e8a07a 63% 68%, transparent 71%)",
  },
  {
    id: "carbon",
    name: "Carbon",
    mode: "dark",
    category: "craft",
    swatch: ["#0e0f10", "#ff9b85"],
    pattern:
      "radial-gradient(circle at 50% 35%, transparent 0 58%, rgb(255 255 255 / 0.4) 61% 64%, transparent 67%)",
  },
  {
    id: "cocoa",
    name: "Cocoa",
    mode: "dark",
    category: "plain",
    swatch: ["#231814", "#a9d3ee"],
    pattern:
      "radial-gradient(120% 70% at 50% 0%, #3d2c23, transparent 75%)",
    ownBackground: true,
  },
  {
    id: "night-light",
    name: "Night Light",
    mode: "dark",
    category: "reading",
    note: "no blue light at all, for reading in bed",
    swatch: ["#120a00", "#ff8c00"],
    pattern: "radial-gradient(circle at 50% 0%, #3a2200, transparent 70%)",
    ownBackground: true,
  },
  {
    id: "colour-safe-dark",
    name: "Colour Safe Dark",
    mode: "dark",
    category: "reading",
    note: "for colour blindness: blue and orange, never red against green",
    swatch: ["#14171b", "#56b4e9"],
    pattern: "linear-gradient(135deg, transparent 0 58%, #e69f00 58% 68%, transparent 68%)",
  },
  {
    id: "e-paper-dark",
    name: "E-Paper Dark",
    mode: "dark",
    category: "paper",
    note: "the dark side of E-Paper",
    swatch: ["#191917", "#dcd9cf"],
    pattern:
      "linear-gradient(90deg, transparent 22%, #191917 22% 78%, transparent 78%), linear-gradient(transparent 28%, #b5b2a8 28% 32%, transparent 32% 42%, #b5b2a8 42% 46%, transparent 46% 56%, #b5b2a8 56% 60%, transparent 60% 70%, #b5b2a8 70% 74%, transparent 74%)",
  },
  {
    id: "letterpress-dark",
    name: "Letterpress Dark",
    mode: "dark",
    category: "paper",
    note: "the dark side of Letterpress",
    swatch: ["#22211a", "#c5d08e"],
    pattern: "radial-gradient(circle at 50% 38%, transparent 0 52%, rgb(0 0 0 / 0.55) 72%)",
  },
  {
    id: "newsprint-dark",
    name: "Newsprint Dark",
    mode: "dark",
    category: "paper",
    note: "the dark side of Newsprint",
    swatch: ["#1c1c1a", "#ff8a94"],
    pattern: "linear-gradient(transparent 30%, #ecebe6 30% 36%, transparent 36% 42%, #ecebe6 42% 45%, transparent 45%)",
    ownBackground: true,
  },
  {
    id: "notebook-dark",
    name: "Notebook Dark",
    mode: "dark",
    category: "paper",
    note: "the dark side of Notebook",
    swatch: ["#1b1d24", "#ff7d92"],
    pattern:
      "linear-gradient(90deg, transparent 22%, #b8606e 22% 26%, transparent 26%), repeating-linear-gradient(transparent 0 4px, #3a4152 4px 5px)",
    ownBackground: true,
  },
  {
    id: "garnet",
    name: "Garnet",
    mode: "dark",
    category: "glass",
    note: "the dark side of Rose Quartz",
    swatch: ["#1a0d10", "#ffc4b8"],
    pattern:
      "radial-gradient(circle at 12% 12%, rgb(160 30 60 / 0.75), transparent 62%), radial-gradient(circle at 88% 88%, rgb(200 80 110 / 0.55), transparent 62%)",
    ownBackground: true,
  },
  {
    id: "crystal",
    name: "Crystal",
    mode: "dark",
    category: "glass",
    note: "the dark side of Prism",
    swatch: ["#101116", "#d4c4ff"],
    pattern:
      "linear-gradient(124deg, transparent 28%, rgb(255 160 160 / 0.45) 38%, rgb(255 218 140 / 0.45) 46%, rgb(150 228 172 / 0.45) 54%, rgb(140 196 255 / 0.45) 62%, rgb(198 164 255 / 0.45) 70%, transparent 80%)",
  },

  // Light palettes
  { id: "solarized-light", name: "Solarized Light", mode: "light", category: "plain", swatch: ["#fdf6e3", "#b58900"] },
  { id: "blossom", name: "Blossom", mode: "light", category: "plain", swatch: ["#f9d7e3", "#a8124f"] },
  { id: "cyanotype", name: "Cyanotype", mode: "light", category: "plain", swatch: ["#cfe1f6", "#17468c"] },
  { id: "sage", name: "Sage", mode: "light", category: "plain", swatch: ["#d4e0cb", "#2b5e3c"] },
  { id: "lilac", name: "Lilac", mode: "light", category: "plain", swatch: ["#e2d7fa", "#5c2db3"] },
  { id: "rhubarb", name: "Rhubarb", mode: "light", category: "pairs", swatch: ["#f6cfc4", "#225c3d"] },
  { id: "majorelle", name: "Majorelle", mode: "light", category: "pairs", swatch: ["#fae78a", "#2f35b8"] },
  { id: "lido", name: "Lido", mode: "light", category: "pairs", swatch: ["#bdebe4", "#b0301a"] },
  { id: "absinthe", name: "Absinthe", mode: "light", category: "pairs", swatch: ["#d6f28a", "#6a2c9e"] },
  { id: "marigold", name: "Marigold", mode: "light", category: "pairs", swatch: ["#ffd9a8", "#ad0f68"] },
  {
    id: "high-contrast-light",
    name: "High Contrast Light",
    mode: "light",
    category: "reading",
    swatch: ["#ffffff", "#0033b3"],
    pattern: "radial-gradient(circle, transparent 0 56%, #000000 58% 66%, transparent 68%)",
  },
  {
    id: "newsprint",
    name: "Newsprint",
    mode: "light",
    category: "paper",
    swatch: ["#dcdcd7", "#b30d29"],
    pattern: "linear-gradient(transparent 30%, #121212 30% 36%, transparent 36% 42%, #121212 42% 45%, transparent 45%)",
    ownBackground: true,
  },
  { id: "macaron", name: "Macaron", mode: "light", category: "craft", swatch: ["#e2f4e9", "#a8336e"] },
  { id: "kraft", name: "Kraft", mode: "light", category: "paper", swatch: ["#dcc6a0", "#9a1f18"] },
  {
    id: "notebook",
    name: "Notebook",
    mode: "light",
    category: "paper",
    swatch: ["#fbfaf5", "#c41e3a"],
    pattern:
      "linear-gradient(90deg, transparent 22%, #e8a0a8 22% 26%, transparent 26%), repeating-linear-gradient(transparent 0 4px, #b9c6ea 4px 5px)",
    ownBackground: true,
  },
  {
    id: "pinstripe",
    name: "Pinstripe",
    mode: "light",
    category: "screens",
    swatch: ["#eeeeee", "#1c5fc8"],
    pattern:
      "radial-gradient(circle at 50% 50%, #e8f4ff 0 12%, #6aaaf2 30%, #1c5fc8 46%, transparent 48%), repeating-linear-gradient(#f5f5f5 0 1px, #dcdcdc 1px 2px)",
    ownBackground: true,
  },
  {
    id: "sunset",
    name: "Sunset",
    mode: "light",
    category: "scenes",
    swatch: ["#ffd3cf", "#9c3300"],
    pattern: "linear-gradient(170deg, #ffe3c4, #ffc9cf 48%, #e9cdf3)",
    ownBackground: true,
  },
  {
    id: "opal",
    name: "Opal",
    mode: "light",
    category: "scenes",
    swatch: ["#e2ecf2", "#0b5f70"],
    pattern: "linear-gradient(125deg, #ffd9ec, #fff1c7 25%, #d3f5e4 50%, #cfe7ff 75%, #e7dbff)",
    ownBackground: true,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    mode: "light",
    category: "craft",
    swatch: ["#f5b8fd", "#0a0a0a"],
    pattern:
      "radial-gradient(circle at 45% 45%, #ffffff 0 32%, transparent 34%), radial-gradient(circle at 59% 59%, #0a0a0a 0 32%, transparent 34%)",
  },
  {
    id: "mondrian",
    name: "Mondrian",
    mode: "light",
    category: "craft",
    swatch: ["#fbfaf6", "#d6001c"],
    pattern:
      "linear-gradient(90deg, transparent 27%, #111111 27% 32%, transparent 32%), linear-gradient(transparent 27%, #111111 27% 32%, transparent 32%), conic-gradient(from 0deg at 30% 30%, #ffd400 0 25%, #fbfaf6 0 50%, #1d4ed8 0 75%, #d6001c 0)",
  },
  {
    id: "aero",
    name: "Aero",
    mode: "light",
    category: "screens",
    swatch: ["#ffffff", "#0066cc"],
    pattern:
      "linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.45) 30% 38%, transparent 38%), radial-gradient(circle, transparent 0 34%, #9cc9f0 36% 52%, #135aad 54%)",
    ownBackground: true,
  },
  {
    id: "golden-gate",
    name: "Golden Gate",
    mode: "light",
    category: "screens",
    swatch: ["#f2f2f5", "#0a64d2"],
    pattern:
      "radial-gradient(120% 90% at 0% 100%, #e9cf9b 0 34%, transparent 35%), radial-gradient(110% 95% at 100% 0%, #3b3f7a 0 30%, transparent 31%), radial-gradient(140% 120% at 20% 110%, #c9c2b8 0 52%, transparent 53%), linear-gradient(120deg, #f1e3c4, #b9b8c4 55%, #4a4e86)",
    ownBackground: true,
  },
  {
    id: "kde-plasma",
    name: "KDE Plasma",
    mode: "light",
    category: "screens",
    swatch: ["#eff0f1", "#1c6b9f"],
    pattern:
      "radial-gradient(circle at 28% 34%, rgb(234 202 178 / 0.95) 0 12%, rgb(214 168 166 / 0.5) 19%, transparent 29%), radial-gradient(circle at 76% 20%, rgb(206 160 188 / 0.85) 0 8%, transparent 18%), radial-gradient(75% 55% at 0% 100%, #c96c58 0 40%, transparent 72%), linear-gradient(170deg, #3d3b67 6%, #4d6896 28%, #8fa9bf 44%, #b7bcc0 56%, #8fa9bf 70%, #6489bd 90%)",
    ownBackground: true,
  },
  {
    id: "gnome",
    name: "GNOME",
    mode: "light",
    category: "screens",
    swatch: ["#fafafb", "#1c71d8"],
    pattern:
      "linear-gradient(#000000 0 22%, transparent 22%), linear-gradient(90deg, #2d3cff 0 16%, transparent 16% 84%, #3a27ff 84%), linear-gradient(#1a40ff 0 31%, transparent 31% 85%, #4404e0 85%)",
    ownBackground: true,
  },
  {
    id: "big-sur",
    name: "Big Sur",
    mode: "light",
    category: "screens",
    swatch: ["#f7f6fa", "#8e3a92"],
    pattern:
      "radial-gradient(140% 90% at 0% 130%, #3346d6 0 40%, transparent 41%), radial-gradient(130% 90% at 30% 120%, #d453b8 0 45%, transparent 46%), radial-gradient(120% 80% at 70% 110%, #ffb05c 0 40%, transparent 41%), linear-gradient(#e4ecff, #f3e6ff)",
    ownBackground: true,
  },
  {
    id: "ventura",
    name: "Ventura",
    mode: "light",
    category: "screens",
    swatch: ["#f3f1ee", "#a84f00"],
    pattern:
      "radial-gradient(circle at 60% 55%, #fffdf5 0 10%, transparent 24%), conic-gradient(from 10deg at 60% 55%, #ffc93c, #ff7a52, #ffb84d, #f2611f, #ffd04a, #ff8f5a, #ffc93c)",
    ownBackground: true,
  },
  {
    id: "luna",
    name: "Luna",
    mode: "light",
    category: "screens",
    swatch: ["#ece9d8", "#0054e3"],
    pattern:
      "linear-gradient(#0058ee 0 26%, #3a93ff 26% 30%, transparent 30%), radial-gradient(120% 60% at 30% 100%, #4f9e24 0 48%, transparent 50%), linear-gradient(#3f86ea, #b6d5f6)",
    ownBackground: true,
  },
  {
    id: "card-catalogue",
    name: "Card Catalogue",
    mode: "light",
    category: "paper",
    swatch: ["#e6cfa6", "#5b2b84"],
    pattern:
      "linear-gradient(transparent 33%, #d24a43 33% 37%, transparent 37%), linear-gradient(transparent 24%, #fcf8ec 24% 76%, transparent 76%), repeating-linear-gradient(#e6cfa6 0 3px, #d3b583 3px 4px)",
    ownBackground: true,
  },
  {
    id: "material-you",
    name: "Material You",
    mode: "light",
    category: "screens",
    swatch: ["#fef7ff", "#6750a4"],
    pattern:
      "radial-gradient(62% 30% at 50% 50%, #e8def8 0 96%, transparent 100%), linear-gradient(transparent 76%, #f3edf7 76%)",
  },
  {
    id: "porcelain",
    name: "Porcelain",
    mode: "light",
    category: "screens",
    swatch: ["#e6e9ef", "#a83a5c"],
    pattern:
      "radial-gradient(circle at 36% 34%, #ffffff 0 22%, transparent 48%), radial-gradient(circle at 66% 68%, #b4bccb 0 18%, transparent 46%)",
  },
  {
    id: "ink-wash",
    name: "Ink Wash",
    mode: "light",
    category: "paper",
    swatch: ["#f2efe6", "#2b4262"],
    pattern:
      "linear-gradient(transparent 50%, #f2efe6 86%), radial-gradient(70% 46% at 74% 100%, #b6b1a7 0 96%, transparent 100%), radial-gradient(80% 62% at 24% 100%, #d0cbc1 0 96%, transparent 100%), radial-gradient(circle at 76% 26%, #b8321f 0 9%, transparent 11%)",
    ownBackground: true,
  },
  {
    id: "delft",
    name: "Delft",
    mode: "light",
    category: "craft",
    swatch: ["#f3f6fb", "#1f46a0"],
    pattern:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='5' y='5' width='14' height='14' rx='1.2' fill='%231f46a0'/%3E%3Crect x='6.6' y='6.6' width='10.8' height='10.8' fill='none' stroke='%23ffffff' stroke-opacity='.75' stroke-width='.6'/%3E%3C/svg%3E\")",
  },
  {
    id: "airmail",
    name: "Airmail",
    mode: "light",
    category: "paper",
    swatch: ["#e7edf6", "#b3162b"],
    pattern:
      "radial-gradient(circle, #e7edf6 0 52%, transparent 54%), repeating-linear-gradient(-45deg, #c8102e 0 3px, #ffffff 3px 4.5px, #1d3a8a 4.5px 7.5px, #ffffff 7.5px 9px)",
  },
  {
    id: "paperback",
    name: "Paperback",
    mode: "light",
    category: "paper",
    swatch: ["#fbf7ee", "#a84200"],
    pattern: "linear-gradient(#ee7d2b 0 30%, transparent 30% 70%, #ee7d2b 70%)",
  },
  {
    id: "sunroom",
    name: "Sunroom",
    mode: "light",
    category: "scenes",
    swatch: ["#e9e2d8", "#6b2d5c"],
    pattern:
      "linear-gradient(118deg, transparent 14%, rgb(255 250 236 / 0.95) 14% 34%, transparent 34% 39%, rgb(255 250 236 / 0.95) 39% 59%, transparent 59%)",
    ownBackground: true,
  },
  {
    id: "e-paper",
    name: "E-Paper",
    mode: "light",
    category: "paper",
    swatch: ["#e8e7e3", "#1a1a1a"],
    pattern:
      "linear-gradient(90deg, transparent 22%, #e8e7e3 22% 78%, transparent 78%), linear-gradient(transparent 28%, #3d3d3b 28% 32%, transparent 32% 42%, #3d3d3b 42% 46%, transparent 46% 56%, #3d3d3b 56% 60%, transparent 60% 70%, #3d3d3b 70% 74%, transparent 74%)",
  },
  {
    id: "dog-ear",
    name: "Dog-Ear",
    mode: "light",
    category: "paper",
    swatch: ["#ebe5ec", "#2b5a4c"],
    pattern: "linear-gradient(45deg, #fdfbfd 0 58%, #d9cedb 58% 72%, transparent 72%)",
  },
  {
    id: "seventies",
    name: "Seventies",
    mode: "light",
    category: "craft",
    swatch: ["#f6ead7", "#6b3a1f"],
    pattern:
      "radial-gradient(circle at 100% 100%, transparent 0 34%, #f0cf86 34% 48%, #e3a137 48% 62%, #c9622b 62% 76%, #7a4122 76% 90%, transparent 90%)",
  },
  {
    id: "haiku",
    name: "Haiku",
    mode: "light",
    category: "screens",
    swatch: ["#d8d8d8", "#285889"],
    pattern:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23336698'/%3E%3Cpath d='M4 5.5h9v3H4z' fill='%23ffcb00' stroke='%23555' stroke-width='.5'/%3E%3Cpath d='M4 8.5h20V24H4z' fill='%23d8d8d8' stroke='%23555' stroke-width='.5'/%3E%3C/svg%3E\")",
    ownBackground: true,
  },
  {
    id: "frost",
    name: "Frost",
    mode: "light",
    category: "glass",
    swatch: ["#dfeaf4", "#4a4f7d"],
    pattern:
      "radial-gradient(circle at 85% 12%, #bcd4f0, transparent 62%), radial-gradient(circle at 12% 90%, #d6d0f0, transparent 62%)",
    ownBackground: true,
  },
  {
    id: "daybreak",
    name: "Daybreak",
    mode: "light",
    category: "glass",
    swatch: ["#f1e9e4", "#7d4c12"],
    pattern:
      "linear-gradient(180deg, #e2e4f3 0%, #f6ece8 55%, #fdcfa2 100%)",
    ownBackground: true,
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    mode: "light",
    category: "glass",
    swatch: ["#f5e5e3", "#8e2f4f"],
    pattern:
      "radial-gradient(circle at 15% 15%, #f2c9d0, transparent 62%), radial-gradient(circle at 88% 88%, #e4cdec, transparent 62%)",
    ownBackground: true,
  },
  {
    id: "prism",
    name: "Prism",
    mode: "light",
    category: "glass",
    swatch: ["#f4f4f7", "#5b3fc4"],
    pattern:
      "linear-gradient(124deg, transparent 28%, rgb(255 160 160 / 0.7) 38%, rgb(255 218 140 / 0.7) 46%, rgb(150 228 172 / 0.7) 54%, rgb(140 196 255 / 0.7) 62%, rgb(198 164 255 / 0.7) 70%, transparent 80%)",
  },
  {
    id: "celadon",
    name: "Celadon",
    mode: "light",
    category: "craft",
    swatch: ["#dde8e3", "#1f6650"],
    pattern:
      "linear-gradient(180deg, rgb(255 255 255 / 0.75), transparent 55%)",
  },
  {
    id: "letterpress",
    name: "Letterpress",
    mode: "light",
    category: "paper",
    swatch: ["#f2efe8", "#4e5a1c"],
    pattern:
      "radial-gradient(circle at 50% 38%, transparent 0 52%, rgb(60 50 30 / 0.2) 72%)",
  },
  {
    id: "pebble",
    name: "Pebble",
    mode: "light",
    category: "craft",
    swatch: ["#e5e1db", "#3e5a6e"],
    pattern:
      "radial-gradient(circle at 35% 28%, rgb(255 255 255 / 0.8), transparent 55%), radial-gradient(circle at 65% 80%, rgb(110 95 75 / 0.15), transparent 50%)",
  },
  {
    id: "meadow",
    name: "Meadow",
    mode: "light",
    category: "plain",
    swatch: ["#ebf0dc", "#2f55a4"],
    pattern:
      "linear-gradient(180deg, #f6f3d2 0%, #e6eed8 60%, #dfe9cf 100%)",
    ownBackground: true,
  },
  {
    id: "sepia-light",
    name: "Sepia Light",
    mode: "light",
    category: "reading",
    note: "the light side of Sepia",
    swatch: ["#efe2c8", "#6e4a12"],
  },
  {
    id: "colour-safe-light",
    name: "Colour Safe Light",
    mode: "light",
    category: "reading",
    note: "for colour blindness: blue and orange, never red against green",
    swatch: ["#f1f0ec", "#00639b"],
    pattern: "linear-gradient(#00639b 0 30%, transparent 30%)",
  },
  {
    id: "terminal-light",
    name: "Terminal Light",
    mode: "light",
    category: "screens",
    note: "the light side of Terminal",
    swatch: ["#eef4ec", "#0d5426"],
    pattern: "repeating-linear-gradient(rgb(13 84 38 / 0.2) 0 1px, transparent 1px 3px)",
    ownBackground: true,
  },
  {
    id: "whiteprint",
    name: "Whiteprint",
    mode: "light",
    category: "paper",
    note: "the light side of Blueprint",
    swatch: ["#eef1f8", "#1b3887"],
    pattern:
      "repeating-linear-gradient(rgb(27 56 135 / 0.3) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgb(27 56 135 / 0.3) 0 1px, transparent 1px 6px)",
    ownBackground: true,
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    mode: "light",
    category: "paper",
    note: "the light side of Chalkboard",
    swatch: ["#edf0f1", "#12703a"],
    pattern:
      "linear-gradient(#9aa3a8 0 14%, transparent 14%), linear-gradient(112deg, transparent 30%, #ffffff 40%, transparent 50%)",
    ownBackground: true,
  },
  {
    id: "art-deco-light",
    name: "Art Deco Light",
    mode: "light",
    category: "craft",
    note: "the light side of Art Deco",
    swatch: ["#f4eee0", "#121f4a"],
    pattern:
      "radial-gradient(circle, transparent 0 50%, #c9a656 52% 55%, transparent 57% 62%, #c9a656 64% 67%, transparent 69%)",
  },
  {
    id: "jade",
    name: "Jade",
    mode: "light",
    category: "glass",
    note: "the light side of Emerald",
    swatch: ["#e4f1ee", "#a33a1e"],
    pattern:
      "radial-gradient(circle at 85% 12%, #a9dbc8, transparent 62%), radial-gradient(circle at 12% 90%, #b6ddd9, transparent 62%)",
    ownBackground: true,
  },
  {
    id: "amber",
    name: "Amber",
    mode: "light",
    category: "glass",
    note: "the light side of Smoke",
    swatch: ["#f3e6d0", "#0c5862"],
    pattern:
      "radial-gradient(circle at 90% 90%, rgb(238 164 72 / 0.7), transparent 62%), radial-gradient(circle at 10% 10%, rgb(255 226 168 / 0.9), transparent 55%)",
    ownBackground: true,
  },
  // The Silly set
  {
    id: "blue-screen",
    name: "Blue Screen",
    mode: "dark",
    category: "silly",
    swatch: ["#0000aa", "#aaaaaa"],
    silly: "Your library ran into a problem.",
  },
  {
    id: "glowstick",
    name: "Glowstick",
    mode: "dark",
    category: "silly",
    swatch: ["#0a0012", "#b6ff00"],
    silly: "Every colour at the party, all at once.",
  },
  {
    id: "hot-dog-stand",
    name: "Hot Dog Stand",
    mode: "light",
    category: "silly",
    swatch: ["#ffd800", "#b30000"],
    silly: "Ketchup and mustard. Fries not included.",
  },
  {
    id: "toxic",
    name: "Toxic",
    mode: "light",
    category: "silly",
    swatch: ["#39ff14", "#6a00b8"],
    silly: "Glows in the dark. Do not lick.",
  },
  {
    id: "desktop-95",
    name: "Desktop 95",
    mode: "light",
    category: "silly",
    swatch: ["#c0c0c0", "#000080"],
    pattern: "radial-gradient(circle, transparent 0 50%, #008080 52%)",
    silly: "It is now safe to turn off your library.",
    ownBackground: true,
  },
  {
    id: "under-construction",
    name: "Under Construction",
    mode: "dark",
    category: "silly",
    swatch: ["#1c1c1c", "#ffd400"],
    pattern:
      "linear-gradient(transparent 34%, #1c1c1c 34%), repeating-linear-gradient(-45deg, #ffd400 0 4px, #111111 4px 8px)",
    silly: "Best viewed in Netscape Navigator.",
  },
  {
    id: "ugly-sweater",
    name: "Ugly Sweater",
    mode: "dark",
    category: "silly",
    swatch: ["#730d16", "#ffd34d"],
    pattern: "radial-gradient(circle, #0d4a26 0 50%, transparent 52%)",
    silly: "Grandma knitted it. You have to wear it.",
    ownBackground: true,
  },
  {
    id: "spreadsheet",
    name: "Spreadsheet",
    mode: "light",
    category: "silly",
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
    category: "silly",
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
    category: "silly",
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
    category: "silly",
    swatch: ["#080818", "#ffd84a"],
    pattern: "radial-gradient(circle, #2438b8 0 44%, #f0f0f8 46% 54%, transparent 56%)",
    silly: "Your library gained a level!",
    ownBackground: true,
  },
  {
    id: "comic",
    name: "Comic",
    mode: "light",
    category: "silly",
    swatch: ["#fffbea", "#d10f2b"],
    pattern:
      "radial-gradient(circle, #ffffff 0 30%, #111111 32% 37%, transparent 39%), repeating-conic-gradient(#ffe14d 0 12deg, #86cff0 12deg 24deg)",
    silly: "KAPOW! Your library, in four colours.",
    ownBackground: true,
  },
];

/**
 * Themes retired, as lookalikes of another or as too busy (Sea Glass,
 * Contour and Leadlight, whose pictures crowded the page), and the theme
 * each one's readers get instead: the closest one left, or the simpler
 * theme that took its place. Kept so a choice stored before (on the
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
  "sea-glass": "porcelain",
  contour: "ink-wash",
  leadlight: "material-you",
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
    // The Linux desktops draw their text in faces of their own, which the
    // page doesn't preload (every other theme would pay for them). Asked
    // for now, they arrive a good deal sooner than when the first layout
    // finds text in them, so the text swaps to them sooner on a slow
    // connection. load() only fetches; nothing on screen changes.
    const faces: Record<string, string[]> = {
      gnome: ["Inter"],
      "kde-plasma": ["Noto Sans"],
      hyprland: ["Noto Sans", "JetBrains Mono"],
    };
    const id = root.getAttribute("data-theme") || "";
    // GNOME's text is Adwaita Sans where that is installed, and Inter only
    // where it isn't: no need to fetch Inter for a GNOME desktop.
    const local = id === "gnome" && document.fonts && document.fonts.check && document.fonts.check('1em "Adwaita Sans"');
    if (!local && Object.prototype.hasOwnProperty.call(faces, id) && document.fonts && document.fonts.load) {
      faces[id].forEach(function (face) {
        document.fonts.load('1em "' + face + '"').catch(function () {});
      });
    }
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
