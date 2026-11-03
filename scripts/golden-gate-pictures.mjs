#!/usr/bin/env node
/**
 * Draws the Golden Gate theme's two pictures in public/themes:
 *
 * - golden-gate.svg, the desktop: five sweeping folds of sand, grey and
 *   indigo over a pale sky, each casting a soft shadow up on the one behind.
 * - golden-gate-frosted.png, the softened, frosted copy the window is drawn
 *   from (see the Golden Gate section of src/app/restyles.css).
 *
 * The picture is designed below with Gaussian blurs: the shadows are each
 * fold's shape moved up and blurred, and the frosted copy is the whole
 * picture blurred, lifted and saturated. A browser that draws such filters
 * runs them again for every tile of every layer the picture is on, each time
 * it repaints, which made picking the theme stall for half a second and its
 * pages slow to open. So the blurs are drawn here, once: each shadow becomes
 * a small image under its fold (soft all over, so a quarter of the size
 * loses nothing, while the fold over it keeps its sharp edge), and the
 * frosted copy becomes a small picture of its own. What a reader sees
 * differs from the filtered picture by at most 3 of 255 levels.
 *
 * Change the folds or colours here, then run:
 *   node scripts/golden-gate-pictures.mjs
 *
 * Needs Playwright and its Chromium, which the app itself doesn't:
 *   npm install --no-save playwright && npx playwright install chromium
 */

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

