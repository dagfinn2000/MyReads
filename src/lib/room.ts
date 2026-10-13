import { BookOwnership, ReadingStatus } from "@prisma/client";
import { hash } from "@/lib/cover-art";

/**
 * The reading room (components/reading-room.tsx): the library drawn as a
 * little pixel-art house, one spine per book, that grows a bookcase at a
 * time and a floor at a time as books are added. This file is the layout,
 * kept free of React so it can be tested: how big each spine is, which
 * shelf it stands on, and where the bookcases and furniture go.
 *
 * Every size here is in dots, one pixel of the pixel art. The room scales a
 * dot up to two or three screen pixels, always a whole number, so edges
 * stay crisp.
 */

/** Inside width of one shelf. */
export const SHELF_WIDTH = 40;
export const SHELVES_PER_CASE = 5;
/** Clear height above each shelf board; the tallest spine is 18. */
export const SHELF_SLOT = 20;
export const SHELF_BOARD = 3;
/** The moulding along the top of a bookcase, and the plinth under it. */
export const CASE_CROWN = 5;
export const CASE_PLINTH = 5;
export const CASE_WIDTH = SHELF_WIDTH + 6;
export const CASE_HEIGHT =
  CASE_CROWN + SHELVES_PER_CASE * (SHELF_SLOT + SHELF_BOARD) + CASE_PLINTH;
/** Floor to ceiling inside one storey. */
export const ROOM_HEIGHT = CASE_HEIGHT + 14;
/** The floor (or ceiling) between storeys, and the outside walls. */
export const BEAM = 5;
export const WALL = 5;
/** Space between two pieces of furniture, and between one and a wall.
 *  Bookcases next to each other touch, as they would along a real wall. */
export const GAP = 4;
export const PAD = 4;

/** The fields the room needs from a book. */
export interface RoomBook {
  id: string;
  title: string;
  /** All authors, joined: "Terry Pratchett, Neil Gaiman". */
  author: string;
  coverUrl: string | null;
  pageCount: number | null;
  currentPage: number | null;
  status: ReadingStatus;
  ownership: BookOwnership;
  /** Who has it, while it is lent out. */
  lentTo: string | null;
}

export interface Spine {
  /** 3–6 dots: thicker books are wider. */
  width: number;
  /** 14–18 dots. */
  height: number;
  /** Which of the five spine patterns (bands, a label, …) it wears. */
  pattern: number;
}

/** A book's spine. The size comes from its page count, the height and
 *  pattern from its title, so a book looks the same on every visit. */
export function spineFor(book: Pick<RoomBook, "title" | "pageCount">): Spine {
  const pages = book.pageCount ?? 0;
  const width = !pages ? 4 : pages < 200 ? 3 : pages < 420 ? 4 : pages < 700 ? 5 : 6;
  const h = hash(book.title.trim().toLowerCase());
  return { width, height: 14 + ((h >>> 3) % 5), pattern: (h >>> 11) % 5 };
}

/** Whether the book is actually on the shelf, rather than wished for, lent
 *  out or given away. Those keep their place on the shelf as an outline. */
export function isOnShelf(book: Pick<RoomBook, "ownership" | "lentTo">): boolean {
  return (
    (book.ownership === BookOwnership.OWNED || book.ownership === BookOwnership.BORROWED) &&
    !book.lentTo
  );
}

/**
 * Stands the spines on shelves in order, starting a new shelf when the
 * next one wouldn't fit. Returns each shelf as the indexes of its books.
 * There is always at least one shelf, even with no books.
 */
export function shelve(widths: readonly number[]): number[][] {
  const shelves: number[][] = [[]];
  let used = 0;
  widths.forEach((w, i) => {
    if (used + w > SHELF_WIDTH) {
      shelves.push([]);
      used = 0;
    }
    shelves[shelves.length - 1].push(i);
    used += w;
  });
  return shelves;
}

export type PieceKind =
  | "hearth"
  | "case"
  | "ladder"
  | "plant"
  | "clock"
  | "seat"
  | "study"
  | "gramophone";

