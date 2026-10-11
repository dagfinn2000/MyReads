import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, toDateInputValue } from "@/lib/display";

describe("formatDate", () => {
  const d = new Date("2024-05-02T00:00:00.000Z");

  it("defaults to day, short month, year", () => {
    expect(formatDate(d)).toBe("2 May 2024");
  });

  it("follows the chosen format", () => {
    expect(formatDate(d, { dateFormat: "mmm-d-y" })).toBe("May 2, 2024");
    expect(formatDate(d, { dateFormat: "dd.mm.y" })).toBe("02.05.2024");
    expect(formatDate(d, { dateFormat: "dd/mm/y" })).toBe("02/05/2024");
    expect(formatDate(d, { dateFormat: "mm/dd/y" })).toBe("05/02/2024");
    expect(formatDate(d, { dateFormat: "iso" })).toBe("2024-05-02");
  });

  it("puts a timestamp on the reader's day", () => {
    const late = new Date("2024-05-02T22:00:00.000Z");
    expect(formatDate(late, { timeZone: "Asia/Tokyo", dateFormat: "iso" })).toBe("2024-05-03");
    expect(formatDate(late, { timeZone: "America/Chicago", dateFormat: "iso" })).toBe(
      "2024-05-02",
    );
  });

  it("is empty for no date", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("toDateInputValue", () => {
  it("matches the day formatDate shows", () => {
    const late = new Date("2024-05-02T22:00:00.000Z");
    expect(toDateInputValue(late, "Asia/Tokyo")).toBe("2024-05-03");
    expect(toDateInputValue(new Date("2024-05-02T00:00:00.000Z"), "Asia/Tokyo")).toBe(
      "2024-05-02",
    );
  });
});

describe("formatNumber", () => {
  it("groups thousands the chosen way", () => {
    expect(formatNumber(12345)).toBe("12,345");
    expect(formatNumber(12345, { numberFormat: "period" })).toBe("12.345");
    // Norwegian grouping uses a no-break space.
    expect(formatNumber(12345, { numberFormat: "space" }).replace(/\s/g, " ")).toBe("12 345");
  });
});
