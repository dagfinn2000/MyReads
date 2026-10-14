"use client";

import "./reading-room.css";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  RoomCeiling,
  RoomFabric,
  RoomFloor,
  RoomHanging,
  RoomOwn,
  RoomPaper,
  RoomStyle,
  RoomWalls,
  RoomWood,
} from "@/lib/room-styles";
import { ReadingStatus } from "@prisma/client";
import { BookLink } from "@/components/book-link";
import {
  BOOKEND,
  CANDLESTICK,
  CAT,
  CAT_TAIL,
  FLAMES_A,
  FLAMES_B,
  GLOBE,
  LOGS,
  MANTEL_CLOCK,
  OPEN_BOOK,
  ORNAMENT_ART,
  Glow,
  PENDULUM,
  PLANT,
  Pendant,
  Rects,
  SIDE_TABLE,
  STEAM,
  Sprite,
  Stand,
  TEACUP,
  tapestryArt,
  armchairArt,
  benchArt,
  bookcaseArt,
  clockArt,
  deskArt,
  fireplaceArt,
  floorLampArt,
  gramophoneArt,
  ladderArt,
  paintingArt,
  rugArt,
  windowArt,
  type Art,
  type HouseGeometry,
  type Rect,
} from "@/components/room-art";
import { HELD_BOOK, SEAT_OFFSET, seatedTop } from "@/components/avatar-art";
import { SeatedAvatar, SleepingPet, Walker, useAvatar, type Avatar } from "@/components/room-avatar";
import { ExtraView } from "@/components/room-extras";
import { RoomPieceView } from "@/components/room-rooms";
import type { AvatarLook } from "@/lib/avatar";
import type { CatCoat, DogCoat, Pet } from "@/lib/pets";
import { chimneyFoot, chimneyRise, roofCrown, roofHeight, shellArt, type Moving, type Shell } from "@/components/room-shells";
import { isClosingBook } from "@/lib/cover-flight";
import { OWNERSHIP_LABELS, STATUS_LABELS } from "@/lib/display";
import {
  BEAM,
  CASE_CROWN,
  CASE_HEIGHT,
  FURNITURE_LABELS,
  GAP,
  NO_ARRANGEMENT,
  ORNAMENT_WIDTH,
  PAD,
  ROOM_LABELS,
  PIECE_WIDTH,
  ROOM_HEIGHT,
  SHELF_BOARD,
  SHELF_SLOT,
  SHELF_WIDTH,
  SHELVES_PER_CASE,
  WALL,
  caseCount,
  dressShelf,
  isExtra,
  isMovable,
  isOnShelf,
  moveTo,
  nudge,
  placementsOf,
  planHouse,
  shelve,
  spineFor,
  type Arrangement,
  type HousePlan,
  type Movable,
  type Piece,
  type RoomBook,
  type RoomKind,
} from "@/lib/room";
import { drawnSpineColour, spineColour } from "@/lib/spine-colour";

/** Stone and grass under the house. */
const FOUNDATION = 6;
const GROUND = 6;
/** The room the chimney's smoke needs over the top of the chimney. */
const SMOKE = 20;
const STOREY = BEAM + ROOM_HEIGHT;
/** Half the label's widest (15rem in reading-room.css). */
const TIP_HALF_WIDTH = 120;

/** Screen pixels to a dot: whole numbers only, so the art stays crisp. */
function scaleFor(width: number): number {
  return width < 560 ? 2 : 3;
}

/** The garden either side of the house: more of it on a wide screen. */
const yardFor = (scale: number) => (scale === 3 ? 24 : 14);

// Drawn once: the art never changes, only where it goes.
const BOOKCASE = bookcaseArt();
const FIREPLACE = fireplaceArt();
const HANGINGS: Record<Exclude<RoomHanging, "none">, Art> = {
  painting: paintingArt("hills"),
  tree: tapestryArt("tree"),
  stag: tapestryArt("stag"),
  stars: tapestryArt("stars"),
  waves: tapestryArt("waves"),
  kilim: tapestryArt("kilim"),
};
const SEASCAPE = paintingArt("sea");
const ARMCHAIR = armchairArt();
const LAMP = floorLampArt();
const WINDOW = windowArt();
const BENCH = benchArt();
const CLOCK = clockArt();
const DESK = deskArt();
const GRAMOPHONE = gramophoneArt();
const LADDER = ladderArt(CASE_HEIGHT - 3, 4);

// ── Spine colours from covers ────────────────────────────────────────────
// Kept in localStorage by cover address. A cover's address changes when the
// image does (lib/covers.ts names files by their content), so an entry
// never goes stale. "" marks a cover that can't be read (another site's
// image without CORS), which then keeps its drawn colour.

const COLOUR_KEY = "myreads:spine-colours";
const MAX_COLOURS = 5000;
let colours: Record<string, string> | null = null;
const listeners = new Set<() => void>();
const NO_COLOURS: Record<string, string> = {};

function loadColours(): Record<string, string> {
  if (colours) return colours;
  colours = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLOUR_KEY) ?? "{}");
    if (parsed && typeof parsed === "object") {
      for (const [url, value] of Object.entries(parsed)) {
        if (typeof value === "string" && /^(#[0-9a-f]{6})?$/.test(value)) colours[url] = value;
      }
    }
  } catch {
    // Storage blocked or garbled: start afresh.
  }
  return colours;
}

function rememberColours(found: Record<string, string>) {
  const next = { ...loadColours(), ...found };
  const urls = Object.keys(next);
  for (const url of urls.slice(0, Math.max(0, urls.length - MAX_COLOURS))) delete next[url];
  colours = next;
  try {
    localStorage.setItem(COLOUR_KEY, JSON.stringify(next));
  } catch {
    // Full or blocked: the colours last until the tab closes.
  }
  listeners.forEach((fn) => fn());
}

const subscribeColours = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The cover's spine colour; "" when it can't be read, null when it might
 *  work another time (a network hiccup). */
function readCover(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const local = url.startsWith("/");
    if (!local) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 36;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, 24, 36);
        resolve(spineColour(ctx.getImageData(0, 0, 24, 36).data) ?? "");
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve(local ? null : "");
    img.src = url;
  });
}

