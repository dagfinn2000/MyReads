/**
 * Chapter notes: a book's own notes and its quotes, laid out in the order
 * of the book (components/book-notes-card.tsx). A note or a quote can name
 * a page, a chapter, both or neither, so the order is worked out here:
 *
 *  - Everything with a page goes by page; at one page a quote comes before
 *    a note (the note is usually about the passage), then the oldest first.
 *  - Something with a chapter but no page goes at the end of that chapter,
 *    as a word on the chapter as a whole, when the chapter has a page
 *    elsewhere. Otherwise it goes after everything with a page, with the
 *    rest of its chapter.
 *  - Something with neither comes last of all.
 *
 * Consecutive entries of one chapter make a section under its name.
 */

/** What the timeline needs to know about a note or a quote. */
export interface TimelineEntry {
  kind: "note" | "quote";
  id: string;
  page: number | null;
  chapter: string | null;
  createdAt: Date;
}

export interface TimelineSection<T extends TimelineEntry> {
  /** chapterKey of its entries; null for entries with no chapter. */
  key: string | null;
  /** The chapter as shown, from its first entry; null without one. */
  label: string | null;
  /** False for the sections after everything with a page. */
  paged: boolean;
  entries: T[];
}

/** The longest chapter name kept, in characters. */
export const CHAPTER_MAX = 120;

const ROMAN = /^(?=[MDCLXVI])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** A chapter as typed, tidied: trimmed, runs of spaces made one. */
export function tidyChapter(chapter: string | null | undefined): string | null {
  const t = chapter?.trim().replace(/\s+/g, " ");
  return t ? t : null;
}

/**
 * What makes two chapters the same one: case and spacing aside, and "3",
 * "03", "Chapter 3", "ch. 3" and "Ch 3" all one. A word after the number
 * ("Chapter 3: The Letter") keeps it a chapter of its own.
 */
export function chapterKey(chapter: string | null | undefined): string | null {
  const t = tidyChapter(chapter)?.toLowerCase();
  if (!t) return null;
  // A Roman numeral needs a space or a dot after the "ch", or "Chi" would
  // be chapter i.
  const m = /^(?:chapter|chap\.?|ch\.?)\s*(\d+)$/.exec(t) ?? /^(?:chapter|chap\.?|ch\.?)(?:\s+|(?<=\.))([mdclxvi]+)$/.exec(t);
  const bare = m ? m[1] : t;
  return /^\d+$/.test(bare) ? String(Number(bare)) : bare;
}

/** How a chapter is shown: a bare number or Roman numeral reads "Chapter
 *  3"; anything else as it was typed. */
export function chapterLabel(chapter: string | null | undefined): string | null {
  const t = tidyChapter(chapter);
  if (!t) return null;
  return /^\d+$/.test(t) || ROMAN.test(t) ? `Chapter ${t}` : t;
}

const hasPage = (e: TimelineEntry) => e.page != null && e.page > 0;

const byTime = (a: TimelineEntry, b: TimelineEntry) =>
  a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const byPage = (a: TimelineEntry, b: TimelineEntry) =>
  a.page! - b.page! || (a.kind === b.kind ? 0 : a.kind === "quote" ? -1 : 1) || byTime(a, b);

/** The notes and quotes of a book in book order, in sections by chapter
 *  (see the top of this file). */
export function arrangeTimeline<T extends TimelineEntry>(entries: readonly T[]): TimelineSection<T>[] {
  const paged = entries.filter(hasPage).sort(byPage);
  const lastIndex = new Map<string, number>();
  paged.forEach((e, i) => {
    const key = chapterKey(e.chapter);
    if (key !== null) lastIndex.set(key, i);
  });

  // Entries with no page: those of a chapter placed by its pages wait for
  // the end of it; the rest go after the paged ones, a chapter at a time,
  // in the order each chapter was first written in, and then the ones with
  // no chapter.
  const waiting = new Map<string | null, T[]>();
  const tail = new Map<string | null, T[]>();
  for (const e of entries.filter((e) => !hasPage(e)).sort(byTime)) {
    const key = chapterKey(e.chapter);
    const into = key !== null && lastIndex.has(key) ? waiting : tail;
    into.set(key, [...(into.get(key) ?? []), e]);
  }

  const sections: TimelineSection<T>[] = [];
  const push = (e: T, paged: boolean) => {
    const key = chapterKey(e.chapter);
    const last = sections[sections.length - 1];
    if (last && last.key === key && last.paged === paged) last.entries.push(e);
    else sections.push({ key, label: chapterLabel(e.chapter), paged, entries: [e] });
  };
  paged.forEach((e, i) => {
    push(e, true);
    const key = chapterKey(e.chapter);
    if (key !== null && lastIndex.get(key) === i) {
      for (const w of waiting.get(key) ?? []) push(w, true);
    }
  });
  const unchaptered = tail.get(null) ?? [];
  tail.delete(null);
  for (const list of tail.values()) for (const e of list) push(e, false);
  for (const e of unchaptered) push(e, false);
  return sections;
}

/** Where each chapter starts, by the first page anything of it names, in
 *  book order: the dividers on the strip of the book. */
export function chapterStarts(
  entries: readonly TimelineEntry[],
): { key: string; label: string; page: number }[] {
  const first = new Map<string, { key: string; label: string; page: number }>();
  for (const e of [...entries].filter(hasPage).sort(byPage)) {
    const key = chapterKey(e.chapter);
    if (key !== null && !first.has(key)) first.set(key, { key, label: chapterLabel(e.chapter)!, page: e.page! });
  }
  return [...first.values()];
}

/**
 * The chapters this book's notes and quotes name, as typed the first time,
 * in book order and then the unplaced ones: what the chapter box offers.
 */
export function chapterChoices(entries: readonly TimelineEntry[]): string[] {
  const out = new Map<string, string>();
  for (const section of arrangeTimeline(entries)) {
    for (const e of section.entries) {
      const key = chapterKey(e.chapter);
      if (key !== null && !out.has(key)) out.set(key, tidyChapter(e.chapter)!);
    }
  }
  return [...out.values()];
}

/**
 * The last page the strip of the book runs to: the book's page count, or
 * the furthest page named when that's further (or the count isn't known).
 * Null when nothing names a page, and the strip isn't drawn.
 */
export function stripEnd(
  pageCount: number | null,
  entries: readonly TimelineEntry[],
  currentPage: number | null = null,
): number | null {
  const pages = entries.filter(hasPage).map((e) => e.page!);
  if (pages.length === 0) return null;
  return Math.max(pageCount ?? 0, currentPage ?? 0, ...pages);
}

/** How far along the strip a page sits, 0 at page 1 to 1 at `end`. */
export function stripAt(page: number, end: number): number {
  if (end <= 1) return 0;
  return Math.min(Math.max((page - 1) / (end - 1), 0), 1);
}

/** Same rule as the reading card: a page past the end is a typo, and the
 *  entry would sort after every other. */
export function pagePastTheEnd(page: number | null | undefined, pageCount: number | null): string | null {
  return page && pageCount != null && page > pageCount
    ? `Page ${page} is past the end of the book (${pageCount} pages)`
    : null;
}
