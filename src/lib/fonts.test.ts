import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FONTS,
  FONT_SLOTS,
  fontFamily,
  fontStyle,
  fontsFor,
  longTextIsSerif,
  pickFont,
} from "@/lib/fonts";

const app = (file: string) => readFileSync(join(__dirname, "..", "app", file), "utf8");

describe("fonts", () => {
  it("gives every face its own id", () => {
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    expect(FONTS.some((f) => f.id === "theme")).toBe(false);
  });

  it("only names CSS variables that next/font defines", () => {
    const defined = new Set(
      [...(app("layout.tsx") + app("fonts.ts")).matchAll(/variable: "(--font-[a-z0-9-]+)"/g)].map((m) => m[1]),
    );
    for (const font of FONTS) {
      for (const [, name] of font.face.matchAll(/var\((--font-[a-z0-9-]+)\)/g)) {
        expect(defined, `${font.id} uses ${name}`).toContain(name);
      }
    }
  });

  it("puts every face of app/fonts.ts on <html>", () => {
    const fonts = app("fonts.ts");
    const declared = [...fonts.matchAll(/^const (\w+) = \w+\(\{/gm)].map((m) => m[1]);
    const listed = fonts.slice(fonts.indexOf("PICKABLE_FONT_VARIABLES"));
    for (const name of declared) expect(listed, name).toContain(`  ${name},`);
    expect(app("layout.tsx")).toContain("PICKABLE_FONT_VARIABLES,");
  });

  it("offers display faces for headings only", () => {
    expect(fontsFor("heading").length).toBe(FONTS.length);
    expect(fontsFor("body").some((f) => f.kind === "display")).toBe(false);
    expect(fontsFor("long").some((f) => f.kind === "display")).toBe(false);
    for (const slot of FONT_SLOTS) expect(fontsFor(slot).length).toBeGreaterThan(35);
  });

  it("reads stored picks, old ones too", () => {
    expect(pickFont("heading", "serif")).toBe("literata");
    expect(pickFont("heading", "rounded")).toBe("nunito");
    expect(pickFont("heading", "sans")).toBe("theme");
    expect(pickFont("long", "serif")).toBe("device-serif");
    expect(pickFont("long", "sans")).toBe("theme");
    // "serif" was never a body choice.
    expect(pickFont("body", "serif")).toBe("theme");
    expect(pickFont("body", "lora")).toBe("lora");
    expect(pickFont("body", "caveat")).toBe("theme");
    expect(pickFont("long", "caveat")).toBe("caveat");
    expect(pickFont("heading", 3)).toBe("theme");
    expect(pickFont("heading", "url(x)")).toBe("theme");
  });

  it("sets a custom property only for the slots picked", () => {
    expect(fontStyle({ bodyFont: "theme", headingFont: "theme", longTextFont: "theme" })).toEqual({});
    expect(fontStyle({ bodyFont: "lexend", headingFont: "cinzel", longTextFont: "theme" })).toEqual({
      "--body-face": "var(--font-lexend), ui-sans-serif, system-ui, sans-serif",
      "--heading-face": "var(--font-cinzel), ui-serif, Georgia, serif",
    });
    expect(fontFamily(FONTS.find((f) => f.id === "device-serif")!)).toMatch(/^ui-serif, "Iowan Old Style"/);
  });

  it("knows when long text is set in a serif, picked for it or for everything", () => {
    expect(longTextIsSerif({ bodyFont: "theme", longTextFont: "theme" })).toBe(false);
    expect(longTextIsSerif({ bodyFont: "theme", longTextFont: "lora" })).toBe(true);
    expect(longTextIsSerif({ bodyFont: "lora", longTextFont: "theme" })).toBe(true);
    expect(longTextIsSerif({ bodyFont: "lora", longTextFont: "inter" })).toBe(false);
    expect(longTextIsSerif({ bodyFont: "theme", longTextFont: "bitter" })).toBe(true);
  });
});
