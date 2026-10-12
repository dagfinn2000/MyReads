import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_VIEW,
  LIBRARY_GROUPS,
  LIBRARY_SORTS,
  NATURAL_DIRS,
  cleanLibraryViewPatch,
  naturalDir,
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

  it("keeps the card style and 3D covers and defaults bad ones", () => {
    expect(parseLibraryView({ cardStyle: "shelf", cover3d: true })).toEqual({
      ...DEFAULT_LIBRARY_VIEW,
      cardStyle: "shelf",
      cover3d: true,
    });
    expect(parseLibraryView({ cardStyle: "tiles", cover3d: "yes" })).toEqual(
      DEFAULT_LIBRARY_VIEW,
    );
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

  it("cleans the card style and 3D switch like the other display fields", () => {
    expect(cleanLibraryViewPatch({ cardStyle: "covers" })).toEqual({ cardStyle: "covers" });
    expect(cleanLibraryViewPatch({ cardStyle: "tiles", cover3d: 1 })).toEqual({
      cardStyle: "cards",
      cover3d: false,
    });
  });

  it("drops unknown keys and garbage", () => {
    expect(cleanLibraryViewPatch({ evil: 1 })).toEqual({});
    expect(cleanLibraryViewPatch(null)).toEqual({});
    expect(cleanLibraryViewPatch("list")).toEqual({});
  });
});

describe("the newer sorts, groupings and display options", () => {
  it("accepts each sort and grouping", () => {
    for (const sort of LIBRARY_SORTS) expect(parseLibraryView({ sort }).sort).toBe(sort);
    for (const group of LIBRARY_GROUPS) expect(parseLibraryView({ group }).group).toBe(group);
  });

  it("gives every sort a natural direction", () => {
    for (const sort of LIBRARY_SORTS) expect(NATURAL_DIRS[sort]).toMatch(/^(asc|desc)$/);
    expect(naturalDir("title")).toBe("asc");
    expect(naturalDir("author")).toBe("asc");
    expect(naturalDir("rating")).toBe("desc");
    expect(naturalDir("pageCount")).toBe("desc");
    expect(naturalDir("bogus")).toBe("desc");
    // Straight from the URL: never a property of Object.prototype.
    expect(naturalDir("constructor")).toBe("desc");
    expect(naturalDir("__proto__")).toBe("desc");
    expect(naturalDir("toString")).toBe("desc");
  });

  it("parses the list-row and ownership options", () => {
    expect(parseLibraryView({})).toMatchObject({
      showOwnership: false,
      rowDate: "none",
      showPageCount: false,
    });
    expect(
      parseLibraryView({ showOwnership: true, rowDate: "finished", showPageCount: true }),
    ).toMatchObject({ showOwnership: true, rowDate: "finished", showPageCount: true });
    expect(parseLibraryView({ rowDate: "started", showPageCount: "yes" })).toMatchObject({
      rowDate: "none",
      showPageCount: false,
    });
    expect(cleanLibraryViewPatch({ rowDate: "added" })).toEqual({ rowDate: "added" });
  });
});
