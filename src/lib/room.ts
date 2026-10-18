import { BookOwnership, ReadingStatus } from "@/lib/enums";
import { hash } from "@/lib/cover-art";
import type { RoomOrnaments } from "@/lib/room-styles";

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
/** The wall between two rooms side by side on one storey, and the least
 *  room either of them gets there. */
export const PARTITION = 14;
export const MIN_SPAN = 60;

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

/** Rooms the reader can add to the house (Decorate › Rooms), each a floor
 *  of its own over the library, with its own furniture; the spare room
 *  comes empty, for whatever the reader puts in it. */
export const ROOMS = [
  "kitchen",
  "bedroom",
  "music",
  "conservatory",
  "games",
  "studio",
  "bathroom",
  "dining",
  "nursery",
  "workshop",
  "sauna",
  "spare",
] as const;
export type RoomKind = (typeof ROOMS)[number];

/** Each room's furniture, left to right. */
export const ROOM_PIECES = {
  kitchen: ["range", "dresser", "table"],
  bedroom: ["wardrobe", "bed", "nightstand"],
  music: ["piano", "harp", "cello"],
  conservatory: ["palm", "wicker", "birdcage", "ferns"],
  games: ["darts", "billiards", "chess"],
  studio: ["easel", "paints", "bust"],
  bathroom: ["bath", "washstand", "towels"],
  dining: ["sideboard", "dining", "cabinet"],
  nursery: ["cot", "toybox", "blocks"],
  workshop: ["workbench", "sawhorse", "toolchest"],
  sauna: ["benches", "heater", "bucket"],
  spare: [],
} as const satisfies Record<RoomKind, readonly string[]>;
export type RoomPiece = (typeof ROOM_PIECES)[RoomKind][number];
const ROOM_PIECE_LIST = Object.values(ROOM_PIECES).flat() as RoomPiece[];

export const ROOM_LABELS: Record<RoomKind, { name: string; blurb: string }> = {
  kitchen: { name: "Kitchen", blurb: "A range with the kettle on, a dresser of plates and the kitchen table." },
  bedroom: { name: "Bedroom", blurb: "A big bed under a quilt, a wardrobe and a bedside lamp." },
  music: { name: "Music room", blurb: "An upright piano, a harp and a cello." },
  conservatory: { name: "Conservatory", blurb: "A palm, ferns, a wicker chair and a songbird." },
  games: { name: "Games room", blurb: "A billiard table, a game of chess and a dartboard." },
  studio: { name: "Studio", blurb: "An easel, a table of paints and a marble bust." },
  bathroom: { name: "Bathroom", blurb: "A claw-foot bath full of bubbles, a washstand and a towel rail." },
  dining: { name: "Dining room", blurb: "A table laid for dinner under a chandelier, a sideboard and a china cabinet." },
  nursery: { name: "Nursery", blurb: "A cot with a mobile turning over it, a toy box and building blocks." },
  workshop: { name: "Woodshop", blurb: "A workbench under a wall of tools, a sawhorse and a tool chest." },
  sauna: { name: "Sauna", blurb: "Wooden benches, a stove with steam rising off its stones, and a bucket and ladle." },
  spare: { name: "Spare room", blurb: "An empty floor, for whatever furniture you like." },
};

/** Furniture the reader can add from Decorate's catalogue. Each goes
 *  wherever there is room for it, and can be moved like the rest. */
export const EXTRAS = [
  "sofa",
  "rocker",
  "aquarium",
  "dog",
  "armour",
  "chest",
  "coatstand",
  "telescope",
  "horse",
  "curios",
  "spinning",
  "beanbag",
  "parrot",
  "monstera",
  "mirror",
  "stove",
  "radio",
  "trolley",
  "dollhouse",
] as const;
export type Extra = (typeof EXTRAS)[number];
export const isExtra = (kind: string): kind is Extra => (EXTRAS as readonly string[]).includes(kind);

/** The room a room's piece of furniture comes with. */
export const roomOf = (kind: PieceKind): RoomKind | null =>
  ROOMS.find((r) => (ROOM_PIECES[r] as readonly string[]).includes(kind)) ?? null;

