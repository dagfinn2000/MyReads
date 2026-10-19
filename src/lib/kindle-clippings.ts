import { foldForSearch } from "@/lib/utils";

/**
 * Kindle highlights for the quotes page's "Import from Kindle". A Kindle
 * keeps every highlight, note and bookmark in `My Clippings.txt`, one
 * clipping after another, each ended by a line of "==========":
 *
 *   The Name of the Wind (Patrick Rothfuss)
 *   - Your Highlight on page 12 | Location 180-182 | Added on Sunday, 5 March 2023 21:14:03
 *
 *   The text that was highlighted.
 *   ==========
 *
 * The file is read in the browser, so this is pure: it turns the file into
 * books with their highlights (notes attached, repeats dropped) and finds
 * each book in the library. Kindles set to other languages word the second
 * line differently; the common ones are recognised, and a clipping that
 * can't be placed is still taken as a highlight, just without its page.
 */

export interface KindleHighlight {
  text: string;
  page: number | null;
  /** The reader's notes on this highlight, joined. */
  note: string | null;
  /** When it was highlighted, as an ISO date, when the line could be read. */
  addedAt: string | null;
}

export interface KindleBook {
  /** Title and author as the file has them, folded: one book per key. */
  key: string;
  title: string;
  /** "Patrick Rothfuss", or "Terry Pratchett, Neil Gaiman"; null when the
   *  file has none. */
  author: string | null;
  highlights: KindleHighlight[];
  /** How many of the highlights carry a note. */
  notes: number;
  /** Notes that belong to no highlight here. They aren't imported: a note
   *  without its passage isn't a quote. */
  looseNotes: number;
}

type Kind = "highlight" | "note" | "bookmark";

interface Clipping {
  kind: Kind;
  title: string;
  author: string | null;
  page: number | null;
  location: { start: number; end: number } | null;
  addedAt: string | null;
  text: string;
}

const BOOKMARK = /bookmark|lesezeichen|signet|marque-page|marcador|segnalibro|bladwijzer|bokmerke/i;
const NOTE = /\b(note|notiz|nota|notitie|notat|anteckning)\b/i;
const LOCATION = /\b(location|loc\.|position|posición|emplacement|posizione|posição|positie|plassering)/i;
const ADDED = /\b(added|hinzugefügt|ajouté|añadido|aggiunto|adicionado|toegevoegd|lagt til)\b/i;
const CLIPPING_LIMIT = /^<\s*you have reached the clipping limit/i;

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];

/** "Dune: Deluxe Edition (Herbert, Frank)": the last bracket is the author,
 *  so "The Way of Kings (Stormlight 1) (Brandon Sanderson)" keeps its
 *  series in the title. */
function splitTitle(line: string): { title: string; author: string | null } {
  const m = /^(.*\S)\s*\(([^()]*)\)\s*$/.exec(line);
  if (!m || !m[2].trim()) return { title: line.trim(), author: null };
  return { title: m[1].trim(), author: displayAuthors(m[2]) };
}

/** "Pratchett, Terry;Gaiman, Neil" as "Terry Pratchett, Neil Gaiman". */
function displayAuthors(raw: string): string {
  return raw
    .split(";")
    .map((name) => {
      const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
      return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name.trim();
    })
    .filter(Boolean)
    .join(", ");
}

/** "180-182", or the old "180-82" short form. */
function parseRange(text: string): { start: number; end: number } | null {
  const m = /(\d+)(?:\s*-\s*(\d+))?/.exec(text);
  if (!m) return null;
  const start = Number(m[1]);
  let end = m[2] ? Number(m[2]) : start;
  if (m[2] && end < start && m[2].length < m[1].length) {
    end = Number(m[1].slice(0, m[1].length - m[2].length) + m[2]);
  }
  return { start, end: Math.max(end, start) };
}

/**
 * "Sunday, 5 March 2023 21:14:03" or "Sunday, March 5, 2023 9:14:03 PM",
 * taken as the reader's own clock, which is what the Kindle wrote. Null
 * for anything else (a Kindle in another language, say), and the quote
 * then dates from the import.
 */