/** Reads the covers that have no colour yet, a few at a time, and saves
 *  what it finds in batches so the shelves don't redraw for every book. */
function useCoverColours(urls: string[]): Record<string, string> {
  const known = useSyncExternalStore(subscribeColours, loadColours, () => NO_COLOURS);
  const wanted = urls.join("\n");

  useEffect(() => {
    const queue = wanted.split("\n").filter((u) => u && !(u in loadColours()));
    if (!queue.length) return;
    let stopped = false;
    let found: Record<string, string> = {};
    const flush = () => {
      if (Object.keys(found).length) rememberColours(found);
      found = {};
    };
    const timer = setInterval(flush, 400);
    const worker = async () => {
      while (!stopped && queue.length) {
        const url = queue.shift()!;
        const colour = await readCover(url);
        if (colour !== null) found[url] = colour;
      }
    };
    void Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      clearInterval(timer);
      if (!stopped) flush();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      flush();
    };
  }, [wanted]);

  return known;
}

// ── Layout ───────────────────────────────────────────────────────────────

interface Layout {
  scale: number;
  geo: HouseGeometry;
  sceneH: number;
  plan: HousePlan;
  /** What planHouse was given, to try other arrangements. */
  caseTotal: number;
  maxInner: number;
  floors: Piece[][];
  cat: boolean;
  /** Each bookcase's shelves, as indexes into the books. */
  cases: number[][][];
  /** The first and last book index in each floor, for the arrow keys'
   *  focus to redraw only the floors it touches. [-1, -1] for none. */
  floorRange: [number, number][];
}

/** Where everything outside the storeys goes, for a house `houseW` wide
 *  with its fireplace `hearthX` in from the inside of the left wall. */
function houseGeometry(
  style: RoomStyle,
  yard: number,
  houseW: number,
  floorCount: number,
  hearthX: number | null,
): HouseGeometry {
  const roofH = roofHeight(style, houseW);
  const chimneyX = yard + WALL + (hearthX === null ? 12 : hearthX + 17);
  // Sky over the roof for a spire or flag, or for the chimney and its
  // smoke.
  const box = { houseX: yard, houseW, roofTop: 0, roofH };
  const rise = chimneyRise(style);
  const roofTop = Math.max(
    4,
    roofCrown(style) + 2,
    rise === null ? 0 : rise + SMOKE - chimneyFoot(style, box, chimneyX),
  );
  return {
    sceneW: houseW + 2 * yard,
    houseX: yard,
    houseW,
    roofTop,
    roofH,
    floorsTop: roofTop + roofH,
    floorCount,
    storey: STOREY,
    roomH: ROOM_HEIGHT,
    beam: BEAM,
    wall: WALL,
    foundation: FOUNDATION,
    ground: GROUND,
    chimneyX,
  };
}

const sceneHeight = (geo: HouseGeometry) => geo.floorsTop + geo.floorCount * STOREY + BEAM + FOUNDATION + GROUND;

function layoutRoom(books: RoomBook[], width: number, style: RoomStyle, arrangement: Arrangement): Layout {
  const scale = scaleFor(width);
  const shelves = shelve(books.map((b) => spineFor(b).width));
  const count = caseCount(shelves.length);
  const cases = Array.from({ length: count }, (_, i) =>
    Array.from({ length: SHELVES_PER_CASE }, (_, j) => shelves[i * SHELVES_PER_CASE + j] ?? []),
  );
  const yard = yardFor(scale);
  const maxInner = Math.floor(width / scale) - 2 * yard - 2 * WALL;
  const plan = planHouse(count, books.length, maxInner, arrangement);
  // The chimney stands over the fireplace, on whichever floor that is.
  const hearth = plan.floors.flat().find((p) => p.kind === "hearth");
  const geo = houseGeometry(style, yard, plan.inner + 2 * WALL, plan.floors.length, hearth ? hearth.x : null);
  const sceneH = sceneHeight(geo);
  const floorRange = plan.floors.map((floor): [number, number] => {
    const inFloor = floor.flatMap((p) => (p.kind === "case" ? cases[p.caseIndex!].flat() : []));
    return inFloor.length ? [inFloor[0], inFloor[inFloor.length - 1]] : [-1, -1];
  });
  return { scale, geo, sceneH, plan, caseTotal: count, maxInner, floors: plan.floors, cat: plan.cat, cases, floorRange };
}

/** `current` if it falls in `range`, else -1, so a memoised part of the
 *  room only redraws when the focus moves into or out of it. */
const within = (current: number, [first, last]: readonly [number, number]) =>
  current >= first && current <= last ? current : -1;

// ── Words ────────────────────────────────────────────────────────────────

/** Why a book is an outline on the shelf rather than a spine. */
function awayReason(book: RoomBook): string | null {
  if (book.lentTo) return `Lent to ${book.lentTo}`;
  if (book.ownership === "WISHLIST") return "On your wishlist";
  if (book.ownership === "GIVEN_AWAY") return OWNERSHIP_LABELS.GIVEN_AWAY;
  return null;
}

function statusLine(book: RoomBook): string {
  const parts: string[] = [STATUS_LABELS[book.status]];
  if (book.status === ReadingStatus.READING && book.currentPage && book.pageCount) {
    parts[0] += `, page ${book.currentPage} of ${book.pageCount}`;
  }
  const away = awayReason(book);
  if (away) parts.push(away);
  return parts.join(" · ");
}

function spineLabel(book: RoomBook): string {
  return `${book.title}${book.author ? `, by ${book.author}` : ""}. ${statusLine(book)}`;
}

function colourOf(book: RoomBook, known: Record<string, string>): string {
  return (book.coverUrl && known[book.coverUrl]) || drawnSpineColour(book.title);
}

interface OpenBook {
  index: number;
  book: RoomBook;
  colour: string;
}

// ── The room ─────────────────────────────────────────────────────────────

