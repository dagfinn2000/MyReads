#!/usr/bin/env node
// Draws the Sunroom theme's picture, public/themes/sunroom.svg: morning sun
// coming in at a window up to the left of the screen and lying across the
// wall in front of it, the window's panes in soft light with the shadows of
// its bars between them.
//
// The light is drawn upright, as the window is, three panes high and two
// across, and then leaned onto the wall the way sun from high up and to the
// left falls: the patch stretches away down and to the right. Its edges and
// the bars' shadows are soft because they are gradients of the wall's own
// colour laid over the light; the far end fades out the same way, and the
// lower right of the wall, where most of a page's text is, stays plain. No
// SVG filters or masks, which the browser would run again on every repaint
// (see the Golden Gate picture). On a light page light is hard to see, so
// the patch is drawn stronger than it would be on a dark one.
//
//   node scripts/sunroom-picture.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1600;
const H = 1000;
// The wall, the page's own colour (--background in Sunroom's block), and
// the sunlight on it, a little warm.
const WALL = "#e9e2d8";
const LIGHT = "#fffaee";

// The window, upright: two panes across and three down, with bars between.
const WIN_W = 760;
const WIN_H = 1020;
const BAR = 34;
const EDGE = 46;
// Where the window's light lands: its top left, top right and bottom left
// corners (the fourth follows).
const [A, B, C] = [[-140, -60], [560, 60], [180, 1060]];
const lean = [
  (B[0] - A[0]) / WIN_W,
  (B[1] - A[1]) / WIN_W,
  (C[0] - A[0]) / WIN_H,
  (C[1] - A[1]) / WIN_H,
  A[0],
  A[1],
].map((n) => Math.round(n * 10000) / 10000);

const stops = (list) =>
  list.map(([offset, colour, opacity]) => `<stop offset="${offset}" stop-color="${colour}" stop-opacity="${opacity}"/>`).join("");
const soft = (id, x1, y1, x2, y2) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops([
    [0, WALL, 0],
    [0.34, WALL, 0.92],
    [0.66, WALL, 0.92],
    [1, WALL, 0],
  ])}</linearGradient>`;
const edge = (id, x1, y1, x2, y2) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops([
    [0, WALL, 1],
    [1, WALL, 0],
  ])}</linearGradient>`;

const midX = WIN_W / 2;
const rows = [WIN_H / 3, (WIN_H * 2) / 3];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>\
${soft("bar-v", midX - BAR / 2, 0, midX + BAR / 2, 0)}\
${rows.map((y, i) => soft(`bar-h${i}`, 0, y - BAR / 2, 0, y + BAR / 2)).join("")}\
${edge("left", 0, 0, EDGE, 0)}\
${edge("right", WIN_W, 0, WIN_W - EDGE, 0)}\
${edge("top", 0, 0, 0, EDGE)}\
${edge("foot", 0, WIN_H, 0, WIN_H - EDGE * 3)}\
<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="-120" cy="-160" r="1500">${stops([
  [0, WALL, 0],
  [0.36, WALL, 0.05],
  [0.62, WALL, 0.55],
  [0.84, WALL, 1],
])}</radialGradient>\
<radialGradient id="warm" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1100">${stops([
  [0, LIGHT, 0.32],
  [1, LIGHT, 0],
])}</radialGradient>\
</defs>\
<rect width="${W}" height="${H}" fill="${WALL}"/>\
<rect width="${W}" height="${H}" fill="url(#warm)"/>\
<g transform="matrix(${lean.join(" ")})">\
<rect width="${WIN_W}" height="${WIN_H}" fill="${LIGHT}" fill-opacity="0.82"/>\
<rect x="${midX - BAR / 2}" width="${BAR}" height="${WIN_H}" fill="url(#bar-v)"/>\
${rows.map((y, i) => `<rect y="${y - BAR / 2}" width="${WIN_W}" height="${BAR}" fill="url(#bar-h${i})"/>`).join("")}\
<rect width="${EDGE}" height="${WIN_H}" fill="url(#left)"/>\
<rect x="${WIN_W - EDGE}" width="${EDGE}" height="${WIN_H}" fill="url(#right)"/>\
<rect width="${WIN_W}" height="${EDGE}" fill="url(#top)"/>\
<rect y="${WIN_H - EDGE * 3}" width="${WIN_W}" height="${EDGE * 3}" fill="url(#foot)"/>\
</g>\
<rect width="${W}" height="${H}" fill="url(#fade)"/>\
</svg>
`;

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes/sunroom.svg");
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
