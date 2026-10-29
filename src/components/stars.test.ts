import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SpriteIcon } from "@/components/icon-sprite";
import { cn } from "@/lib/utils";

vi.mock("@/components/preferences-provider", () => ({ usePreferences: () => ({ ratingStyle: "stars" }) }));

const { StarGraphic } = await import("@/components/stars");

/** A rating as the stars were drawn when each was a component. */
function asComponents(value: number, sizeClass: string): string {
  const row = (filled: boolean) =>
    createElement(
      "div",
      { className: "flex w-max" },
      [0, 1, 2, 3, 4].map((i) =>
        createElement(SpriteIcon, {
          key: i,
          name: "star",
          className: cn(sizeClass, "shrink-0", filled && "fill-current"),
        }),
      ),
    );
  return renderToStaticMarkup(
    createElement(
      "div",
      {
        className: "relative inline-flex text-muted-foreground/30",
        role: "img",
        "aria-label": `${value / 2} out of 5 stars`,
      },
      row(false),
      createElement(
        "div",
        { className: "absolute inset-y-0 left-0 overflow-hidden text-amber-500", style: { width: `${value * 10}%` } },
        row(true),
      ),
    ),
  );
}

describe("star ratings", () => {
  it.each([
    [7, "sm", undefined, "size-4"],
    [10, "lg", undefined, "size-6"],
    [3, "sm", "size-8 sm:size-6", "size-8 sm:size-6"],
  ] as const)("draw %s half stars (%s) just as the components did", (value, size, starClassName, sizeClass) => {
    const html = renderToStaticMarkup(createElement(StarGraphic, { value, size, starClassName }));
    expect(html).toBe(asComponents(value, sizeClass));
  });
});