export type PieceKind =
  | "hearth"
  | "case"
  | "ladder"
  | "plant"
  | "clock"
  | "seat"
  | "study"
  | "gramophone"
  | RoomPiece
  | Extra;

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
  range: 34,
  dresser: 36,
  table: 46,
  wardrobe: 30,
  bed: 50,
  nightstand: 14,
  piano: 44,
  harp: 20,
  cello: 14,
  palm: 22,
  wicker: 24,
  birdcage: 12,
  ferns: 18,
  darts: 14,
  billiards: 60,
  chess: 32,
  easel: 26,
  paints: 24,
  bust: 14,
  bath: 50,
  washstand: 22,
  towels: 14,
  sideboard: 34,
  dining: 50,
  cabinet: 22,
  cot: 40,
  toybox: 22,
  blocks: 16,
  workbench: 46,
  sawhorse: 30,
  toolchest: 16,
  benches: 52,
  heater: 22,
  bucket: 12,
  sofa: 46,
  rocker: 22,
  aquarium: 30,
  dog: 24,
  armour: 20,
  chest: 26,
  coatstand: 14,
  telescope: 24,
  horse: 30,
  curios: 26,
  spinning: 26,
  beanbag: 22,
  parrot: 16,
  monstera: 24,
  mirror: 18,
  stove: 22,
  radio: 18,
  trolley: 26,
  dollhouse: 30,
};

/** The part of each piece, if any, that reaches up the wall as high as the
 *  windows (components/room-windows.ts: WINDOW_DROP under the ceiling,
 *  WINDOW_H tall), as [from, to] in from its left: the picture over the
 *  fireplace, a tall cupboard, the lamp hung over a table. The rest stays
 *  low enough for a window above it. Measured from the art. */
export const HIGH_PART: Record<PieceKind, readonly [number, number] | null> = {
  hearth: [6, 38],
  case: [0, CASE_WIDTH],
  ladder: [0, 8],
  plant: null,
  clock: null,
  seat: [3, 49],
  study: [2, 32],
  gramophone: null,
  range: [0, 34],
  dresser: [0, 36],
  table: null,
  wardrobe: [0, 30],
  bed: null,
  nightstand: null,
  piano: null,
  harp: null,
  cello: null,
  palm: [0, 22],
  wicker: [0, 24],
  birdcage: null,
  ferns: [0, 18],
  darts: [0, 14],
  billiards: [10, 50],
  chess: null,
  easel: null,
  paints: null,
  bust: null,
  bath: null,
  washstand: [3, 19],
  towels: null,
  sideboard: null,
  dining: [14, 37],
  cabinet: [0, 22],
  cot: [8, 33],
  toybox: null,
  blocks: null,
  workbench: [3, 43],
  sawhorse: null,
  toolchest: null,
  benches: null,
  heater: [9, 13],
  bucket: null,
  sofa: null,
  rocker: null,
  aquarium: null,
  dog: null,
  armour: null,
  chest: null,
  coatstand: null,
  telescope: null,
  horse: null,
  curios: null,
  spinning: null,
  beanbag: null,
  parrot: null,
  monstera: null,
  mirror: null,
  stove: [0, 22],
  radio: null,
  trolley: null,
  dollhouse: null,
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
export const MOVABLE = ["hearth", "seat", "study", "gramophone", "plant", "clock", ...ROOM_PIECE_LIST, ...EXTRAS] as const;
export type Movable = (typeof MOVABLE)[number];
/** Furniture that can be put away. The hearth stays: it is where the
 *  reading happens. The catalogue's pieces are taken out instead. */
export const STOWABLE = ["seat", "study", "gramophone", "plant", "clock", "ladder", ...ROOM_PIECE_LIST] as const;
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
  range: "Range",
  dresser: "Dresser",
  table: "Kitchen table",
  wardrobe: "Wardrobe",
  bed: "Bed",
  nightstand: "Bedside table",
  piano: "Piano",
  harp: "Harp",
  cello: "Cello",
  palm: "Palm",
  wicker: "Wicker chair",
  birdcage: "Birdcage",
  ferns: "Ferns",
  darts: "Dartboard",
  billiards: "Billiard table",
  chess: "Chess table",
  easel: "Easel",
  paints: "Paint table",
  bust: "Marble bust",
  bath: "Bath",
  washstand: "Washstand",
  towels: "Towel rail",
  sideboard: "Sideboard",
  dining: "Dining table",
  cabinet: "China cabinet",
  cot: "Cot",
  toybox: "Toy box",
  blocks: "Building blocks",
  workbench: "Workbench",
  sawhorse: "Sawhorse",
  toolchest: "Tool chest",
  benches: "Sauna benches",
  heater: "Sauna stove",
  bucket: "Bucket and ladle",
  sofa: "Sofa",
  rocker: "Rocking chair",
  aquarium: "Aquarium",
  dog: "Dog in a basket",
  armour: "Suit of armour",
  chest: "Chest",
  coatstand: "Coat stand",
  telescope: "Telescope",
  horse: "Rocking horse",
  curios: "Curio cabinet",
  spinning: "Spinning wheel",
  beanbag: "Bean bag",
  parrot: "Parrot on a perch",
  monstera: "Monstera",
  mirror: "Standing mirror",
  stove: "Wood stove",
  radio: "Old radio",
  trolley: "Tea trolley",
  dollhouse: "Dollhouse",
};

