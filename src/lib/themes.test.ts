import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEVICE_THEME_STORAGE_KEY,
  RETIRED_THEMES,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
  parsePartThemes,
  parseThemeSetting,
  sectionOf,
  serializeThemeSetting,
} from "@/lib/themes";

describe("parseThemeSetting", () => {
  it("reads a fixed theme", () => {
    expect(parseThemeSetting("dracula")).toEqual({ kind: "fixed", id: "dracula" });
  });

  it("reads an automatic light/dark pair", () => {
    expect(parseThemeSetting("auto:sage:terminal")).toEqual({
      kind: "auto",
      light: "sage",
      dark: "terminal",
    });
  });

  it("reads a retired theme as the one that replaced it", () => {
    expect(parseThemeSetting("gruvbox")).toEqual({ kind: "fixed", id: "dark" });
    expect(parseThemeSetting("auto:catppuccin-latte:catppuccin-mocha")).toEqual({
      kind: "auto",
      light: "lilac",
      dark: "dracula",
    });
    // Only the map's own keys: an id that happens to name an Object
    // property is still unknown.
    expect(parseThemeSetting("constructor")).toBeNull();
  });

  it("refuses a pair that isn't one light and one dark theme", () => {
    expect(parseThemeSetting("auto:dark:dracula")).toBeNull();
    expect(parseThemeSetting("auto:terminal:sage")).toBeNull();
    expect(parseThemeSetting("auto:light")).toBeNull();
  });

  it("refuses unknown themes and nothing", () => {
    expect(parseThemeSetting("neon-pink")).toBeNull();
    expect(parseThemeSetting(null)).toBeNull();
  });

  it("round-trips through serializeThemeSetting", () => {
    for (const raw of ["light", "auto:light:dark", "auto:blossom:synthwave"]) {
      expect(serializeThemeSetting(parseThemeSetting(raw)!)).toBe(raw);
    }
  });
});

