import { describe, expect, it } from "vitest";
import { bookSchema, isAllowedCoverUrl } from "@/lib/validation";

const minimalForm = {
  title: "T",
  authors: "",
  tags: "",
  format: "PHYSICAL",
  ownership: "OWNED",
};

describe("bookSchema tags", () => {
  it("splits, trims, and lowercases the comma-separated field", () => {
    const parsed = bookSchema.parse({
      ...minimalForm,
      tags: " Fantasy , Sci-Fi ,",
    });
    expect(parsed.tags).toEqual(["fantasy", "sci-fi"]);
  });

  it("dedupes tags that collide after lowercasing", () => {
    // Metadata subjects often differ only in case — "Fiction, fiction"
    // must not land twice (duplicate React keys on the book page).
    const parsed = bookSchema.parse({
      ...minimalForm,
      tags: "Fiction, fiction, FICTION, fantasy",
    });
    expect(parsed.tags).toEqual(["fiction", "fantasy"]);
  });
});

describe("isAllowedCoverUrl", () => {
  it("accepts local cache paths, http(s) URLs and an empty value", () => {
    for (const url of ["", "/api/covers/abc-1234.jpg", "https://covers.openlibrary.org/b/id/1-L.jpg", "HTTP://x.example/a.png"]) {
      expect(isAllowedCoverUrl(url), url).toBe(true);
    }
  });

  it("refuses other schemes and protocol-relative paths", () => {
    // `//host` and `/\host` start with "/" but browsers fetch them off-site.
    for (const url of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.example/x.jpg", "/\\evil.example/x.jpg", "ftp://x.example/a.jpg"]) {
      expect(isAllowedCoverUrl(url), url).toBe(false);
    }
  });
});
