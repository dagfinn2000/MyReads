import { spineInk } from "@/lib/book-spine";

/**
 * A quote as a picture to save or share (components/quote-card-dialog.tsx):
 * the quote set large, with the book's title and author under it, in one of
 * four looks and two shapes. Drawn on a canvas in the browser, so nothing is
 * sent anywhere and nothing is kept.
 *
 * The layout (which size of type fits, where lines break) is plain
 * functions that take a way to measure text, so it can be tested without a
 * browser.
 */

export const QUOTE_CARD_STYLES = ["paper", "night", "cover", "index"] as const;
export type QuoteCardStyle = (typeof QUOTE_CARD_STYLES)[number];

export const QUOTE_CARD_STYLE_LABELS: Record<QuoteCardStyle, string> = {
  paper: "Paper",
  night: "Night",
  cover: "Cover colours",
  index: "Index card",
};

/** Square for a post, tall for a story or a phone's wallpaper. */
export const QUOTE_CARD_SHAPES = ["square", "tall"] as const;
export type QuoteCardShape = (typeof QUOTE_CARD_SHAPES)[number];

export const CARD_WIDTH = 1080;
export const CARD_HEIGHTS: Record<QuoteCardShape, number> = { square: 1080, tall: 1920 };

/** Measures a line of text at a font size, in pixels. */
export type Measure = (text: string, size: number) => number;

/** Splits text into lines no wider than `width`, keeping the quote's own
 *  line breaks. A word too long for a line on its own is broken across
 *  lines. */