/** How wide each piece of furniture stands. The hearth is the fireplace,
 *  armchair, side table and lamp together. The ladder leans on the end of
 *  a row of bookcases and takes a little more room than this. */
export const PIECE_WIDTH: Record<PieceKind, number> = {
  hearth: 104,
  case: CASE_WIDTH,
  ladder: 8,
  plant: 16,
  clock: 16,
  seat: 52,
  study: 50,
  gramophone: 24,
};

/** How many books it takes for each piece of furniture (and the cat) to
 *  move in. The hearth and the first bookcase are always there. */
export const MILESTONES = {
  plant: 10,
  cat: 25,
  clock: 50,
  ladder: 100,
  seat: 150,
  study: 250,
  gramophone: 400,
} as const;

/** The big pieces that start an upper floor, in the order they arrive. */
const FLOOR_STARTERS = ["seat", "study", "gramophone"] as const;
/** The small ones that fill in wherever there is room. */
const FILLERS = ["plant", "clock"] as const;

export interface Piece {
  kind: PieceKind;
  /** Left edge, from the inside of the house's left wall. */
  x: number;
  /** For a bookcase: which one, counting in reading order (top floor
   *  first, left to right). */
  caseIndex?: number;
}

export interface HousePlan {
  /** Inside width of the house, wall to wall. */
  inner: number;
  /** Top floor first, so the page reads top to bottom. */
  floors: Piece[][];
  /** The cat asleep on the armchair. */
  cat: boolean;
}

/** Bookcases stand side by side, and the ladder leans on the last one;
 *  anything else has a gap before it. */
function touches(kinds: readonly PieceKind[], i: number): boolean {
  return i > 0 && (kinds[i] === "case" || kinds[i] === "ladder") && kinds[i - 1] === "case";
}

/** The space a row of pieces needs at its tightest: the gaps between
 *  pieces, and room at both walls. */
function rowWidth(kinds: readonly PieceKind[]): number {
  let width = 2 * PAD;
  kinds.forEach((kind, i) => {
    width += PIECE_WIDTH[kind];
    if (i > 0 && !touches(kinds, i)) width += GAP;
  });
  return width;
}

/** Where a filler goes in a row: the clock in the middle of the
 *  bookcases, the plant at the end. */
function withFiller(kinds: readonly PieceKind[], filler: PieceKind): PieceKind[] {
  if (filler === "clock") {
    const cases = kinds.flatMap((k, i) => (k === "case" ? [i] : []));
    if (cases.length >= 2) {
      const at = cases[Math.floor(cases.length / 2)];
      return [...kinds.slice(0, at), filler, ...kinds.slice(at)];
    }
  }
  return [...kinds, filler];
}

/**
 * Lays out the house: `caseCount` bookcases (at least one), plus the
 * furniture `bookCount` books have earned, in a house no wider inside than
 * `maxInner`.
 *
 * The ground floor has the hearth and as many bookcases as fit beside it.
 * When it is full a floor is added on top, opening with the next big piece
 * of furniture (a window seat, a study, a gramophone) and then bookcases,
 * so a growing library grows a taller house. A small library gets a
 * cottage only as wide as it needs. Furniture that has arrived but has no
 * room waits for a floor with space.
 */
