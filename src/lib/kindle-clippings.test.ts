import { describe, expect, it } from "vitest";
import { matchKindleBook, parseAddedOn, parseClippings, quoteKey } from "@/lib/kindle-clippings";

const END = "==========";

/** A My Clippings.txt the way a Kindle writes it: CRLF, a BOM before
 *  each title. */
function clippings(...entries: [string, string, string][]): string {
  return entries.map(([title, meta, text]) => `﻿${title}\r\n${meta}\r\n\r\n${text}\r\n${END}\r\n`).join("");
}

const WIND = "The Name of the Wind (Rothfuss, Patrick)";
const added = "Added on Sunday, 5 March 2023 21:14:03";

describe("parseClippings", () => {
  it("reads highlights with their page, and the author the right way round", () => {
    const books = parseClippings(
      clippings([WIND, `- Your Highlight on page 12 | Location 180-182 | ${added}`, "It was night again."]),
    );
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      title: "The Name of the Wind",
      author: "Patrick Rothfuss",
      notes: 0,
      looseNotes: 0,
    });
    expect(books[0].highlights).toEqual([
      {
        text: "It was night again.",
        page: 12,
        note: null,
        addedAt: new Date(2023, 2, 5, 21, 14, 3).toISOString(),
      },
    ]);
  });

  it("groups by book, leaves out bookmarks, empty clippings and the clipping limit", () => {
    const books = parseClippings(
      clippings(
        [WIND, `- Your Highlight on page 12 | Location 180-182 | ${added}`, "One."],
        [WIND, `- Your Bookmark on page 20 | Location 300 | ${added}`, ""],
        ["Dune (Frank Herbert)", `- Your Highlight on page 9 | Location 99-100 | ${added}`, "Fear is the mind-killer."],
        ["Dune (Frank Herbert)", `- Your Highlight on page 10 | Location 120-121 | ${added}`, " "],
        [WIND, `- Your Highlight on page 30 | Location 400-401 | ${added}`, "<You have reached the clipping limit for this item>"],
      ),
    );
    // In title order.
    expect(books.map((b) => [b.title, b.highlights.length])).toEqual([
      ["Dune", 1],
      ["The Name of the Wind", 1],
    ]);
  });

  it("keeps the series in the title and the last bracket as the author", () => {
    const [book] = parseClippings(
      clippings([
        "The Way of Kings (The Stormlight Archive, Book 1) (Sanderson, Brandon)",
        `- Your Highlight at location 500-502 | ${added}`,
        "Life before death.",
      ]),
    );
    expect(book.title).toBe("The Way of Kings (The Stormlight Archive, Book 1)");
    expect(book.author).toBe("Brandon Sanderson");
    // "at location" has no page.
    expect(book.highlights[0].page).toBeNull();
  });

  it("names every author, and takes a title with none", () => {
    const books = parseClippings(
      clippings(
        ["Good Omens (Pratchett, Terry;Gaiman, Neil)", `- Your Highlight on page 1 | Location 1-2 | ${added}`, "A."],
        ["notes-from-work", `- Your Highlight on page 1 | ${added}`, "B."],
      ),
    );
    expect(books.map((b) => b.author)).toEqual(["Terry Pratchett, Neil Gaiman", null]);
  });

  it("attaches a note to the highlight it was made on", () => {
    const [book] = parseClippings(
      clippings(
        [WIND, `- Your Highlight on page 12 | Location 180-182 | ${added}`, "First."],
        [WIND, `- Your Highlight on page 14 | Location 200-204 | ${added}`, "Second."],
        [WIND, `- Your Note on page 14 | Location 204 | ${added}`, "Lovely."],
        [WIND, `- Your Note on page 14 | Location 204 | ${added}`, "Read this aloud."],
        [WIND, `- Your Note on page 99 | Location 1500 | ${added}`, "On its own."],
      ),
    );
    expect(book.highlights.map((h) => h.note)).toEqual([null, "Lovely.\n\nRead this aloud."]);
    expect(book.notes).toBe(1);
    expect(book.looseNotes).toBe(1);
  });

  it("finds a PDF's notes by page", () => {
    const [book] = parseClippings(
      clippings(
        ["Report (Someone)", `- Your Highlight on page 3 | ${added}`, "Numbers went up."],
        ["Report (Someone)", `- Your Note on page 3 | ${added}`, "Check this."],
      ),
    );
    expect(book.highlights[0].note).toBe("Check this.");
  });

  it("keeps only the latest of a highlight made longer, shorter or twice", () => {
    const [book] = parseClippings(
      clippings(
        [WIND, `- Your Highlight on page 12 | Location 180-181 | ${added}`, "It was night"],
        [WIND, `- Your Highlight on page 12 | Location 180-182 | ${added}`, "It was night again."],
        [WIND, `- Your Highlight on page 40 | Location 600-601 | ${added}`, "Words are pale shadows."],
        [WIND, `- Your Highlight on page 40 | Location 600-601 | ${added}`, "Words  are pale shadows."],
        // Shares a word with the first, but somewhere else in the book.
        [WIND, `- Your Highlight on page 90 | Location 1200-1201 | ${added}`, "night"],
      ),
    );
    expect(book.highlights.map((h) => h.text)).toEqual([
      "It was night again.",
      "Words  are pale shadows.",
      "night",
    ]);
  });

  it("reads the old short location form", () => {
    const [book] = parseClippings(
      clippings(
        [WIND, "- Highlight Loc. 180-82 | Added on Sunday, March 5, 2023, 09:14 PM", "Old Kindle."],
        [WIND, "- Note Loc. 182 | Added on Sunday, March 5, 2023, 09:15 PM", "Old note."],
      ),
    );
    expect(book.highlights[0].note).toBe("Old note.");
    expect(book.highlights[0].addedAt).toBe(new Date(2023, 2, 5, 21, 14).toISOString());
  });

  it("understands a Kindle set to German, apart from the date", () => {
    const [book] = parseClippings(
      clippings(
        ["Der Process (Kafka, Franz)", "- Ihre Markierung auf Seite 7 | Position 90-91 | Hinzugefügt am Sonntag, 5. März 2023 21:14:03", "Jemand musste Josef K. verleumdet haben."],
        ["Der Process (Kafka, Franz)", "- Ihre Notiz auf Seite 7 | Position 91 | Hinzugefügt am Sonntag, 5. März 2023 21:15:00", "Der Anfang!"],
        ["Der Process (Kafka, Franz)", "- Ihr Lesezeichen auf Seite 8 | Position 95 | Hinzugefügt am Sonntag, 5. März 2023 21:16:00", ""],
      ),
    );
    expect(book.highlights).toEqual([
      { text: "Jemand musste Josef K. verleumdet haben.", page: 7, note: "Der Anfang!", addedAt: null },
    ]);
  });

  it("finds nothing in a file that isn't clippings", () => {
    expect(parseClippings("")).toEqual([]);
    expect(parseClippings("Dear diary,\nnothing happened today.\n")).toEqual([]);
  });

  it("cuts a very long note to what a quote can hold", () => {
    const [book] = parseClippings(
      clippings(
        [WIND, `- Your Highlight on page 1 | Location 10-11 | ${added}`, "Short."],
        [WIND, `- Your Note on page 1 | Location 11 | ${added}`, "x".repeat(2500)],
      ),
    );
    expect(book.highlights[0].note).toHaveLength(2000);
    expect(book.highlights[0].note?.endsWith("…")).toBe(true);
  });
});

