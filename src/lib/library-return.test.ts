import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLibraryHref,
  noteAction,
  parseLibraryReturn,
  previousEntryIs,
} from "./library-return";

describe("isLibraryHref", () => {
  it("accepts the library, with or without a query, and the reading room", () => {
    expect(isLibraryHref("/books")).toBe(true);
    expect(isLibraryHref("/books?sort=title&shelf=READ")).toBe(true);
    expect(isLibraryHref("/room")).toBe(true);
  });

  it("rejects book pages, other pages and other sites", () => {
    expect(isLibraryHref("/books/abc123")).toBe(false);
    expect(isLibraryHref("/books/new")).toBe(false);
    expect(isLibraryHref("/booksx")).toBe(false);
    expect(isLibraryHref("/reading")).toBe(false);
    expect(isLibraryHref("/room/x")).toBe(false);
    expect(isLibraryHref("//evil.example/books")).toBe(false);
    expect(isLibraryHref("https://evil.example/books")).toBe(false);
  });
});

describe("noteAction", () => {
  it("writes a note when a book is opened from the library or the reading room", () => {
    expect(noteAction("/books")).toBe("write");
    expect(noteAction("/room")).toBe("write");
  });

  it("keeps it when one book's series strip opens another", () => {
    expect(noteAction("/books/abc123")).toBe("keep");
  });

  it("forgets it when a book is opened from anywhere else", () => {
    expect(noteAction("/reading")).toBe("forget");
    expect(noteAction("/stats/year/2026")).toBe("forget");
    expect(noteAction("/books/new")).toBe("forget");
    expect(noteAction("/books/check")).toBe("forget");
    expect(noteAction("/books/abc123/edit")).toBe("forget");
  });
});

describe("parseLibraryReturn", () => {
  const note = { bookId: "b1", href: "/books?sort=title", scrollY: 1200, coverY: 1460 };

  it("reads a note for this book", () => {
    expect(parseLibraryReturn(JSON.stringify(note), "b1")).toEqual(note);
  });

  it("ignores a note for another book, or none at all", () => {
    expect(parseLibraryReturn(JSON.stringify(note), "b2")).toBeNull();
    expect(parseLibraryReturn(null, "b1")).toBeNull();
  });

  it("ignores a note that isn't JSON, or points anywhere but the library", () => {
    expect(parseLibraryReturn("{not json", "b1")).toBeNull();
    expect(parseLibraryReturn("null", "b1")).toBeNull();
    expect(parseLibraryReturn(JSON.stringify({ ...note, href: "/books/b1" }), "b1")).toBeNull();
    expect(parseLibraryReturn(JSON.stringify({ ...note, href: "https://x.example" }), "b1")).toBeNull();
    expect(parseLibraryReturn(JSON.stringify({ ...note, href: 7 }), "b1")).toBeNull();
  });

  it("falls back to the top for scroll positions it can't use", () => {
    const parsed = parseLibraryReturn(
      JSON.stringify({ bookId: "b1", href: "/books", scrollY: "far", coverY: null }),
      "b1",
    );
    expect(parsed).toEqual({ bookId: "b1", href: "/books", scrollY: 0, coverY: 0 });
    expect(
      parseLibraryReturn(JSON.stringify({ ...note, scrollY: -40 }), "b1")?.scrollY,
    ).toBe(0);
  });
});

describe("previousEntryIs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubHistory(urls: string[], index: number, withNavigation = true) {
    vi.stubGlobal("location", { origin: "https://reads.example" });
    vi.stubGlobal(
      "window",
      withNavigation
        ? { navigation: { currentEntry: { index }, entries: () => urls.map((url) => ({ url })) } }
        : {},
    );
  }

  it("is true when the entry before this one is that library page", () => {
    stubHistory(["https://reads.example/books?sort=title", "https://reads.example/books/b1"], 1);
    expect(previousEntryIs("/books?sort=title")).toBe(true);
  });

  it("is false when the library's filters were different", () => {
    stubHistory(["https://reads.example/books?sort=author", "https://reads.example/books/b1"], 1);
    expect(previousEntryIs("/books?sort=title")).toBe(false);
  });

  it("is false when something came in between, like the edit page", () => {
    stubHistory(
      [
        "https://reads.example/books",
        "https://reads.example/books/b1",
        "https://reads.example/books/b1/edit",
        "https://reads.example/books/b1",
      ],
      3,
    );
    expect(previousEntryIs("/books")).toBe(false);
  });

  it("is false on the first entry, or without the Navigation API", () => {
    stubHistory(["https://reads.example/books/b1"], 0);
    expect(previousEntryIs("/books")).toBe(false);
    stubHistory(["https://reads.example/books", "https://reads.example/books/b1"], 1, false);
    expect(previousEntryIs("/books")).toBe(false);
  });
});
