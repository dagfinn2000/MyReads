import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES, parseThemeSetting, serializeThemeSetting } from "@/lib/themes";

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