describe("parseAddedOn", () => {
  it("reads both English date orders, on the reader's own clock", () => {
    expect(parseAddedOn("Sunday, 5 March 2023 21:14:03")).toBe(new Date(2023, 2, 5, 21, 14, 3).toISOString());
    expect(parseAddedOn("Sunday, March 5, 2023 9:14:03 PM")).toBe(new Date(2023, 2, 5, 21, 14, 3).toISOString());
    expect(parseAddedOn("Monday, January 2, 2023 12:05:00 AM")).toBe(new Date(2023, 0, 2, 0, 5).toISOString());
  });

  it("gives up on what it can't read", () => {
    expect(parseAddedOn("Sonntag, 5. März 2023 21:14:03")).toBeNull();
    expect(parseAddedOn("31 February 2023 10:00")).toBeNull();
    expect(parseAddedOn("soon")).toBeNull();
  });
});

describe("quoteKey", () => {
  it("ignores case, spacing and curly quotes", () => {
    expect(quoteKey("  “It’s  late,” he said.\n")).toBe(quoteKey('"it\'s late," He said.'));
  });
});

describe("matchKindleBook", () => {
  const library = [
    { id: "wind", title: "The Name of the Wind", authors: ["Patrick Rothfuss"], format: "PHYSICAL" },
    { id: "wind-ebook", title: "The Name of the Wind", authors: ["Patrick Rothfuss"], format: "EBOOK" },
    { id: "sapiens", title: "Sapiens", authors: ["Yuval Noah Harari"] },
    { id: "it", title: "It", authors: ["Stephen King"] },
    { id: "bronte", title: "Jane Eyre", authors: ["Charlotte Brontë"] },
  ];

  it("takes the same title, an e-book first", () => {
    expect(matchKindleBook({ title: "The Name of the Wind", author: "Patrick Rothfuss" }, library)).toBe(
      "wind-ebook",
    );
    // Case, accents, articles and brackets aside.
    expect(matchKindleBook({ title: "jane eyre (Penguin Classics)", author: "Charlotte Bronte" }, library)).toBe(
      "bronte",
    );
    expect(matchKindleBook({ title: "Name of the Wind", author: null }, library)).toBe("wind-ebook");
  });

  it("takes the title before a subtitle only when the author matches", () => {
    expect(
      matchKindleBook({ title: "Sapiens: A Brief History of Humankind", author: "Yuval Noah Harari" }, library),
    ).toBe("sapiens");
    expect(matchKindleBook({ title: "Sapiens: A Graphic History", author: "David Vandermeulen" }, library)).toBeNull();
  });

  it("finds nothing for a book that isn't there", () => {
    expect(matchKindleBook({ title: "Dune", author: "Frank Herbert" }, library)).toBeNull();
    expect(matchKindleBook({ title: "", author: null }, library)).toBeNull();
  });
});
