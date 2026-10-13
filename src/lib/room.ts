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

/** Furniture the reader can move about (Decorate › Arrange). Bookcases
 *  keep to the order of the books, and the ladder to the bookcases. */
export const MOVABLE = ["hearth", "seat", "study", "gramophone", "plant", "clock"] as const;
export type Movable = (typeof MOVABLE)[number];
/** Furniture that can be put away. The hearth stays: it is where the
 *  reading happens. */
export const STOWABLE = ["seat", "study", "gramophone", "plant", "clock", "ladder"] as const;
export type Stowable = (typeof STOWABLE)[number];

/** What the furniture is called in Decorate. */
export const FURNITURE_LABELS: Record<Movable | Stowable, string> = {
  hearth: "Fireplace and armchair",
  seat: "Window seat",
  study: "Writing desk",
  gramophone: "Gramophone",
  plant: "Plant",
  clock: "Grandfather clock",
  ladder: "Library ladder",
};

/** Where the reader has put a piece: on which floor, counting up from the
 *  ground floor (0), and how many things stand to its left there,
 *  bookcases included and the ladder not. */
export interface Placement {
  kind: Movable;
  floor: number;
  slot: number;
}

export interface Arrangement {
  places: readonly Placement[];
  away: readonly Stowable[];
}

export const NO_ARRANGEMENT: Arrangement = { places: [], away: [] };

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