/** Where the reader has put a piece: on which floor, counting up from the
 *  ground floor (0), and how many things stand to its left there,
 *  bookcases included and the ladder not. A piece put in one of the added
 *  rooms names the room as well, so it stays there when the library
 *  grows a floor underneath. */
export interface Placement {
  kind: Movable;
  floor: number;
  slot: number;
  room?: RoomKind;
}

export interface Arrangement {
  places: readonly Placement[];
  away: readonly Stowable[];
  /** Rooms added over the library, from the bottom up. */
  rooms?: readonly RoomKind[];
  /** Rooms set beside the one before them (or the library's top floor)
   *  rather than on a floor of their own. */
  beside?: readonly RoomKind[];
  /** Furniture added from the catalogue. */
  extras?: readonly Extra[];
}

export const NO_ARRANGEMENT: Arrangement = { places: [], away: [], rooms: [], extras: [] };

export interface Piece {
  kind: PieceKind;
  /** Left edge, from the inside of the house's left wall. */
  x: number;
  /** For a bookcase: which one, counting in reading order (top floor
   *  first, left to right). */
  caseIndex?: number;
}

/** One room of a storey: the library, or an added room. A storey with
 *  rooms side by side has a partition (PARTITION wide) between each. */
export interface Span {
  room: RoomKind | null;
  /** Its pieces, as indexes into the storey's row: `from` up to `to`. */
  from: number;
  to: number;
  /** Its inside, from the inside of the house's left wall, and how wide. */
  x: number;
  w: number;
}

