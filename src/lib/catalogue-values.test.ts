import { describe, expect, it } from "vitest";
import {
  bestPageCount,
  catalogueBookValues,
  diffAgainstForm,
  type CatalogueValues,
} from "@/lib/catalogue-values";
import type { BookMetadata } from "@/lib/metadata/types";
import type { TagImportSettings } from "@/lib/tag-rules";

const all: TagImportSettings = { mode: "all", rules: { renames: [], skips: [] }, knownTags: [] };

function row(over: Partial<BookMetadata> = {}): BookMetadata {
  return {
    title: "The Hobbit",
    authors: ["J.R.R. Tolkien"],
    isbn: "9780261103344",
    coverUrl: "https://covers.example.org/1.jpg",
    description: null,
    pageCount: 300,
    publishedDate: "1937",
    tags: [],
    openLibraryId: "OL27482W",
    source: "openlibrary",
    ...over,
  };
}

const empty: CatalogueValues = {
  title: "",
  authors: "",
  isbn: "",
  description: "",
  coverUrl: "",
  pageCount: "",
  publishedDate: "",
  tags: "",
  openLibraryId: "",
};

describe("bestPageCount", () => {
  it("prefers the details' count for an Open Library row, over its median", () => {
    expect(bestPageCount(row({ pageCount: 300 }), 310)).toBe(310);
    expect(bestPageCount(row({ pageCount: 300 }), null)).toBe(300);
  });

  it("keeps an nb.no or Google row's own edition count", () => {
    expect(bestPageCount(row({ source: "nb", pageCount: 287 }), 310)).toBe(287);
    expect(bestPageCount(row({ source: "googlebooks", pageCount: null }), 310)).toBe(310);
  });
});

describe("catalogueBookValues", () => {
  it("falls back to the details' work id for a row without one", () => {
    const v = catalogueBookValues(row({ source: "nb", openLibraryId: null }), { openLibraryId: "OL1W" }, all);
    expect(v.openLibraryId).toBe("OL1W");
  });

  it("uses the scanned ISBN over the row's", () => {
    expect(catalogueBookValues(row(), null, all, "978-82-05-53010-2").isbn).toBe("9788205530102");
    expect(catalogueBookValues(row(), null, all, "hobbit").isbn).toBe("9780261103344");
  });

  it("runs the subjects through the tag settings", () => {
    const v = catalogueBookValues(row({ tags: ["Fantasy"] }), { tags: ["Fiction, General"] }, {
      ...all,
      rules: { renames: [], skips: ["general"] },
    });
    expect(v.tags).toBe("fantasy, fiction");
    expect(catalogueBookValues(row({ tags: ["Fantasy"] }), null, { ...all, mode: "off" }).tags).toBe("");
  });
});

describe("diffAgainstForm", () => {
  const catalogue = catalogueBookValues(row({ tags: ["fantasy"] }), { description: "A hobbit." }, all);

  it("offers empty fields ticked and different ones unticked", () => {
    const rows = diffAgainstForm(
      { ...empty, title: "Hobbit", authors: "Tolkien", tags: "classic" },
      catalogue,
    );
    const byField = Object.fromEntries(rows.map((r) => [r.field, r]));
    expect(byField.title).toMatchObject({ value: "The Hobbit", current: "Hobbit", checked: false });
    expect(byField.authors.checked).toBe(false);
    expect(byField.pageCount).toMatchObject({ value: "300", checked: true });
    expect(byField.description.checked).toBe(true);
    expect(byField.coverUrl.checked).toBe(true);
  });

  it("skips values that only differ in case, spacing, ISBN hyphens or number form", () => {
    const rows = diffAgainstForm(
      {
        ...empty,
        title: "the  HOBBIT",
        authors: "j.r.r. tolkien",
        isbn: "0-261-10334-2",
        pageCount: "0300",
        publishedDate: "1937",
        description: "A  hobbit.",
        tags: "fantasy",
      },
      catalogue,
    );
    expect(rows.map((r) => r.field)).toEqual(["coverUrl", "openLibraryId"]);
  });

  it("offers only new tags, and the cover and Open Library id only when empty", () => {
    const rows = diffAgainstForm(
      { ...empty, tags: "Classic, fantasy", coverUrl: "/api/covers/a.jpg", openLibraryId: "OL9W" },
      catalogueBookValues(row({ tags: ["fantasy", "adventure"] }), null, all),
    );
    const tags = rows.find((r) => r.field === "tags");
    expect(tags).toMatchObject({ value: "adventure", checked: false });
    expect(rows.some((r) => r.field === "coverUrl" || r.field === "openLibraryId")).toBe(false);
  });
});
