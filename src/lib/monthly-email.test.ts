import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import {
  isMonthKey,
  lastMonth,
  monthlyEmailDue,
  monthTitle,
  monthWindow,
  nextMonth,
  nextMonthlyEmail,
  previousMonth,
  quietMonth,
  summarizeMonth,
  type MonthSummaryInput,
  type SummaryBook,
} from "@/lib/monthly-email";
import { buildPasses, type BookDayPages, type CountRead } from "@/lib/stats-count";

describe("months", () => {
  it("step back and forward across years", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-11")).toBe("2026-10");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(nextMonth("2026-09")).toBe("2026-10");
  });

  it("know their days and names", () => {
    expect(monthWindow("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthWindow("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthTitle("2026-10")).toBe("October 2026");
  });

  it("are checked", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    for (const bad of ["2026-13", "2026-1", "26-10", "2026-10-01", 202610, null]) expect(isMonthKey(bad)).toBe(false);
  });

  it("end last month in the reader's zone", () => {
    // 23:30 UTC on 31 October is already 1 November in Oslo.
    expect(lastMonth(new Date("2026-10-31T23:30:00Z"), "Europe/Oslo")).toBe("2026-10");
    expect(lastMonth(new Date("2026-10-31T23:30:00Z"), "UTC")).toBe("2026-09");
  });
});

describe("when the monthly email is due", () => {
  const OSLO = "Europe/Oslo";
  it("comes from 08:00 on the 1st in the reader's zone", () => {
    // 07:59 and 08:00 in Oslo (UTC+1 in November).
    expect(monthlyEmailDue(null, new Date("2026-11-01T06:59:00Z"), OSLO)).toBeNull();
    expect(monthlyEmailDue(null, new Date("2026-11-01T07:00:00Z"), OSLO)).toBe("2026-10");
    // Already 08:00 in Tokyo while it's still the 31st in Oslo.
    expect(monthlyEmailDue(null, new Date("2026-10-31T23:00:00Z"), "Asia/Tokyo")).toBe("2026-10");
  });

  it("goes once a month", () => {
    const now = new Date("2026-11-01T09:00:00Z");
    expect(monthlyEmailDue("2026-10", now, OSLO)).toBeNull();
    expect(monthlyEmailDue("2026-09", now, OSLO)).toBe("2026-10");
    // A later month recorded (a clock put back) doesn't bring it again.
    expect(monthlyEmailDue("2026-11", now, OSLO)).toBeNull();
    // Something unreadable recorded is as good as nothing.
    expect(monthlyEmailDue("junk", now, OSLO)).toBe("2026-10");
  });

  it("still goes later in the first week, not after", () => {
    expect(monthlyEmailDue("2026-09", new Date("2026-11-07T22:00:00Z"), OSLO)).toBe("2026-10");
    expect(monthlyEmailDue("2026-09", new Date("2026-11-07T23:30:00Z"), OSLO)).toBeNull();
    expect(monthlyEmailDue(null, new Date("2026-11-20T12:00:00Z"), OSLO)).toBeNull();
  });

  it("says when the next one comes", () => {
    expect(nextMonthlyEmail(null, new Date("2026-11-23T12:00:00Z"), OSLO)).toEqual({ day: "2026-12-01", month: "2026-11" });
    expect(nextMonthlyEmail(null, new Date("2026-11-03T12:00:00Z"), OSLO)).toEqual({ day: null, month: "2026-10" });
    expect(nextMonthlyEmail("2026-10", new Date("2026-11-03T12:00:00Z"), OSLO)).toEqual({ day: "2026-12-01", month: "2026-11" });
    // Early on the 1st: today's is still to come.
    expect(nextMonthlyEmail("2026-09", new Date("2026-11-01T05:00:00Z"), OSLO)).toEqual({ day: "2026-11-01", month: "2026-10" });
    expect(nextMonthlyEmail("2026-11", new Date("2026-12-31T12:00:00Z"), OSLO)).toEqual({ day: "2027-01-01", month: "2026-12" });
  });
});

/** A date typed into a date field: midnight UTC. */
const d = (day: string) => new Date(`${day}T00:00:00Z`);

function book(id: string, over: Partial<SummaryBook> = {}): SummaryBook {
  return {
    id,
    title: `Book ${id}`,
    authors: ["An Author"],
    coverUrl: null,
    status: "READ",
    format: "PHYSICAL",
    pageCount: 300,
    currentPage: null,
    dateStarted: null,
    dateFinished: null,
    rating: null,
    ...over,
  };
}

const PREFS = { ...DEFAULT_PREFERENCES, statsPagesRead: "logged" as const, statsStoppedBooks: "none" as const };

function input(
  books: SummaryBook[],
  logDays: BookDayPages[] = [],
  over: Partial<MonthSummaryInput<SummaryBook>> = {},
  reads: CountRead[] = [],
): MonthSummaryInput<SummaryBook> {
  const prefs = { ...PREFS, ...over.prefs };
  const readingDays = new Set(logDays.filter((l) => l.pages > 0).map((l) => l.day));
  return {
    month: "2026-10",
    name: "Dagfinn",
    passes: buildPasses({ books, reads, logDays, lastLogDates: new Map() }, prefs, "UTC"),
    logDays,
    minutesByDay: new Map(),
    readingDays,
    goals: [],
    reading: [],
    quotes: [],
    started: 0,
    added: 0,
    ...over,
    prefs,
  };
}

