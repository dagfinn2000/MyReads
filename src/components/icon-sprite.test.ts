import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookOpen, Star } from "lucide-react";
import { IconSprite, SPRITE_PATHS, SpriteIcon, spriteIconHtml, type SpriteName } from "@/components/icon-sprite";

const LUCIDE: Record<SpriteName, typeof Star> = { star: Star, "book-open": BookOpen };

/** The `d` of every path in some markup. */
const paths = (html: string) => [...html.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
/** An <svg>'s opening tag. */
const openTag = (html: string) => html.slice(0, html.indexOf(">") + 1);

describe("sprite icons", () => {
  it.each(Object.keys(SPRITE_PATHS) as SpriteName[])("draw %s with lucide's paths", (name) => {
    const lucide = renderToStaticMarkup(createElement(LUCIDE[name]));
    expect(SPRITE_PATHS[name]).toEqual(paths(lucide));
  });

  it.each(Object.keys(SPRITE_PATHS) as SpriteName[])("give %s lucide's <svg> attributes", (name) => {
    const className = "size-4 shrink-0 fill-current";
    const lucide = renderToStaticMarkup(createElement(LUCIDE[name], { className }));
    const sprite = renderToStaticMarkup(createElement(SpriteIcon, { name, className }));
    expect(openTag(sprite)).toBe(openTag(lucide));
    expect(sprite).toContain(`<use href="#icon-${name}">`);
  });

  it.each(["size-4 shrink-0", "size-8 sm:size-6 shrink-0 fill-current", undefined])(
    "come out the same as markup (class %s)",
    (className) => {
      for (const name of Object.keys(SPRITE_PATHS) as SpriteName[]) {
        expect(spriteIconHtml(name, className)).toBe(
          renderToStaticMarkup(createElement(SpriteIcon, { name, className })),
        );
      }
    },
  );

  it("puts every symbol in the sprite once", () => {
    const sprite = renderToStaticMarkup(createElement(IconSprite));
    for (const name of Object.keys(SPRITE_PATHS)) {
      expect(sprite.split(`id="icon-${name}"`)).toHaveLength(2);
    }
  });
});
