/**
 * Which characters roll when a line with numbers in it changes
 * (components/rolling-number.tsx): the digits that changed, wheel by wheel
 * like a counter's. The numbers in the two lines are paired in order and
 * their digits lined up from the right, so 99 → 100 turns both nines over
 * and rolls a 1 in from blank. When the words between the numbers differ
 * ("Not started" → "12 of 300"), nothing rolls: it's a new line, not the
 * same one counting on.
 */

export type RollCell =
  | { kind: "still"; char: string }
  | {
      kind: "roll";
      char: string;
      /** The digit it turns over from, or "" for none (a new place). */
      from: string;
      /** Up when the number grew, down when it fell. */
      dir: "up" | "down";
      /** Its turn among the wheels of its number that move, from the
       *  right: the units first, then the tens a moment later. */
      delay: number;
    };

/** A number as the app writes one, with its thousands and decimal marks. */
const NUMBER = /\d(?:[\d.,  ]*\d)?/g;
const DIGIT = /\d/;

function split(text: string): { numbers: string[]; words: string[] } {
  const numbers: string[] = [];
  const words: string[] = [];
  let at = 0;
  for (const m of text.matchAll(NUMBER)) {
    words.push(text.slice(at, m.index));
    numbers.push(m[0]);
    at = m.index! + m[0].length;
  }
  words.push(text.slice(at));
  return { numbers, words };
}

const valueOf = (n: string) => Number(n.replace(/\D/g, ""));

export function rollPlan(from: string, to: string): RollCell[] | null {
  const a = split(from);
  const b = split(to);
  if (a.numbers.length !== b.numbers.length || a.words.some((w, i) => w !== b.words[i])) return null;
  const cells: RollCell[] = [];
  const still = (text: string) => {
    for (const char of text) cells.push({ kind: "still", char });
  };
  b.numbers.forEach((n, i) => {
    still(b.words[i]);
    const o = a.numbers[i];
    const dir = valueOf(n) >= valueOf(o) ? "up" : "down";
    const run: RollCell[] = [];
    let turn = 0;
    for (let k = 0; k < n.length; k++) {
      const char = n[n.length - 1 - k];
      const was = o[o.length - 1 - k];
      if (!DIGIT.test(char) || char === was) {
        run.push({ kind: "still", char });
        continue;
      }
      run.push({ kind: "roll", char, from: was && DIGIT.test(was) ? was : "", dir, delay: turn++ });
    }
    cells.push(...run.reverse());
  });
  still(b.words[b.words.length - 1]);
  return cells;
}
