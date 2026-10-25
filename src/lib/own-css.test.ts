import { describe, expect, it } from "vitest";
import { OWN_CSS_MAX, ownCssApplies, parseOwnCss, styleText } from "@/lib/own-css";

describe("parseOwnCss", () => {
  it("keeps a string, and nothing else", () => {
    expect(parseOwnCss("h1 { color: teal; }")).toBe("h1 { color: teal; }");
    expect(parseOwnCss(42)).toBe("");
    expect(parseOwnCss(undefined)).toBe("");
  });

  it("keeps at most OWN_CSS_MAX characters", () => {
    expect(parseOwnCss("a".repeat(OWN_CSS_MAX + 50))).toHaveLength(OWN_CSS_MAX);
  });
});

describe("styleText", () => {
  it("can't close the style element", () => {
    const text = styleText('h1{} </style><script>alert(1)</script><style>');
    expect(text).not.toContain("<");
    expect(text).toContain("\\3C /style>");
  });

  it("leaves the rest of the CSS as it was", () => {
    const css = 'nav > a + a ~ b::after { content: "→"; }';
    expect(styleText(css)).toBe(css);
  });
});

describe("ownCssApplies", () => {
  it("applies everywhere but the Account page", () => {
    expect(ownCssApplies("/books", null)).toBe(true);
    expect(ownCssApplies("/stats/year/2026", null)).toBe(true);
    expect(ownCssApplies("/account", null)).toBe(false);
  });

  it("is skipped with ?css=off", () => {
    expect(ownCssApplies("/books", "off")).toBe(false);
    expect(ownCssApplies("/books", "on")).toBe(true);
  });
});
