import { describe, expect, it } from "vitest";
import { bookSchema, isAllowedCoverUrl, pastReadSchema, readingSchema } from "@/lib/validation";

const minimalForm = {
  title: "T",
  authors: "",
  tags: "",
  format: "PHYSICAL",
  ownership: "OWNED",
};

describe("bookSchema tags", () => {
  it("splits, trims, and lowercases the comma-separated field", () => {
    const parsed = bookSchema.parse({
      ...minimalForm,
      tags: " Fantasy , Sci-Fi ,",
    });
    expect(parsed.tags).toEqual(["fantasy", "sci-fi"]);
  });

  it("dedupes tags that collide after lowercasing", () => {
    // Metadata subjects often differ only in case — "Fiction, fiction"
    // must not land twice (duplicate React keys on the book page).
    const parsed = bookSchema.parse({
      ...minimalForm,
      tags: "Fiction, fiction, FICTION, fantasy",
    });
    expect(parsed.tags).toEqual(["fiction", "fantasy"]);
  });
});

describe("isAllowedCoverUrl", () => {
  it("accepts local cache paths, http(s) URLs and an empty value", () => {
    for (const url of ["", "/api/covers/abc-1234.jpg", "https://covers.openlibrary.org/b/id/1-L.jpg", "HTTP://x.example/a.png"]) {
      expect(isAllowedCoverUrl(url), url).toBe(true);
    }
  });

  it("refuses other schemes and protocol-relative paths", () => {
    // `//host` and `/\host` start with "/" but browsers fetch them off-site.
    for (const url of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.example/x.jpg", "/\\evil.example/x.jpg", "ftp://x.example/a.jpg"]) {
      expect(isAllowedCoverUrl(url), url).toBe(false);
    }
  });
});

describe("bookSchema seriesNumber", () => {
  it("saves a blank field as no number, not #0", () => {
    expect(bookSchema.parse({ ...minimalForm, seriesNumber: "" }).seriesNumber).toBeNull();
    expect(bookSchema.parse({ ...minimalForm, seriesNumber: "  " }).seriesNumber).toBeNull();
    expect(bookSchema.parse(minimalForm).seriesNumber).toBeUndefined();
  });

  it("keeps real numbers, including a deliberate 0 and halves", () => {
    expect(bookSchema.parse({ ...minimalForm, seriesNumber: "0" }).seriesNumber).toBe(0);
    expect(bookSchema.parse({ ...minimalForm, seriesNumber: "2.5" }).seriesNumber).toBe(2.5);
  });
});

describe("bookSchema lengthMinutes", () => {
  it("saves a blank length as not known", () => {
    expect(bookSchema.parse({ ...minimalForm, lengthMinutes: "" }).lengthMinutes).toBeNull();
    expect(bookSchema.parse(minimalForm).lengthMinutes).toBeUndefined();
    expect(bookSchema.parse({ ...minimalForm, lengthMinutes: "700" }).lengthMinutes).toBe(700);
  });

  it("reports a length out of range instead of dropping it", () => {
    const zero = bookSchema.safeParse({ ...minimalForm, lengthMinutes: "0" });
    expect(zero.error?.issues[0]?.message).toBe("Length must be at least 1 minute");
    const huge = bookSchema.safeParse({ ...minimalForm, lengthMinutes: "60001" });
    expect(huge.error?.issues[0]?.message).toBe("Length must be at most 1,000 hours");
  });
});

describe("reading dates", () => {
  const dayAfterTomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  it("refuses a finish date before the start date", () => {
    const res = readingSchema.safeParse({
      status: "READ",
      dateStarted: "2026-10-05",
      dateFinished: "2026-10-01",
    });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.message).toBe("Finish date is before the start date");
  });

  it("refuses dates in the future", () => {
    expect(readingSchema.safeParse({ status: "READ", dateFinished: dayAfterTomorrow }).success).toBe(false);
    expect(readingSchema.safeParse({ status: "READING", dateStarted: dayAfterTomorrow }).success).toBe(false);
  });

  it("accepts the same day for both, and either date alone", () => {
    expect(
      readingSchema.safeParse({ status: "READ", dateStarted: "2026-10-01", dateFinished: "2026-10-01" }).success,
    ).toBe(true);
    expect(readingSchema.safeParse({ status: "READ", dateFinished: "2019-05-01" }).success).toBe(true);
    expect(readingSchema.safeParse({ status: "READING", dateStarted: "", dateFinished: "" }).success).toBe(true);
  });

  it("applies the same rules to past reads", () => {
    expect(pastReadSchema.safeParse({ dateStarted: "2020-02-01", dateFinished: "2020-01-01" }).success).toBe(false);
    expect(pastReadSchema.safeParse({ dateFinished: "2019-05-01" }).success).toBe(true);
  });

  it("reads a ticked Don't remember box as true and a missing one as false", () => {
    expect(readingSchema.parse({ status: "READ", finishedUnknown: "on" }).finishedUnknown).toBe(true);
    expect(readingSchema.parse({ status: "READ" }).finishedUnknown).toBe(false);
    expect(readingSchema.parse({ status: "READ", finishedUnknown: "" }).finishedUnknown).toBe(false);
  });
});

describe("pastReadSchema note", () => {
  it("is trimmed", () => {
    expect(pastReadSchema.parse({ note: "  Read it aloud to the kids \n" }).note).toBe(
      "Read it aloud to the kids",
    );
  });

  it("is null when empty or only spaces", () => {
    expect(pastReadSchema.parse({ note: "" }).note).toBeNull();
    expect(pastReadSchema.parse({ note: "   \n " }).note).toBeNull();
  });

  it("is left undefined when not sent", () => {
    expect(pastReadSchema.parse({}).note).toBeUndefined();
  });

  it("refuses a note over 2000 characters", () => {
    expect(pastReadSchema.parse({ note: "x".repeat(2000) }).note).toHaveLength(2000);
    const res = pastReadSchema.safeParse({ note: "x".repeat(2001) });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.message).toBe("Keep the note to 2000 characters or fewer.");
  });

  it("still checks the dates when there is a note", () => {
    const res = pastReadSchema.safeParse({
      dateStarted: "2020-02-01",
      dateFinished: "2020-01-01",
      note: "Second time round",
    });
    expect(res.success).toBe(false);
  });
});
