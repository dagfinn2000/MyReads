import { describe, expect, it } from "vitest";
import {
  applyTagRules,
  catalogueTags,
  splitCatalogueSubjects,
  withRenameRule,
  withSkipRule,
  withoutRule,
  type TagImportSettings,
  type TagRules,
} from "@/lib/tag-rules";

const none: TagRules = { renames: [], skips: [] };

function settings(over: Partial<TagImportSettings> = {}): TagImportSettings {
  return { mode: "all", rules: none, knownTags: [], ...over };
}

describe("splitCatalogueSubjects", () => {
  it("splits on commas, lowercases, dedupes and drops what can't be a tag", () => {
    expect(
      splitCatalogueSubjects(["Fiction, General", "fiction", "  ", "x".repeat(51), "Sci-Fi"]),
    ).toEqual(["fiction", "general", "sci-fi"]);
  });
});

describe("applyTagRules", () => {
  it("drops skipped tags, before and after renaming", () => {
    const rules = { renames: [{ from: "sf", to: "general" }], skips: ["general", "fiction"] };
    expect(applyTagRules(["fiction", "sf", "fantasy"], rules)).toEqual(["fantasy"]);
  });

  it("follows a chain of renames and dedupes the result", () => {
    const rules = {
      renames: [
        { from: "science fiction", to: "sf" },
        { from: "sf", to: "sci-fi" },
      ],
      skips: [],
    };
    expect(applyTagRules(["science fiction", "sf", "sci-fi"], rules)).toEqual(["sci-fi"]);
  });

  it("stops on a loop in hand-edited rules", () => {
    const rules = {
      renames: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
      skips: [],
    };
    expect(applyTagRules(["a"], rules)).toEqual(["b"]);
  });
});

describe("catalogueTags", () => {
  const raw = ["Fantasy", "Fiction, General", "Science Fiction"];
  const rules = { renames: [{ from: "science fiction", to: "sci-fi" }], skips: ["general"] };

  it("copies nothing when switched off", () => {
    expect(catalogueTags(raw, settings({ mode: "off", rules }))).toEqual([]);
  });

  it("keeps only tags already in the library in mode known", () => {
    expect(catalogueTags(raw, settings({ mode: "known", rules, knownTags: ["Sci-Fi", "romance"] }))).toEqual([
      "sci-fi",
    ]);
    expect(catalogueTags(raw, settings({ mode: "known", rules, knownTags: [] }))).toEqual([]);
  });

  it("keeps every subject, after the rules, in mode all", () => {
    expect(catalogueTags(raw, settings({ rules }))).toEqual(["fantasy", "fiction", "sci-fi"]);
  });
});

describe("withRenameRule", () => {
  it("replaces the old rule for the same tag", () => {
    const rules = { renames: [{ from: "sf", to: "scifi" }], skips: [] };
    expect(withRenameRule(rules, "SF ", "sci-fi").renames).toEqual([{ from: "sf", to: "sci-fi" }]);
  });

  it("points rules that led to the renamed tag at the new name", () => {
    // Renaming A to B, then B to C, leaves A to C (and B to C).
    const first = withRenameRule(none, "a", "b");
    expect(withRenameRule(first, "b", "c").renames).toEqual([
      { from: "a", to: "c" },
      { from: "b", to: "c" },
    ]);
  });

  it("removes a rule back the other way, so nothing loops", () => {
    const rules = { renames: [{ from: "b", to: "a" }], skips: [] };
    expect(withRenameRule(rules, "a", "b").renames).toEqual([{ from: "a", to: "b" }]);
  });

  it("takes both names off the skip list", () => {
    const rules = { renames: [], skips: ["a", "b", "c"] };
    expect(withRenameRule(rules, "a", "b").skips).toEqual(["c"]);
  });

  it("ignores names that can't be tags", () => {
    expect(withRenameRule(none, "a", "b, c")).toBe(none);
    expect(withRenameRule(none, "a", "A")).toBe(none);
  });

  it("keeps the newest 100", () => {
    let rules = none;
    for (let i = 0; i < 105; i++) rules = withRenameRule(rules, `t${i}`, "x");
    expect(rules.renames).toHaveLength(100);
    expect(rules.renames[0].from).toBe("t5");
  });
});

describe("withSkipRule", () => {
  it("adds the tag once and drops the rename rule from it", () => {
    const rules = { renames: [{ from: "fiction", to: "novels" }], skips: ["general"] };
    const once = withSkipRule(rules, "Fiction");
    expect(once).toEqual({ renames: [], skips: ["general", "fiction"] });
    expect(withSkipRule(once, "fiction").skips).toEqual(["general", "fiction"]);
  });

  it("keeps the newest 100", () => {
    let rules = none;
    for (let i = 0; i < 105; i++) rules = withSkipRule(rules, `t${i}`);
    expect(rules.skips).toHaveLength(100);
    expect(rules.skips[0]).toBe("t5");
  });
});

describe("withoutRule", () => {
  it("removes one rename or one skip", () => {
    const rules = { renames: [{ from: "a", to: "b" }], skips: ["c"] };
    expect(withoutRule(rules, { from: "a" })).toEqual({ renames: [], skips: ["c"] });
    expect(withoutRule(rules, { skip: "c" })).toEqual({ renames: [{ from: "a", to: "b" }], skips: [] });
  });
});