export interface HousePlan {
  /** Inside width of the house, wall to wall. */
  inner: number;
  /** Top floor first, so the page reads top to bottom. Each is one row of
   *  pieces, left to right, whichever room they are in. */
  floors: Piece[][];
  /** Which added room each floor is, in the same order; null for the
   *  library's own floors. On a floor with rooms side by side, the one on
   *  the left. */
  rooms: (RoomKind | null)[];
  /** The rooms on each floor, left to right. */
  spans: Span[][];
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
 * `arrangement` is where the reader has moved furniture to, what they
 * have put away, and the rooms they have added. Each room is a floor over
 * the library with its own furniture. A moved piece keeps its floor and
 * place among its neighbours whenever it fits there; on a screen too
 * narrow for that, or with fewer floors than it was put on, it goes
 * wherever it would have gone by itself. No floor is added just to hold
 * furniture.
 */
export function planHouse(
  caseCount: number,
  bookCount: number,
  maxInner: number,
  arrangement: Arrangement = NO_ARRANGEMENT,
): HousePlan {
  const away = new Set<string>(arrangement.away);
  const rooms = [...new Set(arrangement.rooms ?? [])];
  const beside = new Set<string>(arrangement.beside ?? []);
  const inRooms = new Set<string>(rooms.flatMap((r) => ROOM_PIECES[r]));
  const added = new Set<string>(arrangement.extras ?? []);
  /** Whether a piece is in the house: earned by the library, come with a
   *  room or added from the catalogue, and not put away. */
  const has = (k: keyof typeof MILESTONES | RoomPiece | Extra) =>
    !away.has(k) &&
    (k in MILESTONES
      ? bookCount >= MILESTONES[k as keyof typeof MILESTONES]
      : isExtra(k)
        ? added.has(k)
        : inRooms.has(k));
  const fits = (kinds: PieceKind[]) => rowWidth(kinds) <= maxInner;

  // Moved pieces, by floor (or room) and in slot order; one place per
  // piece. One moved into a room that has since gone goes where it would
  // by itself.
  const pinned = new Set<PieceKind>();
  const pinsByFloor = new Map<number, { kind: PieceKind; slot: number }[]>();
  const pinsByRoom = new Map<RoomKind, { kind: PieceKind; slot: number }[]>();
  for (const p of arrangement.places) {
    if (pinned.has(p.kind) || (p.kind !== "hearth" && !has(p.kind))) continue;
    if (p.room && !rooms.includes(p.room)) continue;
    pinned.add(p.kind);
    const pin = { kind: p.kind, slot: p.slot };
    if (p.room) pinsByRoom.set(p.room, [...(pinsByRoom.get(p.room) ?? []), pin]);
    else pinsByFloor.set(p.floor, [...(pinsByFloor.get(p.floor) ?? []), pin]);
  }
  for (const pins of [...pinsByFloor.values(), ...pinsByRoom.values()]) pins.sort((a, b) => a.slot - b.slot);
  // As many floors as the house would have by itself: moving the hearth
  // upstairs frees room on the ground floor, but shouldn't squeeze the
  // furniture out of the floors it was moved to.
  const ownFloors = pinned.size
    ? planHouse(caseCount, bookCount, maxInner, { places: [], away: arrangement.away }).floors.length
    : 0;

  const isStarter = (k: PieceKind) => (FLOOR_STARTERS as readonly PieceKind[]).includes(k);
  const starters: PieceKind[] = FLOOR_STARTERS.filter((k) => has(k) && !pinned.has(k));
  const fillers: PieceKind[] = FILLERS.filter((k) => has(k) && !pinned.has(k));
  const extras: PieceKind[] = EXTRAS.filter((k) => has(k) && !pinned.has(k));
  /** Moved pieces that couldn't keep their place, and go where they would
   *  have gone by themselves. */
  const homeless: PieceKind[] = [];

  // Bottom floor first while building.
  const rows: PieceKind[][] = [];
  const rowPins: { kind: PieceKind; slot: number }[][] = [];
  let left = Math.max(1, caseCount);
  for (let f = 0; ; f++) {
    const pins = [...(pinsByFloor.get(f) ?? [])];
    const row: PieceKind[] = f === 0 && !pinned.has("hearth") ? ["hearth"] : [];
    // Moved pieces have to leave room for a bookcase, so a floor can't fill
    // up with furniture alone; on a ground floor too narrow for the hearth
    // and a bookcase, they have to leave room for the hearth. The hearth
    // moved along the ground floor stays on it.
    // Measured with the moved pieces in their places, which may split the
    // bookcases apart.
    const roomy = (ps: typeof pins) =>
      fits(withPins([...row, "case"], ps)) || (f === 0 && !fits(["hearth", "case"]) && fits(withPins(row, ps)));
    while (!roomy(pins)) {
      let i = pins.length - 1;
      while (i >= 0 && f === 0 && pins[i].kind === "hearth") i--;
      if (i < 0) break;
      const [{ kind }] = pins.splice(i, 1);
      // A big piece opens a floor of its own, as it would by itself.
      if (isStarter(kind)) starters.splice(0, starters.length, ...FLOOR_STARTERS.filter((k) => k === kind || starters.includes(k)));
      else homeless.push(kind);
    }
    const fixed = pins.map((p) => p.kind);
    if (f > 0 && !pins.length && starters.length && fits([starters[0], "case"])) {
      row.push(starters.shift()!);
    }
    // A floor always takes at least one bookcase unless it already holds
    // something, so a house narrower than a bookcase still ends.
    while (left > 0 && (fits(withPins([...row, "case"], pins)) || fixed.length + row.length === 0)) {
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

  // Then the added rooms, each a floor of its own with its furniture, as
  // much of it as fits; or, set beside the one before it, on the same
  // floor, if all of it fits there.
  const libraryFloors = rows.length;
  const rowRooms: (RoomKind | null)[] = rows.map(() => null);
  /** The storey each row stands on, from the ground. */
  const storeyOf: number[] = rows.map((_, i) => i);
  /** A storey's width, with `kinds` in row `i` if that is on it. Rooms
   *  side by side each get at least MIN_SPAN. */
  const storeyWidth = (storey: number, i = -1, kinds: readonly PieceKind[] = []) => {
    const on = rows.flatMap((row, j) => (storeyOf[j] === storey ? [j === i ? kinds : withPins(row, rowPins[j])] : []));
    if (on.length === 1) return rowWidth(on[0]);
    return on.reduce((w, row) => w + Math.max(rowWidth(row), MIN_SPAN), (on.length - 1) * PARTITION);
  };
  const fitsAt = (i: number, kinds: readonly PieceKind[]) => storeyWidth(storeyOf[i], i, kinds) <= maxInner;
  for (const room of rooms) {
    const pins = [...(pinsByRoom.get(room) ?? [])];
    const row: PieceKind[] = ROOM_PIECES[room].filter((k) => has(k) && !pinned.has(k));
    const top = storeyOf[storeyOf.length - 1];
    rows.push(row);
    rowPins.push(pins);
    rowRooms.push(room);
    storeyOf.push(top);
    if (beside.has(room) && fitsAt(rows.length - 1, withPins(row, pins))) continue;
    storeyOf[rows.length - 1] = top + 1;
    while (pins.length && !fits(pins.map((p) => p.kind))) homeless.push(pins.pop()!.kind);
    while (row.length && !fits(withPins(row, pins))) homeless.push(row.pop()!);
  }

  // Furniture still waiting goes wherever it fits, top floor first: that
  // is the newest floor, and usually the emptiest. The library's own
  // furniture tries its floors before the rooms', and a room's the other
  // way round. The hearth and the big pieces open a floor; the small ones
  // fill in.
  const big = (k: PieceKind) => k === "hearth" || isStarter(k);
  const topFirst = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => to - 1 - i);
  const libraryRows = topFirst(0, libraryFloors);
  const roomRows = topFirst(libraryFloors, rows.length);
  for (const kind of [...homeless.filter(big), ...starters, ...fillers, ...homeless.filter((k) => !big(k)), ...extras]) {
    let placed = false;
    for (const i of roomOf(kind) ? [...roomRows, ...libraryRows] : [...libraryRows, ...roomRows]) {
      const next = big(kind) ? [kind, ...rows[i]] : withFiller(rows[i], kind);
      if (fitsAt(i, withPins(next, rowPins[i]))) {
        rows[i] = next;
        placed = true;
        break;
      }
    }
    // The hearth is never left out: moved to a floor that has no room for
    // it, it goes back where it would be by itself, on the ground floor.
    if (!placed && kind === "hearth") {
      return planHouse(caseCount, bookCount, maxInner, {
        ...arrangement,
        places: arrangement.places.filter((p) => p.kind !== "hearth"),
      });
    }
  }
  for (let i = 0; i < rows.length; i++) {
    rows[i] = withPins(rows[i], rowPins[i]);
    rowPins[i] = [];
  }

  // The ladder leans on the end of the highest row of two or more
  // bookcases that has room for it.
  if (has("ladder")) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const last = rows[i].lastIndexOf("case");
      if (last < 1 || rows[i][last - 1] !== "case") continue;
      const next = [...rows[i].slice(0, last + 1), "ladder" as const, ...rows[i].slice(last + 1)];
      if (fitsAt(i, next)) {
        rows[i] = next;
        break;
      }
    }
  }

