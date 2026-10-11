import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_VIEW,
  cleanLibraryViewPatch,
  parseLibraryView,
} from "@/lib/library-view";

describe("parseLibraryView", () => {
  it("passes a fully valid stored view through", () => {
    expect(
      parseLibraryView({ sort: "author", dir: "asc", group: "series" }),
    ).toEqual({ ...DEFAULT_LIBRARY_VIEW, sort: "author", dir: "asc", group: "series" });
  });

  it("returns defaults for null/undefined (never-saved accounts)", () => {
    expect(parseLibraryView(null)).toEqual(DEFAULT_LIBRARY_VIEW);
    expect(parseLibraryView(undefined)).toEqual(DEFAULT_LIBRARY_VIEW);
  });

  it("defaults each unknown field individually", () => {
    // e.g. a sort option removed in a later version — the rest must survive.
    expect(parseLibraryView({ sort: "bogus", dir: "asc", group: "author" })).toEqual({
      ...DEFAULT_LIBRARY_VIEW,
      sort: DEFAULT_LIBRARY_VIEW.sort,
      dir: "asc",
      group: "author",
    });
  });

  it("survives non-object garbage", () => {
    expect(parseLibraryView("title")).toEqual(DEFAULT_LIBRARY_VIEW);
    expect(parseLibraryView(42)).toEqual(DEFAULT_LIBRARY_VIEW);
    expect(parseLibraryView([])).toEqual(DEFAULT_LIBRARY_VIEW);
  });

  it("ignores non-string field values", () => {
    expect(parseLibraryView({ sort: 3, dir: null, group: {} })).toEqual(
      DEFAULT_LIBRARY_VIEW,
    );
  });

  it("keeps display settings and defaults bad ones", () => {
    expect(
      parseLibraryView({
        cardSize: "small",
        layout: "list",
        showRating: false,
        showStatus: "no",
        showSeries: false,
      }),
    ).toEqual({
      ...DEFAULT_LIBRARY_VIEW,
      cardSize: "small",
      layout: "list",
      showRating: false,
      showSeries: false,
    });
    expect(parseLibraryView({ cardSize: "huge", layout: 1 })).toEqual(DEFAULT_LIBRARY_VIEW);
  });
});

describe("cleanLibraryViewPatch", () => {
  it("keeps only the fields given, made valid", () => {
    expect(cleanLibraryViewPatch({ layout: "list" })).toEqual({ layout: "list" });
    expect(cleanLibraryViewPatch({ cardSize: "huge", sort: "title" })).toEqual({
      cardSize: "medium",
      sort: "title",
    });
  });

  it("drops unknown keys and garbage", () => {
    expect(cleanLibraryViewPatch({ evil: 1 })).toEqual({});
    expect(cleanLibraryViewPatch(null)).toEqual({});
    expect(cleanLibraryViewPatch("list")).toEqual({});
  });
});
