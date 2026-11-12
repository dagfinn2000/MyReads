import { describe, expect, it } from "vitest";
import { BookFormat, BookOwnership, ReadingStatus } from "@/lib/enums";
import { activeFilterChips, buildBookWhere, parseFilters } from "@/lib/library-filters";
import { groupBooks, type GroupableBook } from "@/lib/library-sort";
import { canonicalViewQuery } from "@/lib/saved-views";
import { challengeSources } from "@/lib/challenges";
import { describeRules, smartRulesQuery } from "@/lib/smart-shelves";
import { DEFAULT_PREFERENCES, parsePreferences } from "@/lib/preferences";
import {
  BUILT_IN_MOODS,
  MAX_CUSTOM_MOODS,
  MOOD_ICONS,
  allMoods,
  bookMoods,
  cleanBookMoods,
  moodList,
  offeredMoods,
  parseCustomMoods,
  parseHiddenMoods,
  type CustomMood,
} from "@/lib/moods";
import { STATUS_COLORS } from "@/lib/statuses";

const epic: CustomMood = { key: "ep1c", name: "Epic", icon: "swords", color: "teal" };
const prefs = { hiddenMoods: ["spooky"], customMoods: [epic] };

describe("the built-in moods", () => {
  it("have keys, names and icons of their own, and known tints", () => {
    const keys = BUILT_IN_MOODS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(BUILT_IN_MOODS.map((m) => m.name.toLowerCase())).size).toBe(keys.length);
    expect(new Set(BUILT_IN_MOODS.map((m) => m.icon)).size).toBe(keys.length);
    for (const m of BUILT_IN_MOODS) {
      expect(m.key).toMatch(/^[a-z0-9]{1,16}$/);
      expect(MOOD_ICONS).toContain(m.icon);
      expect(STATUS_COLORS).toContain(m.color);
    }
  });

  it("never put two of one tint side by side", () => {
    for (let i = 1; i < BUILT_IN_MOODS.length; i++) {
      expect(BUILT_IN_MOODS[i].color, BUILT_IN_MOODS[i].key).not.toBe(BUILT_IN_MOODS[i - 1].color);
    }
  });
});

describe("parsing the settings", () => {
  it("keeps only built-in moods as hidden, each once", () => {
    expect(parseHiddenMoods(["dark", "dark", "ep1c", 3, "spooky"])).toEqual(["dark", "spooky"]);
    expect(parseHiddenMoods("dark")).toEqual([]);
  });

  it("keeps the reader's own moods that make sense", () => {
    expect(
      parseCustomMoods([
        epic,
        { ...epic, name: "Again" }, // same key
        { key: "cosy", name: "Mine", icon: "sun", color: "sky" }, // a built-in key
        { key: "x2", name: "EPIC", icon: "sun", color: "sky" }, // same name
        { key: "x3", name: "  Very   grand ", icon: "nope", color: "nope" },
        { key: "BAD", name: "Bad key" },
        { key: "x4", name: "" },
        "junk",
      ]),
    ).toEqual([epic, { key: "x3", name: "Very grand", icon: "smile", color: "slate" }]);
    const many = Array.from({ length: 40 }, (_, i) => ({ key: `k${i}`, name: `M${i}`, icon: "sun", color: "sky" }));
    expect(parseCustomMoods(many)).toHaveLength(MAX_CUSTOM_MOODS);
  });

  it("is part of Preferences, with nothing hidden or added by default", () => {
    expect(DEFAULT_PREFERENCES.hiddenMoods).toEqual([]);
    expect(DEFAULT_PREFERENCES.customMoods).toEqual([]);
    expect(parsePreferences({ hiddenMoods: ["dark"], customMoods: [epic] })).toMatchObject({
      hiddenMoods: ["dark"],
      customMoods: [epic],
    });
  });
});

describe("a book's moods", () => {
  it("are offered without the hidden ones, the reader's own after the built-in", () => {
    const offered = offeredMoods(prefs).map((m) => m.key);
    expect(offered).not.toContain("spooky");
    expect(offered.at(-1)).toBe("ep1c");
    expect(allMoods(prefs).map((m) => m.key)).toContain("spooky");
  });

  it("show in list order, a hidden one too, an unknown key not at all", () => {
    expect(bookMoods(["ep1c", "zz9", "spooky", "cosy"], prefs).map((m) => m.name)).toEqual([
      "Cosy",
      "Spooky",
      "Epic",
    ]);
  });

  it("are saved cleaned", () => {
    expect(cleanBookMoods(["dark", "cosy", "dark", "zz9", 1, "ep1c"], prefs)).toEqual(["cosy", "dark", "ep1c"]);
    expect(cleanBookMoods("cosy", prefs)).toEqual([]);
  });
});

