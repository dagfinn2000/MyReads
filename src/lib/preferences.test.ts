import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  cleanPreferencesPatch,
  isValidTimeZone,
  parsePreferences,
} from "@/lib/preferences";

describe("parsePreferences", () => {
  it("gives the defaults for nothing stored", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("nonsense")).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid values and defaults the rest", () => {
    const prefs = parsePreferences({
      dateFormat: "iso",
      ratingStyle: "ten",
      weekStart: "fortnight", // not a value
      newBookStatus: "READING",
      importTags: "no", // not a boolean
    });
    expect(prefs.dateFormat).toBe("iso");
    expect(prefs.ratingStyle).toBe("ten");
    expect(prefs.weekStart).toBe("monday");
    expect(prefs.newBookStatus).toBe("READING");
    expect(prefs.importTags).toBe(true);
  });

  it("keeps known list entries once, in the order given", () => {
    const prefs = parsePreferences({
      catalogues: ["nb", "bogus", "openlibrary", "nb"],
      hiddenStats: ["quote", "quote", "goal", 7],
    });
    expect(prefs.catalogues).toEqual(["nb", "openlibrary"]);
    expect(prefs.hiddenStats).toEqual(["quote", "goal"]);
  });

  it("searches every catalogue rather than none", () => {
    expect(parsePreferences({ catalogues: [] }).catalogues).toEqual(
      DEFAULT_PREFERENCES.catalogues,
    );
  });

  it("keeps the appearance settings and defaults unknown ones", () => {
    expect(parsePreferences({ motion: "off" }).motion).toBe("off");
    expect(parsePreferences({ motion: "wobbly" }).motion).toBe("on");
  });

  it("drops a time zone the runtime doesn't know", () => {
    expect(parsePreferences({ timeZone: "Europe/Oslo" }).timeZone).toBe("Europe/Oslo");
    expect(parsePreferences({ timeZone: "Mars/Olympus" }).timeZone).toBe("");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and UTC", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects empty and unknown zones", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Nowhere/Special")).toBe(false);
  });
});

describe("cleanPreferencesPatch", () => {
  it("keeps only the keys sent, made valid", () => {
    expect(cleanPreferencesPatch({ dateFormat: "iso", textSize: "huge" })).toEqual({
      dateFormat: "iso",
      textSize: "normal",
    });
  });

  it("drops keys that aren't preferences", () => {
    expect(cleanPreferencesPatch({ isAdmin: true, theme: "dark" })).toEqual({});
  });

  it("returns nothing for a non-object", () => {
    expect(cleanPreferencesPatch(null)).toEqual({});
    expect(cleanPreferencesPatch("dateFormat=iso")).toEqual({});
  });
});
