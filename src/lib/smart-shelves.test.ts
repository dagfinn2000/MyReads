import { describe, expect, it } from "vitest";
import { describeRules, rulesShelfId, smartRulesQuery } from "@/lib/smart-shelves";

const statuses = {
  statusNames: { WANT_TO_READ: "Unread" },
  customStatuses: [{ key: "k1", name: "Paused", base: "READING" as const, color: "slate" as const }],
};

describe("smartRulesQuery", () => {
  it("keeps the filters canonical, without the sort and grouping", () => {
    expect(smartRulesQuery("sort=title&dir=asc&group=series&tag=b,a&shelf=WANT_TO_READ&limit=400")).toBe(
      "shelf=WANT_TO_READ&tag=a%2Cb",
    );
  });

  it("is empty when nothing is filtered", () => {
    expect(smartRulesQuery("group=none&sort=createdAt&dir=desc&shelf=all&owned=all")).toBe("");
    expect(smartRulesQuery("")).toBe("");
  });

  it("knows the shelf a rule keeps to", () => {
    expect(rulesShelfId(smartRulesQuery("shelfId=s1&tag=x"))).toBe("s1");
    expect(rulesShelfId("tag=x")).toBe("");
  });
});

describe("describeRules", () => {
  const describe_ = (rules: string, shelfNames = new Map<string, string>()) =>
    describeRules(rules, { statuses, shelfNames, ratingLabel: (v) => `≥ ${v}` });

  it("words every rule, in the order the library's controls run", () => {
    expect(
      describe_(
        smartRulesQuery(
          "shelf=WANT_TO_READ&shelfId=s1&q=dune&format=EBOOK&owned=lent&tag=sci-fi&pages=..300&minRating=8",
        ),
        new Map([["s1", "Fantasy"]]),
      ),
    ).toEqual([
      "Unread",
      "On “Fantasy”",
      "Matching “dune”",
      "Ebook",
      "Lent out",
      "Tag: sci-fi",
      "Rating: ≥ 8",
      "Up to 300 pages",
    ]);
  });

  it("names one of the reader's own statuses, and a shelf since deleted", () => {
    expect(describe_("shelf=READING&statusKey=k1&shelfId=gone")).toEqual([
      "Paused",
      "On a shelf since deleted",
    ]);
  });
});
