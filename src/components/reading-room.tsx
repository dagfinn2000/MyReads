"use client";

import "./reading-room.css";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  PENDANT,
  PENDULUM,
  PLANT,
  Rects,
  SHRUB,
  SIDE_TABLE,
  STEAM,
  Sprite,
  TEACUP,
  armchairArt,
  benchArt,
  bookcaseArt,
  clockArt,
  deskArt,
  fireplaceArt,
  floorLampArt,
  gramophoneArt,
  houseArt,
  ladderArt,
  paintingArt,
  roofSurface,
  rugArt,
  windowArt,
  type Art,
  type HouseGeometry,
} from "@/components/room-art";
import { isClosingBook } from "@/lib/cover-flight";
import { OWNERSHIP_LABELS, STATUS_LABELS } from "@/lib/display";
import {
  BEAM,
  CASE_CROWN,
  CASE_HEIGHT,
  ORNAMENT_WIDTH,
  ROOM_HEIGHT,
  SHELF_BOARD,
  SHELF_SLOT,
  SHELVES_PER_CASE,
  WALL,
  caseCount,
  dressShelf,
  isOnShelf,
  planHouse,
  shelve,
  spineFor,
  type Piece,
  type RoomBook,
} from "@/lib/room";
import { drawnSpineColour, spineColour } from "@/lib/spine-colour";

/** Garden either side of the house, and the stone and grass under it. */
const YARD = 14;
const FOUNDATION = 6;
const GROUND = 6;
/** The chimney's height over the roof, pot included; and the room its
 *  smoke needs above that. */
const CHIMNEY = 16;
const CHIMNEY_WIDTH = 10;
const SMOKE = 20;
const STOREY = BEAM + ROOM_HEIGHT;
/** Half the label's widest (15rem in reading-room.css). */
const TIP_HALF_WIDTH = 120;

/** Screen pixels to a dot: whole numbers only, so the art stays crisp. */
function scaleFor(width: number): number {
  return width < 560 ? 2 : 3;
}

// Drawn once: the art never changes, only where it goes.
const BOOKCASE = bookcaseArt();
const FIREPLACE = fireplaceArt();
const PAINTING = paintingArt("hills");
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
  floors: Piece[][];
  cat: boolean;
  /** Top of the chimney pot, where the smoke starts. */
  smoke: { x: number; y: number };
  /** Each bookcase's shelves, as indexes into the books. */
  cases: number[][][];
  /** The first and last book index in each floor, for the arrow keys'
   *  focus to redraw only the floors it touches. [-1, -1] for none. */
  floorRange: [number, number][];
}

