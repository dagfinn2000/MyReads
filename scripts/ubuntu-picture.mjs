#!/usr/bin/env node
// Draws the Ubuntu theme's desktop, public/themes/ubuntu.svg: Ubuntu's
// colours, aubergine deepening to near black at the top left and warming
// to its orange at the bottom right, with a few broad ribbons of light
// sweeping across from the lower left, as its own wallpapers have them.
//
// The ribbons are wide bands between two curves, each filled with a
// gradient that fades in and out along it, so they have no hard ends.
// There are no SVG filters, which the browser would run again on every
// repaint (see the Golden Gate picture).
//
//   node scripts/ubuntu-picture.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1600;
const H = 1000;

const stops = (list) =>
  list.map(([offset, colour, opacity = 1]) => `<stop offset="${offset}" stop-color="${colour}" stop-opacity="${opacity}"/>`).join("");

// Each ribbon: where its lower and upper edges start at the left and end at
// the right, how far each bows, and how bright it gets.
const ribbons = [
  { from: [[-100, 980], [-100, 860]], to: [[1700, 260], [1700, 120]], bow: [-160, -210], light: 0.1 },
  { from: [[-100, 1060], [-100, 990]], to: [[1700, 520], [1700, 430]], bow: [-120, -150], light: 0.08 },
  { from: [[-100, 760], [-100, 720]], to: [[1700, -40], [1700, -110]], bow: [-90, -120], light: 0.06 },
  { from: [[300, 1100], [300, 1060]], to: [[1700, 760], [1700, 700]], bow: [-60, -80], light: 0.09 },
];

const ribbon = ({ from, to, bow }, i) => {
  const edge = ([x0, y0], [x1, y1], b) => {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2 + b;
    return [x0, y0, mx, my, x1, y1];
  };
  const [ax, ay, acx, acy, bx, by] = edge(from[0], to[0], bow[0]);
  const [cx, cy, ccx, ccy, dx, dy] = edge(from[1], to[1], bow[1]);
  return `<path d="M${ax} ${ay}Q${acx} ${acy} ${bx} ${by}L${dx} ${dy}Q${ccx} ${ccy} ${cx} ${cy}Z" fill="url(#ribbon${i})"/>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"><defs>\
<linearGradient id="base" x1="0" y1="0" x2="1" y2="1">${stops([
  [0, "#1a0012"],
  [0.35, "#3d0a2f"],
  [0.68, "#77216f"],
  [1, "#b13a3d"],
])}</linearGradient>\
<radialGradient id="warm" gradientUnits="userSpaceOnUse" cx="${W * 0.92}" cy="${H * 1.02}" r="${W * 0.62}">${stops([
  [0, "#f47a3a"],
  [0.35, "#e95420", 0.75],
  [0.75, "#c7302f", 0.2],
  [1, "#c7302f", 0],
])}</radialGradient>\
<radialGradient id="dusk" gradientUnits="userSpaceOnUse" cx="${W * 0.1}" cy="${H * 0.05}" r="${W * 0.55}">${stops([
  [0, "#0d0009", 0.8],
  [1, "#0d0009", 0],
])}</radialGradient>\
${ribbons
  .map(
    ({ light }, i) =>
      `<linearGradient id="ribbon${i}" x1="0" y1="1" x2="1" y2="0">${stops([
        [0, "#ffffff", 0],
        [0.35, "#ffd2b8", light],
        [0.7, "#ffffff", light * 0.8],
        [1, "#ffffff", 0],
      ])}</linearGradient>`,
  )
  .join("")}\
</defs>\
<rect width="${W}" height="${H}" fill="url(#base)"/>\
<rect width="${W}" height="${H}" fill="url(#warm)"/>\
<rect width="${W}" height="${H}" fill="url(#dusk)"/>\
${ribbons.map(ribbon).join("")}\
</svg>
`;

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes/ubuntu.svg");
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