let chromium;
try {
  // require, not import(): it also finds a Playwright installed globally.
  ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
  console.error("Needs Playwright: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const OUT = path.resolve(import.meta.dirname, "../public/themes");
/** The picture's size in its own units; it is drawn to cover the screen. */
const W = 1600;
const H = 1000;
/** The images are kept at a quarter of that. */
const STEP = 4;

/** Each fold: its top edge, a curve from the left to the right, and its
 *  colours from left to right. A fold covers everything below its edge. */
const FOLDS = [
  { edge: [120, 420, -40, 980, 760, 520], colours: ["#f6ead2", "#d9d3cd", "#6d6f9e"] },
  { edge: [300, 520, 120, 1040, 860, 640], colours: ["#f1dfbd", "#cfc9c6", "#585b92"] },
  { edge: [470, 560, 300, 1100, 960, 760], colours: ["#ebd3a6", "#c4bec0", "#474a85"] },
  { edge: [640, 600, 500, 1160, 1040, 860], colours: ["#e2c48f", "#b8b3b8", "#383b78"] },
  { edge: [800, 640, 700, 1200, 1100, 960], colours: ["#d8b57a", "#aaa6ae", "#2c2f6b"] },
];
/** Each fold's shadow: its shape moved up by LIFT, blurred by BLUR, in
 *  SHADE at STRENGTH. */
const LIFT = 18;
const BLUR = 16;
const SHADE = [0x1d, 0x1f, 0x3a];
const STRENGTH = 0.22;

const shape = ({ edge: [y0, x1, y1, x2, y2, y3] }) => `M-160 ${y0}C${x1} ${y1} ${x2} ${y2} 1760 ${y3}V1160H-160Z`;

const sky =
  `<linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">` +
  `<stop offset="0" stop-color="#fbf4e6"/><stop offset=".45" stop-color="#e4e0dc"/><stop offset="1" stop-color="#8b8db5"/></linearGradient>`;
/** Light along the top of each fold, shade along its bottom. */
const sheen =
  `<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/>` +
  `<stop offset=".12" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/>` +
  `<stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>`;
const foldColours = FOLDS.map(
  (f, i) =>
    `<linearGradient id="f${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${f.edge[0]}" x2="${W}" y2="${f.edge[5]}">` +
    f.colours.map((c, k) => `<stop offset="${k / 2}" stop-color="${c}"/>`).join("") +
    `</linearGradient>`,
).join("");
const blur = `<filter id="shadow" filterUnits="userSpaceOnUse" x="-160" y="-160" width="1920" height="1320"><feGaussianBlur stdDeviation="${BLUR}"/></filter>`;
/** Frosting: blurred, then white laid over it as opaque as the colour
 *  beneath is dark, so the glass is never darker than a set luminance and
 *  its text reads anywhere on it, then the colour heightened. */
const frost =
  `<filter id="frost" filterUnits="userSpaceOnUse" x="-160" y="-160" width="1920" height="1320"><feGaussianBlur stdDeviation="14"/>` +
  `<feColorMatrix type="saturate" values="1.7" result="seen"/>` +
  `<feColorMatrix in="seen" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -0.1276 -0.4291 -0.0433 0 0.62"/>` +
  `<feComposite in2="seen" operator="over"/><feColorMatrix type="saturate" values="1.4"/></filter>`;

/** The picture as designed, blurs and all. `shadow(i)` draws fold i's shadow. */
function design(shadow, { frosted = false } = {}) {
  const folds = FOLDS.map((f, i) => shadow(i) + `<path d="${shape(f)}" fill="url(#f${i})"/><path d="${shape(f)}" fill="url(#sheen)"/>`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>${sky}${frosted ? frost : ""}${blur}${sheen}${foldColours}</defs>` +
    `<g${frosted ? ` filter="url(#frost)"` : ""}><rect x="-160" y="-160" width="1920" height="1320" fill="url(#sky)"/>${folds.join("")}</g></svg>`
  );
}
const blurredShadow = (i) =>
  `<path d="${shape(FOLDS[i])}" transform="translate(0 -${LIFT})" fill="rgb(${SHADE})" opacity="${STRENGTH}" filter="url(#shadow)"/>`;

/** Where fold i's shadow shows: from where it has faded to nothing above
 *  the fold's edge to just below the edge, past which the fold hides it. */
function band(i) {
  const [y0, x1, y1, x2, y2, y3] = FOLDS[i].edge;
  let top = Infinity;
  let bottom = -Infinity;
  for (let k = 0; k <= 2000; k++) {
    const t = k / 2000;
    const u = 1 - t;
    const x = u ** 3 * -160 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * 1760;
    const y = u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3;
    if (x < 0 || x > W) continue;
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const unit = STEP * 4;
  const from = Math.max(0, Math.floor((top - LIFT - 4 * BLUR) / unit) * unit);
  const to = Math.min(H, Math.ceil((bottom + 2 * STEP) / unit) * unit);
  return [from, to - from];
}

/** A PNG of RGBA or RGB pixels, each row filtered the way that packs best. */
function png(width, height, channels, pixels) {
  const row = width * channels;
  const raw = Buffer.alloc((row + 1) * height);
  for (let y = 0; y < height; y++) {
    const line = pixels.subarray(y * row, (y + 1) * row);
    const above = y > 0 ? pixels.subarray((y - 1) * row, y * row) : new Uint8Array(row);
    let best = null;
    let bestCost = Infinity;
    for (let type = 0; type < 5; type++) {
      const out = Buffer.alloc(row + 1);
      out[0] = type;
      let cost = 0;
      for (let x = 0; x < row; x++) {
        const a = x >= channels ? line[x - channels] : 0;
        const b = above[x];
        const c = x >= channels ? above[x - channels] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const predict = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][type];
        const v = (line[x] - predict) & 0xff;
        out[x + 1] = v;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) [best, bestCost] = [out, cost];
    }
    best.copy(raw, y * (row + 1));
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

/** Draws an SVG at width x height pixels and returns its RGBA, each
 *  STEP x STEP block averaged into one pixel. */
async function drawSmall(svg, width, height) {
  const data = await page.evaluate(
    async ({ svg, width, height, step }) => {
      const img = new Image();
      img.src = "data:image/svg+xml;base64," + btoa(svg);
      await img.decode();
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const px = ctx.getImageData(0, 0, width, height).data;
      const w = width / step;
      const h = height / step;
      const out = new Array(w * h * 4);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          for (let ch = 0; ch < 4; ch++) {
            let sum = 0;
            for (let dy = 0; dy < step; dy++)
              for (let dx = 0; dx < step; dx++) sum += px[((y * step + dy) * width + x * step + dx) * 4 + ch];
            out[(y * w + x) * 4 + ch] = sum / (step * step);
          }
      return out;
    },
    { svg, width, height, step: STEP },
  );
  return data;
}

// Each shadow: the blurred, moved shape alone, as an image of its band.
const images = [];
for (let i = 0; i < FOLDS.length; i++) {
  const [from, height] = band(i);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${from} ${W} ${height}" preserveAspectRatio="none"><defs>${blur}</defs>` +
    `<path d="${shape(FOLDS[i])}" transform="translate(0 -${LIFT})" filter="url(#shadow)"/></svg>`;
  const small = await drawSmall(svg, W, height);
  const w = W / STEP;
  const h = height / STEP;
  const rgba = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    rgba.set(SHADE, p * 4);
    rgba[p * 4 + 3] = Math.round((small[p * 4 + 3] / 255) * STRENGTH * 255);
  }
  images.push({ from, height, data: png(w, h, 4, rgba).toString("base64") });
}
const shadowImage = (i) =>
  `<image x="0" y="${images[i].from}" width="${W}" height="${images[i].height}" preserveAspectRatio="none" href="data:image/png;base64,${images[i].data}"/>`;
const sharp = design(shadowImage).replace(blur, "");
writeFileSync(path.join(OUT, "golden-gate.svg"), sharp);

// The frosted copy, drawn with its blurs and kept at a quarter size.
const frosted = await drawSmall(design(blurredShadow, { frosted: true }), W, H);
const rgb = new Uint8Array((W / STEP) * (H / STEP) * 3);
for (let p = 0; p < rgb.length / 3; p++) for (let ch = 0; ch < 3; ch++) rgb[p * 3 + ch] = Math.round(frosted[p * 4 + ch]);
writeFileSync(path.join(OUT, "golden-gate-frosted.png"), png(W / STEP, H / STEP, 3, rgb));

await browser.close();
console.log("Wrote golden-gate.svg and golden-gate-frosted.png to public/themes.");
