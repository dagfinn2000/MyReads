import { describe, expect, it } from "vitest";
import { isNavActive } from "./nav";

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
