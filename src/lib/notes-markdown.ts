import { arrangeTimeline, chapterLabel } from "@/lib/book-notes";
import { calendarDay } from "@/lib/dates";
import type { RatingStyle } from "@/lib/preferences";

/**
 * A book's notes and quotes as a Markdown file, for Obsidian or any notes
 * app: front matter with the book's details, then everything in the order
 * of the book (lib/book-notes.ts), under its chapters. Text goes out
 * exactly as it was typed.
 */

export interface MarkdownBook {
  title: string;
  authors: string[];
  isbn: string | null;
  seriesName: string | null;
  seriesNumber: number | null;
  publishedDate: string | null;
  pageCount: number | null;
  statusName: string;
  rating: number | null;
  dateStarted: Date | null;
  dateFinished: Date | null;
  tags: string[];
  review: string | null;
}

export interface MarkdownEntry {
  kind: "note" | "quote";
  id: string;
  text: string;
  page: number | null;
  chapter: string | null;
  /** A quote's own note on why it stuck. */
  note?: string | null;
  createdAt: Date;
}

export interface MarkdownOptions {
  ratingStyle: RatingStyle;
  timeZone?: string;
}

/** A YAML string: JSON's double-quoted strings are valid YAML. */
const yaml = (s: string) => JSON.stringify(s);

function frontMatter(book: MarkdownBook, opts: MarkdownOptions): string {
  const lines = ["---", `title: ${yaml(book.title)}`];
  if (book.authors.length === 1) lines.push(`author: ${yaml(book.authors[0])}`);
  else if (book.authors.length > 1) lines.push("authors:", ...book.authors.map((a) => `  - ${yaml(a)}`));
  if (book.seriesName) {
    lines.push(`series: ${yaml(book.seriesName)}`);
    if (book.seriesNumber != null) lines.push(`series_number: ${book.seriesNumber}`);
  }
  if (book.isbn) lines.push(`isbn: ${yaml(book.isbn)}`);
  if (book.publishedDate) lines.push(`published: ${yaml(book.publishedDate)}`);
  if (book.pageCount) lines.push(`pages: ${book.pageCount}`);
  lines.push(`status: ${yaml(book.statusName)}`);
  if (book.rating && opts.ratingStyle !== "off") {
    lines.push(`rating: ${opts.ratingStyle === "ten" ? book.rating : book.rating / 2}`);
  }
  if (book.dateStarted) lines.push(`started: ${calendarDay(book.dateStarted, opts.timeZone)}`);
  if (book.dateFinished) lines.push(`finished: ${calendarDay(book.dateFinished, opts.timeZone)}`);
  if (book.tags.length > 0) lines.push("tags:", ...book.tags.map((t) => `  - ${yaml(t)}`));
  lines.push("---");
  return lines.join("\n");
}

/** Text as a blockquote, blank lines kept inside it. */
function blockquote(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
}

/** "p. 12", "Chapter 3" or both, for where a quote is from. */
function whereFrom(entry: MarkdownEntry, inChapter: boolean): string {
  const parts: string[] = [];
  if (entry.page) parts.push(`p. ${entry.page}`);
  if (!inChapter && entry.chapter) parts.push(chapterLabel(entry.chapter) ?? entry.chapter);
  return parts.join(", ");
}

function entryMarkdown(entry: MarkdownEntry, inChapter: boolean): string {
  const where = whereFrom(entry, inChapter);
  if (entry.kind === "quote") {
    const out = [blockquote(entry.text)];
    if (where) out[0] += `\n>\n> — ${where}`;
    if (entry.note?.trim()) out.push(entry.note.trim());
    return out.join("\n\n");
  }
  return where ? `**${where}.** ${entry.text.trim()}` : entry.text.trim();
}

/** The whole file for one book. */
export function bookNotesMarkdown(
  book: MarkdownBook,
  entries: readonly MarkdownEntry[],
  opts: MarkdownOptions,
): string {
  const out = [frontMatter(book, opts), "", `# ${book.title}`];
  if (book.authors.length > 0) out.push("", `*${book.authors.join(", ")}*`);
  if (book.review?.trim()) out.push("", "## My review", "", book.review.trim());

  // Under their chapters when the book has any; otherwise under one
  // heading. Either way, what has no page or chapter comes last.
  const sections = arrangeTimeline(entries);
  const chaptered = sections.some((s) => s.label);
  if (sections.length > 0 && !chaptered && sections[0].paged) out.push("", "## Notes and quotes");
  for (const section of sections) {
    const heading =
      section.label ?? (!section.paged ? "No page" : chaptered ? "Not in a chapter" : null);
    if (heading) out.push("", `## ${heading}`);
    for (const entry of section.entries) out.push("", entryMarkdown(entry, section.label !== null));
  }
  return `${out.join("\n")}\n`;
}

/** A file name for the book's notes: "Piranesi - Susanna Clarke.md", with
 *  the characters file systems refuse taken out. */
export function markdownFileName(book: Pick<MarkdownBook, "title" | "authors">): string {
  const base = [book.title, book.authors[0]].filter(Boolean).join(" - ");
  const safe = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120)
    .trim();
  return `${safe || "Notes"}.md`;
}

/** File names made unique within one zip: "Dune.md", "Dune (2).md". */
export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? name : name.replace(/\.md$/, ` (${n}).md`);
  });
}