  const storeys = Math.max(...storeyOf) + 1;
  const widths = Array.from({ length: storeys }, (_, st) => storeyWidth(st));
  const inner = Math.max(...widths);

  let caseIndex = 0;
  /** A row of pieces laid out from `x0`, with `spare` width spread evenly
   *  over the walls and the gaps between pieces; bookcases stay together. */
  const lay = (kinds: readonly PieceKind[], spare: number, x0: number): Piece[] => {
    const flexible = 2 + kinds.filter((_, i) => i > 0 && !touches(kinds, i)).length;
    let slot = 0;
    const share = () => {
      const s = Math.floor((spare * (slot + 1)) / flexible) - Math.floor((spare * slot) / flexible);
      slot++;
      return s;
    };
    let x = x0 + PAD + share();
    return kinds.map((kind, i): Piece => {
      if (i > 0 && !touches(kinds, i)) x += GAP + share();
      const piece: Piece = { kind, x };
      if (kind === "case") piece.caseIndex = caseIndex++;
      x += PIECE_WIDTH[kind];
      return piece;
    });
  };
  const floors: Piece[][] = [];
  const spans: Span[][] = [];
  const floorRooms: (RoomKind | null)[] = [];
  for (let st = storeys - 1; st >= 0; st--) {
    const on = rows.flatMap((_, i) => (storeyOf[i] === st ? [i] : []));
    const own = on.map((i) => (on.length > 1 ? Math.max(rowWidth(rows[i]), MIN_SPAN) : rowWidth(rows[i])));
    const total = own.reduce((a, b) => a + b, 0);
    // A narrower storey's spare width goes to its rooms by their size.
    const spare = inner - widths[st];
    const floor: Piece[] = [];
    const parts: Span[] = [];
    let x = 0;
    let before = 0;
    on.forEach((i, j) => {
      const w = own[j] + Math.floor((spare * (before + own[j])) / total) - Math.floor((spare * before) / total);
      before += own[j];
      const from = floor.length;
      floor.push(...lay(rows[i], w - rowWidth(rows[i]), x));
      parts.push({ room: rowRooms[i], from, to: floor.length, x, w });
      x += w + PARTITION;
    });
    floors.push(floor);
    spans.push(parts);
    floorRooms.push(parts[0].room);
  }

  return { inner, floors, rooms: floorRooms, spans, cat: has("cat") };
}

/** A storey's movable rows, one for each of its rooms; `floor` counts up
 *  from the ground. The ladder goes with its bookcase, so isn't in them. */
