/**
 * Fine typesetting for text the reader brings in: book titles, authors,
 * series, descriptions, reviews, quotes and notes, as typed or as a
 * catalogue sent them. Straight quotes become curly ones (“ ” ‘ ’), an
 * apostrophe the right way round (Ender’s, ’90s, rock ’n’ roll), two or
 * three hyphens an em dash, a hyphen with a space each side an en dash,
 * and three dots an ellipsis. Only for showing: what is saved, searched
 * and edited stays exactly as typed. Web addresses are left alone.
 */

/** Words that start with an apostrophe standing for missing letters, so it
 *  points the closing way even at the start of a word. */
const ELIDED = /(?:tis|twas|til|till|em|cause|cos|bout|round|n|nuff|sup)\b/iy;
/** A decade cut short: ’90s. */
const DECADE = /\d\ds?\b/y;

/** What may come just before an opening quote: the start, a space, an
 *  opening bracket, a dash or the other kind of quote. */
const OPENS_AFTER = /[\s([{—–\-/“‘"']/;

const NEEDS_WORK = /["']|--|\s-\s|\.\.\./;
const ADDRESS = /(\bhttps?:\/\/\S+|\bwww\.\S+)/;

export function fineText(text: string): string;
export function fineText(text: string | null | undefined): string | null | undefined;
export function fineText(text: string | null | undefined): string | null | undefined {
  if (!text || !NEEDS_WORK.test(text)) return text;
  // Odd pieces are web addresses (the split keeps them).
  return text
    .split(ADDRESS)
    .map((part, i) => (i % 2 ? part : setPart(part)))
    .join("");
}

function setPart(text: string): string {
  const dashed = text
    .replace(/(?<!\.)\.\.\.(?!\.)/g, "…")
    .replace(/(?<![-\s])-{2,3}(?!-)|(?<=\s)-{2,3}(?=\s)/g, "—")
    .replace(/(?<=\S) - (?=\S)/g, " – ");
  let out = "";
  for (let i = 0; i < dashed.length; i++) {
    const ch = dashed[i];
    if (ch !== '"' && ch !== "'") {
      out += ch;
      continue;
    }
    const before = i === 0 ? " " : dashed[i - 1];
    const after = dashed[i + 1] ?? " ";
    const opens = OPENS_AFTER.test(before) && /\S/.test(after);
    if (ch === '"') {
      out += opens ? "“" : "”";
    } else if (opens && !startsWith(ELIDED, dashed, i + 1) && !startsWith(DECADE, dashed, i + 1)) {
      out += "‘";
    } else {
      out += "’";
    }
  }
  return out;
}

/** Whether the sticky `pattern` matches `text` at `at`. */
function startsWith(pattern: RegExp, text: string, at: number): boolean {
  pattern.lastIndex = at;
  return pattern.test(text);
}
