#!/usr/bin/env node
// Draws the Noir theme's picture, public/themes/noir.svg: late light through
// a venetian blind, falling across the wall from a window above and to the
// right of the screen, as in a detective's office in an old film.
//
// The light is one patch, a window's width of it, drawn upright with the
// blind's slats as soft bands across it (a gradient that repeats, so every
// band has the same soft edge) and the window's middle bar down it, then
// leaned and slanted onto the wall the way light from high up falls. It is
// brightest at the top right and fades out across the wall, and nothing
// falls on the lower left, where the shelves of books are. There are no SVG
// filters or masks, which the browser would run again on every repaint (see
// the Golden Gate picture): the soft edges are gradients, and the fading is
// the page's own colour laid over the light.
//
//   node scripts/noir-picture.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1600;
const H = 1000;
// The wall, the page's own colour (--background in Noir's block).
const WALL = "#0d0e11";
// The light: a little warm, as a street lamp's or a low sun's.
const LIGHT = "#f1e4c6";

// The window, upright: its width and height, the blind's slats as bands of
// light every PERIOD, and the soft edge of each.
const WIN_W = 980;
const WIN_H = 900;
const PERIOD = 74;
// Where the window's light lands on the wall: its top left, top right and
// bottom left corners (the fourth follows). The slats rise to the right, the
// sides lean to the left, as light from high up and to the right falls.
const [A, B, C] = [[470, 40], [1840, -380], [190, 760]];
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

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>\
<linearGradient id="slats" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${PERIOD}" spreadMethod="repeat">${stops([
  [0, LIGHT, 0],
  [0.12, LIGHT, 0.14],
  [0.5, LIGHT, 0.155],
  [0.66, LIGHT, 0.125],
  [0.78, LIGHT, 0],
  [1, LIGHT, 0],
])}</linearGradient>\
<linearGradient id="bar" gradientUnits="userSpaceOnUse" x1="${WIN_W * 0.56 - 30}" y1="0" x2="${WIN_W * 0.56 + 30}" y2="0">${stops([
  [0, WALL, 0],
  [0.32, WALL, 1],
  [0.68, WALL, 1],
  [1, WALL, 0],
])}</linearGradient>\
<linearGradient id="left" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="160" y2="0">${stops([
  [0, WALL, 1],
  [1, WALL, 0],
])}</linearGradient>\
<linearGradient id="right" gradientUnits="userSpaceOnUse" x1="${WIN_W}" y1="0" x2="${WIN_W - 120}" y2="0">${stops([
  [0, WALL, 1],
  [1, WALL, 0],
])}</linearGradient>\
<linearGradient id="foot" gradientUnits="userSpaceOnUse" x1="0" y1="${WIN_H}" x2="0" y2="${WIN_H - 200}">${stops([
  [0, WALL, 1],
  [1, WALL, 0],
])}</linearGradient>\
<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="${W + 80}" cy="-120" r="1500">${stops([
  [0, WALL, 0],
  [0.38, WALL, 0.08],
  [0.62, WALL, 0.55],
  [0.86, WALL, 1],
])}</radialGradient>\
<radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="${W}" cy="0" r="900">${stops([
  [0, LIGHT, 0.05],
  [1, LIGHT, 0],
])}</radialGradient>\
</defs>\
<rect width="${W}" height="${H}" fill="${WALL}"/>\
<g transform="matrix(${lean.join(" ")})">\
<rect width="${WIN_W}" height="${WIN_H}" fill="url(#slats)"/>\
<rect x="${WIN_W * 0.56 - 30}" width="60" height="${WIN_H}" fill="url(#bar)"/>\
<rect width="160" height="${WIN_H}" fill="url(#left)"/>\
<rect x="${WIN_W - 120}" width="120" height="${WIN_H}" fill="url(#right)"/>\
<rect y="${WIN_H - 200}" width="${WIN_W}" height="200" fill="url(#foot)"/>\
</g>\
<rect width="${W}" height="${H}" fill="url(#glow)"/>\
<rect width="${W}" height="${H}" fill="url(#fade)"/>\
</svg>
`;

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes/noir.svg");
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
