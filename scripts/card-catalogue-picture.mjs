// Draws public/themes/card-catalogue.svg, the Card Catalogue theme's
// picture: the top of a pale oak library table, planks running across with
// their grain. Run with `node scripts/card-catalogue-picture.mjs`.
//
// The grain is drawn line by line from a seeded random generator, so it
// never repeats across a wide screen (a tile would) and the file comes out
// the same each run. No filters: every line is a plain stroke, so the
// picture costs nothing to paint again. The planks stay within a few shades
// of the theme's --background (#e6cfa6), and the grain is faint, so text
// laid on the table reads as on the plain colour.
import { writeFileSync } from "node:fs";

const W = 1600;
const H = 1000;

// mulberry32: a small seeded generator.
let seed = 0x0c47a10;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + (b - a) * random();
const pick = (list) => list[Math.floor(random() * list.length)];
const r1 = (n) => Math.round(n * 10) / 10;

// A smooth line through points, as cubic Béziers (Catmull-Rom).
function smooth(points) {
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    d += `C${r1(x1 + (x2 - x0) / 6)} ${r1(y1 + (y2 - y0) / 6)} ${r1(x2 - (x3 - x1) / 6)} ${r1(y2 - (y3 - y1) / 6)} ${r1(x2)} ${r1(y2)}`;
  }
  return d;
}

const tints = ["#e6cfa6", "#e8d2aa", "#e4cca2", "#e7d0a9", "#e5cea4"];
const inks = ["#b48a55", "#a77e4b", "#c09864", "#9c7444"];
const out = [];
out.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
  `<!-- Drawn by scripts/card-catalogue-picture.mjs: pale oak planks and their grain. -->`,
);

let top = -between(20, 80);
let plank = 0;
while (top < H) {
  const height = between(170, 250);
  const bottom = top + height;
  out.push(`<rect y="${r1(top)}" width="${W}" height="${r1(height)}" fill="${tints[plank % tints.length]}"/>`);
  const lines = [];
  // Straight grain, gently wandering across the plank.
  const count = Math.round(height / between(7, 11));
  const phase = between(0, Math.PI * 2);
  const wave = between(0.0012, 0.0026);
  const sway = between(4, 12);
  for (let i = 0; i < count; i++) {
    const base = top + ((i + between(0.1, 0.9)) / count) * height;
    const own = between(0, Math.PI * 2);
    const points = [];
    for (let x = -40; x <= W + 40; x += 80) {
      const y =
        base +
        Math.sin(x * wave + phase) * sway +
        Math.sin(x * wave * 3.1 + own) * sway * 0.25 +
        between(-1.2, 1.2);
      points.push([x, Math.min(bottom - 1, Math.max(top + 1, y))]);
    }
    const width = pick([0.6, 0.8, 1, 1.2, 1.6, 2.2]);
    const opacity = r1(between(0.1, 0.32) * 100) / 100;
    lines.push(`<path d="${smooth(points)}" stroke="${pick(inks)}" stroke-width="${width}" stroke-opacity="${opacity}"/>`);
  }
  // Broad, soft bands where the wood grew darker one year.
  for (let i = 0, n = Math.round(between(3, 6)); i < n; i++) {
    const base = between(top + 10, bottom - 10);
    const points = [];
    for (let x = -60; x <= W + 160; x += 100) {
      points.push([x, base + Math.sin(x * wave + phase) * sway + between(-2, 2)]);
    }
    const opacity = r1(between(0.04, 0.09) * 100) / 100;
    lines.push(`<path d="${smooth(points)}" stroke="${pick(inks)}" stroke-width="${r1(between(6, 16))}" stroke-opacity="${opacity}"/>`);
  }
  // Every other plank has a cathedral, where the saw cut across the growth
  // rings: loops of grain nested inside one another, each pointing along
  // the plank, the outer ones longer and wider.
  if (plank % 2 === 0) {
    const right = random() < 0.5;
    const tip = right ? between(W * 0.45, W * 0.85) : between(W * 0.15, W * 0.55);
    const cy = top + height * between(0.4, 0.6);
    const rings = Math.round(between(9, 13));
    const room = Math.min(cy - top, bottom - cy) - 6;
    for (let k = 0; k < rings; k++) {
      const half = Math.min(room, 3 + k * (room / rings));
      const length = 90 + k * between(32, 44);
      const point = tip + (right ? 1 : -1) * k * between(16, 24);
      const points = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const v = -1 + (2 * i) / steps;
        const x = point - (right ? 1 : -1) * length * Math.abs(v) ** 1.35;
        points.push([x + between(-1, 1), cy + v * half]);
      }
      // The loop's two arms run on along the grain, out of the picture.
      const away = right ? -60 : W + 60;
      const tail = (y) => [
        [away, y + between(-2, 2)],
        [(away + points[0][0]) / 2, y + between(-1.5, 1.5)],
      ];
      const line = [...tail(cy - half), ...points, ...tail(cy + half).reverse()];
      const opacity = r1(between(0.16, 0.34) * 100) / 100;
      lines.push(`<path d="${smooth(line)}" stroke="${pick(inks)}" stroke-width="${pick([0.8, 1, 1.4, 2])}" stroke-opacity="${opacity}"/>`);
    }
  }
  out.push(`<g fill="none" stroke-linecap="round">${lines.join("")}</g>`);
  // The seam with the next plank: a dark line, and the edge catching light.
  out.push(
    `<path d="M0 ${r1(bottom - 0.5)}H${W}" stroke="#8a6438" stroke-opacity="0.45" stroke-width="1.5"/>`,
    `<path d="M0 ${r1(bottom + 1)}H${W}" stroke="#fff6e0" stroke-opacity="0.5"/>`,
  );
  top = bottom;
  plank++;
}
out.push("</svg>");

const file = new URL("../public/themes/card-catalogue.svg", import.meta.url);
writeFileSync(file, out.join("\n") + "\n");
console.log(`card-catalogue.svg: ${plank} planks`);