export function parseAddedOn(text: string): string | null {
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?/i.exec(text);
  const dayFirst = /(\d{1,2})\.?\s+([a-z]+)\.?,?\s+(\d{4})/i.exec(text);
  const monthFirst = /([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(text);
  let day: number, monthName: string, year: number;
  if (dayFirst) {
    [day, monthName, year] = [Number(dayFirst[1]), dayFirst[2], Number(dayFirst[3])];
  } else if (monthFirst) {
    [monthName, day, year] = [monthFirst[1], Number(monthFirst[2]), Number(monthFirst[3])];
  } else {
    return null;
  }
  const month = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase());
  if (month < 0 || day < 1 || day > 31) return null;
  let hour = time ? Number(time[1]) : 12;
  const minute = time ? Number(time[2]) : 0;
  const second = time?.[3] ? Number(time[3]) : 0;
  const half = time?.[4]?.toLowerCase().replace(/[^ap]/g, "");
  if (half === "p" && hour < 12) hour += 12;
  if (half === "a" && hour === 12) hour = 0;
  const date = new Date(year, month, day, hour, minute, second);
  return date.getDate() === day ? date.toISOString() : null;
}

/** The "- Your Highlight on page 12 | Location 180-182 | Added on …" line. */
function parseMeta(line: string): Pick<Clipping, "kind" | "page" | "location" | "addedAt"> {
  const parts = line.replace(/^-\s*/, "").split("|").map((p) => p.trim());
  const kind: Kind = BOOKMARK.test(parts[0]) ? "bookmark" : NOTE.test(parts[0]) ? "note" : "highlight";
  let page: number | null = null;
  let location: Clipping["location"] = null;
  let addedAt: string | null = null;
  for (const [i, part] of parts.entries()) {
    if (ADDED.test(part) || (i === parts.length - 1 && i > 0 && /\d{4}/.test(part))) {
      addedAt = parseAddedOn(part.replace(ADDED, "").replace(/^\s*(on|am|le|el|il|em|op|den)\b/i, ""));
    } else if (LOCATION.test(part)) {
      location = parseRange(part.replace(/^.*?(\d)/, "$1"));
    } else if (page === null) {
      // "on page 12", "auf Seite 12": the first other number is the page.
      // Roman numbers in the front matter give none.
      const n = /(\d+)/.exec(part);
      if (n) page = Number(n[1]) || null;
    }
  }
  return { kind, page, location, addedAt };
}

function parseClipping(chunk: string): Clipping | null {
  const lines = chunk.split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length < 2 || !lines[1].trim().startsWith("-")) return null;
  const { title, author } = splitTitle(lines[0]);
  if (!title) return null;
  const text = lines.slice(2).join("\n").trim();
  return { ...parseMeta(lines[1].trim()), title, author, text };
}

/** Text as compared for repeats: case, spacing and curly quotes aside. */
export function quoteKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function overlaps(a: Clipping["location"], b: Clipping["location"]): boolean {
  if (!a || !b) return true;
  return a.start <= b.end && b.start <= a.end;
}

interface Kept {
  clip: Clipping;
  key: string;
  notes: string[];
}

const NOTE_MAX = 2000;

