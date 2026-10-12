import { describe, expect, it } from "vitest";
import {
  parseGoalYear,
  parsePeriod,
  periodWindow,
  statsHref,
  yearWindow,
} from "@/lib/stats-period";

describe("parsePeriod", () => {
  it("takes a known period, the first of a repeated one, else the default", () => {
    expect(parsePeriod("30d", "all")).toBe("30d");
    expect(parsePeriod("all", "year")).toBe("all");
    expect(parsePeriod(["12m", "30d"], "all")).toBe("12m");
    expect(parsePeriod("bogus", "year")).toBe("year");
    expect(parsePeriod(undefined, "12m")).toBe("12m");
  });
});

describe("periodWindow", () => {
  it("covers the whole calendar year for This year", () => {
    expect(periodWindow("year", "2026-10-12")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(yearWindow(2026)).toEqual(periodWindow("year", "2026-03-01"));
  });

  it("ends the rolling windows today, both ends included", () => {
    // 365 days, the reading calendar's span.
    expect(periodWindow("12m", "2026-10-12")).toEqual({ from: "2025-10-13", to: "2026-10-12" });
    expect(periodWindow("12m", "2028-12-31")).toEqual({ from: "2028-01-02", to: "2028-12-31" });
    // 30 days.
    expect(periodWindow("30d", "2026-10-12")).toEqual({ from: "2026-09-13", to: "2026-10-12" });
  });

  it("crosses a leap day and a year boundary by calendar days", () => {
    expect(periodWindow("30d", "2028-03-01")).toEqual({ from: "2028-02-01", to: "2028-03-01" });
    expect(periodWindow("30d", "2026-01-10")).toEqual({ from: "2025-12-12", to: "2026-01-10" });
  });

  it("has no ends for all time", () => {
    expect(periodWindow("all", "2026-10-12")).toEqual({ from: null, to: null });
  });
});

describe("parseGoalYear", () => {
  const past = new Set([2024, 2025]);

  it("opens next year, or a past year that has a goal", () => {
    expect(parseGoalYear("2027", 2026, past)).toBe(2027);
    expect(parseGoalYear("2024", 2026, past)).toBe(2024);
    expect(parseGoalYear(["2027", "2024"], 2026, past)).toBe(2027);
  });

  it("ignores anything else, the current year included", () => {
    expect(parseGoalYear("2026", 2026, past)).toBeNull();
    expect(parseGoalYear("2030", 2026, past)).toBeNull();
    expect(parseGoalYear("2023", 2026, past)).toBeNull(); // no goal that year
    expect(parseGoalYear("1800", 2026, past)).toBeNull();
    expect(parseGoalYear("abc", 2026, past)).toBeNull();
    expect(parseGoalYear("2027.5", 2026, past)).toBeNull();
    expect(parseGoalYear(undefined, 2026, past)).toBeNull();
  });
});

describe("statsHref", () => {
  it("includes only the parts given", () => {
    expect(statsHref({})).toBe("/stats");
    expect(statsHref({ period: "30d" })).toBe("/stats?period=30d");
    expect(statsHref({ period: "all", goalYear: null })).toBe("/stats?period=all");
    expect(statsHref({ period: "all", goalYear: 2027, hash: "goal" })).toBe(
      "/stats?period=all&goalYear=2027#goal",
    );
  });
});
