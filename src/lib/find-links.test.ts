import { describe, expect, it } from "vitest";
import { fillFindLink, findLinksFor } from "@/lib/find-links";

const wood = { isbn: "9780099448822", title: "Norwegian Wood", authors: ["Haruki Murakami"] };

describe("fillFindLink", () => {
  it("fills in the ISBN", () => {
    expect(fillFindLink("https://lib.example/search?q={isbn}", wood)).toBe(
      "https://lib.example/search?q=9780099448822",
    );
  });

  it("encodes the title so it can't break the query", () => {
    const book = { ...wood, title: "Q&A? #1 / Part 2" };
    expect(fillFindLink("https://lib.example/s?q={title}&x=1", book)).toBe(
      "https://lib.example/s?q=Q%26A%3F%20%231%20%2F%20Part%202&x=1",
    );
  });

  it("inserts a $& in a title as written", () => {
    const book = { ...wood, title: "$& and $1" };
    expect(fillFindLink("https://lib.example/?q={title}", book)).toBe(
      `https://lib.example/?q=${encodeURIComponent("$& and $1")}`,
    );
  });

  it("uses the first author", () => {
    const book = { ...wood, authors: ["Neil Gaiman", "Terry Pratchett"] };
    expect(fillFindLink("https://shop.example/a/{author}", book)).toBe(
      "https://shop.example/a/Neil%20Gaiman",
    );
  });

  it("fills every placeholder in one pattern", () => {
    expect(fillFindLink("https://x.example/{isbn}?t={title}&a={author}&i={isbn}", wood)).toBe(
      "https://x.example/9780099448822?t=Norwegian%20Wood&a=Haruki%20Murakami&i=9780099448822",
    );
  });

  it("is null when a placeholder has nothing to fill it with", () => {
    expect(fillFindLink("https://lib.example/?q={isbn}", { ...wood, isbn: null })).toBeNull();
    expect(fillFindLink("https://lib.example/?q={isbn}", { ...wood, isbn: "" })).toBeNull();
    expect(fillFindLink("https://lib.example/?q={author}", { ...wood, authors: [] })).toBeNull();
  });

  it("keeps a pattern without placeholders as it is", () => {
    expect(fillFindLink("https://lib.example/", { ...wood, isbn: null })).toBe(
      "https://lib.example/",
    );
  });

  it("refuses anything that isn't https", () => {
    expect(fillFindLink("http://lib.example/?q={isbn}", wood)).toBeNull();
    expect(fillFindLink("javascript:alert({title})", wood)).toBeNull();
    expect(fillFindLink("not a link {title}", wood)).toBeNull();
  });
});

describe("findLinksFor", () => {
  it("keeps the order and drops links this book can't fill", () => {
    const links = [
      { name: "Library", url: "https://lib.example/?q={isbn}" },
      { name: "Shop", url: "https://shop.example/?a={author}" },
      { name: "Search", url: "https://search.example/?q={title}" },
    ];
    expect(findLinksFor(links, { ...wood, isbn: null })).toEqual([
      { name: "Shop", href: "https://shop.example/?a=Haruki%20Murakami" },
      { name: "Search", href: "https://search.example/?q=Norwegian%20Wood" },
    ]);
  });

  it("is empty with no links saved", () => {
    expect(findLinksFor([], wood)).toEqual([]);
  });
});