describe("the library's mood filter", () => {
  it("reads mood lists from the address, each key once", () => {
    expect(moodList("cosy, dark,cosy,,Bad Key,all")).toEqual(["cosy", "dark", "all"]);
    const f = parseFilters({ mood: "cosy,dark", notMood: "dark", moodMatch: "all" });
    // A mood in both lists is left out.
    expect([f.mood, f.notMood, f.moodMatch]).toEqual(["cosy", "dark", "all"]);
    expect(parseFilters({ moodMatch: "all" }).moodMatch).toBe("");
    expect(parseFilters({ mood: "cosy,funny", moodMatch: "all" }).moodMatch).toBe("all");
  });

  it("matches one, any or all of them, and leaves some out", () => {
    const where = (sp: Record<string, string>) => buildBookWhere("u", parseFilters(sp));
    expect(where({ mood: "cosy" }).moods).toEqual({ has: "cosy" });
    expect(where({ mood: "cosy,funny" }).moods).toEqual({ hasSome: ["cosy", "funny"] });
    expect(where({ mood: "cosy,funny", moodMatch: "all" }).moods).toEqual({ hasEvery: ["cosy", "funny"] });
    expect(where({ notMood: "dark" }).AND).toEqual([{ NOT: { moods: { hasSome: ["dark"] } } }]);
  });

  it("shows a chip for each, by the mood's name", () => {
    const f = parseFilters({ mood: "cosy,ep1c", moodMatch: "all", notMood: "dark" });
    const name = (key: string) => allMoods(prefs).find((m) => m.key === key)?.name ?? key;
    const chips = activeFilterChips(f, String, () => null, String, name);
    expect(chips.map((c) => c.label)).toEqual(["Mood: Cosy", "Mood: Epic", "Mood: not dark"]);
    // Taking one of two off leaves the other, and "all" goes with the last.
    expect(chips[0].clear).toEqual({ mood: "ep1c", moodMatch: "all" });
    expect(activeFilterChips(parseFilters({ mood: "cosy" }), String)[0].clear).toEqual({
      mood: "",
      moodMatch: "",
    });
  });

  it("is kept in a saved view, in a set order", () => {
    expect(canonicalViewQuery({ mood: "funny,cosy", moodMatch: "all", notMood: "dark" })).toBe(
      "mood=cosy%2Cfunny&moodMatch=all&notMood=dark&group=none&sort=createdAt&dir=desc",
    );
  });
});

describe("smart shelves by mood", () => {
  it("keep moods in their rules and name them", () => {
    const rules = smartRulesQuery("sort=title&mood=ep1c,cosy&notMood=dark");
    expect(rules).toBe("mood=cosy%2Cep1c&notMood=dark");
    expect(
      describeRules(rules, {
        statuses: { statusNames: {}, customStatuses: [] },
        shelfNames: new Map(),
        ratingLabel: String,
        moodName: (key) => allMoods(prefs).find((m) => m.key === key)?.name ?? key,
      }),
    ).toEqual(["Mood: Cosy", "Mood: Epic", "Mood: not dark"]);
  });
});

describe("grouping by mood", () => {
  const book = (title: string, moods: string[]): GroupableBook => ({
    title,
    authors: [],
    rating: null,
    seriesName: null,
    seriesNumber: null,
    dateFinished: null,
    dateStarted: null,
    pageCount: null,
    publishedDate: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    status: ReadingStatus.READ,
    format: BookFormat.PHYSICAL,
    ownership: BookOwnership.OWNED,
    tags: [],
    moods,
  });

  it("puts a book under each of its moods, in list order, and the rest last", () => {
    const groups = groupBooks(
      [book("A", ["dark", "cosy"]), book("B", ["ep1c"]), book("C", ["zz9"]), book("D", [])],
      "mood",
      { moods: allMoods(prefs) },
    )!;
    expect(groups.map((g) => [g.title, g.books.map((b) => b.title).join()])).toEqual([
      ["Cosy", "A"],
      ["Dark", "A"],
      ["Epic", "B"],
      ["No mood", "C,D"],
    ]);
    expect(groups[0].mood).toEqual({ icon: "coffee", color: "amber" });
  });
});

describe("challenges by mood", () => {
  it("are offered after tags", () => {
    const groups = challengeSources({ tags: ["classics"], shelves: [], views: [], moods: [epic] });
    expect(groups.map((g) => g.group)).toEqual(["Tags", "Moods"]);
    expect(groups[1].sources).toEqual([{ value: "mood:ep1c", label: "Epic", name: "Epic" }]);
  });
});
