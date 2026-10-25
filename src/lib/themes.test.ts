import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEVICE_THEME_STORAGE_KEY,
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
    expect(parseThemeSetting("auto:sage:obsidian")).toEqual({
      kind: "auto",
      light: "sage",
      dark: "obsidian",
    });
  });

  it("refuses a pair that isn't one light and one dark theme", () => {
    expect(parseThemeSetting("auto:dark:dracula")).toBeNull();
    expect(parseThemeSetting("auto:obsidian:sage")).toBeNull();
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
      parsePartThemes({ stats: "dracula", room: "auto:sage:obsidian", quotes: "neon", nope: "dark" }),
    ).toEqual({ stats: "dracula", room: "auto:sage:obsidian" });
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
      "data-theme-parts": JSON.stringify({ stats: "auto:blossom:obsidian", library: "gruvbox" }),
    };
    const stored = { [DEVICE_THEME_STORAGE_KEY]: "sage" };

    const stats = fakePage({ attrs, stored, path: "/stats/year/2025" });
    runInitScript(stats);
    expect(stats.html.get("data-theme")).toBe("blossom");
    expect(stats.html.get("data-theme-auto")).toBe("blossom:obsidian");

    const book = fakePage({ attrs, stored, path: "/books/cm123" });
    runInitScript(book);
    expect(book.html.get("data-section")).toBe("book");
    expect(book.html.get("data-theme")).toBe("gruvbox");

    const quotes = fakePage({ attrs, stored, path: "/quotes" });
    runInitScript(quotes);
    expect(quotes.html.get("data-theme")).toBe("sage");
  });

  it("uses the remembered theme when signed out", () => {
    const page = fakePage({ stored: { [THEME_STORAGE_KEY]: "gruvbox" }, path: "/login" });
    runInitScript(page);
    expect(page.html.get("data-theme")).toBe("gruvbox");
    expect(page.html.has("data-section")).toBe(false);
  });
});
