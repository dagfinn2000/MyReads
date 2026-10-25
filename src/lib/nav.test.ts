import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, NAV_ITEMS, parsePreferences } from "@/lib/preferences";
import { NAV_LINKS, ROOMY_NAV_LINKS, isNavActive, topBarLinks } from "./nav";

describe("topBarLinks", () => {
  it("is the bar it always was for anyone who never changes it", () => {
    expect(topBarLinks(DEFAULT_PREFERENCES)).toEqual([
      "library",
      "reading",
      "add",
      "check",
      "quotes",
      "stats",
      "room",
    ]);
    expect(topBarLinks(DEFAULT_PREFERENCES)).toHaveLength(ROOMY_NAV_LINKS);
  });

  it("follows the saved order, leaving hidden links out", () => {
    const prefs = parsePreferences({
      navOrder: ["stats", "quotes", "library"],
      hiddenNav: ["check", "room"],
    });
    expect(topBarLinks(prefs)).toEqual(["stats", "quotes", "library", "reading", "add"]);
  });

  it("puts Series in its place once it is turned on", () => {
    const prefs = parsePreferences({ shownNav: ["series"], navOrder: ["library", "series"] });
    expect(topBarLinks(prefs)).toEqual([
      "library",
      "series",
      "reading",
      "add",
      "check",
      "quotes",
      "stats",
      "room",
    ]);
  });

  it("has somewhere to go for every link", () => {
    for (const item of NAV_ITEMS) expect(NAV_LINKS[item].href).toMatch(/^\/[a-z/]+$/);
    expect(NAV_LINKS.series.href).toBe("/series");
  });
});

describe("isNavActive", () => {
  it("marks the library on the library, a book and its edit page", () => {
    expect(isNavActive("/books", "/books")).toBe(true);
    expect(isNavActive("/books", "/books/abc123")).toBe(true);
    expect(isNavActive("/books", "/books/abc123/edit")).toBe(true);
  });

  it("leaves adding and checking a book to their own links", () => {
    expect(isNavActive("/books", "/books/new")).toBe(false);
    expect(isNavActive("/books", "/books/check")).toBe(false);
    expect(isNavActive("/books/new", "/books/new")).toBe(true);
    expect(isNavActive("/books/check", "/books/check")).toBe(true);
  });

  it("marks a section on its pages below it, and nothing else", () => {
    expect(isNavActive("/stats", "/stats/year/2025")).toBe(true);
    expect(isNavActive("/stats", "/statsx")).toBe(false);
    expect(isNavActive("/quotes", "/books")).toBe(false);
  });
});
