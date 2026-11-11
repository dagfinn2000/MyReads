#!/usr/bin/env node
// Draws the Fernery theme's picture, public/themes/fernery.svg: fronds of
// fern growing in from the lower left corner of the window, one of them
// still curled up as a fiddlehead, on glass left dark everywhere else.
//
// Each frond is a stem curving up from below the window's edge, with
// leaflets down both sides, short at the foot, longest a third of the way
// up and tapering to the tip, every one scalloped into the small lobes a
// fern's leaflets have. Fronds further back are darker, so the ones in
// front stand out from them. A little seeded unevenness keeps the leaflets
// from looking stamped. There are no SVG filters, which the browser would
// run again on every repaint (see the Golden Gate picture), and the
// palest green stays dark enough for the app's text to read on it.
//
//   node scripts/fernery-picture.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 1600;
const H = 1000;

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
const random = mulberry32(20261112);

const round = (n) => Math.round(n);
const pt = ([x, y]) => `${round(x)} ${round(y)}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
const rotate = (a, angle) => [
  a[0] * Math.cos(angle) - a[1] * Math.sin(angle),
  a[0] * Math.sin(angle) + a[1] * Math.cos(angle),
];

// A cubic curve and its direction at t.
const bezier = (p, t) => {
  const u = 1 - t;
  return [0, 1].map(
    (i) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i],
  );
};
const tangent = (p, t) => {
  const u = 1 - t;
  return norm(
    [0, 1].map(
      (i) =>
        3 * u * u * (p[1][i] - p[0][i]) + 6 * u * t * (p[2][i] - p[1][i]) + 3 * t * t * (p[3][i] - p[2][i]),
    ),
  );
};

// One leaflet: from where it leaves the stem, along a midline that bends a
// little towards the frond's tip, its two edges scalloped into lobes, and
// back. Its width swells and tapers like a leaf's.
function leaflet(base, direction, length, width, bend, lobes) {
  const mid = (s) => {
    const curve = rotate(direction, bend * s);
    return add(base, scale(curve, length * s));
  };
  const across = (s) => {
    const d = rotate(direction, bend * s);
    return [-d[1], d[0]];
  };
  const half = (s) => width * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.88)), 0.75) * (1 - 0.35 * s);
  const edge = (side) => {
    const points = [];
    for (let k = 0; k <= lobes; k++) {
      const s = k / lobes;
      points.push([s, add(mid(s), scale(across(s), side * half(s)))]);
    }
    return points;
  };
  let d = `M${pt(base)}`;
  // Up one side, each lobe a bulge between two notches.
  for (const side of [1, -1]) {
    const points = side === 1 ? edge(1) : edge(-1).reverse();
    for (let k = 1; k < points.length; k++) {
      const [s0, a] = points[k - 1];
      const [s1, b] = points[k];
      const s = (s0 + s1) / 2;
      const bulge = add(add(scale(add(a, b), 0.5), scale(across(s), side * half(s) * 0.55)), scale(rotate(direction, bend * s), (length / lobes) * 0.15 * (side === 1 ? 1 : -1)));
      d += `Q${pt(bulge)} ${pt(b)}`;
    }
    if (side === 1) d += `L${pt(mid(1))}`;
  }
  return `${d}Z`;
}

// A frond: its stem from below the window up to its tip, and its leaflets.
function frond({ from, to, bow, leaflets, size, angle = 1.2, curl = 0 }) {
  const chord = [to[0] - from[0], to[1] - from[1]];
  const side = norm([-chord[1], chord[0]]);
  const stem = [
    from,
    add(add(from, scale(chord, 0.33)), scale(side, bow * Math.hypot(...chord))),
    add(add(from, scale(chord, 0.7)), scale(side, bow * 0.8 * Math.hypot(...chord))),
    to,
  ];
  let d = "";
  // The stem, a thin tapering band.
  const steps = 40;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = bezier(stem, t);
    const n = (([x, y]) => [-y, x])(tangent(stem, t));
    const w = size * 0.035 * (1 - t * 0.8);
    left.push(add(p, scale(n, w)));
    right.push(add(p, scale(n, -w)));
  }
  d += `M${left.map(pt).join("L")}L${right.reverse().map(pt).join("L")}Z`;
  // The leaflets, alternating sides, from a little way up the stem.
  for (let i = 0; i < leaflets; i++) {
    const t = 0.12 + (0.86 * (i + 0.5)) / leaflets;
    const p = bezier(stem, t);
    const along = tangent(stem, t);
    // Longest a third of the way up, short at the foot, tapering to the tip.
    const shape = t < 0.32 ? Math.pow(Math.sin((Math.PI / 2) * (t / 0.32)), 0.9) : 1 - ((t - 0.32) / 0.68) * 0.86;
    const length = size * (0.18 + 0.82 * shape) * (0.92 + random() * 0.16);
    for (const s of [1, -1]) {
      const direction = rotate(along, s * (angle + (random() - 0.5) * 0.12) * (1 - 0.3 * t));
      const lobes = Math.max(3, Math.round(length / (size * 0.11)));
      d += leaflet(p, direction, length, length * 0.13, -s * 0.22, lobes);
    }
  }
  // A fiddlehead: the tip still rolled up in a spiral.
  if (curl) {
    const end = bezier(stem, 1);
    const along = tangent(stem, 1);
    const n = [along[1], -along[0]];
    const centre = add(end, scale(n, curl));
    let a = Math.atan2(end[1] - centre[1], end[0] - centre[0]);
    const turns = [];
    for (let k = 0; k <= 60; k++) {
      const r = curl * (1 - k / 75);
      a -= 0.16;
      turns.push([centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a), size * 0.09 * (1 - k / 75)]);
    }
    const outer = turns.map(([x, y, w]) => {
      const [cx, cy] = [x - centre[0], y - centre[1]];
      const l = Math.hypot(cx, cy) || 1;
      return [x + (cx / l) * w, y + (cy / l) * w];
    });
    const inner = turns.map(([x, y, w]) => {
      const [cx, cy] = [x - centre[0], y - centre[1]];
      const l = Math.hypot(cx, cy) || 1;
      return [x - (cx / l) * w, y - (cy / l) * w];
    });
    d += `M${outer.map(pt).join("L")}L${inner.reverse().map(pt).join("L")}Z`;
  }
  return d;
}

// Back to front: darker behind, paler in front.
const layers = [
  {
    colour: "#11281d",
    fronds: [
      { from: [-60, 1090], to: [520, 240], bow: -0.1, leaflets: 19, size: 125 },
      { from: [90, 1100], to: [1040, 700], bow: -0.15, leaflets: 22, size: 110 },
    ],
  },
  {
    colour: "#163327",
    fronds: [
      { from: [-120, 960], to: [210, 330], bow: -0.12, leaflets: 15, size: 105 },
      { from: [-10, 1090], to: [780, 470], bow: -0.13, leaflets: 20, size: 120 },
    ],
  },
  {
    colour: "#1d4031",
    fronds: [
      { from: [-80, 1070], to: [430, 590], bow: -0.14, leaflets: 15, size: 110 },
      { from: [-70, 1000], to: [110, 760], bow: 0.12, leaflets: 8, size: 70 },
      { from: [300, 1090], to: [372, 872], bow: -0.1, leaflets: 2, size: 80, curl: 34 },
    ],
  },
];

const paths = layers
  .map(({ colour, fronds }) => `<path fill="${colour}" d="${fronds.map((f) => frond(f)).join("")}"/>`)
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${paths}</svg>\n`;

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes/fernery.svg");
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
