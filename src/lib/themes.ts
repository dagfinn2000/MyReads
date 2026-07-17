/**
 * Theme registry for the picker. The actual palettes live in globals.css as
 * `[data-theme="…"]` CSS-variable blocks; this module only carries the
 * metadata the UI needs (names, light/dark mode, swatch colors).
 *
 * Palettes are ported from dagfinn2000/dashify so both apps share a look.
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

  // Light palettes
  { id: "everforest-light", name: "Everforest Light", mode: "light", swatch: ["#fdf6e3", "#35a77c"] },
  { id: "gruvbox-light", name: "Gruvbox Light", mode: "light", swatch: ["#f2e5bc", "#af3a03"] },
  { id: "kanagawa-lotus", name: "Kanagawa Lotus", mode: "light", swatch: ["#e5ddb0", "#624c83"] },
  { id: "selenized-light", name: "Selenized Light", mode: "light", swatch: ["#ece3cc", "#c25d1e"] },
  { id: "solarized-light", name: "Solarized Light", mode: "light", swatch: ["#fdf6e3", "#b58900"] },
  { id: "catppuccin-latte", name: "Catppuccin Latte", mode: "light", swatch: ["#eff1f5", "#8839ef"] },
  { id: "rose-pine-dawn", name: "Rosé Pine Dawn", mode: "light", swatch: ["#faf4ed", "#907aa9"] },
];

export const DARK_THEME_IDS = THEMES.filter((t) => t.mode === "dark").map(
  (t) => t.id,
);

/**
 * Inline script injected before hydration so the stored theme applies on
 * first paint (no flash of the default theme). When the server already put
 * the signed-in user's saved theme on <html>, that wins — the script only
 * mirrors it into localStorage (so signed-out pages keep the look);
 * otherwise it applies the localStorage fallback. Kept tiny and
 * try/catch'd — localStorage can throw in some privacy modes.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var s=d.getAttribute("data-theme");if(s){localStorage.setItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)},s);return;}var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(!t)return;d.setAttribute("data-theme",t);if(${JSON.stringify(
  DARK_THEME_IDS,
)}.indexOf(t)>-1)d.classList.add("dark");}catch(e){}})();`;