const log = (bookId: string, day: string, pages: number): BookDayPages => ({ bookId, day, pages, current: true });

describe("summarizeMonth", () => {
  it("counts the month as Stats does, and the month before to compare", () => {
    const books = [
      book("a", { dateStarted: d("2026-10-01"), dateFinished: d("2026-10-05"), rating: 8 }),
      book("b", { dateStarted: d("2026-10-10"), dateFinished: d("2026-10-20"), rating: 10, title: "Piranesi" }),
      book("c", { dateFinished: d("2026-09-15") }),
    ];
    const logs = [
      log("a", "2026-10-01", 100),
      log("a", "2026-10-02", 120),
      log("a", "2026-10-05", 80),
      log("b", "2026-10-10", 50),
      log("c", "2026-09-14", 40),
    ];
    const s = summarizeMonth(input(books, logs));
    expect(s).toMatchObject({ books: 2, pages: 350, readingDays: 4, longestRun: 2 });
    expect(s.before).toMatchObject({ books: 1, pages: 40, readingDays: 1 });
    expect(s.finishes.map((f) => f.id)).toEqual(["a", "b"]);
    expect(s.finishes[0]).toMatchObject({ day: "2026-10-05", days: 4, rating: 8 });
    expect(s.favourite?.title).toBe("Piranesi");
    expect(s.biggestDay).toEqual({ day: "2026-10-02", amount: 120, unit: "pages" });
    expect(s.calendar).toHaveLength(31);
    expect(s.calendar[0]).toEqual({ day: "2026-10-01", level: 4 });
    expect(s.calendar[3]).toEqual({ day: "2026-10-04", level: 0 });
    expect(quietMonth(s)).toBe(false);
  });

  it("has no favourite with one book finished, or none rated", () => {
    const one = summarizeMonth(input([book("a", { dateFinished: d("2026-10-05"), rating: 10 })]));
    expect(one.favourite).toBeNull();
    const unrated = summarizeMonth(
      input([book("a", { dateFinished: d("2026-10-05") }), book("b", { dateFinished: d("2026-10-07") })]),
    );
    expect(unrated.favourite).toBeNull();
  });

  it("shades an audiobook month by time", () => {
    const s = summarizeMonth(
      input([], [], {
        minutesByDay: new Map([
          ["2026-10-03", 45],
          ["2026-10-04", 90],
        ]),
        readingDays: new Set(["2026-10-03", "2026-10-04"]),
      }),
    );
    expect(s.calendarUnit).toBe("minutes");
    expect(s.minutes).toBe(135);
    expect(s.biggestDay).toEqual({ day: "2026-10-04", amount: 90, unit: "minutes" });
    expect(s.calendar[2].level).toBeGreaterThan(0);
  });

  it("lists books put down in the month", () => {
    const s = summarizeMonth(
      input([book("x", { status: "DNF", dateFinished: d("2026-10-11"), title: "Bleak House" })], [], {
        prefs: { ...PREFS, statsStoppedBooks: "pages" },
      }),
    );
    expect(s.putDown.map((b) => b.title)).toEqual(["Bleak House"]);
  });

  it("measures the goals at the month's end", () => {
    const books = Array.from({ length: 5 }, (_, i) =>
      book(`g${i}`, { dateFinished: d(i < 3 ? `2026-0${i + 1}-10` : `2026-10-1${i}`) }),
    );
    const s = summarizeMonth(
      input(books, [], {
        goals: [
          { span: "MONTH", target: 2, unit: "BOOKS", countRereads: true },
          { span: "YEAR", target: 12, unit: "BOOKS", countRereads: true },
        ],
      }),
    );
    expect(s.goals).toEqual([
      { label: "October goal", done: 2, target: 2, unit: "BOOKS", met: true, pace: "" },
      expect.objectContaining({ label: "2026 goal", done: 5, target: 12, met: false }),
    ]);
    // Ten of twelve months gone: ten books would be on schedule.
    expect(s.goals[1].pace).toMatch(/^5 books behind\./);
  });

  it("is quiet with nothing read", () => {
    const s = summarizeMonth(input([book("w", { status: "WANT_TO_READ" })]));
    expect(quietMonth(s)).toBe(true);
    expect(s.calendar.every((c) => c.level === 0)).toBe(true);
  });

  it("takes the newest quote, cut short at a word when long", () => {
    const long = `${"word ".repeat(100)}end`;
    const s = summarizeMonth(input([], [], { quotes: [{ text: long, book: book("q") }] }));
    expect(s.quote!.text.length).toBeLessThanOrEqual(321);
    expect(s.quote!.text.endsWith("word…")).toBe(true);
  });

  it("shows where the reader is in what they're reading", () => {
    const s = summarizeMonth(
      input([], [], {
        reading: [
          { ...book("r1"), format: "PHYSICAL", pageCount: 200, lengthMinutes: null, currentPage: 50 },
          { ...book("r2"), format: "PHYSICAL", pageCount: null, lengthMinutes: null, currentPage: null },
        ],
      }),
    );
    expect(s.reading.map((r) => [r.percent, r.figure])).toEqual([
      [25, "50 of 200 · 25%"],
      [null, null],
    ]);
  });
});
