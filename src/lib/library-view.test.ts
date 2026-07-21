import { describe, expect, it } from "vitest";
import { DEFAULT_LIBRARY_VIEW, parseLibraryView } from "@/lib/library-view";

describe("parseLibraryView", () => {
  it("passes a fully valid stored view through", () => {
    expect(
      parseLibraryView({ sort: "author", dir: "asc", group: "series" }),
    ).toEqual({ sort: "author", dir: "asc", group: "series" });
  });

  it("returns defaults for null/undefined (never-saved accounts)", () => {
    expect(parseLibraryView(null)).toEqual(DEFAULT_LIBRARY_VIEW);
    expect(parseLibraryView(undefined)).toEqual(DEFAULT_LIBRARY_VIEW);
  });

  it("defaults each unknown field individually", () => {
    // e.g. a sort option removed in a later version — the rest must survive.
    expect(parseLibraryView({ sort: "bogus", dir: "asc", group: "author" })).toEqual({
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
});