function layoutRoom(books: RoomBook[], width: number): Layout {
  const scale = scaleFor(width);
  const shelves = shelve(books.map((b) => spineFor(b).width));
  const count = caseCount(shelves.length);
  const cases = Array.from({ length: count }, (_, i) =>
    Array.from({ length: SHELVES_PER_CASE }, (_, j) => shelves[i * SHELVES_PER_CASE + j] ?? []),
  );
  const maxInner = Math.floor(width / scale) - 2 * YARD - 2 * WALL;
  const plan = planHouse(count, books.length, maxInner);
  const houseW = plan.inner + 2 * WALL;
  const sceneW = houseW + 2 * YARD;
  // 2 across for 1 up, flattened to a long ridge on a wide house.
  const roofH = Math.max(14, Math.min(40, Math.floor((houseW + 8) / 4)));
  const ground = plan.floors[plan.floors.length - 1];
  const hearth = ground.find((p) => p.kind === "hearth");
  const chimneyX = YARD + WALL + (hearth ? hearth.x + 17 : 12);
  // Sky over the roof for the chimney (it stands CHIMNEY dots above the
  // roof where it comes through) and SMOKE more for its smoke.
  const flat = { sceneW, houseX: YARD, houseW, roofTop: 0, roofH } as HouseGeometry;
  const roofTop = Math.max(4, CHIMNEY + SMOKE - roofSurface(flat, chimneyX + CHIMNEY_WIDTH));
  const geo: HouseGeometry = {
    sceneW,
    houseX: YARD,
    houseW,
    roofTop,
    roofH,
    floorsTop: roofTop + roofH,
    floorCount: plan.floors.length,
    storey: STOREY,
    roomH: ROOM_HEIGHT,
    beam: BEAM,
    wall: WALL,
    foundation: FOUNDATION,
    ground: GROUND,
    chimneyX,
  };
  const sceneH = geo.floorsTop + plan.floors.length * STOREY + BEAM + FOUNDATION + GROUND;
  const floorRange = plan.floors.map((floor): [number, number] => {
    const inFloor = floor.flatMap((p) => (p.kind === "case" ? cases[p.caseIndex!].flat() : []));
    return inFloor.length ? [inFloor[0], inFloor[inFloor.length - 1]] : [-1, -1];
  });
  return {
    scale,
    geo,
    sceneH,
    floors: plan.floors,
    cat: plan.cat,
    smoke: { x: chimneyX + 3, y: roofSurface(geo, chimneyX + CHIMNEY_WIDTH) - CHIMNEY },
    cases,
    floorRange,
  };
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

/**
 * The library as a cozy pixel-art house: every book a spine on a shelf, in
 * the order a bookshelf files them, and a house that gains bookcases,
 * furniture and floors as the library grows (lib/room.ts lays it out,
 * room-art.tsx draws it).
 *
 * Spines take their cover's main colour, or the drawn cover's colour for a
 * book without an image. Covers are read as their floor scrolls into view,
 * so a big library doesn't fetch every cover at once. Hovering or focusing
 * a spine shows its title; clicking opens the book, whose page then has an
 * X that flies it back onto its shelf. The shelves are one stop for Tab,
 * with the arrow keys moving from book to book.
 *
 * It is drawn in the browser only: how many bookcases fit side by side
 * depends on the width it has.
 */
export function ReadingRoom({ books }: { books: RoomBook[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());
  const [tip, setTip] = useState<{ index: number; left: number; top: number } | null>(null);
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

  const layout = useMemo(() => (width ? layoutRoom(books, width) : null), [books, width]);
  const shell = useMemo(() => (layout ? houseArt(layout.geo) : []), [layout]);
  const reading = books.findIndex((b) => b.status === ReadingStatus.READING && isOnShelf(b));

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

  /** Shows the label over a spine (or the open book) being pointed at or
   *  focused. */
  const showTip = (el: Element | null) => {
    const target = el?.closest<HTMLElement>("[data-book]");
    const box = scene.current?.getBoundingClientRect();
    if (!target || !box) return setTip(null);
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

  if (!layout) {
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
        aria-label="Your bookshelves"
        aria-describedby="room-keys"
        data-library-view=""
        data-returning={returning ? "" : undefined}
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
          <Rects rects={shell} />
        </svg>
        <Smoke x={layout.smoke.x} y={layout.smoke.y} scale={s} />
        {geo.roofH >= 20 && (
          <Glow x={geo.houseX + geo.houseW / 2} y={geo.roofTop + geo.roofH - 11} r={16} scale={s} />
        )}
        <Sprite art={SHRUB} scale={s} className="room-abs" style={at(1, sceneH - GROUND - SHRUB.h + 1)} />
        <Sprite
          art={SHRUB}
          scale={s}
          className="room-abs"
          style={at(geo.sceneW - SHRUB.w - 1, sceneH - GROUND - SHRUB.h + 1)}
        />

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
          />
        ))}

        <p id="room-keys" className="sr-only">
          Use the arrow keys to move from book to book, and Enter to open one.
        </p>
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
}) {
  const floorLine = STOREY;
  return (
    <div
      className="room-floor"
      data-floor={index}
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
          />
        );
      })}
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

/** A sprite standing on the floor, `x` from the scene's left. */
function Stand({ art: a, x, floorLine, scale: s, className, children }: {
  art: Art;
  x: number;
  floorLine: number;
  scale: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Sprite
      art={a}
      scale={s}
      className={`room-abs ${className ?? ""}`}
      style={{ left: x * s, top: (floorLine - a.h) * s }}
    >
      {children}
    </Sprite>
  );
}

/** A warm pool of light, shown at night (dark themes) only. */
function Glow({ x, y, r, scale: s, className }: { x: number; y: number; r: number; scale: number; className?: string }) {
  return (
    <div
      className={`room-glow ${className ?? ""}`}
      aria-hidden="true"
      style={{ left: (x - r) * s, top: (y - r) * s, width: 2 * r * s, height: 2 * r * s }}
    />
  );
}

/** Smoke rising from the chimney pot whose top is at `x`, `y`. */
function Smoke({ x, y, scale: s }: { x: number; y: number; scale: number }) {
  return (
    <div className="room-smoke room-abs" aria-hidden="true" style={{ left: x * s, top: (y - 3) * s }}>
      <span />
      <span />
      <span />
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
}: {
  kind: Piece["kind"];
  x: number;
  floorLine: number;
  ceiling: number;
  scale: number;
  cat: boolean;
  openBook: OpenBook | null;
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
      return (
        <>
          {stand(rugArt(56), 46)}
          <Sprite art={PAINTING} scale={s} className="room-abs room-art-dim" style={{ left: (x + 7) * s, top: (floorLine - 92) * s }} />
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
          {cat &&
            stand(CAT, 57, {
              lift: 11,
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
          {openBook && (
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
    default:
      return null;
  }
}

function Pendant({ x, ceiling, scale: s }: { x: number; ceiling: number; scale: number }) {
  return (
    <>
      <Sprite art={PENDANT} scale={s} className="room-abs" style={{ left: x * s, top: ceiling * s }} />
      <Glow x={x + 5.5} y={ceiling + 15} r={26} scale={s} />
    </>
  );
}
