import { describe, expect, it } from "vitest";
import { fitQuote, quoteCardFileName, wrapLines, type Measure } from "@/lib/quote-card";

/** Every letter half the type size wide, as a monospaced face would be. */
const mono: Measure = (text, size) => text.length * size * 0.5;

describe("wrapLines", () => {
  it("breaks between words to fit the width", () => {
    // 10 letters of 20px type fit in 100px.
    expect(wrapLines("only in silence the word", 100, 20, mono)).toEqual([
      "only in",
      "silence",
      "the word",
    ]);
  });

  it("keeps the quote's own line breaks, without blank lines at the ends", () => {
    expect(wrapLines("\nOne line\n\nanother\n", 200, 20, mono)).toEqual(["One line", "", "another"]);
  });

  it("breaks a word too long for a line", () => {
    expect(wrapLines("Lavransdatter", 100, 20, mono)).toEqual(["Lavransdat", "ter"]);
  });
});

describe("fitQuote", () => {
  it("takes the largest size that fits", () => {
    const layout = fitQuote("Short and sweet.", { width: 800, height: 300 }, mono, { max: 64, min: 30 });
    expect(layout.size).toBe(64);
    expect(layout.lines).toEqual(["Short and sweet."]);
    expect(layout.cut).toBe(false);
  });

  it("goes smaller for a longer quote", () => {
    const text = "word ".repeat(80).trim();
    const layout = fitQuote(text, { width: 800, height: 500 }, mono, { max: 64, min: 30 });
    expect(layout.size).toBeLessThan(64);
    expect(layout.size).toBeGreaterThanOrEqual(30);
    expect(layout.lines.length * layout.lineHeight).toBeLessThanOrEqual(500);
    expect(layout.lines.join(" ")).toBe(text);
    expect(layout.cut).toBe(false);
  });

  it("cuts a quote too long even at the smallest size, with an ellipsis", () => {
    const text = "Every word counts here. ".repeat(200).trim();
    const layout = fitQuote(text, { width: 600, height: 400 }, mono, { max: 40, min: 30 });
    expect(layout.size).toBe(30);
    expect(layout.cut).toBe(true);
    expect(layout.lines.length * layout.lineHeight).toBeLessThanOrEqual(400);
    const last = layout.lines[layout.lines.length - 1];
    expect(last.endsWith("…")).toBe(true);
    expect(last).not.toMatch(/[\s.]…$/);
    expect(mono(last, 30)).toBeLessThanOrEqual(600);
  });
});

describe("quoteCardFileName", () => {
  it("names the file after the book", () => {
    expect(quoteCardFileName("A Wizard of Earthsea")).toBe("quote-a-wizard-of-earthsea.png");
    expect(quoteCardFileName("Smilla's Sense of Snow")).toBe("quote-smilla-s-sense-of-snow.png");
    expect(quoteCardFileName("Ærø: Brontë & Høeg")).toBe("quote-aero-bronte-hoeg.png");
    expect(quoteCardFileName("Kristin Lavransdatter: Kransen på Jørundgård")).toBe(
      "quote-kristin-lavransdatter-kransen-pa-jorundgard.png",
    );
    expect(quoteCardFileName("???")).toBe("quote-book.png");
  });
});
