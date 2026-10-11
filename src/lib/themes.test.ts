import { describe, expect, it } from "vitest";
import { parseThemeSetting, serializeThemeSetting } from "@/lib/themes";

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
