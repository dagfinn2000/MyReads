import { describe, expect, it } from "vitest";
import { parsePreferences } from "@/lib/preferences";
import {
  MAX_BOOK_FIELDS,
  cleanFieldValue,
  cleanFieldValues,
  fieldFilterLabel,
  fieldSearchText,
  fieldValuesFromForm,
  formatFieldValue,
  parseBookFields,
  parseFieldFilter,
  resolveFieldFilter,
  serializeFieldFilter,
  type BookField,
} from "@/lib/book-fields";

const shelf: BookField = { id: "loc", name: "Where", type: "text", options: [] };
const price: BookField = { id: "pr", name: "Price", type: "number", options: [] };
const bought: BookField = { id: "bo", name: "Bought", type: "date", options: [] };
const signed: BookField = { id: "si", name: "Signed", type: "yesno", options: [] };
const edition: BookField = { id: "ed", name: "Edition", type: "choice", options: ["First", "Book club"] };
const fields = [shelf, price, bought, signed, edition];

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseBookFields", () => {
  it("keeps good fields and drops bad ones one by one", () => {
    expect(
      parseBookFields([
        shelf,
        { id: "BAD", name: "Nope", type: "text" },
        { id: "x1", name: "  ", type: "text" },
        { id: "x2", name: "Odd", type: "colour" },
        { ...edition, options: ["First", " first ", "", "Book  club", 7] },
        "junk",
      ]),
    ).toEqual([shelf, edition]);
  });

  it("keeps each id and each name once, and options only on a choice", () => {
    expect(
      parseBookFields([
        shelf,
        { ...shelf, name: "Other" },
        { ...price, name: "WHERE" },
        { ...price, options: ["a"] },
      ]),
    ).toEqual([shelf, price]);
  });

  it("keeps at most the limit, and is part of Preferences", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `f${i}`, name: `F${i}`, type: "text" }));
    expect(parseBookFields(many)).toHaveLength(MAX_BOOK_FIELDS);
    expect(parsePreferences({}).customFields).toEqual([]);
    expect(parsePreferences({ customFields: [signed] }).customFields).toEqual([signed]);
  });
});

describe("cleanFieldValue", () => {
  it("reads numbers the way people type them", () => {
    expect(cleanFieldValue(price, "12.5")).toBe(12.5);
    expect(cleanFieldValue(price, "12,5")).toBe(12.5);
    expect(cleanFieldValue(price, "1,234.5")).toBe(1234.5);
    expect(cleanFieldValue(price, "1 234")).toBe(1234);
    expect(cleanFieldValue(price, 7)).toBe(7);
    for (const bad of ["", "abc", "1e400", "12..5", NaN, Infinity, 1e13]) {
      expect(cleanFieldValue(price, bad)).toBeNull();
    }
  });

  it("takes only real dates", () => {
    expect(cleanFieldValue(bought, "2024-02-29")).toBe("2024-02-29");
    for (const bad of ["2023-02-29", "2024-13-01", "0999-01-01", "24-01-01", "yesterday", 20240101]) {
      expect(cleanFieldValue(bought, bad)).toBeNull();
    }
  });

  it("reads yes and no, and a choice as its option is written", () => {
    expect(cleanFieldValue(signed, "yes")).toBe(true);
    expect(cleanFieldValue(signed, false)).toBe(false);
    expect(cleanFieldValue(signed, "maybe")).toBeNull();
    expect(cleanFieldValue(edition, " book CLUB ")).toBe("Book club");
    expect(cleanFieldValue(edition, "Third")).toBeNull();
  });

  it("keeps text to one tidy line within the limit", () => {
    expect(cleanFieldValue(shelf, "  Hall  shelf 3 ")).toBe("Hall shelf 3");
    expect(cleanFieldValue(shelf, "Hall\nshelf")).toBe("Hall shelf");
    expect(cleanFieldValue(shelf, "x".repeat(501))).toBeNull();
  });
});

