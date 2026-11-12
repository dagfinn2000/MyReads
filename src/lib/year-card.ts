import { spineInk, type SpineDesign } from "@/lib/book-spine";
import {
  CARD_HEIGHTS,
  CARD_WIDTH,
  NIGHT_INK,
  PAPER_INK,
  clip,
  measureWith,
  paintNight,
  paintPaper,
  seedOf,
  seeded,
  shade,
  wrapLines,
  type QuoteCardShape,
} from "@/lib/quote-card";
import { longestRun, type YearWrapped } from "@/lib/year-wrapped";

/**
 * The year as a picture to keep or share, the last slide of the year's
 * story (components/year-story.tsx): the year set large, its four best
 * figures, the favourite genres and author, and every book finished
 * standing on a shelf along the foot, coloured from its cover. In three
 * looks and the quote pictures' two shapes. Drawn on a canvas in the
 * browser, so nothing is sent anywhere and nothing is kept.
 */

export const YEAR_CARD_LOOKS = ["paper", "night", "theme"] as const;
export type YearCardLook = (typeof YEAR_CARD_LOOKS)[number];

export const YEAR_CARD_LOOK_LABELS: Record<YearCardLook, string> = {
  paper: "Paper",
  night: "Night",
  theme: "Your theme",
};

export type YearCardShape = QuoteCardShape;

/** A big number and what it counts. */
export interface YearCardFigure {
  value: string;
  label: string;
}

/** A book on the shelf along the foot, shaped as in the Spines view. */
export interface YearCardSpine {
  colour: string;
  /** In rem at the Spines view's medium size (lib/book-spine.ts). */
  width: number;
  /** A share of the tallest: 0.84 to 1. */
  height: number;
  design: SpineDesign;
}

/** A cover in the tall picture's row of books. */
export interface YearCardBook {
  title: string;
  /** The cover's main colour, for a cover that can't be drawn. */
  colour: string;
  cover: HTMLImageElement | null;
}

export interface YearCardInput {
  year: number;
  current: boolean;
  figures: YearCardFigure[];
  genres: string[];
  author: string | null;
  /** The tall picture's row of covers, at most five. */
  books: YearCardBook[];
  booksLabel: string;
  spines: YearCardSpine[];
}

/** The reader's theme colours, for Your theme: any colour a canvas reads. */
export interface ThemeInk {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
}

export interface YearCardFonts {
  /** The book face, for the words. */
  serif: string;
  /** The face for the year and the figures: the book face, or the
   *  theme's heading face on Your theme. */
  heading: string;
}

/** "2026-in-books.png". */
export function yearCardFileName(year: number): string {
  return `${year}-in-books.png`;
}

/**
 * Up to four figures for the picture, the ones that say most first: books,
 * pages, the longest streak (or the days read, without one), and hours with
 * the timer; re-reads and days read fill in when one of those is missing.
 */
export function pickFigures(w: YearWrapped, fmt: (n: number) => string): YearCardFigure[] {
  const out: YearCardFigure[] = [];
  const streak = longestRun(w.days);
  const hours = Math.round(w.minutes / 60);
  out.push({ value: fmt(w.books), label: `${w.books === 1 ? "book" : "books"} ${w.bookWord}` });
  if (w.pages > 0) out.push({ value: fmt(w.pages), label: w.pages === 1 ? "page" : "pages" });
  const streakShown = streak !== null && streak.length > 1;
  if (streakShown) out.push({ value: fmt(streak.length), label: "days in a row" });
  else if (w.days.length > 0) out.push({ value: fmt(w.days.length), label: w.days.length === 1 ? "day reading" : "days reading" });
  if (w.minutes >= 60) out.push({ value: fmt(hours), label: hours === 1 ? "hour reading" : "hours reading" });
  if (out.length < 4 && streakShown && w.days.length > 0)
    out.push({ value: fmt(w.days.length), label: "days reading" });
  if (out.length < 4 && w.rereads > 0) out.push({ value: fmt(w.rereads), label: w.rereads === 1 ? "re-read" : "re-reads" });
  return out.slice(0, 4);
}