export function planHouse(caseCount: number, bookCount: number, maxInner: number): HousePlan {
  const has = (k: keyof typeof MILESTONES) => bookCount >= MILESTONES[k];
  const starters: PieceKind[] = FLOOR_STARTERS.filter(has);
  const fillers: PieceKind[] = FILLERS.filter(has);
  const fits = (kinds: PieceKind[]) => rowWidth(kinds) <= maxInner;

  // Bottom floor first while building.
  const rows: PieceKind[][] = [];
  let row: PieceKind[] = ["hearth"];
  let left = Math.max(1, caseCount);
  for (;;) {
    // A floor always takes at least one bookcase unless it already holds
    // something, so a house narrower than a bookcase still ends.
    while (left > 0 && (fits([...row, "case"]) || row.length === 0)) {
      row.push("case");
      left--;
    }
    rows.push(row);
    if (left === 0) break;
    row = [];
    if (starters.length && fits([starters[0], "case"])) row.push(starters.shift()!);
  }

  // Furniture still waiting goes wherever it fits, top floor first: that
  // is the newest floor, and usually the emptiest.
  for (const kind of [...starters, ...fillers]) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const next = starters.includes(kind) ? [kind, ...rows[i]] : withFiller(rows[i], kind);
      if (fits(next)) {
        rows[i] = next;
        break;
      }
    }
  }

  // The ladder leans on the end of the highest row of two or more
  // bookcases that has room for it.
  if (has("ladder")) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const last = rows[i].lastIndexOf("case");
      if (last < 1 || rows[i][last - 1] !== "case") continue;
      const next = [...rows[i].slice(0, last + 1), "ladder" as const, ...rows[i].slice(last + 1)];
      if (fits(next)) {
        rows[i] = next;
        break;
      }
    }
  }

  const inner = Math.max(...rows.map(rowWidth));
  rows.reverse();

  let caseIndex = 0;
  const floors = rows.map((kinds) => {
    // Spread the spare width evenly over the walls and the gaps between
    // pieces; bookcases stay together.
    const flexible = 2 + kinds.filter((_, i) => i > 0 && !touches(kinds, i)).length;
    const spare = inner - rowWidth(kinds);
    let slot = 0;
    const share = () => {
      const s = Math.floor((spare * (slot + 1)) / flexible) - Math.floor((spare * slot) / flexible);
      slot++;
      return s;
    };
    let x = PAD + share();
    return kinds.map((kind, i): Piece => {
      if (i > 0 && !touches(kinds, i)) x += GAP + share();
      const piece: Piece = { kind, x };
      if (kind === "case") piece.caseIndex = caseIndex++;
      x += PIECE_WIDTH[kind];
      return piece;
    });
  });

  return { inner, floors, cat: has("cat") };
}

/** How many bookcases a list of shelves fills. */
export function caseCount(shelfCount: number): number {
  return Math.max(1, Math.ceil(shelfCount / SHELVES_PER_CASE));
}

/** Little things that stand on a shelf's spare space. */
export type Ornament = "plant" | "candle" | "vase" | "frame" | "globe" | "hourglass" | "teapot";
export const ORNAMENT_WIDTH: Record<Ornament, number> = {
  plant: 6,
  candle: 3,
  vase: 5,
  frame: 7,
  globe: 7,
  hourglass: 5,
  teapot: 8,
};
const ORNAMENTS = Object.keys(ORNAMENT_WIDTH) as Ornament[];
export const BOOKEND_WIDTH = 3;

export interface ShelfDressing {
  /** A bookend after the last book, on a shelf that isn't full. */
  bookend: boolean;
  /** Ornaments on the rest, each with its left edge on the shelf. */
  ornaments: { kind: Ornament; x: number }[];
}

/**
 * What stands on a shelf beside its books (`used` dots of them): a bookend
 * when there is room for one, then an ornament or two on space a book
 * would leave bare. Shelf `n` (counting from the first) always gets the
 * same ones.
 */
export function dressShelf(n: number, used: number): ShelfDressing {
  const free = SHELF_WIDTH - used;
  const bookend = used > 0 && free >= BOOKEND_WIDTH + 2;
  const start = used + (bookend ? BOOKEND_WIDTH : 0);
  const room = SHELF_WIDTH - start;
  const ornaments: ShelfDressing["ornaments"] = [];
  if (room < 9) return { bookend, ornaments };

  const h = hash(`shelf ${n}`);
  const first = ORNAMENTS[h % ORNAMENTS.length];
  const second = ORNAMENTS[(h >>> 8) % ORNAMENTS.length];
  // One ornament in the middle of the space, or two spread out when it is
  // a whole bare shelf.
  const picks = room >= 30 && second !== first ? [first, second] : [first];
  picks.forEach((kind, i) => {
    const centre = start + (room * (2 * i + 1)) / (2 * picks.length);
    ornaments.push({ kind, x: Math.round(centre - ORNAMENT_WIDTH[kind] / 2) });
  });
  return { bookend, ornaments };
}
