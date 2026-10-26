import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("the motion off switch (globals.css)", () => {
  it("turns transitions off outright on every element, not down to a tiny duration", () => {
    // Any duration on every element is a transition of every property
    // (`transition-property` defaults to all), and a theme change then
    // starts thousands of them: seconds on the library.
    const everyElement = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
      ([, selector, body]) => /(^|[\s,])\*/.test(selector) && body.includes("transition-duration"),
    );
    expect(everyElement.length).toBeGreaterThanOrEqual(2); // reduced motion, Animations off
    for (const [, , body] of everyElement) {
      expect(body).toMatch(/transition-duration:\s*0s\s*!important/);
    }
  });
});
