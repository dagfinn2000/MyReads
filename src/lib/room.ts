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

export interface HousePlan {
  /** Inside width of the house, wall to wall. */
  inner: number;
  /** Top floor first, so the page reads top to bottom. */
  floors: Piece[][];
  /** Which added room each floor is, in the same order; null for the
   *  library's own floors. */
  rooms: (RoomKind | null)[];
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
    const roomy = (kinds: PieceKind[]) =>
      fits([...kinds, ...row, "case"]) || (f === 0 && !fits(["hearth", "case"]) && fits([...kinds, ...row]));
    while (!roomy(pins.map((p) => p.kind))) {
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

  // Then the added rooms, each a floor of its own with its furniture,
  // as much of it as fits.
  const libraryFloors = rows.length;
  const rowRooms: (RoomKind | null)[] = rows.map(() => null);
  for (const room of rooms) {
    const pins = [...(pinsByRoom.get(room) ?? [])];
    while (pins.length && !fits(pins.map((p) => p.kind))) homeless.push(pins.pop()!.kind);
    const row: PieceKind[] = ROOM_PIECES[room].filter((k) => has(k) && !pinned.has(k));
    while (row.length && !fits(withPins(row, pins))) homeless.push(row.pop()!);
    rows.push(row);
    rowPins.push(pins);
    rowRooms.push(room);
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
      if (fits(withPins(next, rowPins[i]))) {
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
  rowRooms.reverse();

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

  return { inner, floors, rooms: rowRooms, cat: has("cat") };
}

export const isMovable = (k: PieceKind): k is Movable => (MOVABLE as readonly string[]).includes(k);

/** A placement on a floor of a plan, naming the room when it is one. */
function placement(plan: HousePlan, kind: Movable, floor: number, slot: number): Placement {
  const room = plan.rooms[plan.floors.length - 1 - floor];
  return room ? { kind, floor, slot, room } : { kind, floor, slot };
}

/** Where every movable piece stands in a plan, as placements that would
 *  put it back exactly there. */
export function placementsOf(plan: HousePlan): Placement[] {
  const out: Placement[] = [];
  plan.floors.forEach((floor, f) => {
    const fromGround = plan.floors.length - 1 - f;
    floor
      .filter((p) => p.kind !== "ladder")
      .forEach((p, slot) => {
        if (isMovable(p.kind)) out.push(placement(plan, p.kind, fromGround, slot));
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
  return rows.flatMap((row, f) => row.flatMap((k, s) => (isMovable(k) ? [placement(plan, k, f, s)] : [])));
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

/** `room` taken off the house with its furniture. Anything else moved
 *  into it goes back where it would go by itself. */
export function removeRoom(a: Arrangement, room: RoomKind): Arrangement {
  const pieces: readonly string[] = ROOM_PIECES[room];
  return {
    ...a,
    places: a.places.filter((p) => p.room !== room && !pieces.includes(p.kind)),
    away: a.away.filter((k) => !pieces.includes(k)),
    rooms: (a.rooms ?? []).filter((r) => r !== room),
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