/** Where each spine stands on a shelf `width` wide: the Spines view's
 *  widths, scaled down to fit when there are many, never wider than
 *  `maxUnit` pixels a rem, and centred. */
export function shelfLayout(
  spines: readonly Pick<YearCardSpine, "width" | "height">[],
  width: number,
  height: number,
  maxUnit = 22,
): { x: number; w: number; h: number }[] {
  if (!spines.length) return [];
  const total = spines.reduce((sum, s) => sum + s.width, 0);
  // A pixel's gap between books, while they're wide enough to spare one.
  const gap = width / spines.length >= 6 ? 2 : 0;
  const unit = Math.min(maxUnit, (width - gap * (spines.length - 1)) / total);
  const used = total * unit + gap * (spines.length - 1);
  let x = (width - used) / 2;
  return spines.map((s) => {
    const w = s.width * unit;
    const spot = { x, w, h: s.height * height };
    x += w + gap;
    return spot;
  });
}

// ── Drawing ───────────────────────────────────────────────────────────────

interface Ink {
  ink: string;
  soft: string;
  accent: string;
  plank: string;
  plankEdge: string;
  /** How solid the plank is: a theme's text colour, at full strength,
   *  would be a stark bar. */
  plankAlpha: number;
}

function paintLook(
  ctx: CanvasRenderingContext2D,
  look: YearCardLook,
  w: number,
  h: number,
  rand: () => number,
  theme: ThemeInk | null,
): Ink {
  if (look === "paper") {
    paintPaper(ctx, w, h, rand);
    return { ...PAPER_INK, plank: "#7a5233", plankEdge: "#a3764d", plankAlpha: 1 };
  }
  if (look === "night") {
    paintNight(ctx, w, h, rand);
    return { ...NIGHT_INK, plank: "#3e2a1c", plankEdge: "#d9b45a", plankAlpha: 1 };
  }
  const t = theme ?? { background: "#ffffff", foreground: "#111111", muted: "#666666", accent: "#333333" };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, w, h);
  // A soft wash of the accent from the top corner.
  const glow = ctx.createRadialGradient(w * 0.85, h * 0.08, 0, w * 0.85, h * 0.08, w * 0.9);
  ctx.save();
  glow.addColorStop(0, t.accent);
  glow.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  return { ink: t.foreground, soft: t.muted, accent: t.accent, plank: t.foreground, plankEdge: t.accent, plankAlpha: 0.3 };
}

/**
 * Draws the picture onto `canvas` (resizing it to the picture's size). The
 * fonts must already be loaded, or the browser draws with a fallback.
 * `theme` is the reader's colours, for Your theme.
 */
