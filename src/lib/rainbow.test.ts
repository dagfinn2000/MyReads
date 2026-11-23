import { describe, expect, it } from "vitest";
import { bookRainbowKey, cachedCoverFile, hexToHsl, rainbowKey } from "@/lib/rainbow";
import { sortBooks } from "@/lib/library-sort";

describe("rainbow order", () => {
  it("runs red, orange, yellow, green, blue, violet, pink, then greys", () => {
    const order = ["#d01010", "#e07010", "#e0d020", "#20a040", "#2050c0", "#7030b0", "#e060a0", "#f0f0f0", "#808080", "#101010"];
    const keys = order.map((c) => rainbowKey(c)!);
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
  });

  it("files a red just the purple side of 0° with the reds", () => {
    expect(rainbowKey("#d0103a")!).toBeLessThan(rainbowKey("#e07010")!);
  });

  it("puts light before dark within a hue", () => {
    expect(rainbowKey("#6080f0")!).toBeLessThan(rainbowKey("#102070")!);
  });

  it("reads hex as HSL", () => {
    expect(hexToHsl("#ff0000")).toEqual({ hue: 0, saturation: 1, lightness: 0.5 });
    expect(hexToHsl("nope")).toBeNull();
  });

  it("knows a cached cover by its file, and a drawn cover by its title", () => {
    expect(cachedCoverFile("/api/covers/abc.jpg")).toBe("abc.jpg");
    expect(cachedCoverFile("https://covers.example.org/x.jpg")).toBeNull();
    const colours = new Map([["abc.jpg", "#2050c0"]]);
    expect(bookRainbowKey({ title: "X", coverUrl: "/api/covers/abc.jpg" }, colours)).toBe(rainbowKey("#2050c0"));
    expect(bookRainbowKey({ title: "Dune", coverUrl: null }, colours)).toEqual(expect.any(Number));
    expect(bookRainbowKey({ title: "X", coverUrl: "https://elsewhere/x.jpg" }, colours)).toBeNull();
    expect(bookRainbowKey({ title: "X", coverUrl: "/api/covers/unread.jpg" }, new Map([["unread.jpg", ""]]))).toBeNull();
  });

  it("sorts unknown colours last either way round", () => {
    const book = (title: string, rainbow: number | null) => ({
      title,
      authors: ["A"],
      rating: null,
      seriesName: null,
      seriesNumber: null,
      dateFinished: null,
      dateStarted: null,
      pageCount: null,
      publishedDate: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      rainbow,
    });
    const books = [book("unknown", null), book("blue", 150), book("red", 5)];
    expect(sortBooks(books, "colour", "asc").map((b) => b.title)).toEqual(["red", "blue", "unknown"]);
    expect(sortBooks(books, "colour", "desc").map((b) => b.title)).toEqual(["blue", "red", "unknown"]);
  });
});
