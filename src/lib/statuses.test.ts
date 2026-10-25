import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@/lib/enums";
import { parsePreferences } from "@/lib/preferences";
import {
  MAX_CUSTOM_STATUSES,
  bookStatusBadge,
  bookStatusName,
  customStatusOf,
  parseCustomStatuses,
  parseStatusChoice,
  parseStatusNames,
  statusChoice,
  statusName,
  statusOptions,
  type CustomStatus,
} from "@/lib/statuses";

const paused: CustomStatus = { key: "p1", name: "Paused", base: ReadingStatus.READING, color: "violet" };
const owned: CustomStatus = { key: "o1", name: "Owned, not started", base: ReadingStatus.WANT_TO_READ, color: "sky" };
const prefs = { statusNames: { READ: "Finished" }, customStatuses: [paused, owned] };

describe("parseStatusNames", () => {
  it("keeps tidy new names for the four statuses only", () => {
    expect(parseStatusNames({ READ: "  Finished\n ", DNF: "", READING: 4, NOPE: "x" })).toEqual({ READ: "Finished" });
  });

  it("drops a name too long, or no different from the built-in one", () => {
    expect(parseStatusNames({ READ: "x".repeat(31), DNF: "Did Not Finish" })).toEqual({});
  });

  it("reads anything else as no names", () => {
    expect(parseStatusNames(null)).toEqual({});
    expect(parseStatusNames(["READ"])).toEqual({});
  });
});

describe("parseCustomStatuses", () => {
  it("keeps good entries and drops bad ones one by one", () => {
    expect(
      parseCustomStatuses([
        paused,
        { key: "BAD KEY", name: "Nope", base: "READ", color: "sky" },
        { key: "x1", name: "  ", base: "READ", color: "sky" },
        { key: "x2", name: "Odd", base: "SOMETIMES", color: "sky" },
        { key: "x3", name: "Gift", base: "READ", color: "plaid" },
        "junk",
      ]),
    ).toEqual([paused, { key: "x3", name: "Gift", base: "READ", color: "slate" }]);
  });

  it("keeps each key and each name once", () => {
    expect(
      parseCustomStatuses([paused, { ...paused, name: "Other" }, { ...owned, name: "PAUSED" }]),
    ).toEqual([paused]);
  });

  it("keeps at most the limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ key: `k${i}`, name: `S${i}`, base: "READ", color: "sky" }));
    expect(parseCustomStatuses(many)).toHaveLength(MAX_CUSTOM_STATUSES);
  });

  it("is part of Preferences, empty by default", () => {
    expect(parsePreferences({}).customStatuses).toEqual([]);
    expect(parsePreferences({}).statusNames).toEqual({});
    expect(parsePreferences({ customStatuses: [paused] }).customStatuses).toEqual([paused]);
  });
});

describe("naming a book's status", () => {
  it("uses the reader's names", () => {
    expect(statusName(ReadingStatus.READ, prefs)).toBe("Finished");
    expect(statusName(ReadingStatus.DNF, prefs)).toBe("Did Not Finish");
  });

  it("uses a custom status only on its own base", () => {
    expect(bookStatusName({ status: ReadingStatus.READING, statusKey: "p1" }, prefs)).toBe("Paused");
    expect(customStatusOf({ status: ReadingStatus.READ, statusKey: "p1" }, prefs)).toBeNull();
    expect(bookStatusName({ status: ReadingStatus.READ, statusKey: "p1" }, prefs)).toBe("Finished");
    expect(bookStatusName({ status: ReadingStatus.READING, statusKey: "gone" }, prefs)).toBe("Currently Reading");
  });

  it("tints the badge in the custom status's colour", () => {
    expect(bookStatusBadge({ status: ReadingStatus.READING, statusKey: "p1" }, prefs)).toContain("bg-violet-100");
    expect(bookStatusBadge({ status: ReadingStatus.READING, statusKey: null }, prefs)).toContain("bg-amber-100");
  });
});

describe("status menus", () => {
  it("lists each custom status under its base", () => {
    expect(statusOptions(prefs).map((o) => o.label)).toEqual([
      "Want to Read",
      "Owned, not started",
      "Currently Reading",
      "Paused",
      "Finished",
      "Did Not Finish",
    ]);
  });

  it("round-trips a choice", () => {
    expect(parseStatusChoice(statusChoice(ReadingStatus.READING, "p1"), prefs)).toEqual({
      status: ReadingStatus.READING,
      statusKey: "p1",
    });
    expect(parseStatusChoice("READ", prefs)).toEqual({ status: ReadingStatus.READ, statusKey: null });
  });

  it("keeps the status but not a key that doesn't fit it", () => {
    expect(parseStatusChoice("READ:p1", prefs)).toEqual({ status: ReadingStatus.READ, statusKey: null });
    expect(parseStatusChoice("READING:gone", prefs)).toEqual({ status: ReadingStatus.READING, statusKey: null });
  });

  it("refuses anything that isn't a status", () => {
    for (const bad of ["", "NOPE", "READ:p1:x", 7, null, "READING:" + "x".repeat(60)]) {
      expect(parseStatusChoice(bad, prefs)).toBeNull();
    }
  });
});
