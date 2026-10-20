import { describe, expect, it } from "vitest";
import { BookOwnership } from "@/lib/enums";
import {
  LENDING_NOTE,
  defaultDueKey,
  dueText,
  isOverdue,
  lendingMode,
  loanDue,
  outFor,
  overdueCutoff,
  overdueText,
  showsLendingCard,
} from "@/lib/loans";

const at = (iso: string) => new Date(iso);

describe("outFor", () => {
  it("says 'lent today' before a full day has passed", () => {
    // The case that was wrong first time round: lent in the morning, read in
    // the evening. Rounding made that "1 days" — wrong count, wrong grammar.
    expect(outFor(at("2026-07-28T08:00:00Z"), at("2026-07-28T22:00:00Z"))).toBe("lent today");
    expect(outFor(at("2026-07-28T00:00:00Z"), at("2026-07-28T00:00:00Z"))).toBe("lent today");
  });

  it("uses the singular for exactly one day", () => {
    expect(outFor(at("2026-07-27T08:00:00Z"), at("2026-07-28T08:00:00Z"))).toBe("out for 1 day");
    expect(outFor(at("2026-07-27T08:00:00Z"), at("2026-07-28T23:00:00Z"))).toBe("out for 1 day");
  });

  it("counts whole days after that", () => {
    expect(outFor(at("2026-07-01T08:00:00Z"), at("2026-07-28T08:00:00Z"))).toBe("out for 27 days");
  });

  it("never reports negative time for a future-dated loan", () => {
    expect(outFor(at("2026-08-05T00:00:00Z"), at("2026-07-28T00:00:00Z"))).toBe("lent today");
  });
});

describe("lendingMode", () => {
  it("only lets a copy you own be lent", () => {
    expect(lendingMode(BookOwnership.OWNED)).toBe("lendable");
    expect(lendingMode(BookOwnership.BORROWED)).toBe("borrowed");
    expect(lendingMode(BookOwnership.GIVEN_AWAY)).toBe("given-away");
    expect(lendingMode(BookOwnership.WISHLIST)).toBe("wishlist");
  });

  it("says why for each kind of copy", () => {
    expect(LENDING_NOTE.lendable).toBe("This copy is on your shelf.");
    expect(LENDING_NOTE.borrowed).toBe("Borrowed copy. It isn't yours to lend.");
    expect(LENDING_NOTE["given-away"]).toBe("You gave this copy away.");
    expect(LENDING_NOTE.wishlist).toBe("On your wishlist, so there's no copy to lend.");
  });
});

describe("showsLendingCard", () => {
  it("hides the card for a wishlist book with nothing on record", () => {
    expect(showsLendingCard(BookOwnership.WISHLIST, 0)).toBe(false);
  });

  it("keeps a wishlist book's loan history visible", () => {
    expect(showsLendingCard(BookOwnership.WISHLIST, 2)).toBe(true);
  });

  it("shows the card for every other copy", () => {
    for (const o of [BookOwnership.OWNED, BookOwnership.BORROWED, BookOwnership.GIVEN_AWAY]) {
      expect(showsLendingCard(o, 0)).toBe(true);
    }
  });
});

describe("loanDue", () => {
  const due = at("2026-11-30T00:00:00.000Z");

  it("has nothing to say without a due date", () => {
    expect(loanDue(null, at("2026-11-01T12:00:00Z"), "UTC")).toEqual({ kind: "none" });
  });

  it("counts the days left by calendar day", () => {
    expect(loanDue(due, at("2026-11-25T23:00:00Z"), "UTC")).toEqual({ kind: "upcoming", days: 5 });
    expect(loanDue(due, at("2026-11-29T08:00:00Z"), "UTC")).toEqual({ kind: "upcoming", days: 1 });
  });

  it("is due today all through the due day, and overdue the day after", () => {
    expect(loanDue(due, at("2026-11-30T00:30:00Z"), "UTC")).toEqual({ kind: "today" });
    expect(loanDue(due, at("2026-11-30T23:30:00Z"), "UTC")).toEqual({ kind: "today" });
    expect(loanDue(due, at("2026-12-01T00:30:00Z"), "UTC")).toEqual({ kind: "overdue", days: 1 });
    expect(loanDue(due, at("2026-12-13T09:00:00Z"), "UTC")).toEqual({ kind: "overdue", days: 13 });
  });

  it("goes by the reader's own day", () => {
    // 23:30 on the 30th in New York is already the 1st in UTC.
    const lateEvening = at("2026-12-01T04:30:00Z");
    expect(loanDue(due, lateEvening, "America/New_York")).toEqual({ kind: "today" });
    expect(isOverdue(due, lateEvening, "America/New_York")).toBe(false);
    expect(isOverdue(due, lateEvening, "UTC")).toBe(true);
  });
});

describe("dueText", () => {
  it("reads naturally", () => {
    expect(dueText({ kind: "none" })).toBe("");
    expect(dueText({ kind: "today" })).toBe("today");
    expect(dueText({ kind: "upcoming", days: 1 })).toBe("tomorrow");
    expect(dueText({ kind: "upcoming", days: 9 })).toBe("in 9 days");
    expect(dueText({ kind: "overdue", days: 1 })).toBe("1 day overdue");
    expect(dueText({ kind: "overdue", days: 4 })).toBe("4 days overdue");
  });
});

describe("overdueCutoff", () => {
  it("is the start of the reader's today as a typed date is saved", () => {
    expect(overdueCutoff(at("2026-12-01T04:30:00Z"), "America/New_York").toISOString()).toBe(
      "2026-11-30T00:00:00.000Z",
    );
    expect(overdueCutoff(at("2026-12-01T04:30:00Z"), "Europe/Oslo").toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });
});

describe("defaultDueKey", () => {
  it("adds the lending period to the day it's lent", () => {
    expect(defaultDueKey("2026-10-20", "none")).toBe("");
    expect(defaultDueKey("2026-10-20", "14")).toBe("2026-11-03");
    expect(defaultDueKey("2026-12-20", "30")).toBe("2027-01-19");
  });
});

describe("overdueText", () => {
  const dune = { bookId: "a", title: "Dune", borrower: "Kari" };
  const emma = { bookId: "b", title: "Emma", borrower: "Ola" };
  const hobbit = { bookId: "c", title: "The Hobbit", borrower: "Per" };

  it("says nothing when nothing is overdue", () => {
    expect(overdueText([])).toBeNull();
  });

  it("names the one book and who has it", () => {
    expect(overdueText([dune], "3 Sep 2026")).toBe(
      "Dune is overdue. Kari has had it since 3 Sep 2026.",
    );
  });

  it("lists two, and counts the rest", () => {
    expect(overdueText([dune, emma])).toBe("2 lent books are overdue: Dune (Kari) and Emma (Ola).");
    expect(overdueText([dune, emma, hobbit])).toBe(
      "3 lent books are overdue: Dune (Kari), Emma (Ola) and 1 more.",
    );
  });
});
