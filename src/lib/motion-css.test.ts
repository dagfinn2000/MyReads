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

describe("compositor layers (globals.css)", () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    body,
  }));

  it("gives a cover its 3D tilt only while it tilts, not at rest", () => {
    // A 3D transform, even turned by 0deg, puts each cover on a layer of its
    // own; with every cover in the library on one, scrolling spent most of
    // its time sorting the layers.
    const tilted = rules.filter((r) => r.selector.includes("[data-tilt]") && /transform:\s*perspective/.test(r.body));
    expect(tilted.length).toBeGreaterThan(0);
    for (const r of tilted) expect(r.selector).toContain("[data-tilting]");
  });

  it("names the classes whose transitions a theme change holds off, never every element", () => {
    const held = rules.filter((r) => r.selector.includes("[data-theme-changing]"));
    expect(held.length).toBeGreaterThan(0);
    for (const r of held) expect(r.selector).not.toMatch(/(^|[\s,>])\*/);
  });
});

describe("transition-all (components/ui)", () => {
  it("is used by no component: it animates scrollbar-color too, which Chrome restarts on every restyle of <html>", () => {
    for (const file of ["badge.tsx", "button.tsx", "tabs.tsx"]) {
      const source = readFileSync(path.resolve(__dirname, "../components/ui", file), "utf8");
      expect(source, file).not.toContain("transition-all");
    }
  });
});


describe("skipping what is off screen (globals.css)", () => {
  it("skips library cards and rows only where they can still draw past their edge", () => {
    // content-visibility clips what a card draws outside itself (its
    // shadow, its lift, a theme's frame); overflow-clip-margin gives that
    // back, so a browser without it must draw every card as before.
    const guarded = /@supports\s*\(overflow-clip-margin[^)]*\)\s*\{\s*\.card-skip\s*\{([^{}]*)\}/.exec(css);
    expect(guarded).not.toBeNull();
    expect(guarded![1]).toMatch(/content-visibility:\s*auto/);
    expect(guarded![1]).toMatch(/overflow-clip-margin:/);
    const everywhere = css.replace(/@supports\s*\(overflow-clip-margin[\s\S]*?\n\}/, "");
    expect(everywhere).not.toMatch(/\.card-skip[^{]*\{[^}]*content-visibility/);
  });
});

describe("menus and dialogs opening (globals.css)", () => {
  it("keeps the scroll lock's property on <body>, so opening one doesn't restyle every element", async () => {
    // The scroll lock behind Radix's menus, lists and dialogs sets this on
    // <body>; inherited, it reached every element of the page.
    const { removedBarSizeVariable } = await import("react-remove-scroll-bar/constants");
    const rule = new RegExp(`@property\\s+${removedBarSizeVariable}\\s*\\{([^{}]*)\\}`).exec(css);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/inherits:\s*false/);
    expect(rule![1]).toMatch(/syntax:\s*"\*"/);
  });

  it("keeps <body> taking the pointer, and covers the page with the shield instead", () => {
    // Radix's pointer-events: none on <body> is inherited by every element.
    const body = /body\[style\*="pointer-events: none"\]\s*\{([^{}]*)\}/.exec(css);
    expect(body?.[1]).toMatch(/pointer-events:\s*auto\s*!important/);
    const shield = /body\[style\*="pointer-events: none"\]\s*>\s*\.outside-shield\s*\{([^{}]*)\}/.exec(css);
    expect(shield?.[1]).toMatch(/position:\s*fixed/);
    expect(shield?.[1]).toMatch(/inset:\s*0/);
    const layout = readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");
    expect(layout).toMatch(/\{children\}[\s\S]*className="outside-shield"[\s\S]*<\/body>/);
  });
});
