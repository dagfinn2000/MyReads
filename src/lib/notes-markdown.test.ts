import { describe, expect, it } from "vitest";
import { bookNotesMarkdown, markdownFileName, uniqueNames, type MarkdownEntry } from "@/lib/notes-markdown";

const book = {
  title: "Piranesi",
  authors: ["Susanna Clarke"],
  isbn: "9781526622426",
  seriesName: null,
  seriesNumber: null,
  publishedDate: "2020",
  pageCount: 272,
  statusName: "Read",
  rating: 9,
  dateStarted: new Date("2026-11-01T00:00:00Z"),
  dateFinished: new Date("2026-11-09T00:00:00Z"),
  tags: ["fantasy", "house"],
  review: "Strange and kind.",
};
const at = (n: number) => new Date(Date.UTC(2026, 10, n));
const entry = (e: Partial<MarkdownEntry> & Pick<MarkdownEntry, "kind" | "id" | "text">): MarkdownEntry => ({
  page: null,
  chapter: null,
  createdAt: at(1),
  ...e,
});

describe("bookNotesMarkdown", () => {
  it("writes front matter, the review, and everything in book order under chapters", () => {
    const md = bookNotesMarkdown(
      book,
      [
        entry({ kind: "note", id: "n2", text: "Who is the Other?", page: 12, chapter: "1" }),
        entry({ kind: "quote", id: "q1", text: "The Beauty of the House is immeasurable;\nits Kindness infinite.", page: 5, chapter: "1", note: "The first line." }),
        entry({ kind: "note", id: "n3", text: "The statues.", page: 40, chapter: "Part Two" }),
        entry({ kind: "note", id: "n9", text: "Reread in spring." }),
      ],
      { ratingStyle: "half", timeZone: "Europe/Oslo" },
    );
    expect(md).toBe(`---
title: "Piranesi"
author: "Susanna Clarke"
isbn: "9781526622426"
published: "2020"
pages: 272
status: "Read"
rating: 4.5
started: 2026-11-01
finished: 2026-11-09
tags:
  - "fantasy"
  - "house"
---

# Piranesi

*Susanna Clarke*

## My review

Strange and kind.

## Chapter 1

> The Beauty of the House is immeasurable;
> its Kindness infinite.
>
> — p. 5

The first line.

**p. 12.** Who is the Other?

## Part Two

**p. 40.** The statues.

## No page

Reread in spring.
`);
  });

  it("puts a book without chapters under one heading, and rates out of ten when asked", () => {
    const md = bookNotesMarkdown(
      { ...book, review: null, authors: ["A", "B"], rating: 7 },
      [entry({ kind: "quote", id: "q", text: "Line", page: 3, chapter: null })],
      { ratingStyle: "ten" },
    );
    expect(md).toContain("authors:\n  - \"A\"\n  - \"B\"");
    expect(md).toContain("rating: 7");
    expect(md).toContain("## Notes and quotes\n\n> Line\n>\n> — p. 3\n");
    expect(md).not.toContain("My review");
  });

  it("leaves the rating out when ratings are off, and escapes quotes in front matter", () => {
    const md = bookNotesMarkdown({ ...book, title: 'Say "Hi"' }, [], { ratingStyle: "off" });
    expect(md).toContain('title: "Say \\"Hi\\""');
    expect(md).not.toContain("rating:");
  });
});

describe("file names", () => {
  it("takes out what file systems refuse", () => {
    expect(markdownFileName({ title: 'What? A/B: "C"', authors: ["Ann"] })).toBe("What A B C - Ann.md");
    expect(markdownFileName({ title: "...", authors: [] })).toBe("Notes.md");
  });

  it("numbers names that come twice", () => {
    expect(uniqueNames(["Dune.md", "dune.md", "Emma.md", "Dune.md"])).toEqual([
      "Dune.md",
      "dune (2).md",
      "Emma.md",
      "Dune (3).md",
    ]);
  });
});
