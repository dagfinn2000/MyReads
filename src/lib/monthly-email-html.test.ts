import { describe, expect, it } from "vitest";
import { escapeHtml, ratingText, renderMonthlyEmail, type EmailLook } from "@/lib/monthly-email-html";
import type { MonthFinish, MonthSummary } from "@/lib/monthly-email";

const LOOK: EmailLook = { dateFormat: "d-mmm-y", numberFormat: "comma", ratingStyle: "half", weekStart: "monday" };
const NO_LINKS = { site: null, unsubscribe: null };

function finish(id: string, over: Partial<MonthFinish> = {}): MonthFinish {
  return {
    id,
    title: `Book ${id}`,
    authors: ["An Author"],
    coverUrl: null,
    day: "2026-10-05",
    rating: null,
    isReread: false,
    days: 4,
    pageCount: 300,
    ...over,
  };
}

function summary(over: Partial<MonthSummary> = {}): MonthSummary {
  const calendar = Array.from({ length: 31 }, (_, i) => ({
    day: `2026-10-${String(i + 1).padStart(2, "0")}`,
    level: i % 5,
  }));
  return {
    month: "2026-10",
    name: "Dagfinn",
    books: 2,
    pages: 1234,
    minutes: 95,
    readingDays: 18,
    before: { books: 1, pages: 900, minutes: 95, readingDays: 20 },
    longestRun: 6,
    biggestDay: { day: "2026-10-14", amount: 112, unit: "pages" },
    finishes: [finish("a", { rating: 9 }), finish("b", { rating: 6, isReread: true })],
    favourite: null,
    putDown: [],
    calendar,
    calendarUnit: "pages",
    started: 2,
    added: 0,
    goals: [],
    reading: [],
    quote: null,
    ...over,
  };
}

describe("ratingText", () => {
  it("follows the reader's rating style", () => {
    expect(ratingText(9, "half")).toBe("★★★★½");
    expect(ratingText(8, "half")).toBe("★★★★");
    expect(ratingText(9, "whole")).toBe("★★★★★");
    expect(ratingText(1, "whole")).toBe("★");
    expect(ratingText(7, "ten")).toBe("7/10");
    expect(ratingText(7, "off")).toBe("");
    expect(ratingText(null, "half")).toBe("");
  });
});

