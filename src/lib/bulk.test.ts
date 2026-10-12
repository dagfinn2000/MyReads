import { describe, expect, it } from "vitest";
import { BULK_MAX_IDS, bulkDeleteSchema, bulkSchema, chunk, retag } from "@/lib/bulk";

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : result.error?.issues[0]?.message;

const ids = (n: number) => Array.from({ length: n }, (_, i) => `book${i}`);

describe("retag", () => {
  it("merges without duplicates and is null when nothing changes", () => {
    expect(retag(["fantasy", "epic"], ["fantasy", "reread"], [])).toEqual(["fantasy", "epic", "reread"]);
    expect(retag(["fantasy"], ["fantasy"], [])).toBeNull();
    expect(retag(["fantasy"], [], ["sci-fi"])).toBeNull();
    expect(retag([], [], [])).toBeNull();
  });

  it("removes tags, alone or together with adding", () => {
    expect(retag(["fantasy", "epic", "owned"], [], ["epic"])).toEqual(["fantasy", "owned"]);
    expect(retag(["fantasy", "epic"], ["reread"], ["fantasy"])).toEqual(["epic", "reread"]);
  });
});

describe("chunk", () => {
  it("splits into runs of the given size", () => {
    const parts = chunk(ids(2500), 1000);
    expect(parts.map((p) => p.length)).toEqual([1000, 1000, 500]);
    expect(parts.flat()).toEqual(ids(2500));
  });

  it("gives nothing for nothing", () => {
    expect(chunk([], 1000)).toEqual([]);
  });
});

describe("bulkSchema", () => {
  it("takes 2,000 ids and refuses 2,001 with a readable message", () => {
    expect(BULK_MAX_IDS).toBe(2000);
    expect(bulkSchema.safeParse({ bookIds: ids(2000), status: "READ" }).success).toBe(true);
    expect(firstError(bulkSchema.safeParse({ bookIds: ids(2001), status: "READ" }))).toBe(
      "That's more than 2,000 books. Use “Select all books that match” instead.",
    );
  });

  it("wants exactly one of ids or filters", () => {
    const message = "Select some books first.";
    expect(firstError(bulkSchema.safeParse({ status: "READ" }))).toBe(message);
    expect(firstError(bulkSchema.safeParse({ bookIds: [], status: "READ" }))).toBe(message);
    expect(
      firstError(bulkSchema.safeParse({ bookIds: ["a"], matching: { tag: "x" }, status: "READ" })),
    ).toBe(message);
    expect(bulkSchema.safeParse({ matching: { tag: "x" }, status: "READ" }).success).toBe(true);
  });

  it("names a tag that is both added and removed", () => {
    expect(
      firstError(bulkSchema.safeParse({ bookIds: ["a"], addTags: ["Epic"], removeTags: ["epic "] })),
    ).toBe("“epic” is in both Add tags and Remove tags.");
  });

  it("trims and lowercases tags, and explains a tag that is too long", () => {
    const parsed = bulkSchema.parse({ bookIds: ["a"], addTags: ["  Fantasy "], removeTags: ["OLD"] });
    expect(parsed.addTags).toEqual(["fantasy"]);
    expect(parsed.removeTags).toEqual(["old"]);
    expect(firstError(bulkSchema.safeParse({ bookIds: ["a"], removeTags: ["x".repeat(51)] }))).toBe(
      "Tags can be at most 50 characters.",
    );
  });

  it("explains a search too long to send", () => {
    expect(
      firstError(bulkSchema.safeParse({ matching: { q: "x".repeat(2001) }, status: "READ" })),
    ).toBe("That search is too long to apply to every match.");
  });
});

describe("bulkDeleteSchema", () => {
  it("needs the count shown when deleting every match", () => {
    expect(bulkDeleteSchema.safeParse({ matching: { tag: "x" } }).success).toBe(false);
    expect(bulkDeleteSchema.safeParse({ matching: { tag: "x" }, expectedCount: 3 }).success).toBe(true);
    expect(bulkDeleteSchema.safeParse({ bookIds: ["a", "b"] }).success).toBe(true);
  });
});
