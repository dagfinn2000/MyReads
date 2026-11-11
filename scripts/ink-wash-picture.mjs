#!/usr/bin/env node
// Draws the Ink Wash theme's picture, public/themes/ink-wash.svg: ranges of
// mountains in washes of grey ink, rising out of mist along the foot of the
// window, the paper above them left empty.
//
// Each range is a ridge line made of a few peaks and a little seeded wobble,
// filled down to the foot with its ink fading out as it goes, so every range
// stands in the mist at its feet and the one behind shows through. Ranges
// further off are paler. There are no SVG filters, which the browser would
// run again on every repaint (see the Golden Gate picture), and the nearest
// ink stays pale enough for the app's muted text to read on it at 4.5:1.
//
//   node scripts/ink-wash-picture.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1600;
const H = 600;

// A small seeded generator, so the picture comes out the same every time.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261111);

// Back to front: where the range stands, its peaks as [x, height, spread],
// how much it wobbles, its ink and how far down the mist takes it.
const ranges = [
  { base: 340, peaks: [[1180, 175, 165], [1420, 95, 115], [870, 60, 190], [300, 45, 250]], wobble: 9, ink: "#dcd8cf", fade: 230 },
  { base: 405, peaks: [[330, 150, 145], [575, 70, 115], [1010, 40, 210], [1520, 55, 135]], wobble: 8, ink: "#cfcac0", fade: 200 },
  { base: 468, peaks: [[1310, 118, 150], [1075, 48, 115], [170, 42, 150]], wobble: 7, ink: "#c4bfb5", fade: 160 },
  { base: 540, peaks: [[430, 52, 210], [770, 24, 150], [1555, 40, 130]], wobble: 6, ink: "#b9b4aa", fade: 110 },
];

const round = (n) => Math.round(n * 10) / 10;

function ridge({ base, peaks, wobble }) {
  // Three slow waves with seeded phases make the wobble.
  const waves = [0, 1, 2].map((i) => ({
    length: [260, 120, 55][i] * (0.8 + random() * 0.4),
    phase: random() * Math.PI * 2,
    size: wobble * [1, 0.5, 0.22][i],
  }));
  const points = [];
  for (let x = -8; x <= W + 8; x += 8) {
    let y = base;
    for (const [px, height, spread] of peaks) y -= height * Math.exp(-(((x - px) / spread) ** 2));
    for (const w of waves) y += w.size * Math.sin((x / w.length) * Math.PI * 2 + w.phase);
    points.push([x, round(y)]);
  }
  return points;
}

const defs = [];
const shapes = [];
ranges.forEach((range, i) => {
  const points = ridge(range);
  const top = Math.min(...points.map(([, y]) => y));
  defs.push(
    `<linearGradient id="r${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${Math.floor(top)}" x2="0" y2="${Math.min(H, range.base + range.fade)}">` +
      `<stop offset="0" stop-color="${range.ink}"/>` +
      `<stop offset=".45" stop-color="${range.ink}" stop-opacity=".6"/>` +
      `<stop offset="1" stop-color="${range.ink}" stop-opacity="0"/>` +
      `</linearGradient>`,
  );
  const line = points.map(([x, y]) => `${x} ${y}`).join(" ");
  shapes.push(`<path fill="url(#r${i})" d="M-8 ${H}L${line}L${W + 8} ${H}Z"/>`);
});

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<defs>${defs.join("")}</defs>${shapes.join("")}</svg>\n`;

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes/ink-wash.svg");
writeFileSync(out, svg);
console.log(`wrote ${path.relative(process.cwd(), out)} (${svg.length} bytes)`);
