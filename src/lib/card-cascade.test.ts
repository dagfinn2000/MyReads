import { describe, expect, it } from "vitest";
import { STAGGERED_CARDS, cascadeSteps } from "./card-cascade";

const ids = (n: number, prefix = "b") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("cascadeSteps", () => {
  it("numbers a first view in reading order", () => {
    const steps = cascadeSteps(["a", "b", "c"]);
    expect([...steps]).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("never lets a card past the staggered ones rise before them", () => {
    const keys = ids(60);
    const steps = keys.map((k) => cascadeSteps(keys).get(k)!);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    }
    expect(steps[STAGGERED_CARDS - 1]).toBe(STAGGERED_CARDS - 1);
    expect(steps[STAGGERED_CARDS]).toBe(STAGGERED_CARDS);
    expect(steps[59]).toBe(STAGGERED_CARDS);
  });

  it("carries on through the sections of a grouped library", () => {
    // Section B starts after section A's cards, not alongside them.
    const keys = ["A\nx", "A\ny", "B\nz", "B\nx"];
    expect([...cascadeSteps(keys).values()]).toEqual([0, 1, 2, 3]);
  });

  it("starts the cards Show more adds straight away, below the ones in place", () => {
    const first = cascadeSteps(ids(200));
    const more = cascadeSteps(ids(260), first);
    expect(more.get("b0")).toBe(0);
    expect(more.get("b199")).toBe(STAGGERED_CARDS);
    expect(more.get("b200")).toBe(0);
    expect(more.get("b201")).toBe(1);
    expect(more.get("b259")).toBe(STAGGERED_CARDS);
  });

  it("keeps the cards already showing as they were, and numbers only the new ones", () => {
    const first = cascadeSteps(["a", "b", "c"]);
    const next = cascadeSteps(["x", "a", "y", "c"], first);
    expect([...next]).toEqual([
      ["x", 0],
      ["a", 0],
      ["y", 1],
      ["c", 2],
    ]);
  });

  it("forgets cards that left, so one that comes back rises again in turn", () => {
    const first = cascadeSteps(["a", "b", "c", "d"]);
    const filtered = cascadeSteps(["a"], first);
    expect([...filtered.keys()]).toEqual(["a"]);
    const back = cascadeSteps(["a", "b", "c", "d"], filtered);
    expect([...back.values()]).toEqual([0, 0, 1, 2]);
  });

  it("gives a repeated key one step", () => {
    expect([...cascadeSteps(["a", "a", "b"])]).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });
});