export function wrapLines(text: string, width: number, size: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      // A word wider than the line: as many letters as fit, then the rest.
      let rest = word;
      while (measure(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measure(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  // No blank lines at either end.
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

export interface QuoteLayout {
  size: number;
  lineHeight: number;
  lines: string[];
  /** True when even the smallest size couldn't fit it all, and the last
   *  line ends in an ellipsis. */
  cut: boolean;
}

/**
 * The largest type size, from `max` down to `min`, at which the quote fits
 * in `width` × `height`. A quote too long even at `min` keeps the lines
 * that fit and ends the last with an ellipsis.
 */
export function fitQuote(
  text: string,
  box: { width: number; height: number },
  measure: Measure,
  { max = 64, min = 30, leading = 1.36 }: { max?: number; min?: number; leading?: number } = {},
): QuoteLayout {
  for (let size = max; size >= min; size -= 2) {
    const lines = wrapLines(text, box.width, size, measure);
    const lineHeight = Math.round(size * leading);
    if (lines.length * lineHeight <= box.height) return { size, lineHeight, lines, cut: false };
  }
  const size = min;
  const lineHeight = Math.round(size * leading);
  const lines = wrapLines(text, box.width, size, measure);
  const room = Math.max(1, Math.floor(box.height / lineHeight));
  if (lines.length <= room) return { size, lineHeight, lines, cut: false };
  const kept = lines.slice(0, room);
  let last = kept[room - 1].replace(/[\s.,;:!?–—-]+$/, "");
  while (last && measure(`${last}…`, size) > box.width) last = last.slice(0, -1).trimEnd();
  kept[room - 1] = `${last}…`;
  return { size, lineHeight, lines: kept, cut: true };
}

/** Letters that don't come apart into a plain letter and an accent. */
const SPELLED_OUT: Record<string, string> = { æ: "ae", ø: "o", œ: "oe", ß: "ss", þ: "th", ð: "d", ł: "l" };

/** A file name for the picture: the book's title, made safe. */
export function quoteCardFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[æøœßþðł]/g, (ch) => SPELLED_OUT[ch])
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `quote-${slug || "book"}.png`;
}

// ── Drawing ───────────────────────────────────────────────────────────────

export interface QuoteCardInput {
  text: string;
  title: string;
  authors: string[];
  page: number | null;
  /** The cover's main colour (lib/cover-colours.ts), for the cover look. */
  colour: string;
  /** The cover image, already loaded, when it can be drawn. */
  cover: HTMLImageElement | null;
}

/** Font families the card uses: the app's book face, and a typewriter. */
export interface CardFonts {
  serif: string;
  mono: string;
}

interface Look {
  ink: string;
  soft: string;
  accent: string;
  mono: boolean;
}

/** A small seeded random, so the paper's grain and the night's stars are
 *  the same each time the same quote is drawn. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function seedOf(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}

/** Mixes "#rrggbb" towards black (amount < 0) or white (amount > 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (v: number) => Math.round(v + (target - v) * t);
  const r = mix(n >> 16);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r} ${g} ${b})`;
}

/** Paints the background and returns the colours to write in. */
function paintBackground(
  ctx: CanvasRenderingContext2D,
  style: QuoteCardStyle,
  w: number,
  h: number,
  input: QuoteCardInput,
  rand: () => number,
): Look {
  if (style === "paper") {
    ctx.fillStyle = "#f5efe2";
    ctx.fillRect(0, 0, w, h);
    // Grain: a scatter of faint flecks.
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rand() < 0.5 ? "rgb(120 95 60 / 0.07)" : "rgb(255 255 255 / 0.35)";
      ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
    // Edges a shade darker, as old paper goes.
    const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    edge.addColorStop(0, "rgb(160 120 70 / 0)");
    edge.addColorStop(1, "rgb(160 120 70 / 0.22)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
    return { ink: "#2b2118", soft: "#7b6a55", accent: "#a2412e", mono: false };
  }
  if (style === "night") {
    const sky = ctx.createLinearGradient(0, 0, w * 0.3, h);
    sky.addColorStop(0, "#1f2547");
    sky.addColorStop(1, "#0a0d1c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const r = rand() < 0.9 ? 1.2 : 2.2;
      ctx.fillStyle = `rgb(255 248 225 / ${0.15 + rand() * 0.45})`;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const glow = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.7);
    glow.addColorStop(0, "rgb(120 130 220 / 0.18)");
    glow.addColorStop(1, "rgb(120 130 220 / 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    return { ink: "#f2ebd9", soft: "#aaa7bd", accent: "#d9b45a", mono: false };
  }
  if (style === "cover") {
    const base = /^#[0-9a-f]{6}$/i.test(input.colour) ? input.colour : "#3b4a6b";
    const fill = ctx.createLinearGradient(0, 0, w, h);
    fill.addColorStop(0, shade(base, 0.12));
    fill.addColorStop(1, shade(base, -0.28));
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    const light = spineInk(base) === "light";
    return light
      ? { ink: "#fbf7ee", soft: "rgb(251 247 238 / 0.72)", accent: "rgb(251 247 238 / 0.55)", mono: false }
      : { ink: "#1d1710", soft: "rgb(29 23 16 / 0.7)", accent: "rgb(29 23 16 / 0.5)", mono: false };
  }
  // An index card: white, a red line under the heading and blue rules
  // (drawn with the text, so they sit under its lines).
  ctx.fillStyle = "#fbfaf4";
  ctx.fillRect(0, 0, w, h);
  return { ink: "#1f2b4a", soft: "#5c6784", accent: "#c8423b", mono: true };
}

/**
 * Draws the card onto `canvas` (resizing it to the card's size). The fonts
 * must already be loaded, or the browser draws with a fallback.
 */
export function drawQuoteCard(
  canvas: HTMLCanvasElement,
  input: QuoteCardInput,
  style: QuoteCardStyle,
  shape: QuoteCardShape,
  fonts: CardFonts,
): void {
  const w = CARD_WIDTH;
  const h = CARD_HEIGHTS[shape];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rand = seeded(seedOf(input.text + input.title));
  const look = paintBackground(ctx, style, w, h, input, rand);
  if (look.mono) drawIndexCard(ctx, input, look, w, h, fonts.mono);
  else drawQuote(ctx, input, look, w, h, shape, fonts.serif, style === "cover" ? input.cover : null);
}

/** The book's title, then its author and the page. */
function byline(input: QuoteCardInput): string {
  return [input.authors.join(", "), input.page != null ? `p. ${input.page}` : ""]
    .filter(Boolean)
    .join("  ·  ");
}

/** Paper, Night and Cover colours: a large opening quotation mark, the
 *  quote in italic, a short rule, then the book (beside its cover, on
 *  Cover colours), the whole block centred down the card. */
function drawQuote(
  ctx: CanvasRenderingContext2D,
  input: QuoteCardInput,
  look: Look,
  w: number,
  h: number,
  shape: QuoteCardShape,
  serif: string,
  cover: HTMLImageElement | null,
): void {
  const side = 120;
  const width = w - side * 2;
  const markH = 150;
  const bookH = cover ? 270 : 180;
  const layout = fitQuote(
    input.text,
    { width, height: h - 2 * (shape === "tall" ? 240 : 110) - markH - bookH },
    measureWith(ctx, `italic 400 SIZEpx ${serif}`),
    { max: shape === "tall" ? 76 : 64, min: 30, leading: 1.36 },
  );
  const textH = layout.lines.length * layout.lineHeight;
  const top = Math.round((h - (markH + textH + bookH)) / 2);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = look.accent;
  ctx.font = `400 220px ${serif}`;
  ctx.fillText("\u201C", side - 10, top + 175);

  ctx.fillStyle = look.ink;
  ctx.font = `italic 400 ${layout.size}px ${serif}`;
  const textTop = top + markH;
  layout.lines.forEach((line, i) =>
    ctx.fillText(line, side, textTop + Math.round(layout.size * 1.05) + i * layout.lineHeight),
  );

  let y = textTop + textH + 56;
  ctx.fillStyle = look.accent;
  ctx.fillRect(side, y, 90, 3);
  y += 30;
  let x = side;
  if (cover) {
    ctx.save();
    ctx.shadowColor = "rgb(0 0 0 / 0.35)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(cover, side, y, 120, 180);
    ctx.restore();
    x = side + 156;
    y += 52;
  }
  const room = w - side - x;
  ctx.fillStyle = look.ink;
  ctx.font = `600 38px ${serif}`;
  y += 38;
  ctx.fillText(clip(ctx, input.title, room), x, y);
  const by = byline(input);
  if (by) {
    ctx.fillStyle = look.soft;
    ctx.font = `400 27px ${serif}`;
    ctx.fillText(clip(ctx, by, room), x, y + 46);
  }
}

/** Index card: the book written across the top above a red line, then
 *  the quote typed on the blue rules below it, with a red margin. */
function drawIndexCard(
  ctx: CanvasRenderingContext2D,
  input: QuoteCardInput,
  look: Look,
  w: number,
  h: number,
  mono: string,
): void {
  const side = 120;
  const width = w - side - 90;
  const redLine = 230;
  const layout = fitQuote(
    input.text,
    { width, height: h - redLine - 110 },
    measureWith(ctx, `400 SIZEpx ${mono}`),
    { max: 50, min: 24, leading: 1.6 },
  );
  // The first line sits on the first rule under the red line.
  const firstRule = redLine + layout.lineHeight;

  ctx.fillStyle = "rgb(90 140 210 / 0.38)";
  for (let rule = firstRule; rule < h - 30; rule += layout.lineHeight) ctx.fillRect(0, rule, w, 2);
  ctx.fillStyle = look.accent;
  ctx.fillRect(0, redLine, w, 3);
  ctx.fillStyle = "rgb(200 66 59 / 0.4)";
  ctx.fillRect(side - 34, 0, 2, h);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = look.ink;
  ctx.font = `700 36px ${mono}`;
  ctx.fillText(clip(ctx, input.title, width), side, redLine - 82);
  const by = byline(input);
  if (by) {
    ctx.fillStyle = look.soft;
    ctx.font = `400 26px ${mono}`;
    ctx.fillText(clip(ctx, by, width), side, redLine - 34);
  }

  ctx.fillStyle = look.ink;
  ctx.font = `400 ${layout.size}px ${mono}`;
  layout.lines.forEach((line, i) => ctx.fillText(line, side, firstRule + i * layout.lineHeight - 12));
}

/** A Measure for `font`, a canvas font with SIZE where the size goes. */
function measureWith(ctx: CanvasRenderingContext2D, font: string): Measure {
  return (text, size) => {
    ctx.font = font.replace("SIZE", String(size));
    return ctx.measureText(text).width;
  };
}

/** The text cut short with an ellipsis to fit `width` in the current font. */
function clip(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}