function spanRows(plan: HousePlan, floor: number): PieceKind[][] {
  const f = plan.floors.length - 1 - floor;
  return plan.spans[f].map((sp) =>
    plan.floors[f]
      .slice(sp.from, sp.to)
      .filter((p) => p.kind !== "ladder")
      .map((p) => p.kind),
  );
}

export const isMovable = (k: PieceKind): k is Movable => (MOVABLE as readonly string[]).includes(k);

/** A placement in one of a floor's rooms (`span`), naming the room when it
 *  is an added one. */
function placement(plan: HousePlan, kind: Movable, floor: number, span: number, slot: number): Placement {
  const room = plan.spans[plan.floors.length - 1 - floor][span]?.room;
  return room ? { kind, floor, slot, room } : { kind, floor, slot };
}

/** Where every movable piece stands in a plan, as placements that would
 *  put it back exactly there. */
export function placementsOf(plan: HousePlan): Placement[] {
  return plan.floors.flatMap((_, f) => {
    const fromGround = plan.floors.length - 1 - f;
    return spanRows(plan, fromGround).flatMap((row, span) =>
      row.flatMap((kind, slot) => (isMovable(kind) ? [placement(plan, kind, fromGround, span, slot)] : [])),
    );
  });
}

/**
 * Every movable piece where it stands now, with `kind` moved to `floor`
 * (from the ground), into the room `span` places from the left there (the
 * library, or an added room beside it) at `slot`. Pinning them all, not
 * just the one that moved, keeps the rest from rearranging themselves
 * around it. Null when the house has no such floor or room, or the piece
 * isn't in it.
 */
export function moveTo(plan: HousePlan, kind: Movable, floor: number, slot: number, span = 0): Placement[] | null {
  if (floor < 0 || floor >= plan.floors.length) return null;
  const rows = plan.floors.map((_, f) => spanRows(plan, f));
  const from = rows.flat().find((r) => r.includes(kind));
  const to = rows[floor][span];
  if (!from || !to) return null;
  from.splice(from.indexOf(kind), 1);
  to.splice(Math.max(0, Math.min(slot, to.length)), 0, kind);
  return rows.flatMap((spans, f) =>
    spans.flatMap((row, j) => row.flatMap((k, s) => (isMovable(k) ? [placement(plan, k, f, j, s)] : []))),
  );
}

/** Where a piece goes when nudged one step: along its room, through the
 *  partition into the room beside it, or to the floor above or below at
 *  about the same place across. Null when it is already at that end,
 *  edge or floor. */
export function nudge(
  plan: HousePlan,
  kind: Movable,
  direction: "left" | "right" | "up" | "down",
): { floor: number; span: number; slot: number } | null {
  const floors = plan.floors.length;
  const here = plan.floors.flatMap((_, f) => {
    const floor = floors - 1 - f;
    return spanRows(plan, floor).flatMap((row, span) => (row.includes(kind) ? [{ floor, span, slot: row.indexOf(kind), row }] : []));
  })[0];
  if (!here) return null;
  const { floor, span, slot, row } = here;
  if (direction === "left") {
    if (slot > 0) return { floor, span, slot: slot - 1 };
    return span > 0 ? { floor, span: span - 1, slot: spanRows(plan, floor)[span - 1].length } : null;
  }
  if (direction === "right") {
    if (slot < row.length - 1) return { floor, span, slot: slot + 1 };
    return span < spanRows(plan, floor).length - 1 ? { floor, span: span + 1, slot: 0 } : null;
  }
  const to = floor + (direction === "up" ? 1 : -1);
  if (to < 0 || to >= floors) return null;
  // The room and place on the new floor nearest the piece's middle across
  // the house.
  const piece = plan.floors[floors - 1 - floor].find((p) => p.kind === kind)!;
  const middle = piece.x + PIECE_WIDTH[kind] / 2;
  return { floor: to, ...placeAt(plan, to, middle) };
}

/** The room (`span`) and place among its pieces nearest `middle` dots in
 *  from the left wall, on `floor` (from the ground). `except` is left out,
 *  as a piece being dragged is. */
export function placeAt(plan: HousePlan, floor: number, middle: number, except?: PieceKind): { span: number; slot: number } {
  const f = plan.floors.length - 1 - floor;
  const spans = plan.spans[f];
  let span = spans.findIndex((sp) => middle < sp.x + sp.w + PARTITION / 2);
  if (span < 0) span = spans.length - 1;
  const sp = spans[span];
  const row = plan.floors[f].slice(sp.from, sp.to).filter((p) => p.kind !== "ladder" && p.kind !== except);
  return { span, slot: row.filter((p) => p.x + PIECE_WIDTH[p.kind] / 2 < middle).length };
}

