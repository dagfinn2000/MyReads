import { describe, expect, it } from "vitest";
import { calendarDay } from "@/lib/dates";
import { goalProgress, markRereads } from "@/lib/goals";
import {
  booksReadAllTime,
  buildPasses,
  countWindow,
  goalRuleLine,
  inWindow,
  ruleNotes,
  tally,
  type BookDayPages,
  type CountBook,
  type CountRead,
  type CountRules,
  type StatsInputs,
} from "@/lib/stats-count";
import { ALL_TIME, yearWindow, type DayWindow } from "@/lib/stats-period";

const TZ = "UTC";
const DEFAULTS: CountRules = {
  statsPagesRead: "finished",
  statsStoppedBooks: "none",
  statsAudiobooks: "full",
};
const LOGGED: CountRules = { ...DEFAULTS, statsPagesRead: "logged" };

/** A date typed into a date field: midnight UTC. */
const d = (day: string) => new Date(`${day}T00:00:00Z`);

function book(id: string, over: Partial<CountBook> = {}): CountBook {
  return {
    id,
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

function read(bookId: string, finished: string | null, over: Partial<CountRead> = {}): CountRead {
  return { bookId, dateStarted: null, dateFinished: finished ? d(finished) : null, rating: null, ...over };
}

function log(bookId: string, day: string, pages: number, current = true): BookDayPages {
  return { bookId, day, pages, current };
}

function inputs(
  books: CountBook[],
  reads: CountRead[] = [],
  logDays: BookDayPages[] = [],
  lastLogDates: Map<string, Date> = new Map(),
): StatsInputs {
  return { books, reads, logDays, lastLogDates };
}

/** Books and pages a window adds up to under some rules. */
function count(inp: StatsInputs, rules: CountRules, window: DayWindow = ALL_TIME) {
  return tally(countWindow(buildPasses(inp, rules, TZ), window, rules));
}

describe("with the default rules", () => {
  // A library with a bit of everything.
  const books = [
    book("a", { dateFinished: d("2025-06-01") }), // and read before, in 2024
    book("b", { pageCount: 200 }), // Read, no finish date
    book("c", { pageCount: null, dateFinished: d("2026-02-01") }),
    book("d", { status: "WANT_TO_READ", pageCount: 150 }), // read before the app
    book("e", { status: "DNF", pageCount: 400, currentPage: 120, dateFinished: d("2026-03-01") }),
    book("f", { status: "READING", pageCount: 500, currentPage: 100 }),
    book("g", { format: "AUDIOBOOK", pageCount: 350, dateFinished: d("2026-05-05") }),
  ];
  const reads = [read("a", "2024-03-01"), read("d", null)];
  const logDays = [log("f", "2026-09-01", 100), log("e", "2026-02-20", 120)];
  const inp = inputs(books, reads, logDays);

  /** The stats page's sums before "What counts" existed. */
  function before() {
    const readBooks = books.filter((b) => b.status === "READ");
    const pageCountOf = (id: string) => books.find((b) => b.id === id)!.pageCount;
    const finishes = markRereads(
      [
        ...readBooks
          .filter((b) => b.dateFinished)
          .map((b) => ({ bookId: b.id, dateFinished: b.dateFinished!, pageCount: b.pageCount })),
        ...reads
          .filter((r) => r.dateFinished)
          .map((r) => ({ bookId: r.bookId, dateFinished: r.dateFinished!, pageCount: pageCountOf(r.bookId) })),
      ],
      new Set(reads.filter((r) => !r.dateFinished).map((r) => r.bookId)),
    ).map((f) => ({ ...f, year: Number(calendarDay(f.dateFinished, TZ).slice(0, 4)) }));
    return {
      booksRead: readBooks.length,
      pagesRead:
        readBooks.reduce((s, b) => s + (b.pageCount ?? 0), 0) +
        reads.reduce((s, r) => s + (pageCountOf(r.bookId) ?? 0), 0),
      perYear: (year: number) => finishes.filter((f) => f.year === year).length,
      goal: (year: number, unit: "BOOKS" | "PAGES", countRereads: boolean) => {
        const counted = finishes
          .filter((f) => f.year === year)
          .filter((f) => countRereads || !f.isReread);
        return unit === "PAGES"
          ? counted.reduce((s, f) => s + (f.pageCount ?? 0), 0)
          : counted.length;
      },
    };
  }

  it("reproduces Books read, Pages read, the per-year bars and goal progress", () => {
    const old = before();
    expect(booksReadAllTime(books, DEFAULTS).books).toBe(old.booksRead);
    expect(count(inp, DEFAULTS).pages).toBe(old.pagesRead);
    expect(old.pagesRead).toBe(1300);

    const passes = buildPasses(inp, DEFAULTS, TZ);
    for (const year of [2023, 2024, 2025, 2026, 2027]) {
      const items = countWindow(passes, yearWindow(year), DEFAULTS);
      expect(tally(items).books, `${year}`).toBe(old.perYear(year));
      for (const unit of ["BOOKS", "PAGES"] as const) {
        for (const countRereads of [true, false]) {
          expect(goalProgress(items, { unit, countRereads }), `${year} ${unit}`).toBe(
            old.goal(year, unit, countRereads),
          );
        }
      }
    }
  });

  it("counts open and stopped books nowhere", () => {
    const ids = countWindow(buildPasses(inp, DEFAULTS, TZ), ALL_TIME, DEFAULTS).map(
      (i) => i.pass.book.id,
    );
    expect(ids).not.toContain("e");
    expect(ids).not.toContain("f");
  });
});

describe("Pages I logged", () => {
  it("splits a book read across New Year between the two years", () => {
    const inp = inputs(
      [book("x", { pageCount: 600, dateFinished: d("2026-01-10") })],
      [],
      [
        log("x", "2025-12-20", 300),
        log("x", "2025-12-28", 150),
        log("x", "2026-01-05", 100),
        log("x", "2026-01-10", 50),
      ],
    );
    expect(count(inp, LOGGED, yearWindow(2025))).toMatchObject({ books: 0, pages: 450 });
    expect(count(inp, LOGGED, yearWindow(2026))).toMatchObject({ books: 1, pages: 150 });
    expect(count(inp, LOGGED).pages).toBe(600);
    // Whole books put it all in the year it was finished.
    expect(count(inp, DEFAULTS, yearWindow(2025)).pages).toBe(0);
    expect(count(inp, DEFAULTS, yearWindow(2026)).pages).toBe(600);
  });

  it("adds a book finished without logging on its finish day; undated only in all time", () => {
    const inp = inputs([
      book("y", { pageCount: 250, dateFinished: d("2026-03-03") }),
      book("z", { pageCount: 100 }),
    ]);
    expect(count(inp, LOGGED, yearWindow(2026)).pages).toBe(250);
    expect(count(inp, LOGGED).pages).toBe(350);
  });

  it("counts a read from before the app and a logged re-read once each", () => {
    const inp = inputs(
      [book("p", { dateFinished: d("2026-04-01") })],
      [read("p", "2020-05-01")],
      [log("p", "2026-03-20", 200), log("p", "2026-04-01", 100)],
    );
    expect(count(inp, LOGGED).pages).toBe(600);
    expect(count(inp, LOGGED, yearWindow(2020)).pages).toBe(300);
    expect(count(inp, LOGGED, yearWindow(2026)).pages).toBe(300);

    // An undated "read it before" adds its pages in all time only.
    const undated = inputs(
      [book("p", { dateFinished: d("2026-04-01") })],
      [read("p", null)],
      [log("p", "2026-03-20", 300)],
    );
    expect(count(undated, LOGGED).pages).toBe(600);
    expect(count(undated, LOGGED, yearWindow(2026)).pages).toBe(300);
  });

  it("counts pages logged in books still on the go, and back on the shelf", () => {
    const inp = inputs(
      [
        book("r", { status: "READING", currentPage: 120 }),
        book("w", { status: "WANT_TO_READ" }),
      ],
      [],
      [log("r", "2026-09-01", 120), log("w", "2026-02-02", 80)],
    );
    const last30 = { from: "2026-08-17", to: "2026-09-15" };
    expect(count(inp, LOGGED, last30)).toMatchObject({ books: 0, pages: 120 });
    expect(count(inp, LOGGED, yearWindow(2026)).pages).toBe(200);
    expect(count(inp, DEFAULTS, yearWindow(2026)).pages).toBe(0);
  });
});

describe("log attribution", () => {
  it("gives pages before a finish to that pass and later ones to the re-read", () => {
    const inp = inputs(
      [book("r", { dateFinished: d("2026-06-01") })],
      [read("r", "2025-03-10", { dateStarted: d("2025-03-01") })],
      [
        log("r", "2025-03-05", 200, false),
        log("r", "2025-03-10", 100, false),
        log("r", "2026-05-20", 300),
      ],
    );
    const passes = buildPasses(inp, LOGGED, TZ);
    const [first, again] = passes;
    expect(first).toMatchObject({ isReread: false, logged: [{ pages: 200 }, { pages: 100 }] });
    expect(again).toMatchObject({ isReread: true, logged: [{ day: "2026-05-20", pages: 300 }] });

    const year2026 = countWindow(passes, yearWindow(2026), LOGGED);
    expect(goalProgress(year2026, { unit: "PAGES", countRereads: false })).toBe(0);
    expect(goalProgress(year2026, { unit: "PAGES", countRereads: true })).toBe(300);
    expect(count(inp, LOGGED, yearWindow(2025)).pages).toBe(300);
  });

  it("treats a re-read in progress as a re-read for the goal", () => {
    const inp = inputs(
      [book("q", { status: "READING", currentPage: 150 })],
      [read("q", "2025-01-10")],
      [log("q", "2026-08-01", 150)],
    );
    const items = countWindow(buildPasses(inp, LOGGED, TZ), yearWindow(2026), LOGGED);
    expect(items).toHaveLength(1);
    expect(items[0].isReread).toBe(true);
    expect(goalProgress(items, { unit: "PAGES", countRereads: false })).toBe(0);
    expect(goalProgress(items, { unit: "PAGES", countRereads: true })).toBe(150);
  });

  it("keeps an undated logged pass's pages on it, so they aren't counted twice", () => {
    // Finished with "Don't remember", then read again: the earlier pages
    // sit before the new pass's start.
    const inp = inputs(
      [book("u", { status: "READING", pageCount: 400, currentPage: 50 })],
      [read("u", null, { dateStarted: d("2026-02-01") })],
      [log("u", "2026-02-10", 400, false), log("u", "2026-07-05", 50)],
    );
    expect(count(inp, LOGGED).pages).toBe(450);
    expect(count(inp, LOGGED, yearWindow(2026)).pages).toBe(450);
  });

  it("bounds each earlier pass by its own start", () => {
    // An undated pass read in 2022, then a dated one in early 2023.
    const inp = inputs(
      [book("v", { status: "WANT_TO_READ" })],
      [
        read("v", null, { dateStarted: d("2022-01-01") }),
        read("v", "2023-03-01", { dateStarted: d("2023-01-15") }),
      ],
      [log("v", "2022-06-01", 300, false), log("v", "2023-02-01", 300, false)],
    );
    const [undated, dated] = buildPasses(inp, LOGGED, TZ);
    expect(undated.logged).toEqual([{ day: "2022-06-01", pages: 300 }]);
    expect(dated.logged).toEqual([{ day: "2023-02-01", pages: 300 }]);
    expect(count(inp, LOGGED).pages).toBe(600);
  });

  it("gives pages logged after a typed finish date to that finish", () => {
    const inp = inputs(
      [book("t", { status: "READING" })],
      [read("t", "2024-05-01")],
      [log("t", "2024-04-20", 250, false), log("t", "2024-05-03", 50, false)],
    );
    const [archived] = buildPasses(inp, LOGGED, TZ);
    expect(archived.logged.reduce((s, l) => s + l.pages, 0)).toBe(300);
  });
});

describe("Books I stop reading", () => {
  const stopped = book("s", {
    status: "DNF",
    pageCount: 500,
    currentPage: 218,
    dateFinished: d("2026-03-01"),
  });
  const logs = [log("s", "2026-02-20", 218)];

  it("drops a stopped book entirely by default, logged pages too", () => {
    expect(count(inputs([stopped], [], logs), LOGGED, yearWindow(2026))).toMatchObject({
      books: 0,
      pages: 0,
    });
  });

  it("counts the pages read on the day it was put down", () => {
    const rules: CountRules = { ...DEFAULTS, statsStoppedBooks: "pages" };
    const inp = inputs([stopped], [], logs);
    expect(count(inp, rules, { from: "2026-03-01", to: "2026-03-31" })).toMatchObject({
      books: 0,
      pages: 218,
    });
    expect(count(inp, rules, { from: "2026-02-01", to: "2026-02-28" }).pages).toBe(0);
    // Logged, the pages land on the days they were read.
    expect(count(inp, { ...rules, statsPagesRead: "logged" }, { from: "2026-02-01", to: "2026-02-28" }).pages).toBe(218);
  });

  it("dates a stop without a finish date by the last log entry, else all time only", () => {
    const rules: CountRules = { ...DEFAULTS, statsStoppedBooks: "pages" };
    const byLog = inputs(
      [book("s", { status: "DNF", currentPage: 90 })],
      [],
      [],
      new Map([["s", new Date("2026-04-04T18:00:00Z")]]),
    );
    expect(count(byLog, rules, { from: "2026-04-04", to: "2026-04-04" }).pages).toBe(90);

    const undated = inputs([book("s", { status: "DNF", currentPage: 90 })]);
    expect(count(undated, rules, yearWindow(2026)).pages).toBe(0);
    expect(count(undated, rules).pages).toBe(90);
  });

  it("caps the pages at the book's length, and falls back to the logged pages", () => {
    const rules: CountRules = { ...DEFAULTS, statsStoppedBooks: "pages" };
    expect(count(inputs([{ ...stopped, currentPage: 700 }]), rules).pages).toBe(500);
    expect(count(inputs([{ ...stopped, currentPage: null }], [], logs), rules).pages).toBe(218);
  });

  it("counts as a book in the window it was put down, and all time", () => {
    const rules: CountRules = { ...DEFAULTS, statsStoppedBooks: "book" };
    const inp = inputs([stopped, book("k", { dateFinished: d("2026-03-15") })]);
    expect(count(inp, rules, { from: "2026-03-01", to: "2026-03-31" })).toMatchObject({
      books: 2,
      putDown: 1,
    });
    expect(count(inp, rules, { from: "2026-04-01", to: "2026-04-30" }).books).toBe(0);
    expect(booksReadAllTime([stopped, book("k")], rules)).toEqual({ books: 2, putDown: 1 });
    expect(booksReadAllTime([stopped, book("k")], DEFAULTS)).toEqual({ books: 1, putDown: 0 });
  });

  it("leaves a stopped re-read's earlier finish alone, and marks the stop a re-read", () => {
    const rules: CountRules = { ...DEFAULTS, statsStoppedBooks: "book" };
    const passes = buildPasses(inputs([stopped], [read("s", "2024-01-01")]), rules, TZ);
    expect(passes.map((p) => [p.kind, p.isReread])).toEqual([
      ["finished", false],
      ["stopped", true],
    ]);
  });
});

describe("Audiobooks", () => {
  const audio = book("h", { format: "AUDIOBOOK", pageCount: 476, dateFinished: d("2026-08-21") });
  const logs = [log("h", "2026-08-10", 476)];

  it("as books, not pages: keeps the book, drops its pages in both modes", () => {
    const rules: CountRules = { ...DEFAULTS, statsAudiobooks: "books" };
    expect(count(inputs([audio], [], logs), rules)).toMatchObject({ books: 1, pages: 0 });
    expect(
      count(inputs([audio], [], logs), { ...rules, statsPagesRead: "logged" }),
    ).toMatchObject({ books: 1, pages: 0 });
  });

  it("left out: gone from books, pages and Books read", () => {
    const rules: CountRules = { ...DEFAULTS, statsAudiobooks: "out" };
    expect(buildPasses(inputs([audio], [read("h", "2025-01-01")], logs), rules, TZ)).toEqual([]);
    expect(booksReadAllTime([audio, book("k")], rules).books).toBe(1);
  });
});

describe("windows", () => {
  it("include both ends, and an unknown day only in all time", () => {
    const w = { from: "2026-09-13", to: "2026-10-12" };
    expect(inWindow("2026-09-13", w)).toBe(true);
    expect(inWindow("2026-10-12", w)).toBe(true);
    expect(inWindow("2026-09-12", w)).toBe(false);
    expect(inWindow(null, w)).toBe(false);
    expect(inWindow(null, ALL_TIME)).toBe(true);
  });

  it("read a typed finish date as the day typed, in any zone", () => {
    const inp = inputs([book("m", { dateFinished: d("2026-09-12") })]);
    const passes = buildPasses(inp, DEFAULTS, "America/New_York");
    expect(passes[0].day).toBe("2026-09-12");
    expect(countWindow(passes, { from: "2026-09-12", to: "2026-10-11" }, DEFAULTS)).toHaveLength(1);
    expect(countWindow(passes, { from: "2026-08-13", to: "2026-09-11" }, DEFAULTS)).toHaveLength(0);

    // A "finished now" moment falls on the reader's own day.
    const late = inputs([book("n", { dateFinished: new Date("2026-09-12T02:00:00Z") })]);
    expect(buildPasses(late, DEFAULTS, "America/New_York")[0].day).toBe("2026-09-11");
  });
});

describe("rule notes", () => {
  it("names the rule on each card", () => {
    expect(ruleNotes(DEFAULTS)).toEqual({
      pagesSuffix: "",
      pages: ["whole books when finished"],
      books: [],
    });
    expect(
      ruleNotes(
        { statsPagesRead: "logged", statsStoppedBooks: "book", statsAudiobooks: "out" },
        { rereads: 2, putDown: 1 },
      ),
    ).toEqual({
      pagesSuffix: " · as logged",
      pages: ["includes pages of books you stopped", "audiobooks left out"],
      books: ["includes 2 re-reads", "includes 1 put down", "audiobooks left out"],
    });
    expect(ruleNotes({ ...LOGGED, statsAudiobooks: "books" }, { rereads: 1 })).toEqual({
      pagesSuffix: " · as logged",
      pages: ["no audiobook pages"],
      books: ["includes 1 re-read"],
    });
  });

  it("explains a pages goal in both modes", () => {
    expect(goalRuleLine(DEFAULTS)).toBe(
      "A pages goal adds up the page counts of the books you finish.",
    );
    expect(goalRuleLine(LOGGED)).toBe(
      "A pages goal counts the pages you log, plus whole books you finish without logging.",
    );
  });
});