describe("renderMonthlyEmail", () => {
  it("says the month's numbers in the subject, the page and the text", () => {
    const email = renderMonthlyEmail(summary(), LOOK, NO_LINKS, () => null);
    expect(email.subject).toBe("Your October in books: 2 finished, 1,234 pages");
    expect(email.preheader).toBe("18 reading days, 6 in a row at best, and 2 books finished.");
    expect(email.html).toContain("Your October in books");
    expect(email.html).toContain("Up 334 on September");
    expect(email.html).toContain("Same as September"); // the time read
    expect(email.html).toContain("of 31 · 6 in a row at best");
    expect(email.html).toContain("Most in a day: 112 pages on 14 Oct");
    expect(email.html).toContain("★★★★½");
    expect(email.html).toContain("Re-read");
    expect(email.text).toContain("Pages read: 1,234");
    expect(email.text).toContain("- Book b by An Author (re-read), finished 5 Oct, ★★★");
  });

  it("keeps what the reader typed from becoming HTML", () => {
    const evil = '<script>alert("x")</script>';
    const email = renderMonthlyEmail(
      summary({
        name: evil,
        finishes: [finish("a", { title: evil, authors: [evil] })],
        quote: { text: evil, book: finish("q", { title: evil }) },
      }),
      LOOK,
      NO_LINKS,
      () => null,
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(escapeHtml(`a&b"'<>`)).toBe("a&amp;b&quot;&#39;&lt;&gt;");
  });

  it("shows covers it's given, and cloth for the rest", () => {
    const email = renderMonthlyEmail(summary(), LOOK, NO_LINKS, (b) => (b.id === "a" ? "cid:cover-a@myreads" : null));
    expect(email.html).toContain('src="cid:cover-a@myreads"');
    expect(email.html.match(/<img /g)).toHaveLength(1);
    expect(email.html).toContain(">B</td>"); // Book b's first letter on its cloth
  });

  it("puts the favourite first, large", () => {
    const fav = finish("a", { rating: 10, title: "Piranesi" });
    const html = renderMonthlyEmail(summary({ favourite: fav, finishes: [fav, finish("b")] }), LOOK, NO_LINKS, () => null).html;
    const card = html.slice(html.indexOf('class="card"'));
    expect(card.indexOf("Book of the month")).toBeLessThan(card.indexOf("Piranesi"));
    expect(card.indexOf("Piranesi")).toBeLessThan(card.indexOf("Also finished"));
    expect(card.match(/Piranesi/g)).toHaveLength(1);
  });

  it("has links only when it knows where MyReads is", () => {
    const without = renderMonthlyEmail(summary(), LOOK, NO_LINKS, () => null);
    expect(without.html).not.toContain("href=");
    expect(without.html).toContain("turn off Monthly email under Account › Preferences");

    const links = { site: "https://books.example.com", unsubscribe: "https://books.example.com/api/email/unsubscribe?u=1&t=k" };
    const email = renderMonthlyEmail(summary(), LOOK, links, () => null);
    expect(email.html).toContain('href="https://books.example.com/stats"');
    expect(email.html).toContain('href="https://books.example.com/account#monthly-email"');
    expect(email.html).toContain('href="https://books.example.com/api/email/unsubscribe?u=1&amp;t=k"');
    expect(email.text).toContain("Stop these emails: https://books.example.com/api/email/unsubscribe?u=1&t=k");
    // December's points at the year in review.
    const december = renderMonthlyEmail(summary({ month: "2026-12" }), LOOK, links, () => null);
    expect(december.html).toContain('href="https://books.example.com/stats/year/2026"');
  });

  it("says a quiet month kindly, without empty numbers", () => {
    const quiet = summary({
      books: 0,
      pages: 0,
      minutes: 0,
      readingDays: 0,
      longestRun: 0,
      biggestDay: null,
      finishes: [],
      started: 0,
    });
    const email = renderMonthlyEmail(quiet, LOOK, NO_LINKS, () => null);
    expect(email.subject).toBe("Your October in books");
    expect(email.html).toContain("a quiet month");
    expect(email.html).not.toContain("Books finished");
    expect(email.html).not.toContain("day by day");
  });

  it("starts the calendar's weeks on the reader's day", () => {
    // 1 October 2026 is a Thursday: three empty days before it from
    // Monday, four from Sunday.
    const blanks = (html: string) => {
      const table = html.slice(html.indexOf("day by day"));
      const firstRow = table.slice(table.indexOf("</tr>") + 5, table.indexOf("</tr>", table.indexOf("</tr>") + 5));
      return firstRow.match(/&nbsp;<\/td>/g)?.length ?? 0;
    };
    expect(blanks(renderMonthlyEmail(summary(), LOOK, NO_LINKS, () => null).html)).toBe(3);
    expect(blanks(renderMonthlyEmail(summary(), { ...LOOK, weekStart: "sunday" }, NO_LINKS, () => null).html)).toBe(4);
  });

  it("follows the reader's number and date styles, and hides ratings when they're off", () => {
    const html = renderMonthlyEmail(
      summary(),
      { ...LOOK, numberFormat: "space", dateFormat: "mmm-d-y", ratingStyle: "off" },
      NO_LINKS,
      () => null,
    ).html;
    expect(html).toMatch(/1\s234/u);
    expect(html).toContain("Finished Oct 5");
    expect(html).not.toContain("★");
  });

  it("has a dark look for the mail apps that ask", () => {
    const html = renderMonthlyEmail(summary(), LOOK, NO_LINKS, () => null).html;
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("[data-ogsc] .ink");
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
  });
});
