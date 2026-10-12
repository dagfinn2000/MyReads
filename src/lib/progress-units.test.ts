import { describe, expect, it } from "vitest";
import { BookFormat } from "@prisma/client";
import {
  addStep,
  fallbackHint,
  formatDuration,
  formatLength,
  formatPosition,
  minutesToPage,
  pageToMinutes,
  pageToPercent,
  parseBoxText,
  parseDuration,
  parseUnitText,
  percentToPage,
  positionText,
  progressFigure,
  stepsFor,
  unitFor,
} from "@/lib/progress-units";

const prefs = { ebookUnit: "percent", audiobookUnit: "time" } as const;
const ebook = (pageCount: number | null) =>
  unitFor({ format: BookFormat.EBOOK, pageCount, lengthMinutes: null }, prefs);
const audio = (pageCount: number | null, lengthMinutes: number | null) =>
  unitFor({ format: BookFormat.AUDIOBOOK, pageCount, lengthMinutes }, prefs);
const paper = (pageCount: number | null) =>
  unitFor({ format: BookFormat.PHYSICAL, pageCount, lengthMinutes: null }, prefs);

describe("unitFor", () => {
  it("keeps physical books in pages whatever the preferences say", () => {
    expect(paper(300)).toMatchObject({ unit: "page", wanted: "page", fallback: null });
  });

  it("puts an ebook in percent only with a page count", () => {
    expect(ebook(389)).toMatchObject({ unit: "percent", fallback: null });
    expect(ebook(null)).toMatchObject({ unit: "page", wanted: "percent", fallback: "noPageCount" });
  });

  it("needs both a length and a page count for time", () => {
    expect(audio(476, 970)).toMatchObject({ unit: "time", lengthMinutes: 970 });
    expect(audio(476, null)).toMatchObject({ unit: "page", fallback: "noLength" });
    expect(audio(null, 970)).toMatchObject({ unit: "page", wanted: "time", fallback: "noPageCount" });
  });

  it("ignores a length on anything but an audiobook", () => {
    const info = unitFor({ format: BookFormat.EBOOK, pageCount: 300, lengthMinutes: 600 }, prefs);
    expect(info.lengthMinutes).toBeNull();
  });

  it("follows the preference back to pages", () => {
    const info = unitFor(
      { format: BookFormat.EBOOK, pageCount: 300, lengthMinutes: null },
      { ebookUnit: "page", audiobookUnit: "page" },
    );
    expect(info).toMatchObject({ unit: "page", fallback: null });
  });
});

describe("percent and pages", () => {
  it("round-trips through a 389-page book within a percent", () => {
    for (const pct of [1, 10, 42, 50, 77, 99]) {
      const back = pageToPercent(percentToPage(pct, 389), 389);
      expect(Math.abs(back - pct), String(pct)).toBeLessThanOrEqual(1);
    }
  });

  it("clamps to the book", () => {
    expect(percentToPage(0, 389)).toBe(0);
    expect(percentToPage(100, 389)).toBe(389);
    expect(percentToPage(150, 389)).toBe(389);
    expect(pageToPercent(500, 389)).toBe(100);
    expect(pageToPercent(0, 389)).toBe(0);
  });

  it("never shows 100% before the last page or 0% after page 0", () => {
    expect(pageToPercent(388, 389)).toBe(99); // 99.7%
    expect(pageToPercent(1, 389)).toBe(1); // 0.3%
  });

  it("logs at least page 1 for a small percent and stays off the last page below 100%", () => {
    expect(percentToPage(1, 40)).toBe(1);
    expect(percentToPage(99, 40)).toBe(39);
  });
});

describe("minutes and pages", () => {
  it("converts a 970-minute, 476-page audiobook", () => {
    expect(minutesToPage(312, 970, 476)).toBe(153);
    expect(pageToMinutes(153, 476, 970)).toBe(312);
  });

  it("clamps past the end and keeps 1 minute off page 0", () => {
    expect(minutesToPage(2000, 970, 476)).toBe(476);
    expect(minutesToPage(1, 970, 476)).toBe(1);
    expect(pageToMinutes(476, 476, 970)).toBe(970);
  });
});

describe("parseDuration", () => {
  it("reads the ways a listener types a time", () => {
    expect(parseDuration("5:12")).toBe(312);
    expect(parseDuration("5.12")).toBe(312);
    expect(parseDuration("5,12")).toBe(312);
    expect(parseDuration("5:05")).toBe(305);
    expect(parseDuration("5h 12m")).toBe(312);
    expect(parseDuration("5 h 12 min")).toBe(312);
    expect(parseDuration("5h")).toBe(300);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration("45 min")).toBe(45);
    expect(parseDuration("312")).toBe(312);
    expect(parseDuration(" 1:02:30 ")).toBe(63);
  });

  it("refuses what isn't a time", () => {
    for (const s of ["5:75", "", "abc", "-3", "5.5", "5,7", "5:12:99"]) {
      expect(parseDuration(s), s).toBeNull();
    }
  });
});

describe("formatDuration and formatLength", () => {
  it("formats minutes as h:mm", () => {
    expect(formatDuration(312)).toBe("5:12");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(60000)).toBe("1000:00");
  });

  it("writes a length out", () => {
    expect(formatLength(970)).toBe("16 h 10 min");
    expect(formatLength(45)).toBe("45 min");
    expect(formatLength(180)).toBe("3 h");
  });
});