/** How the room is decorated (Decorate on the Room page). */
export interface RoomDecor {
  style: RoomStyle;
  walls: RoomWalls;
  wood: RoomWood;
  fabric: RoomFabric;
  hanging: RoomHanging;
  paper: RoomPaper;
  floor: RoomFloor;
  ceiling: RoomCeiling;
  /** Added rooms' own walls and floors. */
  own: Partial<Record<RoomKind, RoomOwn>>;
  /** The coat of every cat in the house, and of the dog in its basket. */
  cat: CatCoat;
  dog: DogCoat;
}

export const PLAIN_DECOR: RoomDecor = {
  style: "cottage",
  walls: "style",
  wood: "style",
  fabric: "style",
  hanging: "painting",
  paper: "style",
  floor: "style",
  ceiling: "none",
  own: {},
  cat: "ginger",
  dog: "brown",
};

const FLOOR_NAMES = ["ground floor", "first floor", "second floor", "third floor", "fourth floor", "fifth floor"];
const floorName = (fromGround: number) => FLOOR_NAMES[fromGround] ?? `floor ${fromGround}`;

/**
 * The library as a cozy pixel-art house: every book a spine on a shelf, in
 * the order a bookshelf files them, and a house that gains bookcases,
 * furniture and floors as the library grows (lib/room.ts lays it out,
 * room-art.tsx draws the furniture and room-shells.ts the house, in the
 * style chosen in Decorate).
 *
 * Spines take their cover's main colour, or the drawn cover's colour for a
 * book without an image. Covers are read as their floor scrolls into view,
 * so a big library doesn't fetch every cover at once. Hovering or focusing
 * a spine shows its title; clicking opens the book, whose page then has an
 * X that flies it back onto its shelf. The shelves are one stop for Tab,
 * with the arrow keys moving from book to book.
 *
 * While `arranging`, the furniture has handles to drag it about, or move
 * it with the arrow keys; `onArrange` gets where it now stands.
 *
 * The reader's `avatar` wanders the floor with the fireplace, its `pet`
 * at its heels, and sits in the armchair with the book they're reading,
 * if there is one, the pet asleep at its feet.
 *
 * It is drawn in the browser only: how many bookcases fit side by side
 * depends on the width it has.
 */