describe("cleanFieldValues", () => {
  it("drops values of fields that are gone, or that no longer fit", () => {
    expect(
      cleanFieldValues({ loc: "Hall", gone: "x", ed: "Second", si: true, pr: "cheap" }, fields),
    ).toEqual({ loc: "Hall", si: true });
    expect(cleanFieldValues(null, fields)).toEqual({});
    expect(cleanFieldValues(["loc"], fields)).toEqual({});
  });
});

describe("fieldValuesFromForm", () => {
  it("sets what the form sends, clears what it sends empty, keeps the rest", () => {
    const res = fieldValuesFromForm(
      form({ "field:pr": "9,99", "field:si": "", "field:ed": "first" }),
      fields,
      { loc: "Hall", si: true },
    );
    expect(res).toEqual({ values: { loc: "Hall", pr: 9.99, ed: "First" } });
  });

  it("names a field whose value can't be read", () => {
    expect(fieldValuesFromForm(form({ "field:bo": "soon" }), fields).error).toBe("“Bought” needs a date.");
    expect(fieldValuesFromForm(form({ "field:pr": "lots" }), fields).error).toBe("“Price” needs a number.");
  });

  it("lets an option taken away since go quietly", () => {
    expect(fieldValuesFromForm(form({ "field:ed": "Gone" }), fields, { ed: "First" })).toEqual({ values: {} });
  });
});

describe("showing and searching values", () => {
  it("folds text and choices into the search text, nothing else", () => {
    expect(
      fieldSearchText({ loc: "Héllo Hall", ed: "Book club", pr: 12, si: true, bo: "2024-01-01" }, fields),
    ).toBe("hello hall book club");
  });

  it("shows each type the reader's way", () => {
    expect(formatFieldValue(price, 1234.5, { numberFormat: "space" })).toBe("1 234,5");
    expect(formatFieldValue(bought, "2024-05-01", { dateFormat: "iso" })).toBe("2024-05-01");
    expect(formatFieldValue(bought, "2024-05-01")).toBe("1 May 2024");
    expect(formatFieldValue(signed, false)).toBe("No");
  });
});

describe("field filters", () => {
  it("round-trips each kind", () => {
    for (const s of ["si", "si!", "ed=Book club", "pr:4.5..20", "bo:2024-01-01..", "pr:..10"]) {
      expect(serializeFieldFilter(parseFieldFilter(s)!)).toBe(s);
    }
  });

  it("refuses anything else", () => {
    for (const bad of ["", "BAD", "si=", "pr:..", "pr:1..2..3", "x".repeat(200)]) {
      expect(parseFieldFilter(bad)).toBeNull();
    }
  });

  it("only filters a field by what fits it", () => {
    expect(resolveFieldFilter(parseFieldFilter("ed=first")!, fields)).toEqual({
      field: edition,
      op: "is",
      value: "First",
    });
    expect(resolveFieldFilter(parseFieldFilter("loc=Hall")!, fields)).toBeNull();
    expect(resolveFieldFilter(parseFieldFilter("loc:1..2")!, fields)).toBeNull();
    expect(resolveFieldFilter(parseFieldFilter("pr:x..2")!, fields)).toBeNull();
    expect(resolveFieldFilter(parseFieldFilter("gone")!, fields)).toBeNull();
    expect(resolveFieldFilter(parseFieldFilter("bo:2024-01-01..")!, fields)).toEqual({
      field: bought,
      op: "range",
      min: "2024-01-01",
      max: null,
    });
  });

  it("labels the chip", () => {
    expect(fieldFilterLabel("si=yes", fields)).toBe("Signed: Yes");
    expect(fieldFilterLabel("loc!", fields)).toBe("Where: no value");
    expect(fieldFilterLabel("pr:5..20", fields)).toBe("Price: 5 to 20");
    expect(fieldFilterLabel("pr:5..", fields)).toBe("Price: at least 5");
    expect(fieldFilterLabel("bo:..2024-05-01", fields)).toBe("Bought: until 1 May 2024");
    expect(fieldFilterLabel("gone", fields)).toBeNull();
  });
});