/** The stretches the furniture in a room takes up where the windows and
 *  pictures hang (HIGH_PART), left to right, run together where they
 *  meet. */
function highParts(pieces: readonly Piece[]): [number, number][] {
  const taken: [number, number][] = [];
  for (const p of pieces) {
    const high = HIGH_PART[p.kind];
    if (!high) continue;
    const [a, b] = [p.x + high[0], p.x + high[1]];
    const last = taken.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else taken.push([a, b]);
  }
  return taken;
}

/** Where windows go on each floor (top first): x, in from the left wall,
 *  of each window `width` wide, in the stretches of wall that the
 *  furniture in each room leaves clear up there (HIGH_PART), with room
 *  either side. */
export function windowSpots(plan: HousePlan, width: number): number[][] {
  const margin = 4;
  return plan.floors.map((floor, f) =>
    plan.spans[f].flatMap((sp) => {
      const taken = highParts(floor.slice(sp.from, sp.to));
      const edges = [sp.x, ...taken.flat(), sp.x + sp.w];
      const spots: number[] = [];
      for (let i = 0; i < edges.length; i += 2) {
        const [a, b] = [edges[i], edges[i + 1]];
        const free = b - a - 2 * margin;
        if (free < width) continue;
        // A long stretch gets two or three, evenly spaced.
        const n = Math.max(1, Math.min(3, Math.floor((free + 40) / (width + 60))));
        for (let k = 0; k < n; k++) spots.push(Math.round(a + margin + ((free - width) * (2 * k + 1)) / (2 * n)));
      }
      return spots;
    }),
  );
}

/** Where pictures hang on each floor (top first), and the windows with
 *  them if there are any (`windowW` wide, else null): x, in from the left
 *  wall, of each picture's box `pictureW` wide and each window, on the
 *  stretches of wall that the furniture leaves clear (HIGH_PART). A
 *  window comes first along each stretch, then a picture, and so on, as
 *  many as fit with room between them. */
export function wallSpots(
  plan: HousePlan,
  pictureW: number,
  windowW: number | null,
): { pictures: number[][]; windows: number[][] } {
  const margin = 4;
  const gap = 12;
  const pictures: number[][] = [];
  const windows: number[][] = [];
  plan.floors.forEach((floor, f) => {
    const hung = { pictures: [] as number[], windows: [] as number[] };
    for (const sp of plan.spans[f]) {
      const taken = highParts(floor.slice(sp.from, sp.to));
      const edges = [sp.x, ...taken.flat(), sp.x + sp.w];
      for (let i = 0; i < edges.length; i += 2) {
        const [a, b] = [edges[i], edges[i + 1]];
        const free = b - a - 2 * margin;
        // Each gets an equal share of the stretch, wide enough for the
        // widest with room beside it; or the first alone if it fits.
        const widest = Math.max(pictureW, windowW ?? 0);
        let n = Math.min(5, Math.floor(free / (widest + gap)));
        if (n === 0 && free >= (windowW ?? pictureW)) n = 1;
        for (let k = 0; k < n; k++) {
          const window = windowW !== null && k % 2 === 0;
          const w = window ? windowW : pictureW;
          const x = Math.round(a + margin + (free * (2 * k + 1)) / (2 * n) - w / 2);
          (window ? hung.windows : hung.pictures).push(x);
        }
      }
    }
    pictures.push(hung.pictures);
    windows.push(hung.windows);
  });
  return { pictures, windows };
}

/** `kind` put away. Whatever stood to its right on its floor moves up a
 *  place, so the rest stay where they were. */
export function putAway(a: Arrangement, kind: Stowable): Arrangement {
  const was = a.places.find((p) => p.kind === kind);
  const places = a.places
    .filter((p) => p.kind !== kind)
    .map((p) => (was && p.floor === was.floor && p.slot > was.slot ? { ...p, slot: p.slot - 1 } : p));
  return { ...a, places, away: [...a.away, kind] };
}

/** `kind` out again, wherever it goes by itself. */
export const bringOut = (a: Arrangement, kind: Stowable): Arrangement => ({
  ...a,
  away: a.away.filter((k) => k !== kind),
});

/** `room` added as a new top floor, with all its furniture. */
export const addRoom = (a: Arrangement, room: RoomKind): Arrangement => ({
  ...a,
  rooms: [...(a.rooms ?? []).filter((r) => r !== room), room],
});

/** `room` set beside the one before it, or (`on` false) on a floor of its
 *  own again. */
export const setBeside = (a: Arrangement, room: RoomKind, on: boolean): Arrangement => ({
  ...a,
  beside: [...(a.beside ?? []).filter((r) => r !== room), ...(on ? [room] : [])],
});