export function drawYearCard(
  canvas: HTMLCanvasElement,
  input: YearCardInput,
  look: YearCardLook,
  shape: YearCardShape,
  fonts: YearCardFonts,
  theme: ThemeInk | null = null,
): void {
  const w = CARD_WIDTH;
  const h = CARD_HEIGHTS[shape];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const tall = shape === "tall";
  const ink = paintLook(ctx, look, w, h, seeded(seedOf(`year-${input.year}`)), theme);
  const side = 96;
  const room = w - side * 2;
  ctx.textBaseline = "alphabetic";

  // The year, and what it is.
  const yearSize = tall ? 240 : 200;
  let y = (tall ? 150 : 70) + Math.round(yearSize * 0.82);
  ctx.fillStyle = ink.ink;
  ctx.font = `700 ${yearSize}px ${fonts.heading}`;
  ctx.fillText(String(input.year), side - Math.round(yearSize * 0.04), y);
  y += tall ? 84 : 70;
  ctx.fillStyle = ink.soft;
  ctx.font = `italic 400 ${tall ? 60 : 52}px ${fonts.serif}`;
  ctx.fillText(input.current ? "in books, so far" : "in books", side, y);
  y += 34;
  ctx.fillStyle = ink.accent;
  ctx.fillRect(side, y, 90, 4);
  const titleBottom = y + 4;

  // The shelf along the foot.
  const plankH = 16;
  const plankTop = h - (tall ? 120 : 84) - plankH;
  const spineMax = tall ? 190 : 120;
  const shelfTop = plankTop - spineMax;

  // What goes between, spread evenly down the room left.
  const blocks: { height: number; draw: (top: number) => void }[] = [];
  if (input.figures.length) blocks.push(figuresBlock(ctx, input.figures, ink, fonts, tall, side, room));
  if (tall && input.books.length) blocks.push(booksBlock(ctx, input.books, input.booksLabel, ink, fonts, side, room));
  if (input.genres.length) blocks.push(lineBlock(ctx, "Favourite genres", input.genres.join("  ·  "), ink, fonts, tall, side, room));
  if (input.author && (tall || !input.genres.length))
    blocks.push(lineBlock(ctx, "Author of the year", input.author, ink, fonts, tall, side, room));
  const used = blocks.reduce((sum, b) => sum + b.height, 0);
  const gap = Math.max(24, Math.min(tall ? 110 : 80, (shelfTop - titleBottom - used) / (blocks.length + 1)));
  let top = titleBottom + gap;
  for (const block of blocks) {
    block.draw(top);
    top += block.height + gap;
  }

  // The books, then the plank they stand on.
  const spots = shelfLayout(input.spines, room, spineMax);
  spots.forEach((spot, i) =>
    drawSpine(ctx, side + spot.x, plankTop, spot.w, spot.h, input.spines[i].colour, input.spines[i].design),
  );
  ctx.save();
  ctx.globalAlpha = ink.plankAlpha;
  ctx.fillStyle = ink.plank;
  ctx.fillRect(side - 28, plankTop, room + 56, plankH);
  ctx.restore();
  ctx.fillStyle = ink.plankEdge;
  ctx.fillRect(side - 28, plankTop, room + 56, 3);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000000";
  ctx.fillRect(side - 28, plankTop + plankH, room + 56, 6);
  ctx.restore();
}

/** Small capitals over what they name. */
function caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string, serif: string) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = `600 ${size}px ${serif}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(size * 0.14)}px`;
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

/** The figures, two to a row. */
function figuresBlock(
  ctx: CanvasRenderingContext2D,
  figures: YearCardFigure[],
  ink: Ink,
  fonts: YearCardFonts,
  tall: boolean,
  side: number,
  room: number,
) {
  const labelSize = tall ? 34 : 29;
  const colW = room / 2;
  // One size for every figure: the largest at which the widest still fits
  // its column (a wide theme face can't take "20,847" at full size).
  let valueSize = tall ? 118 : 96;
  ctx.font = `700 ${valueSize}px ${fonts.heading}`;
  const widest = Math.max(...figures.map((f) => ctx.measureText(f.value).width));
  if (widest > colW - 24) valueSize = Math.max(48, Math.floor((valueSize * (colW - 24)) / widest));
  const rowH = Math.round(valueSize * 0.78) + Math.round(labelSize * 1.7);
  const rowGap = tall ? 60 : 34;
  const rows = Math.ceil(figures.length / 2);
  return {
    height: rows * rowH + (rows - 1) * rowGap,
    draw(top: number) {
      figures.forEach((f, i) => {
        const x = side + (i % 2) * colW;
        const y = top + Math.floor(i / 2) * (rowH + rowGap) + Math.round(valueSize * 0.78);
        ctx.fillStyle = ink.ink;
        ctx.font = `700 ${valueSize}px ${fonts.heading}`;
        ctx.fillText(clip(ctx, f.value, colW - 24), x, y);
        ctx.fillStyle = ink.soft;
        ctx.font = `400 ${labelSize}px ${fonts.serif}`;
        ctx.fillText(clip(ctx, f.label, colW - 24), x, y + Math.round(labelSize * 1.55));
      });
    },
  };
}

/** A caption and one line under it: the genres, or the author. */
function lineBlock(
  ctx: CanvasRenderingContext2D,
  label: string,
  text: string,
  ink: Ink,
  fonts: YearCardFonts,
  tall: boolean,
  side: number,
  room: number,
) {
  const capSize = tall ? 25 : 22;
  const size = tall ? 40 : 34;
  return {
    height: capSize + 16 + size,
    draw(top: number) {
      caption(ctx, label, side, top + capSize, capSize, ink.soft, fonts.serif);
      ctx.fillStyle = ink.ink;
      ctx.font = `500 ${size}px ${fonts.serif}`;
      ctx.fillText(clip(ctx, text, room), side, top + capSize + 16 + Math.round(size * 0.8));
    },
  };
}

