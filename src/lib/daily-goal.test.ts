import { describe, expect, it } from "vitest";
import {
  dailyGoalLines,
  dailyGoalStatus,
  dailyGoalTarget,
  goalMetDays,
  type DailyGoalTarget,
} from "@/lib/daily-goal";
import { DEFAULT_PREFERENCES, parsePreferences } from "@/lib/preferences";

const pages: DailyGoalTarget = { unit: "pages", amount: 30 };
const TODAY = "2026-10-19";

describe("dailyGoalTarget", () => {
  it("is off by default, and follows the unit Preferences pick", () => {
    expect(dailyGoalTarget(DEFAULT_PREFERENCES)).toBeNull();
    expect(dailyGoalTarget({ ...DEFAULT_PREFERENCES, dailyGoal: "pages" })).toEqual({
      unit: "pages",
      amount: 20,
    });
    expect(
      dailyGoalTarget({ ...DEFAULT_PREFERENCES, dailyGoal: "minutes", dailyGoalMinutes: 45 }),
    ).toEqual({ unit: "minutes", amount: 45 });
  });

  it("only takes amounts the menus offer", () => {
    const prefs = parsePreferences({ dailyGoal: "pages", dailyGoalPages: 37, dailyGoalMinutes: 60 });
    expect(prefs.dailyGoalPages).toBe(20);
    expect(prefs.dailyGoalMinutes).toBe(60);
    expect(parsePreferences({ dailyGoal: "chapters" }).dailyGoal).toBe("off");
    expect(parsePreferences({ dailyGoalPages: "50" }).dailyGoalPages).toBe(20);
  });
});

describe("dailyGoalStatus", () => {
  it("counts today and what's left", () => {
    const status = dailyGoalStatus(new Map([[TODAY, 18]]), pages, TODAY);
    expect(status).toMatchObject({ today: 18, met: false, left: 12 });
  });

  it("counts the days in a row, not breaking on a today that isn't over", () => {
    const byDay = new Map([
      ["2026-10-16", 40],
      ["2026-10-17", 30],
      ["2026-10-18", 31],
      [TODAY, 5],
    ]);
    expect(dailyGoalStatus(byDay, pages, TODAY)).toMatchObject({ streak: 3, met: false });
    byDay.set(TODAY, 30);
    expect(dailyGoalStatus(byDay, pages, TODAY)).toMatchObject({ streak: 4, met: true, left: 0 });
  });

  it("counts the days met in the week before today", () => {
    const byDay = new Map([
      ["2026-10-11", 99], // eight days back: outside the week
      ["2026-10-12", 30],
      ["2026-10-15", 10],
      ["2026-10-17", 35],
    ]);
    expect(dailyGoalStatus(byDay, pages, TODAY)).toMatchObject({ streak: 0, lastWeek: 2 });
  });

  it("finds the days the goal was met", () => {
    expect(goalMetDays(new Map([["a", 29], ["b", 30], ["c", 31]]), 30)).toEqual(new Set(["b", "c"]));
  });
});

describe("dailyGoalLines", () => {
  const base = { today: 0, met: false, left: 30, streak: 0, lastWeek: 0 };

  it("says what's left, and nothing more on a fresh start", () => {
    expect(dailyGoalLines(base, pages)).toEqual({
      headline: "30 pages to go today",
      detail: null,
    });
    expect(dailyGoalLines({ ...base, today: 29, left: 1 }, pages).headline).toBe(
      "1 page to go today",
    );
  });

  it("celebrates a met goal and a run of days", () => {
    expect(dailyGoalLines({ ...base, today: 31, met: true, left: 0, streak: 5 }, pages)).toEqual({
      headline: "Daily goal met",
      detail: "5 days in a row",
    });
    expect(
      dailyGoalLines({ ...base, today: 10, left: 20, lastWeek: 3 }, { unit: "minutes", amount: 30 }),
    ).toEqual({ headline: "20 minutes to go today", detail: "met on 3 of the last 7 days" });
  });

  it("writes what's left in the reader's number style", () => {
    const big = { ...base, left: 1250 };
    const minutes = { unit: "minutes", amount: 1500 } as const;
    expect(dailyGoalLines(big, minutes, { dateFormat: "iso", numberFormat: "period" }).headline).toBe(
      "1.250 minutes to go today",
    );
  });
});
