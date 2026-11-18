import { describe, expect, it } from "vitest";
import { fineText } from "./fine-type";

describe("fineText", () => {
  it("curls double quotes", () => {
    expect(fineText('He said "no" and left.')).toBe("He said \u201cno\u201d and left.");
    expect(fineText('"Hi," she said.')).toBe("\u201cHi,\u201d she said.");
    expect(fineText('A ("quoted") word')).toBe("A (\u201cquoted\u201d) word");
  });

  it("turns apostrophes the right way", () => {
    expect(fineText("Ender's Game")).toBe("Ender\u2019s Game");
    expect(fineText("Tim O'Brien")).toBe("Tim O\u2019Brien");
    expect(fineText("the '90s")).toBe("the \u201990s");
    expect(fineText("rock 'n' roll")).toBe("rock \u2019n\u2019 roll");
    expect(fineText("'Twas the night")).toBe("\u2019Twas the night");
    expect(fineText("1990's")).toBe("1990\u2019s");
  });

  it("opens and closes single quotes", () => {
    expect(fineText("she said 'nothing' at all")).toBe("she said \u2018nothing\u2019 at all");
    expect(fineText(`"'Hello,' he said"`)).toBe("\u201c\u2018Hello,\u2019 he said\u201d");
  });

  it("sets dashes and ellipses", () => {
    expect(fineText("Wait--what?")).toBe("Wait\u2014what?");
    expect(fineText("one --- two")).toBe("one \u2014 two");
    expect(fineText("Pages 1990 - 1995")).toBe("Pages 1990 \u2013 1995");
    expect(fineText("And then...")).toBe("And then\u2026");
    expect(fineText("Four dots....")).toBe("Four dots....");
  });

  it("leaves lists, hyphens and rules alone", () => {
    expect(fineText("- one\n- two")).toBe("- one\n- two");
    expect(fineText("well-known self-help")).toBe("well-known self-help");
    expect(fineText("----")).toBe("----");
  });

  it("leaves web addresses alone", () => {
    expect(fineText("See https://example.com/a--b?q='x' -- it's good")).toBe(
      "See https://example.com/a--b?q='x' \u2014 it\u2019s good",
    );
  });

  it("hands back empty values and text with nothing to set", () => {
    expect(fineText("")).toBe("");
    expect(fineText(null)).toBe(null);
    expect(fineText(undefined)).toBe(undefined);
    const plain = "Dune";
    expect(fineText(plain)).toBe(plain);
  });
});
