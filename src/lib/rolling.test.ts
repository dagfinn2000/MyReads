import { describe, expect, it } from "vitest";
import { rollPlan, type RollCell } from "@/lib/rolling";

const rolls = (plan: RollCell[] | null) =>
  plan?.filter((c) => c.kind === "roll").map((c) => (c.kind === "roll" ? `${c.from || "_"}${c.char}${c.dir[0]}${c.delay}` : ""));
const text = (plan: RollCell[] | null) => plan?.map((c) => c.char).join("");

describe("rollPlan", () => {
  it("rolls only the digits that changed, units first", () => {
    const plan = rollPlan("141 of 272 · 52%", "151 of 272 · 56%");
    expect(text(plan)).toBe("151 of 272 · 56%");
    expect(rolls(plan)).toEqual(["45u0", "26u0"]);
  });

  it("carries over: every wheel that turns, and a new place rolls in from blank", () => {
    expect(rolls(rollPlan("99 of 300", "100 of 300"))).toEqual(["_1u2", "90u1", "90u0"]);
  });

  it("rolls down when the number falls", () => {
    expect(rolls(rollPlan("120 of 300", "118 of 300"))).toEqual(["21d1", "08d0"]);
  });

  it("keeps thousands marks still and lines digits up past them", () => {
    const plan = rollPlan("1,234 pages", "1,240 pages");
    expect(text(plan)).toBe("1,240 pages");
    expect(rolls(plan)).toEqual(["34u1", "40u0"]);
  });

  it("doesn't roll a line whose words changed", () => {
    expect(rollPlan("Not started", "12 of 300")).toBeNull();
    expect(rollPlan("12 of 300", "12 of 300 · 4%")).toBeNull();
  });
});