/** `room` taken off the house with its furniture. Anything else moved
 *  into it goes back where it would go by itself. */
export function removeRoom(a: Arrangement, room: RoomKind): Arrangement {
  const pieces: readonly string[] = ROOM_PIECES[room];
  return {
    ...a,
    places: a.places.filter((p) => p.room !== room && !pieces.includes(p.kind)),
    away: a.away.filter((k) => !pieces.includes(k)),
    rooms: (a.rooms ?? []).filter((r) => r !== room),
    beside: (a.beside ?? []).filter((r) => r !== room),
  };
}

/** `kind` added from the catalogue, wherever it goes by itself. */
export const addExtra = (a: Arrangement, kind: Extra): Arrangement => ({
  ...a,
  extras: [...(a.extras ?? []).filter((k) => k !== kind), kind],
});

/** `kind` taken out of the house again. Whatever stood to its right on its
 *  floor moves up a place, so the rest stay where they were. */
export function removeExtra(a: Arrangement, kind: Extra): Arrangement {
  const was = a.places.find((p) => p.kind === kind);
  const places = a.places
    .filter((p) => p.kind !== kind)
    .map((p) => (was && p.floor === was.floor && p.slot > was.slot ? { ...p, slot: p.slot - 1 } : p));
  return { ...a, places, extras: (a.extras ?? []).filter((k) => k !== kind) };
}

/** How many bookcases a list of shelves fills. */
export function caseCount(shelfCount: number): number {
  return Math.max(1, Math.ceil(shelfCount / SHELVES_PER_CASE));
}

/** Little things that stand on a shelf's spare space: the first seven on
 *  any shelf, the rest only when the shelves have plenty
 *  (RoomOrnaments). */
export type Ornament =
  | "plant"
  | "candle"
  | "vase"
  | "frame"
  | "globe"
  | "hourglass"
  | "teapot"
  | "stack"
  | "cactus"
  | "bird"
  | "inkwell";
export const ORNAMENT_WIDTH: Record<Ornament, number> = {
  plant: 6,
  candle: 3,
  vase: 5,
  frame: 7,
  globe: 7,
  hourglass: 5,
  teapot: 8,
  stack: 9,
  cactus: 5,
  bird: 7,
  inkwell: 6,
};
const ORNAMENTS: readonly Ornament[] = ["plant", "candle", "vase", "frame", "globe", "hourglass", "teapot"];
const ALL_ORNAMENTS = Object.keys(ORNAMENT_WIDTH) as Ornament[];
export const BOOKEND_WIDTH = 3;
/** On a shelf with plenty: the most, and the space kept between them. */
const PLENTY = 4;
const SPACING = 2;

export interface ShelfDressing {
  /** A bookend after the last book, on a shelf that isn't full. */
  bookend: boolean;
  /** Ornaments on the rest, each with its left edge on the shelf. */
  ornaments: { kind: Ornament; x: number }[];
}

/**
 * What stands on a shelf beside its books (`used` dots of them): a bookend
 * when there is room for one, then on space a book would leave bare an
 * ornament or two ("some"), as many as fit ("plenty"), or none. Shelf `n`
 * (counting from the first) always gets the same ones.
 */
export function dressShelf(n: number, used: number, how: RoomOrnaments = "some"): ShelfDressing {
  const free = SHELF_WIDTH - used;
  const bookend = used > 0 && free >= BOOKEND_WIDTH + 2;
  const start = used + (bookend ? BOOKEND_WIDTH : 0);
  const room = SHELF_WIDTH - start;
  const ornaments: ShelfDressing["ornaments"] = [];
  const h = hash(`shelf ${n}`);
  if (how === "plenty") {
    // A different one each time, while they fit with a little space
    // round each, then spread evenly along the space.
    const picks: Ornament[] = [];
    let width = 0;
    for (let i = 0; picks.length < PLENTY && i < 16; i++) {
      const kind = ALL_ORNAMENTS[(hash(`shelf ${n} ${i}`) + h) % ALL_ORNAMENTS.length];
      if (picks.includes(kind)) continue;
      const w = ORNAMENT_WIDTH[kind];
      if (width + w + SPACING * (picks.length + 2) > room) continue;
      picks.push(kind);
      width += w;
    }
    const gap = (room - width) / (picks.length + 1);
    let x = start + gap;
    for (const kind of picks) {
      ornaments.push({ kind, x: Math.round(x) });
      x += ORNAMENT_WIDTH[kind] + gap;
    }
    return { bookend, ornaments };
  }
  if (how === "none" || room < 9) return { bookend, ornaments };

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
