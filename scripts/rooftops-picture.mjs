#!/usr/bin/env node
// Draws the Rooftops theme's picture, public/themes/rooftops.svg: a city's
// roofs at night along the foot of the window, as seen from high up. Two
// rows of them: the far one paler, lost a little in the haze of the city's
// light, the near one nearly black, with gables, flat tops, mansards,
// chimneys with their pots, and dormers. A few windows are still lit.
//
// The roofline comes from a seeded random walk, so it is the same every
// time this is run and never repeats across the width. Every shape is a
// plain filled path with whole-number points: no filters, masks or
// gradients, so the browser draws it once and is done.
//
//   node scripts/rooftops-picture.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 2400;
const H = 300;
const FAR = "#1e2638";
const NEAR = "#0a0e16";
const LIT = "#ffd27a";

// mulberry32: a small seeded generator.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(19480601);
const between = (a, b) => Math.round(a + rand() * (b - a));

/** One row of roofs from left to right: a path for the silhouettes and a
 *  list of window rectangles. `base` is how high the eaves stand. */
function row({ minW, maxW, base, spread, chimneys, lit, windows }) {
  let d = `M0 ${H}`;
  // Chimneys, dormers and tanks, which stand on the outline: shapes of
  // their own, so the outline stays one closed shape down to the foot.
  let extra = "";
  const lights = [];
  let x = -between(0, 60);
  while (x < W) {
    const w = between(minW, maxW);
    const eave = H - base - between(0, spread);
    const kind = rand();
    const x0 = Math.max(x, 0);
    const x1 = Math.min(x + w, W);
    d += ` L${x0} ${eave}`;
    let top = eave;
    if (kind < 0.42) {
      // A gable: up to a ridge in the middle and down again.
      const ridge = eave - between(Math.round(w * 0.22), Math.round(w * 0.42));
      d += ` L${Math.round(x + w / 2)} ${ridge} L${x1} ${eave}`;
      top = ridge;
      if (windows && rand() < 0.55) {
        // A small window up in the gable.
        const ww = between(9, 13);
        const wy = Math.round((eave + ridge) / 2 + 4);
        lights.push([Math.round(x + w / 2 - ww / 2), wy, ww, between(12, 16), rand() < lit]);
      }
    } else if (kind < 0.7) {
      // A mansard: steep sides, a flat top, dormers in the slope.
      const rise = between(26, 40);
      const inset = between(14, 22);
      d += ` L${x + inset} ${eave - rise} L${x + w - inset} ${eave - rise} L${x1} ${eave}`;
      top = eave - rise;
      if (windows) {
        for (let dx = x + inset + 10; dx < x + w - inset - 22; dx += between(30, 44)) {
          // Each dormer stands proud of the slope with a little roof of its own.
          const dw = 14;
          const dy = eave - rise + 6;
          extra += ` M${dx - 3} ${dy + 4} L${dx + dw / 2} ${dy - 6} L${dx + dw + 3} ${dy + 4} L${dx + dw} ${dy + 4} L${dx + dw} ${eave} L${dx} ${eave} L${dx} ${dy + 4} Z`;
          lights.push([dx + 3, dy + 7, dw - 6, between(9, 12), rand() < lit]);
        }
      }
    } else {
      // A flat top with a low parapet, maybe a water tank or a lift room.
      d += ` L${x1} ${eave}`;
      if (rand() < 0.35) {
        const bw = between(22, 34);
        const bx = x + between(10, Math.max(12, w - bw - 10));
        const bh = between(16, 26);
        extra += ` M${bx} ${eave + 1} L${bx} ${eave - bh} L${bx + bw} ${eave - bh} L${bx + bw} ${eave + 1} Z`;
      }
    }
    if (chimneys && rand() < 0.6) {
      // A chimney stack, standing on the slope or the top, with its pots.
      const cw = between(14, 24);
      const cx = x + between(Math.round(w * 0.15), Math.round(w * 0.75) - cw);
      const roofAt = kind < 0.42 ? Math.round(eave - (top - eave) * -1 * (1 - Math.abs(cx + cw / 2 - (x + w / 2)) / (w / 2))) : top;
      const ch = between(24, 40);
      const cy = Math.min(roofAt, eave) - ch;
      extra += ` M${cx} ${Math.max(roofAt, top) + 8} L${cx} ${cy} L${cx + cw} ${cy} L${cx + cw} ${Math.max(roofAt, top) + 8} Z`;
      const pots = between(1, 3);
      for (let p = 0; p < pots; p++) {
        const px = cx + 2 + Math.round(((cw - 4) / pots) * p);
        const pw = Math.max(4, Math.round((cw - 4) / pots) - 2);
        const ph = between(5, 9);
        extra += ` M${px} ${cy} L${px} ${cy - ph} L${px + pw} ${cy - ph} L${px + pw} ${cy} Z`;
      }
    }
    if (windows) {
      // Windows in the wall below the eaves: a row or two, most dark.
      const cols = Math.max(1, Math.floor((w - 24) / 30));
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < cols; c++) {
          if (rand() < 0.5) continue;
          lights.push([x + 16 + c * 30, eave + 14 + r * 34, 12, 18, rand() < lit * 0.6]);
        }
      }
    }
    x += w;
  }
  d += ` L${W} ${H} Z`;
  return { d: d + extra, lights: lights.filter(([lx, , lw]) => lx >= 0 && lx + lw <= W) };
}

const far = row({ minW: 70, maxW: 170, base: 150, spread: 70, chimneys: true, lit: 0, windows: false });
const near = row({ minW: 110, maxW: 240, base: 70, spread: 70, chimneys: true, lit: 0.16, windows: true });
// Lit windows in the far row: a scattering of dim squares.
const farLit = [];
for (let i = 0; i < 26; i++) farLit.push([between(10, W - 20), between(H - 150, H - 80), 8, 10]);

const rect = ([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\
<path d="${far.d}" fill="${FAR}"/>\
<g fill="${LIT}" fill-opacity="0.28">${farLit.map(rect).join("")}</g>\
<path d="${near.d}" fill="${NEAR}" fill-rule="nonzero"/>\
<g fill="${LIT}" fill-opacity="0.9">${near.lights.filter((l) => l[4]).map(rect).join("")}</g>\
</svg>
`;

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes/rooftops.svg");
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes, ${near.lights.filter((l) => l[4]).length} lit windows)`);