/** The tall picture's row of covers. */
function booksBlock(
  ctx: CanvasRenderingContext2D,
  books: YearCardBook[],
  label: string,
  ink: Ink,
  fonts: YearCardFonts,
  side: number,
  room: number,
) {
  const capSize = 25;
  const gap = 24;
  const coverW = Math.floor((room - gap * 4) / 5);
  const coverH = Math.round(coverW * 1.5);
  return {
    height: capSize + 26 + coverH,
    draw(top: number) {
      caption(ctx, label, side, top + capSize, capSize, ink.soft, fonts.serif);
      const y = top + capSize + 26;
      books.slice(0, 5).forEach((b, i) => drawCover(ctx, b, side + i * (coverW + gap), y, coverW, coverH, fonts.serif));
    },
  };
}

/** A cover, cropped to fill its box as the app's covers are, or its colour
 *  with the title on it when the image can't be drawn. */
function drawCover(ctx: CanvasRenderingContext2D, book: YearCardBook, x: number, y: number, w: number, h: number, serif: string) {
  ctx.save();
  ctx.shadowColor = "rgb(0 0 0 / 0.3)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  const hex = /^#[0-9a-f]{6}$/i.test(book.colour) ? book.colour : "#3b4a6b";
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  const img = book.cover;
  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    return;
  }
  ctx.fillStyle = shade(hex, -0.25);
  ctx.fillRect(x, y + h - 10, w, 10);
  ctx.fillStyle = spineInk(hex) === "light" ? "#fbf7ee" : "#1d1710";
  const size = 19;
  const lines = wrapLines(book.title, w - 24, size, measureWith(ctx, `600 SIZEpx ${serif}`)).slice(0, 5);
  ctx.font = `600 ${size}px ${serif}`;
  lines.forEach((line, i) => ctx.fillText(line, x + 12, y + 32 + i * Math.round(size * 1.3)));
}

/** A spine standing on the plank at `bottom`: its colour, rounded by a
 *  little light and shade, with its binding's details when it's wide
 *  enough to show them. */
function drawSpine(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottom: number,
  w: number,
  h: number,
  colour: string,
  design: SpineDesign,
) {
  const hex = /^#[0-9a-f]{6}$/i.test(colour) ? colour : "#6b5b4b";
  const top = bottom - h;
  ctx.fillStyle = hex;
  ctx.fillRect(x, top, w, h);
  const round = ctx.createLinearGradient(x, 0, x + w, 0);
  round.addColorStop(0, "rgb(0 0 0 / 0.22)");
  round.addColorStop(0.3, "rgb(255 255 255 / 0.12)");
  round.addColorStop(1, "rgb(0 0 0 / 0.26)");
  ctx.fillStyle = round;
  ctx.fillRect(x, top, w, h);
  if (w < 8) return;
  const gilt = spineInk(hex) === "light" ? "rgb(240 210 140 / 0.75)" : "rgb(90 60 20 / 0.55)";
  if (design === "bands") {
    ctx.fillStyle = gilt;
    for (const at of [0.07, 0.11, 0.89, 0.93]) ctx.fillRect(x, top + h * at, w, Math.max(1.5, h * 0.012));
  } else if (design === "label") {
    ctx.fillStyle = shade(hex, 0.45);
    ctx.fillRect(x + w * 0.16, top + h * 0.26, w * 0.68, h * 0.22);
  } else if (design === "leather") {
    ctx.fillStyle = shade(hex, -0.35);
    ctx.fillRect(x, top, w, h * 0.1);
    ctx.fillRect(x, bottom - h * 0.1, w, h * 0.1);
  } else {
    ctx.fillStyle = gilt;
    const cx = x + w / 2;
    const cy = top + h * 0.8;
    const r = Math.min(w * 0.22, 6);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
  }
}