export function ReadingRoom({
  books,
  decor = PLAIN_DECOR,
  arrangement = NO_ARRANGEMENT,
  arranging = false,
  onArrange,
  onDone,
  onPlan,
  avatar = null,
  pet = "none",
}: {
  books: RoomBook[];
  decor?: RoomDecor;
  avatar?: AvatarLook | null;
  /** The animal at the avatar's heels. */
  pet?: Pet;
  arrangement?: Arrangement;
  arranging?: boolean;
  onArrange?: (next: Arrangement) => void;
  /** Escape while arranging. */
  onDone?: () => void;
  /** The house as it is laid out at this width, whenever that changes. */
  onPlan?: (plan: HousePlan) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());
  const [tip, setTip] = useState<{ index: number; left: number; top: number } | null>(null);
  const [note, setNote] = useState<{ text: string; shown: boolean } | null>(null);
  // Back from a book's X: the books are already on their shelves as the
  // spine flies home, rather than settling onto them again.
  const [returning] = useState(isClosingBook);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style = decor.style;
  const layout = useMemo(
    () => (width ? layoutRoom(books, width, style, arrangement) : null),
    [books, width, style, arrangement],
  );
  const { paper, floor, ceiling, own } = decor;
  const shell = useMemo(
    () => (layout ? shellArt(layout.geo, style, { paper, floor, ceiling, own, rooms: layout.plan.rooms }) : null),
    [layout, style, paper, floor, ceiling, own],
  );
  useEffect(() => {
    if (layout) onPlan?.(layout.plan);
  }, [layout, onPlan]);
  const reading = books.findIndex((b) => b.status === ReadingStatus.READING && isOnShelf(b));
  const figure = useAvatar(avatar, pet);

  // Which floors have come near the screen: their covers get read.
  useEffect(() => {
    const floors = scene.current?.querySelectorAll<HTMLElement>("[data-floor]");
    if (!floors?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.floor));
        if (shown.length) setSeen((prev) => (shown.every((f) => prev.has(f)) ? prev : new Set([...prev, ...shown])));
      },
      { rootMargin: "400px 0px" },
    );
    floors.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [layout]);

  const covers = useMemo(() => {
    if (!layout) return [];
    const urls = new Set<string>();
    if (reading >= 0 && books[reading].coverUrl) urls.add(books[reading].coverUrl!);
    layout.floors.forEach((floor, f) => {
      if (!seen.has(f)) return;
      for (const piece of floor) {
        if (piece.kind !== "case") continue;
        for (const i of layout.cases[piece.caseIndex!].flat()) {
          if (books[i].coverUrl) urls.add(books[i].coverUrl!);
        }
      }
    });
    return [...urls];
  }, [layout, seen, books, reading]);
  const known = useCoverColours(covers);

  const openBook = useMemo<OpenBook | null>(
    () => (reading >= 0 ? { index: reading, book: books[reading], colour: colourOf(books[reading], known) } : null),
    [books, reading, known],
  );

  // A note about the last move goes after a while.
  useEffect(() => {
    if (!note?.shown) return;
    const timer = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(timer);
  }, [note]);

  /** Moves a piece of furniture, if it fits there: `floor` counts up from
   *  the ground floor. */
  const move = (kind: Movable, floor: number, slot: number): boolean => {
    if (!layout || !onArrange) return false;
    const places = moveTo(layout.plan, kind, floor, slot);
    const wanted = places?.find((p) => p.kind === kind);
    if (!places || !wanted) return false;
    const next: Arrangement = { ...arrangement, places };
    const plan = planHouse(layout.caseTotal, books.length, layout.maxInner, next);
    const landed = placementsOf(plan).find((p) => p.kind === kind);
    const name = FURNITURE_LABELS[kind];
    if (!landed || landed.floor !== wanted.floor || landed.slot !== wanted.slot) {
      setNote({ text: `There isn't room for the ${name.toLowerCase()} there.`, shown: true });
      return false;
    }
    const row = plan.floors[plan.floors.length - 1 - landed.floor].filter((p) => p.kind !== "ladder");
    setNote({
      text: `${name}: ${landed.room ? `the ${ROOM_LABELS[landed.room].name.toLowerCase()}` : floorName(landed.floor)}, ${landed.slot + 1} of ${row.length} from the left.`,
      shown: false,
    });
    onArrange(next);
    return true;
  };

  /** Shows the label over a spine (or the open book) being pointed at or
   *  focused. */
  const showTip = (el: Element | null) => {
    const target = el?.closest<HTMLElement>("[data-book]");
    const box = scene.current?.getBoundingClientRect();
    if (!target || !box || arranging) return setTip(null);
    const rect = target.getBoundingClientRect();
    // Centred over the book, but kept inside the scene at its edges.
    const half = Math.min(TIP_HALF_WIDTH, box.width / 2);
    setTip({
      index: Number(target.dataset.book),
      left: Math.min(Math.max(rect.left + rect.width / 2 - box.left, half), box.width - half),
      top: rect.top - box.top,
    });
  };

  /** Arrow keys move along the shelves: left and right through the books in
   *  order, up and down to the nearest book on the shelf above or below. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (arranging && e.key === "Escape") {
      e.preventDefault();
      onDone?.();
      return;
    }
    const from = (e.target as HTMLElement).closest<HTMLElement>("[data-spine]");
    if (!from || e.altKey || e.ctrlKey || e.metaKey) return;
    const spines = [...(scene.current?.querySelectorAll<HTMLElement>("[data-spine]") ?? [])];
    const at = spines.indexOf(from);
    let next: HTMLElement | undefined;
    if (e.key === "ArrowRight") next = spines[at + 1];
    else if (e.key === "ArrowLeft") next = spines[at - 1];
    else if (e.key === "Home") next = spines[0];
    else if (e.key === "End") next = spines[spines.length - 1];
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const here = from.getBoundingClientRect();
      const up = e.key === "ArrowUp";
      const rows = spines
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => (up ? rect.bottom <= here.top + 1 : rect.top >= here.bottom - 1));
      // The nearest shelf in that direction, then the book closest across.
      const shelfY = up
        ? Math.max(...rows.map((r) => r.rect.bottom))
        : Math.min(...rows.map((r) => r.rect.bottom));
      const centre = here.left + here.width / 2;
      next = rows
        .filter((r) => Math.abs(r.rect.bottom - shelfY) < 2)
        .sort(
          (a, b) =>
            Math.abs(a.rect.left + a.rect.width / 2 - centre) -
            Math.abs(b.rect.left + b.rect.width / 2 - centre),
        )[0]?.el;
    } else return;
    e.preventDefault();
    next?.focus();
  };

  if (!layout || !shell) {
    return <div ref={wrap} className="room-wrap" style={{ minHeight: "28rem" }} />;
  }

  const { scale: s, geo, sceneH } = layout;
  const at = (x: number, y: number): React.CSSProperties => ({ left: x * s, top: y * s });
  const tipBook = tip ? books[tip.index] : null;

  return (
    <div ref={wrap} className="room-wrap">
      <div
        ref={scene}
        className="room-scene"
        role="group"
        aria-label={arranging ? "Your reading room, moving furniture" : "Your bookshelves"}
        aria-describedby={arranging ? "room-arrange-keys" : "room-keys"}
        data-library-view=""
        data-returning={returning ? "" : undefined}
        {...decorData(decor)}
        data-arranging={arranging ? "" : undefined}
        style={{ width: geo.sceneW * s, height: sceneH * s, "--u": `${s}px` } as React.CSSProperties}
        onPointerOver={(e) => showTip(e.target as Element)}
        onPointerLeave={() => setTip(null)}
        onFocus={(e) => showTip(e.target)}
        onBlur={() => setTip(null)}
        onKeyDown={onKeyDown}
      >
        <svg
          className="room-abs"
          width={geo.sceneW * s}
          height={sceneH * s}
          viewBox={`0 0 ${geo.sceneW} ${sceneH}`}
          shapeRendering="crispEdges"
          aria-hidden="true"
          focusable="false"
        >
          <Rects rects={shell.rects} />
          {shell.storeys.map((st, i) =>
            st.walls === "style" ? (
              <Rects key={i} rects={st.rects} />
            ) : (
              // A room painted a colour of its own.
              <g key={i} data-room-walls={st.walls}>
                <Rects rects={st.rects} />
              </g>
            ),
          )}
          {shell.twinkle.map((t, i) => (
            <Rects key={`twinkle-${i}`} className={`room-twinkle room-twinkle-${i}`} rects={t} />
          ))}
          <Rects rects={shell.over} />
        </svg>
        {shell.smoke && <Smoke x={shell.smoke.x} y={shell.smoke.y} steam={shell.smoke.steam} scale={s} />}
        {shell.yard.map((y, i) => (
          <Sprite key={i} art={y.art} scale={s} className="room-abs" style={at(y.x, y.y)} />
        ))}
        {shell.moving.map((m, i) => (
          <MovingPart key={i} part={m} scale={s} />
        ))}
        {shell.lights.map((l, i) => (
          <Glow key={i} x={l.x} y={l.y} r={l.r} scale={s} />
        ))}
        {shell.fireflies.map((box, i) => (
          <Fireflies key={i} box={box} scale={s} />
        ))}

        {layout.floors.map((pieces, f) => (
          <Floor
            key={f}
            index={f}
            pieces={pieces}
            top={geo.floorsTop + f * STOREY}
            left={geo.houseX + WALL}
            width={geo.houseW - 2 * WALL}
            scale={s}
            books={books}
            cases={layout.cases}
            known={known}
            current={within(current, layout.floorRange[f])}
            onCurrent={setCurrent}
            cat={layout.cat}
            openBook={openBook}
            hanging={decor.hanging}
            arranging={arranging}
            avatar={figure}
          />
        ))}

        {arranging && (
          <ArrangeHandles
            layout={layout}
            scene={scene}
            onMove={move}
            onEdge={(text) => setNote({ text, shown: true })}
            onDone={onDone}
          />
        )}

        <p id="room-keys" className="sr-only">
          Use the arrow keys to move from book to book, and Enter to open one.
        </p>
        <p id="room-arrange-keys" className="sr-only">
          Drag a piece of furniture to move it, or use the arrow keys. Press Escape when you&apos;re done.
        </p>
        <p className="sr-only" aria-live="polite">
          {arranging && note?.text}
        </p>
        {arranging && note?.shown && (
          <p className="room-note" aria-hidden="true">
            {note.text}
          </p>
        )}
        {tipBook && tip && (
          <div className="room-tip" style={{ left: tip.left, top: tip.top }} aria-hidden="true">
            <p className="font-heading font-medium">{tipBook.title}</p>
            {tipBook.author && <p className="text-muted-foreground">{tipBook.author}</p>}
            <p className="text-muted-foreground">{statusLine(tipBook)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Arranging ────────────────────────────────────────────────────────────

interface Drag {
  kind: Movable;
  pointer: number;
  /** Where the pointer took hold, and where it is now, in scene dots. */
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  /** The pointer's offset from the piece's left edge. */
  grab: number;
  moved: boolean;
}