function bookFrom(clips: Clipping[]): KindleBook {
  const first = clips[0];
  const kept: Kept[] = [];
  for (const clip of clips) {
    if (clip.kind !== "highlight") continue;
    const key = quoteKey(clip.text);
    // A highlight made longer or shorter on the Kindle stays in the file
    // next to the new one: the later one wins.
    const i = kept.findIndex(
      (k) =>
        k.key === key ||
        ((k.key.includes(key) || key.includes(k.key)) && overlaps(k.clip.location, clip.location)),
    );
    if (i >= 0) kept.splice(i, 1);
    kept.push({ clip, key, notes: [] });
  }

  let looseNotes = 0;
  for (const note of clips) {
    if (note.kind !== "note") continue;
    // A note sits at the last location of the passage it was made on; a
    // PDF only has pages.
    const at = note.location?.start;
    const home =
      at !== undefined
        ? (kept.findLast((k) => k.clip.location?.end === at) ??
          kept.findLast((k) => k.clip.location && k.clip.location.start <= at && at <= k.clip.location.end))
        : note.page !== null
          ? kept.findLast((k) => !k.clip.location && k.clip.page === note.page)
          : undefined;
    if (home) home.notes.push(note.text);
    else looseNotes++;
  }

  const highlights = kept.map(({ clip, notes }) => {
    const note = notes.join("\n\n");
    return {
      text: clip.text,
      page: clip.page,
      note: note ? (note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX - 1)}…` : note) : null,
      addedAt: clip.addedAt,
    };
  });
  return {
    key: bookKey(first.title, first.author),
    title: first.title,
    author: first.author,
    highlights,
    notes: highlights.filter((h) => h.note).length,
    looseNotes,
  };
}

function bookKey(title: string, author: string | null): string {
  return `${foldForSearch(title)}|${foldForSearch(author ?? "")}`;
}

/** Every book in the file with something to import, in title order. */
export function parseClippings(file: string): KindleBook[] {
  const byBook = new Map<string, Clipping[]>();
  const chunks = file.replace(/﻿/g, "").replace(/\r\n?/g, "\n").split(/^=+[ \t]*$/m);
  for (const chunk of chunks) {
    const clip = parseClipping(chunk);
    if (!clip || clip.kind === "bookmark" || !clip.text || CLIPPING_LIMIT.test(clip.text)) continue;
    const key = bookKey(clip.title, clip.author);
    const list = byBook.get(key);
    if (list) list.push(clip);
    else byBook.set(key, [clip]);
  }
  return [...byBook.values()]
    .map(bookFrom)
    .filter((b) => b.highlights.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}

// ---------------------------------------------------------------------------
// Finding the book in the library

export interface LibraryBookRef {
  id: string;
  title: string;
  authors: string[];
  format?: string;
}

/** A title for comparing: folded, without brackets, punctuation or a
 *  leading article. */
function titleKey(title: string): string {
  return foldForSearch(title)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(the|a|an) /, "");
}

/** The title before its subtitle: "Sapiens: A Brief History…" → "sapiens". */
function mainTitle(title: string): string {
  return titleKey(title.split(/:| [-–—] /)[0]);
}

/** Surnames from the file's author: "Herbert, Frank" or "Frank Herbert". */
function surnames(author: string | null): string[] {
  if (!author) return [];
  return author
    .split(/,|&| and /)
    .map((name) => foldForSearch(name).trim().split(/\s+/).pop() ?? "")
    .filter((s) => s.length > 1);
}

/**
 * The library book a Kindle book most likely is: the same title, or the
 * same title before a subtitle when the author matches too; the matching
 * author and then an e-book edition win a tie. Null when nothing is close
 * enough, and the reader picks.
 */
export function matchKindleBook(
  book: Pick<KindleBook, "title" | "author">,
  library: readonly LibraryBookRef[],
): string | null {
  const full = titleKey(book.title);
  const main = mainTitle(book.title);
  const names = surnames(book.author);
  if (!full) return null;
  let best: { id: string; score: number } | null = null;
  for (const candidate of library) {
    const theirFull = titleKey(candidate.title);
    const theirMain = mainTitle(candidate.title);
    let score = theirFull === full ? 4 : theirMain === main || theirFull === main || theirMain === full ? 2 : 0;
    if (score === 0) continue;
    const authors = foldForSearch(candidate.authors.join(" "));
    if (names.some((s) => authors.includes(s))) score += 2;
    else if (names.length && candidate.authors.length) score -= 1;
    if (candidate.format === "EBOOK") score += 0.1;
    if (score >= 3 && (!best || score > best.score)) best = { id: candidate.id, score };
  }
  return best?.id ?? null;
}