describe("parseUnitText", () => {
  it("reads pages, refusing one past the end", () => {
    expect(parseUnitText("212", paper(412))).toEqual({ value: 212, page: 212 });
    expect(parseUnitText("500", paper(412))).toEqual({
      error: "Page 500 is past the end of the book (412 pages).",
    });
    expect(parseUnitText("2.5", paper(412))).toEqual({ error: "Type a whole page number." });
    expect(parseUnitText("  ", paper(412))).toBeNull();
  });

  it("reads percent, with or without the sign", () => {
    expect(parseUnitText("42", ebook(389))).toEqual({ value: 42, page: 163 });
    expect(parseUnitText("42%", ebook(389))).toEqual({ value: 42, page: 163 });
    expect(parseUnitText("101", ebook(389))).toEqual({ error: "Type a percent from 0 to 100." });
  });

  it("reads time, refusing past the length", () => {
    expect(parseUnitText("5:12", audio(476, 970))).toEqual({ value: 312, page: 153 });
    expect(parseUnitText("5.5", audio(476, 970))).toEqual({
      error: "Use hours and minutes, like 5:12.",
    });
    expect(parseUnitText("17:00", audio(476, 700))).toEqual({
      error: "That's past the end (11:40).",
    });
  });
});

describe("parseBoxText", () => {
  it("keeps the stored page while the box still shows it", () => {
    // Page 175 of 412 shows as 42%, and 42% on its own is page 173.
    expect(positionText(175, ebook(412))).toBe("42");
    expect(parseUnitText("42", ebook(412))).toEqual({ value: 42, page: 173 });
    expect(parseBoxText("42", ebook(412), 175)).toEqual({ value: 42, page: 175 });
    expect(parseBoxText("5:10", audio(400, 700), 177)).toEqual({ value: 310, page: 177 });
  });

  it("reads anything else as typed", () => {
    expect(parseBoxText("43", ebook(412), 175)).toEqual({ value: 43, page: 177 });
    expect(parseBoxText("42", ebook(412), null)).toEqual({ value: 42, page: 173 });
    expect(parseBoxText("", ebook(412), null)).toBeNull();
    expect(parseBoxText("120", paper(412), 120)).toEqual({ value: 120, page: 120 });
  });
});

describe("formatPosition and progressFigure", () => {
  it("speaks each unit", () => {
    expect(formatPosition(212, paper(412))).toBe("page 212");
    expect(formatPosition(212, paper(412), { capital: true })).toBe("Page 212");
    expect(formatPosition(163, ebook(389))).toBe("42%");
    expect(formatPosition(153, audio(476, 970))).toBe("5:12");
  });

  it("shows the figure under the bar", () => {
    expect(progressFigure(212, paper(412))).toBe("212 of 412 · 51%");
    expect(progressFigure(212, paper(null))).toBe("Page 212");
    expect(progressFigure(200, ebook(389))).toBe("51%");
    expect(progressFigure(214, audio(476, 700))).toBe("5:15 of 11:40 · 45%");
  });

  it("fills the box from a page", () => {
    expect(positionText(null, paper(412))).toBe("");
    expect(positionText(153, audio(476, 970))).toBe("5:12");
  });
});

describe("stepsFor", () => {
  it("gives the step buttons in the book's own unit", () => {
    expect(stepsFor("10-25", paper(412)).map((s) => s.label)).toEqual(["+10", "+25"]);
    expect(stepsFor("5-10", ebook(389)).map((s) => s.label)).toEqual(["+5%", "+10%"]);
    expect(stepsFor("10-25", audio(476, 970)).map((s) => s.ariaLabel)).toEqual([
      "Add 10 minutes",
      "Add 25 minutes",
    ]);
  });

  it("makes +5% a twentieth of the book, at least 1", () => {
    expect(stepsFor("5pct", paper(412))).toEqual([
      { amount: 21, label: "+5%", ariaLabel: "Add 5% of the book" },
    ]);
    expect(stepsFor("5pct", paper(10))[0].amount).toBe(1);
    expect(stepsFor("5pct", ebook(389))[0].amount).toBe(5);
    expect(stepsFor("5pct", audio(476, 970))[0].amount).toBe(49);
  });

  it("falls back to +10 and +25 without a page count", () => {
    expect(stepsFor("5pct", paper(null)).map((s) => s.amount)).toEqual([10, 25]);
  });

  it("adds a step to the box, or to where the book is", () => {
    expect(addStep("200", 10, 150, paper(412))).toBe("210");
    expect(addStep("", 10, 150, paper(412))).toBe("160");
    expect(addStep("405", 10, 150, paper(412))).toBe("412");
    expect(addStep("5:12", 25, null, audio(476, 970))).toBe("5:37");
    expect(addStep("nonsense", 5, 163, ebook(389))).toBe("47");
  });
});

describe("fallbackHint", () => {
  it("says what the book is missing", () => {
    expect(fallbackHint(ebook(null))?.after).toBe(" to track by percent.");
    expect(fallbackHint(audio(null, 970))?.before).toContain("the print edition's is fine");
    expect(fallbackHint(audio(476, null))?.before).toContain("the audiobook's length");
    expect(fallbackHint(paper(412))).toBeNull();
  });
});