const DIRECTIONS: Record<string, "left" | "right" | "up" | "down"> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/**
 * A handle over each piece of furniture that can move, to drag it to
 * another place or floor, with a line where it would go. The arrow keys
 * move a focused one a place at a time; it keeps focus as it goes.
 */
function ArrangeHandles({
  layout,
  scene,
  onMove,
  onEdge,
  onDone,
}: {
  layout: Layout;
  scene: React.RefObject<HTMLDivElement | null>;
  onMove: (kind: Movable, floor: number, slot: number) => boolean;
  /** A piece can't go any further that way. */
  onEdge: (text: string) => void;
  onDone?: () => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const handles = useRef(new Map<Movable, HTMLButtonElement>());
  const following = useRef<Movable | null>(null);
  const { scale: s, geo, floors } = layout;
  const left = geo.houseX + WALL;
  const top = (f: number) => geo.floorsTop + f * STOREY + BEAM;

  // A piece moved from the keyboard to another floor: keep it in view.
  useEffect(() => {
    const kind = following.current;
    following.current = null;
    if (kind) handles.current.get(kind)?.scrollIntoView({ block: "nearest" });
  }, [layout]);

  /** Where a dragged piece would land: the floor (top first), the place
   *  among the pieces there, and the line between them, in scene dots. */
  const target = (d: Drag) => {
    const f = Math.max(0, Math.min(floors.length - 1, Math.floor((d.y - geo.floorsTop) / STOREY)));
    const others = floors[f].filter((p) => p.kind !== d.kind);
    const row = others.filter((p) => p.kind !== "ladder");
    const middle = d.x - d.grab + PIECE_WIDTH[d.kind] / 2 - left;
    const slot = row.filter((p) => p.x + PIECE_WIDTH[p.kind] / 2 < middle).length;
    const next = row[slot];
    const ends = others.filter((p) => !next || p.x < next.x).map((p) => p.x + PIECE_WIDTH[p.kind]);
    const end = ends.length ? Math.max(...ends) : 0;
    const line = next ? (end + next.x) / 2 : Math.min(end + GAP / 2, geo.houseW - 2 * WALL - 1);
    return { f, slot, line: left + line };
  };

  const scenePoint = (e: React.PointerEvent) => {
    const box = scene.current!.getBoundingClientRect();
    return { x: (e.clientX - box.left) / s, y: (e.clientY - box.top) / s };
  };

  const pieces = floors.flatMap((row, f) =>
    row.flatMap((p) => (isMovable(p.kind) ? [{ kind: p.kind, f, x: p.x }] : [])),
  );
  const drop = drag?.moved ? target(drag) : null;

  return (
    <>
      {drop && (
        <div
          className="room-drop"
          aria-hidden="true"
          style={{ left: (drop.line - 1) * s, top: top(drop.f) * s, width: 2 * s, height: ROOM_HEIGHT * s }}
        />
      )}
      {pieces.map(({ kind, f, x }) => {
        const name = FURNITURE_LABELS[kind];
        const dragging = drag?.kind === kind && drag.moved;
        return (
          <button
            key={kind}
            ref={(el) => {
              if (el) handles.current.set(kind, el);
              else handles.current.delete(kind);
            }}
            type="button"
            className="room-handle"
            data-dragging={dragging ? "" : undefined}
            aria-label={`Move the ${name.toLowerCase()}`}
            style={{
              left: (left + x) * s,
              top: top(f) * s,
              width: PIECE_WIDTH[kind] * s,
              height: ROOM_HEIGHT * s,
              translate: dragging ? `${(drag.x - drag.fromX) * s}px ${(drag.y - drag.fromY) * s}px` : undefined,
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const p = scenePoint(e);
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ kind, pointer: e.pointerId, fromX: p.x, fromY: p.y, x: p.x, y: p.y, grab: p.x - left - x, moved: false });
            }}
            onPointerMove={(e) => {
              if (drag?.pointer !== e.pointerId) return;
              const p = scenePoint(e);
              const moved = drag.moved || Math.abs(p.x - drag.fromX) + Math.abs(p.y - drag.fromY) > 3;
              setDrag({ ...drag, x: p.x, y: p.y, moved });
            }}
            onPointerUp={(e) => {
              if (drag?.pointer !== e.pointerId) return;
              setDrag(null);
              if (!drag.moved) return;
              const t = target(drag);
              onMove(kind, floors.length - 1 - t.f, t.slot);
            }}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onDone?.();
                return;
              }
              const direction = DIRECTIONS[e.key];
              if (!direction || e.altKey || e.ctrlKey || e.metaKey) return;
              e.preventDefault();
              const to = nudge(layout.plan, kind, direction);
              const it = `The ${name.toLowerCase()}`;
              if (!to) {
                onEdge(
                  direction === "up"
                    ? `${it} is on the top floor.`
                    : direction === "down"
                      ? `${it} is on the ground floor.`
                      : `${it} is at the ${direction} wall.`,
                );
              } else if (onMove(kind, to.floor, to.slot) && (direction === "up" || direction === "down")) {
                following.current = kind;
              }
            }}
          >
            <span className="room-handle-name">{name}</span>
          </button>
        );
      })}
    </>
  );
}

