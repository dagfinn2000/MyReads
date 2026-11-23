import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchScore } from "@/lib/quick-find";
import { SETTINGS, matchSettings, queryForms, settingHref } from "@/lib/settings-index";

const form = fs.readFileSync(path.join(process.cwd(), "src/components/preferences-form.tsx"), "utf8");

describe("the settings index", () => {
  it("has every section and setting the Preferences form names", () => {
    const labels = new Set(SETTINGS.map((s) => s.label));
    const named = [
      ...[...form.matchAll(/<Section title="([^"]+)"/g)].map((m) => m[1]),
      ...[...form.matchAll(/\blabel="([^"]+)"/g)].map((m) => m[1]),
      ...[...form.matchAll(/<p className="text-sm font-medium">([^<{]+)</g)].map((m) => m[1]),
    ].filter((l) => l.trim());
    expect(named.length).toBeGreaterThan(80);
    expect(named.filter((l) => !labels.has(l))).toEqual([]);
  });

  it("finds a setting by a word it goes by", () => {
    expect(matchSettings("ribbon", 3, matchScore)[0].label).toBe("Reading progress on covers");
    expect(matchSettings("dark mode", 3, matchScore)[0].label).toBe("Theme");
    expect(matchSettings("time zone", 3, matchScore)[0].label).toBe("Time zone");
    expect(matchSettings("  ", 3, matchScore)).toEqual([]);
  });

  it("opens the Account page at the setting", () => {
    expect(settingHref({ label: "Time zone" })).toBe("/account?find=Time%20zone");
  });
});

describe("queryForms", () => {
  it("tries the singular of a plural too", () => {
    expect(queryForms("fonts")).toEqual(["fonts", "font"]);
    expect(queryForms("sounds on covers")).toEqual(["sounds on covers", "sound on cover"]);
    expect(queryForms("glass")).toEqual(["glass"]);
    expect(queryForms("themes")).toEqual(["themes", "theme"]);
    expect(queryForms("font")).toEqual(["font"]);
  });

  it("finds Font for fonts", () => {
    expect(matchSettings("fonts", 3, matchScore).map((s) => s.label)).toContain("Font");
  });
});