describe("THEMES", () => {
  const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  const blocks = new Map(
    [...css.matchAll(/\[data-theme="([^"]+)"\]\s*\{([^}]*)\}/g)].map((m) => [m[1], m[2]]),
  );
  const token = (body: string, name: string) =>
    body.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1].toLowerCase();

  it("has a palette in globals.css for every theme, and a theme for every palette", () => {
    const ids = THEMES.map((t) => t.id).filter((id) => id !== "light" && id !== "dark");
    expect([...blocks.keys()].sort()).toEqual([...ids].sort());
  });

  it("draws each swatch (and the title bar) in the palette's own colours", () => {
    for (const t of THEMES) {
      const body = blocks.get(t.id);
      if (!body) continue;
      expect([token(body, "background"), token(body, "primary")], t.id).toEqual(t.swatch);
    }
  });

  it("keeps its own themes, the Silly set too, easy to read", () => {
    // Ported from dagfinn2000/dashify as they are there.
    const ported = new Set(["dracula", "everforest", "solarized-light"]);
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (body: string, a: string, b: string) => {
      const [x, y] = [token(body, a)!, token(body, b)!].map(luminance).sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    for (const [id, body] of blocks) {
      if (ported.has(id)) continue;
      expect(contrast(body, "foreground", "background"), `${id} text`).toBeGreaterThanOrEqual(11);
      expect(contrast(body, "muted-foreground", "muted"), `${id} muted text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(body, "primary-foreground", "primary"), `${id} buttons`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(body, "primary", "background"), `${id} accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(body, "destructive", "card"), `${id} danger`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("shows a theme's page picture in its swatch too", () => {
    for (const [id, body] of blocks) {
      if (!body.includes("--page-gradient")) continue;
      expect(THEMES.find((t) => t.id === id)?.pattern, id).toBeTruthy();
    }
  });

  it("replaces each retired theme with one of its own kind that exists", () => {
    const retiredLights = new Set([
      "catppuccin-latte",
      "rose-pine-dawn",
      "selenized-light",
      "everforest-light",
      "kanagawa-lotus",
      "gruvbox-light",
      "apricot",
    ]);
    for (const [old, replacement] of Object.entries(RETIRED_THEMES)) {
      expect(THEMES.some((t) => t.id === old), old).toBe(false);
      expect(blocks.has(old), old).toBe(false);
      const mode = THEMES.find((t) => t.id === replacement)?.mode;
      expect(mode, old).toBe(retiredLights.has(old) ? "light" : "dark");
    }
  });

  it("lists the Silly set last, each with a line about it", () => {
    const first = THEMES.findIndex((t) => t.silly);
    expect(first).toBeGreaterThan(0);
    expect(THEMES.slice(first).every((t) => t.silly)).toBe(true);
  });
});

describe("sectionOf", () => {
  it("names the part of the app a path is in", () => {
    expect(sectionOf("/books")).toBe("library");
    expect(sectionOf("/books/new")).toBe("library");
    expect(sectionOf("/books/check")).toBe("library");
    expect(sectionOf("/books/cm123")).toBe("book");
    expect(sectionOf("/books/cm123/edit")).toBe("book");
    expect(sectionOf("/series")).toBe("series");
    expect(sectionOf("/stats/year/2026")).toBe("stats");
    expect(sectionOf("/reading")).toBe("reading");
    expect(sectionOf("/account")).toBe("account");
    expect(sectionOf("/login")).toBe("");
    expect(sectionOf("/")).toBe("");
  });
});

describe("parsePartThemes", () => {
  it("keeps the parts' themes that exist", () => {
    expect(
      parsePartThemes({ stats: "dracula", room: "auto:sage:terminal", quotes: "neon", nope: "dark" }),
    ).toEqual({ stats: "dracula", room: "auto:sage:terminal" });
  });

  it("moves a part on a retired theme to its replacement", () => {
    expect(parsePartThemes({ library: "kanagawa-lotus", room: "auto:apricot:obsidian" })).toEqual({
      library: "kraft",
      room: "auto:solarized-light:high-contrast-dark",
    });
  });

  it("reads anything else as no part themes", () => {
    expect(parsePartThemes(null)).toEqual({});
    expect(parsePartThemes(["dracula"])).toEqual({});
    expect(parsePartThemes("dracula")).toEqual({});
  });
});

/** Just enough of a page for the pre-paint script: <html>'s attributes
 *  and classes, localStorage, the colour scheme and the address. */
function fakePage({
  attrs = {},
  stored = {},
  path = "/books",
}: {
  attrs?: Record<string, string>;
  stored?: Record<string, string>;
  path?: string;
}) {
  const html = new Map(Object.entries(attrs));
  const classes = new Set<string>();
  const storage = new Map(Object.entries(stored));
  const element = (map: Map<string, string>) => ({
    getAttribute: (name: string) => map.get(name) ?? null,
    setAttribute: (name: string, value: string) => void map.set(name, String(value)),
    removeAttribute: (name: string) => void map.delete(name),
  });
  const document = {
    documentElement: {
      ...element(html),
      classList: {
        toggle: (name: string, on: boolean) => void (on ? classes.add(name) : classes.delete(name)),
      },
    },
    querySelector: () => null,
    createElement: () => element(new Map()),
    head: { appendChild: () => {} },
  };
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  };
  const window = { matchMedia: () => ({ matches: false, addEventListener: () => {} }) };
  return { document, localStorage, window, location: { pathname: path }, html, classes, storage };
}

function runInitScript(page: ReturnType<typeof fakePage>) {
  new Function("document", "localStorage", "window", "location", THEME_INIT_SCRIPT)(
    page.document,
    page.localStorage,
    page.window,
    page.location,
  );
}

describe("THEME_INIT_SCRIPT", () => {
  it("shows the account's theme, and remembers it for signed-out pages", () => {
    const page = fakePage({ attrs: { "data-theme": "dracula" } });
    runInitScript(page);
    expect(page.html.get("data-theme")).toBe("dracula");
    expect(page.html.get("data-theme-account")).toBe("dracula");
    expect(page.html.get("data-section")).toBe("library");
    expect(page.classes.has("dark")).toBe(true);
    expect(page.storage.get(THEME_STORAGE_KEY)).toBe("dracula");
  });

  it("shows this device's theme over the account's, which it leaves alone", () => {
    const page = fakePage({
      attrs: { "data-theme": "dracula" },
      stored: { [DEVICE_THEME_STORAGE_KEY]: "sage" },
    });
    runInitScript(page);
    expect(page.html.get("data-theme")).toBe("sage");
    expect(page.html.get("data-theme-device")).toBe("sage");
    expect(page.storage.get(THEME_STORAGE_KEY)).toBe("dracula");
    expect(page.classes.has("dark")).toBe(false);
  });

  it("ignores a device theme that no longer exists", () => {
    const page = fakePage({
      attrs: { "data-theme": "dracula" },
      stored: { [DEVICE_THEME_STORAGE_KEY]: "auto:sage:neon" },
    });
    runInitScript(page);
    expect(page.html.get("data-theme")).toBe("dracula");
    expect(page.html.has("data-theme-device")).toBe(false);
  });

  it("shows a part's own theme on its pages, over the device's", () => {
    const attrs = {
      "data-theme": "dracula",
      "data-theme-parts": JSON.stringify({ stats: "auto:blossom:terminal", library: "lacquer" }),
    };
    const stored = { [DEVICE_THEME_STORAGE_KEY]: "sage" };

    const stats = fakePage({ attrs, stored, path: "/stats/year/2025" });
    runInitScript(stats);
    expect(stats.html.get("data-theme")).toBe("blossom");
    expect(stats.html.get("data-theme-auto")).toBe("blossom:terminal");

    const book = fakePage({ attrs, stored, path: "/books/cm123" });
    runInitScript(book);
    expect(book.html.get("data-section")).toBe("book");
    expect(book.html.get("data-theme")).toBe("lacquer");

    const quotes = fakePage({ attrs, stored, path: "/quotes" });
    runInitScript(quotes);
    expect(quotes.html.get("data-theme")).toBe("sage");
  });

  it("uses the remembered theme when signed out", () => {
    const page = fakePage({ stored: { [THEME_STORAGE_KEY]: "ember" }, path: "/login" });
    runInitScript(page);
    expect(page.html.get("data-theme")).toBe("ember");
    expect(page.html.has("data-section")).toBe(false);
  });

  it("reads a retired theme kept in this browser as its replacement", () => {
    const signedOut = fakePage({ stored: { [THEME_STORAGE_KEY]: "gruvbox" }, path: "/login" });
    runInitScript(signedOut);
    expect(signedOut.html.get("data-theme")).toBe("dark");

    const device = fakePage({
      attrs: { "data-theme": "dracula" },
      stored: { [DEVICE_THEME_STORAGE_KEY]: "auto:apricot:obsidian" },
    });
    runInitScript(device);
    expect(device.html.get("data-theme-device")).toBe("auto:solarized-light:high-contrast-dark");
    expect(device.html.get("data-theme")).toBe("solarized-light");
  });
});