/** One storey, wall to wall and from the floor above's boards to its own,
 *  with everything in it measured from its top left. Lamplight stays
 *  inside it. Off screen the browser skips drawing it. */
const Floor = memo(function Floor({
  index,
  pieces,
  top,
  left,
  width,
  scale: s,
  books,
  cases,
  known,
  current,
  onCurrent,
  cat,
  openBook,
  hanging,
  arranging,
  avatar,
}: {
  index: number;
  pieces: Piece[];
  top: number;
  left: number;
  width: number;
  scale: number;
  books: RoomBook[];
  cases: number[][][];
  known: Record<string, string>;
  current: number;
  onCurrent: (index: number) => void;
  cat: boolean;
  openBook: OpenBook | null;
  hanging: RoomHanging;
  /** While the furniture is being moved, the books stay put. */
  arranging: boolean;
  avatar: Avatar | null;
}) {
  const floorLine = STOREY;
  const hearth = pieces.find((p) => p.kind === "hearth");
  return (
    <div
      className="room-floor"
      data-floor={index}
      inert={arranging}
      style={{ left: left * s, top: top * s, width: width * s, height: STOREY * s }}
    >
      {pieces.map((piece) => {
        const x = piece.x;
        if (piece.kind === "case") {
          const n = piece.caseIndex!;
          const shelves = cases[n];
          const all = shelves.flat();
          return (
            <Bookcase
              key={`case-${n}`}
              index={n}
              shelves={shelves}
              books={books}
              x={x}
              y={floorLine - CASE_HEIGHT}
              scale={s}
              known={known}
              current={all.length ? within(current, [all[0], all[all.length - 1]]) : -1}
              onCurrent={onCurrent}
            />
          );
        }
        return (
          <Furniture
            key={piece.kind}
            kind={piece.kind}
            x={x}
            floorLine={floorLine}
            ceiling={BEAM}
            scale={s}
            cat={cat}
            openBook={openBook}
            hanging={hanging}
            avatar={avatar}
          />
        );
      })}
      {/* Up and about while no book is being read; out of the way while
          the furniture moves. */}
      {avatar && hearth && !openBook && !arranging && (
        <Walker avatar={avatar} width={width} home={hearth.x + 40} floorLine={floorLine} scale={s} />
      )}
    </div>
  );
});