/** `pins` (in slot order) placed into `row` at their slots. */
function withPins(row: readonly PieceKind[], pins: readonly { kind: PieceKind; slot: number }[]): PieceKind[] {
  const out = [...row];
  for (const p of pins) out.splice(Math.min(p.slot, out.length), 0, p.kind);
  return out;
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
 *
 * `arrangement` is where the reader has moved furniture to, and what they
 * have put away. A moved piece keeps its floor and place among its
 * neighbours whenever it fits there; on a screen too narrow for that, or
 * with fewer floors than it was put on, it goes wherever it would have
 * gone by itself. No floor is added just to hold furniture.
 */
export function planHouse(
  caseCount: number,
  bookCount: number,
  maxInner: number,
  arrangement: Arrangement = NO_ARRANGEMENT,
): HousePlan {
  const away = new Set<string>(arrangement.away);
  const has = (k: keyof typeof MILESTONES) => bookCount >= MILESTONES[k] && !away.has(k);
  const fits = (kinds: PieceKind[]) => rowWidth(kinds) <= maxInner;

  // Moved pieces, by floor and in slot order; one place per piece.
  const pinned = new Set<PieceKind>();
  const pinsByFloor = new Map<number, { kind: PieceKind; slot: number }[]>();
  for (const p of arrangement.places) {
    if (pinned.has(p.kind) || (p.kind !== "hearth" && !has(p.kind))) continue;
    pinned.add(p.kind);
    pinsByFloor.set(p.floor, [...(pinsByFloor.get(p.floor) ?? []), { kind: p.kind, slot: p.slot }]);
  }
  for (const pins of pinsByFloor.values()) pins.sort((a, b) => a.slot - b.slot);
  // As many floors as the house would have by itself: moving the hearth
  // upstairs frees room on the ground floor, but shouldn't squeeze the
  // furniture out of the floors it was moved to.
  const ownFloors = pinned.size
    ? planHouse(caseCount, bookCount, maxInner, { places: [], away: arrangement.away }).floors.length
    : 0;

  const starters: PieceKind[] = FLOOR_STARTERS.filter((k) => has(k) && !pinned.has(k));
  const fillers: PieceKind[] = FILLERS.filter((k) => has(k) && !pinned.has(k));
  /** Moved pieces that couldn't keep their place, and go where they would
   *  have gone by themselves. */
  const homeless: PieceKind[] = [];

  // Bottom floor first while building.
  const rows: PieceKind[][] = [];
  const rowPins: { kind: PieceKind; slot: number }[][] = [];
  let left = Math.max(1, caseCount);
  for (let f = 0; ; f++) {
    const pins = [...(pinsByFloor.get(f) ?? [])];
    // Moved pieces have to leave room for a bookcase, so a floor can't fill
    // up with furniture alone.
    while (pins.length && !fits([...pins.map((p) => p.kind), "case"])) homeless.push(pins.pop()!.kind);
    const fixed = pins.map((p) => p.kind);
    const row: PieceKind[] = [];
    if (f === 0 && !pinned.has("hearth")) row.push("hearth");
    else if (f > 0 && !pins.length && starters.length && fits([starters[0], "case"])) {
      row.push(starters.shift()!);
    }
    // A floor always takes at least one bookcase unless it already holds
    // something, so a house narrower than a bookcase still ends.
    while (left > 0 && (fits([...fixed, ...row, "case"]) || fixed.length + row.length === 0)) {
      row.push("case");
      left--;
    }
    rows.push(row);
    rowPins.push(pins);
    if (left === 0) {
      // The bookcases are all in. Furniture moved to a higher floor still
      // gets one, up to the floors the house would have had; anything
      // further up finds a place below.
      const higher = [...pinsByFloor.keys()].filter((fl) => fl > f).sort((a, b) => a - b);
      for (const fl of higher.filter((fl) => fl >= ownFloors)) {
        homeless.push(...pinsByFloor.get(fl)!.map((p) => p.kind));
      }
      const next = higher.find((fl) => fl < ownFloors);
      if (next === undefined) break;
      if (next !== f + 1) {
        pinsByFloor.set(f + 1, pinsByFloor.get(next)!);
        pinsByFloor.delete(next);
      }
    }
  }

  // Furniture still waiting goes wherever it fits, top floor first: that
  // is the newest floor, and usually the emptiest. The hearth and the big
  // pieces open a floor; the small ones fill in.
  const big = (k: PieceKind) => k === "hearth" || (FLOOR_STARTERS as readonly PieceKind[]).includes(k);
  for (const kind of [...homeless.filter(big), ...starters, ...fillers, ...homeless.filter((k) => !big(k))]) {
    let placed = false;
    for (let i = rows.length - 1; i >= 0 && !placed; i--) {
      const next = big(kind) ? [kind, ...rows[i]] : withFiller(rows[i], kind);
      if (fits(withPins(next, rowPins[i]))) {
        rows[i] = next;
        placed = true;
      }
    }
    // The hearth is never left out: with no room anywhere it stands on the
    // ground floor all the same, as it always has in a narrow house.
    if (!placed && kind === "hearth") rows[0].unshift(kind);
  }
  for (let i = 0; i < rows.length; i++) rows[i] = withPins(rows[i], rowPins[i]);

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

export const isMovable = (k: PieceKind): k is Movable => (MOVABLE as readonly string[]).includes(k);

/** Where every movable piece stands in a plan, as placements that would
 *  put it back exactly there. */
export function placementsOf(plan: HousePlan): Placement[] {
  const out: Placement[] = [];
  plan.floors.forEach((floor, f) => {
    const fromGround = plan.floors.length - 1 - f;
    floor
      .filter((p) => p.kind !== "ladder")
      .forEach((p, slot) => {
        if (isMovable(p.kind)) out.push({ kind: p.kind, floor: fromGround, slot });
      });
  });
  return out;
}

/**
 * Every movable piece where it stands now, with `kind` moved to `floor`
 * (from the ground) and `slot` there. Pinning them all, not just the one
 * that moved, keeps the rest from rearranging themselves around it.
 * Null when the house has no such floor or the piece isn't in it.
 */
export function moveTo(plan: HousePlan, kind: Movable, floor: number, slot: number): Placement[] | null {
  if (floor < 0 || floor >= plan.floors.length) return null;
  const rows = plan.floors.map((f) => f.filter((p) => p.kind !== "ladder").map((p) => p.kind)).reverse();
  const from = rows.findIndex((r) => r.includes(kind));
  if (from < 0) return null;
  rows[from].splice(rows[from].indexOf(kind), 1);
  rows[floor].splice(Math.max(0, Math.min(slot, rows[floor].length)), 0, kind);
  return rows.flatMap((row, f) =>
    row.flatMap((k, s) => (isMovable(k) ? [{ kind: k, floor: f, slot: s }] : [])),
  );
}

/** Where a piece goes when nudged one step: along its floor, or to the
 *  floor above or below at about the same place across. Null when it is
 *  already at that end, edge or floor. */
export function nudge(
  plan: HousePlan,
  kind: Movable,
  direction: "left" | "right" | "up" | "down",
): { floor: number; slot: number } | null {
  const here = placementsOf(plan).find((p) => p.kind === kind);
  if (!here) return null;
  const rowOf = (fromGround: number) =>
    plan.floors[plan.floors.length - 1 - fromGround].filter((p) => p.kind !== "ladder");
  const row = rowOf(here.floor);
  if (direction === "left") return here.slot > 0 ? { floor: here.floor, slot: here.slot - 1 } : null;
  if (direction === "right") {
    return here.slot < row.length - 1 ? { floor: here.floor, slot: here.slot + 1 } : null;
  }
  const floor = here.floor + (direction === "up" ? 1 : -1);
  if (floor < 0 || floor >= plan.floors.length) return null;
  // The slot on the new floor nearest the piece's middle across the room.
  const middle = row[here.slot].x + PIECE_WIDTH[kind] / 2;
  const target = rowOf(floor);
  const slot = target.filter((p) => p.x + PIECE_WIDTH[p.kind] / 2 < middle).length;
  return { floor, slot };
}

/** `kind` put away. Whatever stood to its right on its floor moves up a
 *  place, so the rest stay where they were. */
export function putAway(a: Arrangement, kind: Stowable): Arrangement {
  const was = a.places.find((p) => p.kind === kind);
  const places = a.places
    .filter((p) => p.kind !== kind)
    .map((p) => (was && p.floor === was.floor && p.slot > was.slot ? { ...p, slot: p.slot - 1 } : p));
  return { places, away: [...a.away, kind] };
}

/** `kind` out again, wherever it goes by itself. */
export const bringOut = (a: Arrangement, kind: Stowable): Arrangement => ({
  places: a.places,
  away: a.away.filter((k) => k !== kind),
});

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
