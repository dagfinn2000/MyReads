import { describe, expect, it } from "vitest";
import { COVER_WIDTHS, coverAt, coverSrcSet, hasCoverCopies } from "./cover-src";

describe("cover copies", () => {
  it("offers every width of a cached cover", () => {
    expect(coverSrcSet("/api/covers/abc.jpg")).toBe(
      COVER_WIDTHS.map((w) => `/api/covers/abc.jpg?w=${w} ${w}w`).join(", "),
    );
    expect(coverAt("/api/covers/abc.jpg", 160)).toBe("/api/covers/abc.jpg?w=160");
  });

  it("leaves remote covers and addresses with a query of their own alone", () => {
    for (const url of ["https://covers.openlibrary.org/b/id/1-L.jpg", "/api/covers/abc.jpg?v=2"]) {
      expect(hasCoverCopies(url)).toBe(false);
      expect(coverSrcSet(url)).toBeUndefined();
      expect(coverAt(url, 160)).toBe(url);
    }
  });
});