const Bookcase = memo(function Bookcase({
  index,
  shelves,
  books,
  x,
  y,
  scale: s,
  known,
  current,
  onCurrent,
}: {
  index: number;
  shelves: number[][];
  books: RoomBook[];
  x: number;
  y: number;
  scale: number;
  known: Record<string, string>;
  /** The book that takes Tab focus, if it is in this bookcase; else -1. */
  current: number;
  onCurrent: (index: number) => void;
}) {
  return (
    <div className="room-abs" style={{ left: x * s, top: y * s }}>
      <Sprite art={BOOKCASE} scale={s} className="block" />
      {shelves.map((shelf, j) => {
        const used = shelf.reduce((sum, i) => sum + spineFor(books[i]).width, 0);
        const dressing = dressShelf(index * SHELVES_PER_CASE + j, used);
        const slotTop = CASE_CROWN + j * (SHELF_SLOT + SHELF_BOARD);
        return (
          <ul
            key={j}
            className="room-shelf"
            aria-label={`Bookcase ${index + 1}, shelf ${j + 1}`}
            style={{ left: 3 * s, top: slotTop * s, width: 40 * s, height: SHELF_SLOT * s }}
          >
            {shelf.map((i, k) => {
              const book = books[i];
              const spine = spineFor(book);
              return (
                <li key={book.id} className="contents">
                  <BookLink
                    bookId={book.id}
                    prefetch={false}
                    className="room-spine"
                    data-spine=""
                    data-book={i}
                    data-flight-cover=""
                    data-pattern={spine.pattern}
                    data-away={isOnShelf(book) ? undefined : ""}
                    data-reading={book.status === ReadingStatus.READING ? "" : undefined}
                    tabIndex={i === current ? 0 : -1}
                    aria-label={spineLabel(book)}
                    onFocus={() => onCurrent(i)}
                    style={
                      {
                        width: spine.width * s,
                        height: spine.height * s,
                        "--spine": colourOf(book, known),
                        "--i": Math.min(k, 12),
                      } as React.CSSProperties
                    }
                  />
                </li>
              );
            })}
            {dressing.bookend && (
              <li className="contents" aria-hidden="true">
                <Sprite art={BOOKEND} scale={s} className="room-abs" style={{ left: used * s, bottom: 0 }} />
              </li>
            )}
            {dressing.ornaments.map((o) => (
              <li key={o.kind + o.x} className="contents" aria-hidden="true">
                <Sprite
                  art={ORNAMENT_ART[o.kind]}
                  scale={s}
                  className="room-abs"
                  style={{ left: (o.x + (ORNAMENT_WIDTH[o.kind] - ORNAMENT_ART[o.kind].w) / 2) * s, bottom: 0 }}
                />
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
});

/** Smoke rising from the chimney pot whose top is at `x`, `y`, or steam
 *  from a stack. */
function Smoke({ x, y, steam, scale: s }: { x: number; y: number; steam: boolean; scale: number }) {
  return (
    <div
      className={`room-smoke room-abs ${steam ? "room-smoke-steam" : ""}`}
      aria-hidden="true"
      style={{ left: x * s, top: (y - 3) * s }}
    >
      <span />
      <span />
      <span />
    </div>
  );
}

/** A banner, gear, torch or beacon on the house, in its frames. */
function MovingPart({ part, scale: s }: { part: Moving; scale: number }) {
  const [first, second] = part.frames;
  return (
    <Sprite art={part.art} scale={s} className={`room-abs room-${part.motion}`} style={{ left: part.x * s, top: part.y * s }}>
      {second ? (
        <>
          <Rects className="room-frame-a" rects={first} />
          <Rects className="room-frame-b" rects={second} />
        </>
      ) : (
        <Rects className="room-blinker" rects={first} />
      )}
    </Sprite>
  );
}

/** Where the fireflies are, as fractions of their box, and their timing:
 *  fixed, so they're in the same places on every visit. */
const FIREFLIES = Array.from({ length: 5 }, (_, i) => ({
  x: (i * 0.37 + 0.11) % 1,
  y: (i * 0.61 + 0.23) % 1,
  t: 5 + ((i * 1.7) % 3),
  p: -((i * 2.3) % 6),
}));

/** Fireflies drifting over the garden, at night only. */
function Fireflies({ box, scale: s }: { box: Shell["fireflies"][number]; scale: number }) {
  return (
    <div
      className="room-fireflies room-abs"
      aria-hidden="true"
      style={{ left: box.x * s, top: box.y * s, width: box.w * s, height: box.h * s }}
    >
      {FIREFLIES.map((f, i) => (
        <span
          key={i}
          style={
            {
              left: `${f.x * 100}%`,
              top: `${f.y * 100}%`,
              "--t": `${f.t}s`,
              "--p": `${f.p}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Furniture({
  kind,
  x,
  floorLine,
  ceiling,
  scale: s,
  cat,
  openBook,
  hanging,
  avatar,
}: {
  kind: Piece["kind"];
  x: number;
  floorLine: number;
  ceiling: number;
  scale: number;
  cat: boolean;
  openBook: OpenBook | null;
  hanging: RoomHanging;
  avatar: Avatar | null;
}) {
  const stand = (a: Art, dx: number, extra?: { className?: string; children?: React.ReactNode; lift?: number }) => (
    <Stand
      key={`${dx}-${a.w}-${a.h}`}
      art={a}
      x={x + dx}
      floorLine={floorLine - (extra?.lift ?? 0)}
      scale={s}
      className={extra?.className}
    >
      {extra?.children}
    </Stand>
  );

  switch (kind) {
    case "hearth": {
      const fireTop = floorLine - FIREPLACE.h;
      const chairTop = floorLine - ARMCHAIR.h;
      const seated = avatar && openBook;
      const hung = hanging === "none" ? null : HANGINGS[hanging];
      return (
        <>
          {stand(rugArt(56), 46)}
          {hung && (
            // Centred over the fireplace; a tapestry hangs from higher up.
            <Sprite
              art={hung}
              scale={s}
              className="room-abs room-art-dim"
              style={{ left: (x + 22 - hung.w / 2) * s, top: (floorLine - (hanging === "painting" ? 92 : 106)) * s }}
            />
          )}
          {stand(FIREPLACE, 0, {
            children: (
              <>
                <Rects rects={LOGS.map(([rx, ry, w, h, p]) => [rx + 15, ry + 37, w, h, p] as const)} />
                <Rects className="room-frame-a" rects={FLAMES_A.map(([rx, ry, w, h, p]) => [rx + 15, ry + 28, w, h, p] as const)} />
                <Rects className="room-frame-b" rects={FLAMES_B.map(([rx, ry, w, h, p]) => [rx + 15, ry + 28, w, h, p] as const)} />
              </>
            ),
          })}
          <Glow x={x + 22} y={fireTop + 36} r={44} scale={s} className="room-glow-fire" />
          {stand(CANDLESTICK, 4, { lift: FIREPLACE.h })}
          {stand(CANDLESTICK, 37, { lift: FIREPLACE.h })}
          {stand(MANTEL_CLOCK, 18, { lift: FIREPLACE.h })}
          {stand(ARMCHAIR, 50)}
          {seated && (
            <SeatedAvatar
              avatar={avatar}
              x={x + 50 + SEAT_OFFSET.x}
              y={chairTop + seatedTop(avatar.art.sit)}
              spine={openBook.colour}
              scale={s}
            />
          )}
          {/* Their pet sleeps at their feet while they read. */}
          {seated && avatar.pet && <SleepingPet pet={avatar.pet} right={x + 69} floorLine={floorLine} scale={s} />}
          {/* The cat has the armchair, unless someone's reading in it; then
              it curls up on the rug at their feet. */}
          {cat &&
            stand(CAT, seated ? 70 : 57, {
              lift: seated ? 0 : 11,
              children: <Rects className="room-tail" rects={CAT_TAIL} />,
            })}
          {stand(SIDE_TABLE, 81)}
          {stand(TEACUP, 88, {
            lift: SIDE_TABLE.h,
          })}
          <Sprite
            art={{ w: 2, h: 3, rects: STEAM[0] }}
            scale={s}
            className="room-abs room-steam"
            style={{ left: (x + 89) * s, top: (floorLine - SIDE_TABLE.h - TEACUP.h - 4) * s }}
          />
          {seated && (
            <BookLink
              bookId={openBook.book.id}
              prefetch={false}
              className="room-abs room-held-book"
              data-book={openBook.index}
              aria-label={`Reading in the armchair: ${spineLabel(openBook.book)}`}
              style={{
                left: (x + 50 + SEAT_OFFSET.x + HELD_BOOK.x) * s,
                top: (chairTop + seatedTop(avatar.art.sit) + HELD_BOOK.y) * s,
                width: HELD_BOOK.w * s,
                height: HELD_BOOK.h * s,
              }}
            />
          )}
          {openBook && !seated && (
            <BookLink
              bookId={openBook.book.id}
              prefetch={false}
              className="room-abs room-open-book"
              data-book={openBook.index}
              aria-label={`On the side table: ${spineLabel(openBook.book)}`}
              style={{ left: (x + 80) * s, top: (floorLine - SIDE_TABLE.h - OPEN_BOOK.h) * s, "--spine": openBook.colour } as React.CSSProperties}
            >
              <Sprite art={OPEN_BOOK} scale={s} className="block" />
            </BookLink>
          )}
          {stand(LAMP, 93)}
          <Glow x={x + 99} y={floorLine - 54} r={30} scale={s} />
        </>
      );
    }
    case "seat":
      return (
        <>
          {/* The sill just over the seat's cushions. */}
          <Sprite art={WINDOW} scale={s} className="room-abs" style={{ left: (x + 3) * s, top: (floorLine - 71) * s }} />
          {/* Sunlight through the lower panes, slanting down to the floor. */}
          <div
            className="room-sunbeam"
            aria-hidden="true"
            style={{ left: (x + 11) * s, top: (floorLine - 46) * s, width: 54 * s, height: 46 * s }}
          />
          {stand(BENCH, 6)}
          <Pendant x={x + 20} ceiling={ceiling} scale={s} />
        </>
      );
    case "study":
      return (
        <>
          <Sprite art={SEASCAPE} scale={s} className="room-abs room-art-dim" style={{ left: (x + 2) * s, top: (floorLine - 78) * s }} />
          {stand(DESK, 0)}
          <Glow x={x + 6} y={floorLine - 32} r={18} scale={s} />
          {stand(GLOBE, 37)}
        </>
      );
    case "gramophone":
      return (
        <>
          {stand(GRAMOPHONE, 0)}
          <Pendant x={x + 7} ceiling={ceiling} scale={s} />
        </>
      );
    case "clock":
      return stand(CLOCK, 1, {
        children: PENDULUM.map((frame, i) => <Rects key={i} className={`room-swing-${i}`} rects={frame} />),
      });
    case "plant":
      return stand(PLANT, 0);
    case "ladder":
      // Hooked over the crown of the bookcase on its left.
      return stand(LADDER, -4);
    case "case":
      return null;
    default:
      // The furniture of an added room.
      return isExtra(kind) ? (
        <ExtraView kind={kind} x={x} floorLine={floorLine} scale={s} />
      ) : (
        <RoomPieceView kind={kind} x={x} floorLine={floorLine} ceiling={ceiling} scale={s} />
      );
  }
}

// ── Previews for Decorate ────────────────────────────────────────────────

/** The data attributes that colour a scene (or a preview) in `decor`'s
 *  style and colours (reading-room.css). */
export function decorData(decor: RoomDecor): Record<string, string | undefined> {
  const pick = (value: string) => (value === "style" ? undefined : value);
  return {
    "data-style": decor.style,
    "data-derive": decor.style === "cottage" ? undefined : "",
    "data-walls": pick(decor.walls),
    "data-wood": pick(decor.wood),
    "data-fabric": pick(decor.fabric),
    "data-cat": decor.cat === "ginger" ? undefined : decor.cat,
    "data-dog": decor.dog === "brown" ? undefined : decor.dog,
  };
}

const shift = (rects: readonly Rect[], dx: number, dy: number): Rect[] =>
  rects.map(([x, y, w, h, p]): Rect => [x + dx, y + dy, w, h, p]);

const PREVIEW_SPINES: Rect[] = (() => {
  const paints = ["spine-a", "chair", "rug-2", "spine-b", "curtain", "wood-lo", "chair-lo"] as const;
  const out: Rect[] = [];
  let n = 0;
  for (let j = 0; j < SHELVES_PER_CASE; j++) {
    const bottom = CASE_CROWN + j * (SHELF_SLOT + SHELF_BOARD) + SHELF_SLOT;
    for (let x = 3; x < 3 + SHELF_WIDTH - 6; n++) {
      const w = 3 + ((n * 7) % 3);
      const h = 13 + ((n * 5) % 6);
      out.push([x, bottom - h, w, h, paints[(n * 3 + j) % paints.length]]);
      x += w;
    }
  }
  return out;
})();

/** A small picture of one floor of the house in a style: the fireplace,
 *  armchair and lamp, and a bookcase of books. */
function previewArt(style: RoomStyle, hanging: RoomHanging): { w: number; h: number; rects: Rect[] } {
  const inner = 2 * PAD + PIECE_WIDTH.hearth + GAP + PIECE_WIDTH.case;
  const geo = houseGeometry(style, yardFor(3), inner + 2 * WALL, 1, PAD);
  const shell = shellArt(geo, style);
  const R: Rect[] = [...shell.rects, ...shell.storeys.flatMap((st) => st.rects), ...shell.twinkle.flat(), ...shell.over];
  for (const y of shell.yard) R.push(...shift(y.art.rects, y.x, y.y));
  for (const m of shell.moving) R.push(...shift(m.frames[0], m.x, m.y));
  const fx = geo.houseX + WALL + PAD;
  const line = geo.floorsTop + STOREY;
  const stand = (a: Art, dx: number, lift = 0) => R.push(...shift(a.rects, fx + dx, line - lift - a.h));
  stand(rugArt(56), 46);
  const hung = hanging === "none" ? null : HANGINGS[hanging];
  if (hung) R.push(...shift(hung.rects, fx + 22 - hung.w / 2, line - (hanging === "painting" ? 92 : 106)));
  stand(FIREPLACE, 0);
  R.push(...shift(LOGS, fx + 15, line - FIREPLACE.h + 37), ...shift(FLAMES_A, fx + 15, line - FIREPLACE.h + 28));
  stand(CANDLESTICK, 4, FIREPLACE.h);
  stand(CANDLESTICK, 37, FIREPLACE.h);
  stand(MANTEL_CLOCK, 18, FIREPLACE.h);
  stand(ARMCHAIR, 50);
  stand(SIDE_TABLE, 81);
  stand(TEACUP, 88, SIDE_TABLE.h);
  stand(LAMP, 93);
  const bx = fx + PIECE_WIDTH.hearth + GAP;
  R.push(...shift(BOOKCASE.rects, bx, line - CASE_HEIGHT), ...shift(PREVIEW_SPINES, bx, line - CASE_HEIGHT));
  return { w: geo.sceneW, h: sceneHeight(geo), rects: R };
}

/** A house style in miniature, coloured by the scene (or element with
 *  decorData) around it. */
export const HousePreview = memo(function HousePreview({ style, hanging }: { style: RoomStyle; hanging: RoomHanging }) {
  const a = useMemo(() => previewArt(style, hanging), [style, hanging]);
  return (
    <svg
      className="room-preview"
      viewBox={`0 0 ${a.w} ${a.h}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Rects rects={a.rects} />
    </svg>
  );
});

/** What hangs over the fireplace, on its own. */
export function HangingPreview({ hanging, scale = 2 }: { hanging: Exclude<RoomHanging, "none">; scale?: number }) {
  return <Sprite art={HANGINGS[hanging]} scale={scale} className="block" />;
}
