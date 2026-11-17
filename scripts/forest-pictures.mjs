#!/usr/bin/env node
// Draws the pictures of the two forest themes into public/themes:
//
//   Wildwood, deep in a forest at night        wildwood-*.svg
//   Birchwood, a birch wood on a sunny morning  birchwood-*.svg
//
// Each forest is drawn in layers, from the back to the front, and globals.css
// stacks them on the page's fixed layer, each sized and placed on its own:
//
//   far     thin trunks far off, fading into the mist (a strip that repeats
//           across the window, scaled to its height)
//   mid     nearer trunks with a branch or two (a wider strip, so the two
//           strips never repeat in step)
//   light   shafts of light slanting down through the leaves, stretched over
//           the whole window
//   floor   ferns, grass and mist along the foot of the window (a strip)
//   left    the nearest trunks, standing at the left edge, with their roots,
//   right   and at the right edge
//   canopy  leaves overhead, hanging in from the top (a strip)
//
// The fireflies (and in the birch wood, the motes of pollen in the sun) are
// not drawn here: they move, so they are their own elements, drawn by
// components/background-scene.tsx.
//
// Writing passes over every layer somewhere, so in the night wood every
// layer is dark, the nearest darkest, and in the birch wood every layer is
// pale; text reads on any part of either. No SVG filters (see the Golden
// Gate picture: the browser runs them again on every repaint): soft light
// and mist are gradients. Everything scattered is placed by a seeded
// generator, so the pictures come out the same each run, and every number
// is rounded so the files stay small.
//
//   node scripts/forest-pictures.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes");

/** A small seeded generator (mulberry32), so a picture is the same each run. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r0 = (n) => Math.round(n);
const pt = ([x, y]) => `${r0(x)} ${r0(y)}`;
const svg = (w, h, body, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${body}</svg>\n`;
const write = (name, text) => {
  writeFileSync(path.join(OUT, name), text);
  console.log(`${name}: ${text.length} bytes`);
};
const between = (rand, lo, hi) => lo + rand() * (hi - lo);

/**
 * A closed outline: from `start`, along `segs`, each a point to draw a
 * straight line to or a [control, point] pair for a curve, and back.
 * Every outline is drawn turning the same way, so where two in one path
 * overlap (a leaflet over its stem, a branch over its trunk) they add up
 * and never cut a hole in each other.
 */
function closed(start, segs) {
  const curve = (sg) => Array.isArray(sg[0]);
  const anchors = [start, ...segs.map((sg) => (curve(sg) ? sg[1] : sg))];
  const all = [start, ...segs.flatMap((sg) => (curve(sg) ? sg : [sg]))];
  let area = 0;
  for (let i = 0; i < all.length; i++) {
    const [a, b] = [all[i], all[(i + 1) % all.length]];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area >= 0) return `M${pt(start)}${segs.map((sg) => (curve(sg) ? `Q${pt(sg[0])} ${pt(sg[1])}` : `L${pt(sg)}`)).join("")}Z`;
  let d = `M${pt(anchors[anchors.length - 1])}`;
  for (let i = segs.length - 1; i >= 0; i--) d += curve(segs[i]) ? `Q${pt(segs[i][0])} ${pt(anchors[i])}` : `L${pt(anchors[i])}`;
  return `${d}Z`;
}

/** A gentle, uneven wobble along a trunk: two slow waves with random phases. */
function wobble(rand, size) {
  const [a, b, p, q] = [between(rand, 0.5, 1), between(rand, 0.2, 0.5), rand() * 6.3, rand() * 6.3];
  const [f, g] = [between(rand, 2, 4), between(rand, 5, 9)];
  return (t) => size * (a * Math.sin(f * t + p) + b * Math.sin(g * t + q));
}

/**
 * A trunk standing from below `bottom` to above `top`: its two edges wobble a
 * little on their own, it narrows towards the top, leans, and flares out
 * into its roots at the foot when `flare` is set. Returns the outline, and
 * where its middle and edges are at a height, for branches and bark.
 */
function trunk(rand, { x, w, top, bottom, lean = 0, taper = 0.75, flare = 0, step = 40 }) {
  const n = Math.max(6, Math.ceil((bottom - top) / step));
  const wl = wobble(rand, w * 0.035);
  const wr = wobble(rand, w * 0.035);
  const centre = (t) => x + lean * (1 - t); // t: 0 at the foot, 1 at the top
  const half = (t) => {
    const base = (w / 2) * (1 - (1 - taper) * t);
    const root = flare ? flare * w * Math.pow(Math.max(0, 0.1 - t) / 0.1, 2.2) : 0;
    return base + root;
  };
  const y = (t) => bottom - t * (bottom - top);
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    left.push([centre(t) - half(t) + wl(t * 6), y(t)]);
    right.push([centre(t) + half(t) + wr(t * 6), y(t)]);
  }
  const outline = [...left, ...right.reverse()];
  const d = closed(outline[0], outline.slice(1));
  return { d, centre, half, y, w };
}

/** A branch leaving a trunk at height t, out to one side and up. */
function branch(rand, tr, { t, side, length, thick, rise = 0.5, droop = 0 }) {
  const y0 = tr.y(t);
  const x0 = tr.centre(t) + side * tr.half(t) * 0.7;
  const dir = [side * Math.cos(rise), -Math.sin(rise)];
  const tip = [x0 + dir[0] * length, y0 + dir[1] * length + droop * length];
  const mid = [x0 + dir[0] * length * 0.55, y0 + dir[1] * length * 0.4 + droop * length * 0.15];
  const n = [-dir[1], dir[0]];
  const a = [x0 + n[0] * thick, y0 + n[1] * thick - thick * 0.6];
  const b = [x0 - n[0] * thick, y0 - n[1] * thick + thick * 0.6];
  const m1 = [mid[0] + n[0] * thick * 0.45, mid[1] + n[1] * thick * 0.45];
  const m2 = [mid[0] - n[0] * thick * 0.45, mid[1] - n[1] * thick * 0.45];
  let d = closed(a, [[m1, tip], [m2, b]]);
  // A twig or two off it.
  const twigs = Math.floor(between(rand, 1, 3));
  for (let k = 0; k < twigs; k++) {
    const s = between(rand, 0.35, 0.75);
    const p = [x0 + (tip[0] - x0) * s, y0 + (tip[1] - y0) * s];
    const ang = rise + between(rand, 0.35, 0.8) * (k % 2 ? 1 : -0.6);
    const len = length * between(rand, 0.18, 0.35);
    const q = [p[0] + side * Math.cos(ang) * len, p[1] - Math.sin(ang) * len];
    const tw = Math.max(1, thick * 0.3);
    d += closed([p[0], p[1] - tw], [q, [p[0], p[1] + tw]]);
  }
  return { d, tip };
}

/**
 * Bark: broken ridges running up the trunk, each at its own place across it,
 * wandering a little. Drawn as thin strokes; the caller clips them to the
 * trunk.
 */
function bark(rand, tr, { count, from = 0, to = 1, seg = [60, 160], gap = [20, 90] }) {
  let d = "";
  for (let k = 0; k < count; k++) {
    const across = between(rand, -0.85, 0.85);
    let t = from + rand() * 0.05;
    while (t < to) {
      const len = between(rand, seg[0], seg[1]) / (tr.y(0) - tr.y(1));
      const t1 = Math.min(to, t + len);
      const pts = [];
      for (let s = t; s <= t1; s += 0.012) pts.push([tr.centre(s) + across * tr.half(s) + between(rand, -1.2, 1.2), tr.y(s)]);
      if (pts.length > 1) d += `M${pts.map(pt).join("L")}`;
      t = t1 + between(rand, gap[0], gap[1]) / (tr.y(0) - tr.y(1));
    }
  }
  return d;
}

/**
 * `count` places along [0, width), each the best of a few random tries at
 * keeping away from the ones before, so they spread without lining up.
 */
function spread(rand, count, width, tries = 8) {
  const xs = [];
  for (let i = 0; i < count; i++) {
    let best = 0;
    let far = -1;
    for (let k = 0; k < tries; k++) {
      const x = rand() * width;
      const d = Math.min(Infinity, ...xs.map((q) => Math.min(Math.abs(x - q), width - Math.abs(x - q))));
      if (d > far) [best, far] = [x, d];
    }
    xs.push(best);
  }
  return xs;
}

/** Draws `make(x)` at x, and again a strip's width to either side when it
 *  crosses an edge, so the strip joins up with itself where it repeats. */
function wrapped(x, reach, width, make) {
  let out = make(x);
  if (x - reach < 0) out += make(x + width);
  if (x + reach > width) out += make(x - width);
  return out;
}

// ── A row of trunks for the far and mid strips ───────────────────────────────
// `fill` paints every trunk; with `round` set, each trunk is its own path so
// a gradient across it (objectBoundingBox) shades it round, lit on the left.
function trunkRow(rand, { width, height, count, w, lean, fill, round = false, branches = 0, step }) {
  const paths = [];
  for (const x of spread(rand, count, width)) {
    const tw = between(rand, w[0], w[1]);
    const tl = between(rand, -lean, lean);
    const opts = { w: tw, top: -20, bottom: height + 20, lean: tl, taper: between(rand, 0.6, 0.85), step };
    const nb = branches ? Math.floor(between(rand, 0, branches + 1)) : 0;
    const bs = Array.from({ length: nb }, () => ({
      t: between(rand, 0.35, 0.9),
      side: rand() < 0.5 ? -1 : 1,
      length: tw * between(rand, 1.6, 3.2),
      thick: tw * between(rand, 0.12, 0.2),
      rise: between(rand, 0.35, 0.9),
    }));
    const seed = r0(rand() * 1e9);
    const draw = (cx) => {
      const r = seeded(seed);
      const tr = trunk(r, { ...opts, x: cx });
      let d = tr.d;
      for (const b of bs) d += branch(r, tr, b).d;
      return d;
    };
    if (round) {
      // Each copy its own path, so the shading follows each one.
      paths.push(draw(x));
      if (x - tw * 4 < 0) paths.push(draw(x + width));
      if (x + tw * 4 > width) paths.push(draw(x - width));
    } else paths.push(wrapped(x, tw * 4, width, draw));
  }
  return round ? paths.map((d) => `<path fill="${fill}" d="${d}"/>`).join("") : `<path fill="${fill}" d="${paths.join("")}"/>`;
}

// ── Shafts of light ──────────────────────────────────────────────────────────
// Each shaft is a few long quadrilaterals inside each other, each faint, so
// together it is brightest along its middle and soft at its sides, and all
// of them fade out towards the floor with one gradient.
function shafts(beams, colour, peak) {
  const W = 1600;
  const H = 1000;
  const defs = `<defs><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="${colour}" stop-opacity="${peak}"/><stop offset="0.55" stop-color="${colour}" stop-opacity="${r0(peak * 45) / 100}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></linearGradient></defs>`;
  let d = "";
  for (const { x0, x1, w0, w1 } of beams) {
    for (const k of [1, 0.72, 0.46, 0.24]) {
      d += closed([x0 - w0 * k, -10], [[x0 + w0 * k, -10], [x1 + w1 * k, H + 10], [x1 - w1 * k, H + 10]]);
    }
  }
  return svg(W, H, `${defs}<path fill="url(#fade)" d="${d}"/>`, ' preserveAspectRatio="none"');
}

// ── Ferns and grass for the floor ────────────────────────────────────────────
/** A fern frond: a curved stem with leaflets down both sides, longest a
 *  third of the way up and tapering to the tip, the tip nodding over. */
function frond(rand, [x, y], { length, angle, bend, leaflets, size }) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    const a = angle + bend * s * s;
    const px = x + Math.sin(a) * length * s;
    const py = y - Math.cos(a) * length * s * (1 - 0.15 * s);
    pts.push([px, py, a]);
  }
  let d = "";
  // The stem.
  const left = pts.map(([px, py, a], i) => [px - Math.cos(a) * size * 0.05 * (1 - i / 26), py - Math.sin(a) * size * 0.05 * (1 - i / 26)]);
  const right = pts.map(([px, py, a], i) => [px + Math.cos(a) * size * 0.05 * (1 - i / 26), py + Math.sin(a) * size * 0.05 * (1 - i / 26)]);
  const stem = [...left, ...right.reverse()];
  d += closed(stem[0], stem.slice(1));
  for (let i = 0; i < leaflets; i++) {
    const s = 0.1 + (0.86 * (i + 0.5)) / leaflets;
    const idx = Math.min(23, Math.floor(s * 24));
    const [px, py, a] = pts[idx];
    const shape = s < 0.3 ? Math.sin((Math.PI / 2) * (s / 0.3)) : 1 - ((s - 0.3) / 0.7) * 0.85;
    const len = size * (0.25 + 0.75 * shape) * between(rand, 0.9, 1.1);
    for (const side of [-1, 1]) {
      const la = a + side * (1.15 - 0.35 * s) + between(rand, -0.08, 0.08);
      const dir = [Math.sin(la), -Math.cos(la)];
      const nrm = [-dir[1], dir[0]];
      const tip = [px + dir[0] * len, py + dir[1] * len + len * 0.18];
      const wv = len * 0.2;
      const c1 = [px + dir[0] * len * 0.45 + nrm[0] * wv, py + dir[1] * len * 0.45 + nrm[1] * wv];
      const c2 = [px + dir[0] * len * 0.45 - nrm[0] * wv, py + dir[1] * len * 0.45 - nrm[1] * wv + len * 0.1];
      d += closed([px, py], [[c1, tip], [c2, [px, py]]]);
    }
  }
  return d;
}

/** A clump of fern: fronds fanning out from one root. */
function fern(rand, x, y, size) {
  let d = "";
  const n = Math.floor(between(rand, 4, 7));
  for (let i = 0; i < n; i++) {
    const angle = -1.25 + (2.5 * (i + between(rand, 0.2, 0.8))) / n;
    d += frond(rand, [x + between(rand, -8, 8), y], {
      length: size * between(rand, 0.75, 1.1) * (1 - Math.abs(angle) * 0.25),
      angle: angle * 0.85,
      bend: Math.sign(angle || 1) * between(rand, 0.5, 0.9),
      leaflets: Math.floor(between(rand, 9, 13)),
      size: size * 0.22,
    });
  }
  return d;
}

/** A tuft of grass blades. */
function grass(rand, x, y, size) {
  let d = "";
  const n = Math.floor(between(rand, 5, 9));
  for (let i = 0; i < n; i++) {
    const a = between(rand, -0.6, 0.6);
    const len = size * between(rand, 0.5, 1);
    const bend = a * between(rand, 0.3, 0.8);
    const w = between(rand, 2, 3.6);
    const tip = [x + Math.sin(a + bend) * len, y - Math.cos(a + bend) * len];
    const c = [x + Math.sin(a) * len * 0.5, y - Math.cos(a) * len * 0.55];
    d += closed([x - w, y], [[[c[0] - w * 0.5, c[1]], tip], [[c[0] + w * 0.5, c[1]], [x + w, y]]]);
  }
  return d;
}

/**
 * The floor strip: mist lying over it, then the ground, then ferns and grass
 * along it, in two rows, the back row paler. A few clumps of fern and tufts
 * of grass are drawn once and set down again and again, each turned,
 * flipped and sized differently, which keeps the file small. `extra(rand,
 * W, H, gy)` adds what only one of the forests has between the rows
 * (flowers), or in front of them all with `extraInFront` (mushrooms whose
 * glow would look odd seen through a fern).
 */
function floor(seed, { W, H, mist, mistPeak, back, front, ground, extra = () => "", extraInFront = false }) {
  const rand = seeded(seed);
  const kinds = [0, 1, 2, 3].map((k) => `<path id="f${k}" d="${fern(rand, 0, 0, 100)}"/>`).join("") +
    [0, 1].map((k) => `<path id="g${k}" d="${grass(rand, 0, 0, 100)}"/>`).join("");
  const defs = `<defs>${kinds}<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mist}" stop-opacity="0"/><stop offset="0.6" stop-color="${mist}" stop-opacity="${mistPeak}"/><stop offset="1" stop-color="${mist}" stop-opacity="${r0(mistPeak * 60) / 100}"/></linearGradient></defs>`;
  const mistRect = `<rect y="0" width="${W}" height="${H}" fill="url(#mist)"/>`;
  // The lie of the ground: a low wavy line, a little under a fifth up.
  const g = wobble(rand, 7);
  const gy = (x) => H * 0.84 + g((x / W) * 6.283);
  const lie = [];
  for (let x = 0; x <= W; x += 40) lie.push([x, gy(x)]);
  const groundD = closed([0, H], [...lie, [W, H]]);
  const place = (x, y, size) => {
    const kind = rand() < 0.72 ? `f${Math.floor(rand() * 4)}` : `g${Math.floor(rand() * 2)}`;
    const flip = rand() < 0.5 ? -1 : 1;
    const k = Math.round((size / 100) * 100) / 100;
    const use = (cx) => `<use href="#${kind}" transform="translate(${r0(cx)} ${r0(y)}) scale(${flip * k} ${k})"/>`;
    return wrapped(x, size, W, use);
  };
  let backRow = "";
  for (const x of spread(rand, 18, W)) backRow += place(x, gy(x) - 4, between(rand, 60, 105));
  let frontRow = "";
  for (const x of spread(rand, 13, W)) frontRow += place(x, H + 10, between(rand, 120, 190));
  return svg(
    W,
    H,
    extraInFront
      ? `${defs}${mistRect}<g fill="${back}">${backRow}</g><path fill="${ground}" d="${groundD}"/><g fill="${front}">${frontRow}</g>${extra(rand, W, H, gy)}`
      : `${defs}${mistRect}<g fill="${back}">${backRow}</g><path fill="${ground}" d="${groundD}"/>${extra(rand, W, H, gy)}<g fill="${front}">${frontRow}</g>`,
  );
}

// ── Leaves overhead ──────────────────────────────────────────────────────────
/** A clump of leaves: a mass whose edge is the pointed tips of leaves,
 *  sticking out at their own angles and lengths. */
function foliage(rand, cx, cy, rx, ry) {
  const n = Math.max(9, Math.round((rx + ry) / 7.5));
  const base = [];
  const tips = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + between(rand, -0.2, 0.2)) / n) * Math.PI * 2;
    const r = between(rand, 0.72, 0.9);
    base.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    const at = ((i + 0.5 + between(rand, -0.25, 0.25)) / n) * Math.PI * 2;
    const rt = between(rand, 1, 1.22);
    tips.push([cx + Math.cos(at) * rx * rt, cy + Math.sin(at) * ry * rt]);
  }
  const segs = [];
  for (let i = 0; i < n; i++) {
    const p = base[i];
    const q = base[(i + 1) % n];
    const t = tips[i];
    // Each leaf swells out from the mass and comes to its point.
    const c1 = [p[0] + (t[0] - p[0]) * 0.3 + (t[0] - cx) * 0.12, p[1] + (t[1] - p[1]) * 0.3 + (t[1] - cy) * 0.12];
    const c2 = [q[0] + (t[0] - q[0]) * 0.3 + (t[0] - cx) * 0.12, q[1] + (t[1] - q[1]) * 0.3 + (t[1] - cy) * 0.12];
    segs.push([c1, t], [c2, q]);
  }
  return closed(base[0], segs);
}

/** One leaf, hanging from (x, y) at angle a, pointed at its tip. */
function leaf(x, y, a, len, wid) {
  const dir = [Math.sin(a), Math.cos(a)];
  const nrm = [-dir[1], dir[0]];
  const tip = [x + dir[0] * len, y + dir[1] * len];
  const c1 = [x + dir[0] * len * 0.45 + nrm[0] * wid, y + dir[1] * len * 0.45 + nrm[1] * wid];
  const c2 = [x + dir[0] * len * 0.45 - nrm[0] * wid, y + dir[1] * len * 0.45 - nrm[1] * wid];
  return closed([x, y], [[c2, tip], [c1, [x, y]]]);
}

/** A sprig hanging down from the canopy: a thin stem, bending as it hangs,
 *  with leaves along it, larger near the top. */
function sprig(rand, x, y, len, leafLen) {
  const sway = between(rand, -0.3, 0.3);
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    pts.push([x + Math.sin(sway * s * 1.6) * len * s, y + len * s]);
  }
  let d = closed([x + 1.4, y], [pts[10], [x - 1.4, y]]);
  const n = Math.max(3, Math.round(len / (leafLen * 0.7)));
  for (let i = 1; i <= n; i++) {
    const s = i / n;
    const p = pts[Math.round(s * 10)];
    const side = i % 2 ? 1 : -1;
    const l = leafLen * (1.15 - 0.5 * s) * between(rand, 0.85, 1.1);
    d += leaf(p[0], p[1], sway + side * between(rand, 0.55, 1), l, l * 0.34);
  }
  return d;
}

/**
 * The canopy strip: a little light through gaps at the top, then two bands
 * of leaves, the farther paler and hanging lower. Each band is closed along
 * the top, where the top bar sits over it, and comes to a ragged edge of
 * clumps of leaves below, some hanging lower than others, with sprigs
 * hanging down from the nearer one.
 */
function canopy(seed, { W, H, glow, glowPeak, far, near }) {
  const rand = seeded(seed);
  const defs = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glow}" stop-opacity="${glowPeak}"/><stop offset="0.5" stop-color="${glow}" stop-opacity="${r0(glowPeak * 40) / 100}"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></linearGradient></defs>`;
  const band = (level, dip, clumpR, every) => {
    const edge = wobble(rand, H * 0.05);
    const ey = (x) => H * level + edge((x / W) * 6.283);
    const edgeLine = [];
    for (let x = W; x >= 0; x -= 50) edgeLine.push([x, ey(x)]);
    let d = closed([0, -10], [[W, -10], ...edgeLine]);
    for (let x = 0; x < W; x += every * between(rand, 0.7, 1.3)) {
      const hang = rand() < 0.14 ? between(rand, 1, 2.2) : between(rand, 0, 1);
      // A clump, and for a branch that hangs lower, a few more down it.
      for (let k = 0; k <= Math.floor(hang); k++) {
        const r = clumpR * between(rand, 0.7, 1.25) * (1 - k * 0.12);
        const cy = ey(x) + dip * k * 0.8 + between(rand, -0.3, 0.6) * clumpR;
        const cx = x + between(rand, -0.4, 0.4) * clumpR * k;
        const rx = r * between(rand, 1.1, 1.5);
        const s = r0(rand() * 1e9);
        d += wrapped(cx, rx * 1.3, W, (px) => foliage(seeded(s), px, cy, rx, r));
      }
    }
    return { d, ey };
  };
  const farBand = band(0.36, 40, 26, 34);
  const nearBand = band(0.16, 46, 30, 30);
  let sprigD = "";
  for (const x of spread(rand, 12, W)) {
    const len = between(rand, H * 0.22, H * 0.55);
    const y = nearBand.ey(x) - 4;
    const s = r0(rand() * 1e9);
    const leafLen = between(rand, 13, 18);
    sprigD += wrapped(x, 40, W, (cx) => sprig(seeded(s), cx, y, len, leafLen));
  }
  return svg(W, H, `${defs}<rect width="${W}" height="${r0(H * 0.6)}" fill="url(#sky)"/><path fill="${far}" d="${farBand.d}"/><path fill="${near}" d="${nearBand.d}"/><path fill="${near}" d="${sprigD}"/>`);
}

// ═════════════════════════════════════════════════════════════════════════════
// Wildwood: deep in a forest at night. Old trunks crowd in from the edges,
// moonlight comes down through the leaves in pale shafts, mist lies low
// among the ferns, and a few mushrooms at the roots glow a faint cyan.
// ═════════════════════════════════════════════════════════════════════════════
{
  const H = 1000;
  // Far off: two depths of thin trunks, the farthest nearly lost in the
  // mist; both darker than the air at the top and dissolving into the mist
  // near the ground.
  {
    const W = 1700;
    const rand = seeded(1101);
    const defs = `<defs><linearGradient id="a" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="#08140f"/><stop offset="0.5" stop-color="#0c1d17"/><stop offset="0.82" stop-color="#11251e" stop-opacity="0.4"/><stop offset="1" stop-color="#11251e" stop-opacity="0"/></linearGradient><linearGradient id="b" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="#060f0c"/><stop offset="0.55" stop-color="#091812"/><stop offset="0.88" stop-color="#0e211a" stop-opacity="0.6"/><stop offset="1" stop-color="#0e211a" stop-opacity="0.2"/></linearGradient></defs>`;
    const farthest = trunkRow(rand, { width: W, height: H, count: 30, w: [5, 12], lean: 10, fill: "url(#a)", step: 60 });
    const far = trunkRow(rand, { width: W, height: H, count: 17, w: [11, 22], lean: 14, fill: "url(#b)", branches: 1, step: 50 });
    write("wildwood-far.svg", svg(W, H, defs + farthest + far));
  }
  // Nearer: fewer, broader trunks with a branch or two, moonlight on their
  // left sides.
  {
    const W = 2300;
    const rand = seeded(2203);
    const defs = `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14291f"/><stop offset="0.2" stop-color="#08130f"/><stop offset="0.6" stop-color="#050c09"/><stop offset="1" stop-color="#040a08"/></linearGradient></defs>`;
    write(
      "wildwood-mid.svg",
      svg(W, H, defs + trunkRow(rand, { width: W, height: H, count: 11, w: [26, 58], lean: 18, fill: "url(#m)", round: true, branches: 2, step: 40 })),
    );
  }
  // Moonlight, pale green-white, in four shafts from the upper left.
  write(
    "wildwood-light.svg",
    shafts(
      [
        { x0: 420, x1: 760, w0: 46, w1: 120 },
        { x0: 610, x1: 980, w0: 26, w1: 80 },
        { x0: 900, x1: 1290, w0: 58, w1: 150 },
        { x0: 1180, x1: 1560, w0: 22, w1: 70 },
      ],
      "#b8e2cf",
      0.065,
    ),
  );
  // The floor: mist, ferns, and a few glowing mushrooms.
  write(
    "wildwood-floor.svg",
    floor(3307, {
      W: 2600,
      H: 300,
      mist: "#34594b",
      mistPeak: 0.42,
      back: "#0a1813",
      ground: "#050c09",
      front: "#030806",
      extraInFront: true,
      extra: (rand, W, H, gy) => {
        let d = "";
        let glow = "";
        for (const x of spread(rand, 5, W)) {
          const n = Math.floor(between(rand, 2, 5));
          for (let k = 0; k < n; k++) {
            const mx = x + k * between(rand, 9, 16);
            const my = gy(mx) + between(rand, -2, 6);
            const s = between(rand, 0.6, 1.2) * (k === 0 ? 1.2 : 0.8);
            glow += `<circle cx="${r0(mx)}" cy="${r0(my - 10 * s)}" r="${r0(26 * s)}" fill="url(#glow)"/>`;
            d += mushroom(mx, my, s);
          }
        }
        return `<defs><radialGradient id="glow"><stop offset="0" stop-color="#7ff0d0" stop-opacity="0.22"/><stop offset="1" stop-color="#7ff0d0" stop-opacity="0"/></radialGradient></defs>${glow}<path fill="#8fe8d0" fill-opacity="0.55" d="${d}"/>`;
      },
    }),
  );
  // Overhead: leaves black against a little light from above.
  write("wildwood-canopy.svg", canopy(4409, { W: 1900, H: 320, glow: "#1d3c33", glowPeak: 0.9, far: "#07110d", near: "#030806" }));

  // The nearest trunks, at the left and right edges: broad, near black,
  // bark ridged, moonlight on their left sides, moss low down, roots
  // spreading into the floor and mushrooms glowing among them.
  const near = (name, seed, W, trunks) => {
    const rand = seeded(seed);
    let defs = `<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a3329"/><stop offset="0.1" stop-color="#0a1612"/><stop offset="0.45" stop-color="#040a08"/><stop offset="1" stop-color="#020605"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#7ff0d0" stop-opacity="0.24"/><stop offset="1" stop-color="#7ff0d0" stop-opacity="0"/></radialGradient>`;
    let body = "";
    trunks.forEach((o, i) => {
      const tr = trunk(rand, { top: -20, bottom: H + 30, step: 30, ...o });
      let d = tr.d;
      for (const b of o.branches ?? []) d += branch(rand, tr, b).d;
      defs += `<clipPath id="c${i}"><path d="${tr.d}"/></clipPath>`;
      const ridges = bark(rand, tr, { count: Math.round(o.w / 9), seg: [70, 200], gap: [15, 70] });
      body += `<path fill="url(#s)" d="${d}${roots(rand, tr, o.roots ?? 3)}"/><g clip-path="url(#c${i})"><path fill="none" stroke="#0f211a" stroke-width="2.4" stroke-opacity="0.8" d="${ridges}"/><path fill="none" stroke="#000" stroke-width="3" stroke-opacity="0.6" transform="translate(4 0)" d="${ridges}"/></g>`;
      // Mushrooms at the foot.
      let m = "";
      let g = "";
      for (const [dx, s] of o.mushrooms ?? []) {
        const mx = tr.centre(0) + dx;
        const my = H - between(rand, 14, 30);
        g += `<circle cx="${r0(mx)}" cy="${r0(my - 10 * s)}" r="${r0(30 * s)}" fill="url(#glow)"/>`;
        m += mushroom(mx, my, s);
      }
      body += `${g}<path fill="#8fe8d0" fill-opacity="0.6" d="${m}"/>`;
    });
    write(name, svg(W, H, `${defs}</defs>${body}`));
  };
  near("wildwood-left.svg", 5501, 340, [
    { x: 292, w: 54, lean: -10, taper: 0.8, flare: 0.8, branches: [{ t: 0.62, side: -1, length: 90, thick: 7, rise: 0.6 }] },
    { x: 110, w: 150, lean: 16, taper: 0.82, flare: 0.9, branches: [{ t: 0.7, side: 1, length: 190, thick: 15, rise: 0.42 }], mushrooms: [[86, 1.1], [104, 0.75], [-70, 0.8]] },
  ]);
  near("wildwood-right.svg", 6607, 360, [
    { x: 74, w: 46, lean: 8, taper: 0.8, flare: 0.8 },
    { x: 248, w: 170, lean: -14, taper: 0.8, flare: 0.85, branches: [{ t: 0.55, side: -1, length: 200, thick: 16, rise: 0.5 }], mushrooms: [[-104, 0.9], [-88, 1.2], [-118, 0.7]] },
  ]);
}

/** A small mushroom: a domed cap on a short stem, standing at (x, y). */
function mushroom(x, y, s) {
  const cw = 9 * s;
  const ch = 7 * s;
  const sw = 2.2 * s;
  const sh = 9 * s;
  return closed([x - sw, y], [[x - sw * 0.8, y - sh], [x + sw * 0.8, y - sh], [x + sw, y]]) +
    closed([x - cw, y - sh], [[[x - cw, y - sh - ch * 1.6], [x, y - sh - ch * 1.4]], [[x + cw, y - sh - ch * 1.6], [x + cw, y - sh]]]);
}

/** Roots leaving the foot of a trunk to either side, tapering into the
 *  ground. */
function roots(rand, tr, count) {
  let d = "";
  for (let k = 0; k < count; k++) {
    const side = k % 2 ? 1 : -1;
    const t = between(rand, 0.02, 0.07);
    const x0 = tr.centre(t) + side * tr.half(t) * 0.6;
    const y0 = tr.y(t);
    const len = tr.w * between(rand, 0.6, 1.1);
    const tip = [x0 + side * len, tr.y(0) + between(rand, -4, 10)];
    const th = tr.w * between(rand, 0.1, 0.16);
    const c = [x0 + side * len * 0.35, y0 + (tip[1] - y0) * 0.2];
    d += closed([x0, y0 - th], [[[c[0], c[1] - th * 0.5], tip], [[c[0], c[1] + th], [x0, y0 + th * 2]]]);
  }
  return d;
}

/**
 * A birch's marks: the short dark lenticels across its bark, the dark
 * chevrons where branches once were, and the black, fissured bark low
 * down that old birches have. The caller clips them to the trunk.
 */
function birchMarks(rand, tr, { lenticels, chevrons, base = 0 }) {
  let d = "";
  for (let k = 0; k < lenticels; k++) {
    const t = between(rand, base * 0.8, 1);
    const y = tr.y(t);
    const across = between(rand, -1.1, 0.9);
    const len = tr.half(t) * between(rand, 0.2, 0.7);
    const x0 = tr.centre(t) + across * tr.half(t);
    const h = between(rand, 1.2, 3.2) * Math.max(1, tr.w / 60);
    d += closed([x0, y], [[[x0 + len / 2, y - h], [x0 + len, y]], [[x0 + len / 2, y + h * 0.7], [x0, y]]]);
  }
  for (let k = 0; k < chevrons; k++) {
    // A branch scar: a dark mark curving down and in from one edge, like a
    // brow, thick at the edge and thinning to a point.
    const t = between(rand, Math.max(0.2, base * 2), 0.95);
    const side = rand() < 0.5 ? -1 : 1;
    const y = tr.y(t);
    const edge = tr.centre(t) + side * tr.half(t) * 1.05;
    const reach = tr.half(t) * between(rand, 0.5, 1);
    const drop = tr.w * between(rand, 0.12, 0.26);
    const th = tr.w * between(rand, 0.04, 0.07);
    const inner = [edge - side * reach, y + drop];
    d += closed([edge, y - th], [[[edge - side * reach * 0.6, y - th * 0.5], inner], [[edge - side * reach * 0.5, y + th * 1.2], [edge, y + th * 1.4]]]);
  }
  if (base) {
    // The dark foot, its top edge rising and falling in soft waves where it
    // gives way to white bark.
    const n = 6;
    const xAt = (s, t) => tr.centre(t) - tr.half(t) * 1.3 + s * tr.half(t) * 2.6;
    const tops = Array.from({ length: n + 1 }, (_, i) => {
      const t = base * between(rand, 0.45, 1.1);
      return [xAt(i / n, t), tr.y(t)];
    });
    const segs = [tops[0]];
    for (let i = 1; i < n; i++) {
      const m = [(tops[i][0] + tops[i + 1][0]) / 2, (tops[i][1] + tops[i + 1][1]) / 2];
      segs.push([tops[i], i === n - 1 ? tops[n] : m]);
    }
    segs.push([xAt(1, 0), tr.y(0) + 5]);
    d += closed([xAt(0, 0), tr.y(0) + 5], segs);
  }
  return d;
}

/** A wood anemone: five white petals round a yellow middle, on a stem. */
function anemone(x, y, s) {
  let petals = "";
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    const tip = [x + Math.cos(a) * 7 * s, y + Math.sin(a) * 5 * s];
    const n = [-Math.sin(a) * 3 * s, Math.cos(a) * 2.2 * s];
    petals += closed([x, y], [[[x + Math.cos(a) * 4 * s + n[0], y + Math.sin(a) * 3 * s + n[1]], tip], [[x + Math.cos(a) * 4 * s - n[0], y + Math.sin(a) * 3 * s - n[1]], [x, y]]]);
  }
  return { petals, stem: closed([x - 0.8, y], [[x - 1.2, y + 16 * s], [x + 1.2, y + 16 * s], [x + 0.8, y]]), centre: [x, y, 1.8 * s] };
}

// ═════════════════════════════════════════════════════════════════════════════
// Birchwood: a birch wood on a sunny morning. White trunks marked in black
// at every depth, the farthest pale in the haze, sunlight slanting down
// through fresh green leaves, ferns and wood anemones along the foot. All
// of it pale enough that the app's text reads over any part of it: the
// marks on the trunks the page's writing passes over are a soft grey, and
// only the nearest trunks, out at the edges, are marked in black.
// ═════════════════════════════════════════════════════════════════════════════
{
  const H = 1000;
  // Far off: pale trunks in the haze, fading into it towards the ground.
  {
    const W = 1700;
    const rand = seeded(7101);
    const defs = `<defs><linearGradient id="a" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="#dfe6d6"/><stop offset="0.6" stop-color="#e3e8db"/><stop offset="0.85" stop-color="#e9ede1" stop-opacity="0.5"/><stop offset="1" stop-color="#e9ede1" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbfbf6"/><stop offset="0.55" stop-color="#eef0e8"/><stop offset="1" stop-color="#d6dbcf"/></linearGradient></defs>`;
    const farthest = trunkRow(rand, { width: W, height: H, count: 30, w: [5, 12], lean: 10, fill: "url(#a)", step: 60 });
    // Nearer, a row of slim white birches, unmarked at this distance.
    const far = trunkRow(rand, { width: W, height: H, count: 15, w: [10, 19], lean: 12, fill: "url(#b)", round: true, branches: 1, step: 50 });
    write("birchwood-far.svg", svg(W, H, defs + farthest + far));
  }
  // Nearer birches: white, shaded on the right, marked in soft grey.
  {
    const W = 2300;
    const rand = seeded(8203);
    let defs = `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#f3f4ee"/><stop offset="0.85" stop-color="#d7dccf"/><stop offset="1" stop-color="#c9cfc0"/></linearGradient>`;
    let body = "";
    let i = 0;
    for (const x of spread(rand, 11, W)) {
      const tw = between(rand, 24, 46);
      const opts = { w: tw, top: -20, bottom: H + 20, lean: between(rand, -16, 16), taper: between(rand, 0.6, 0.8), step: 40 };
      const seed = r0(rand() * 1e9);
      const nb = Math.floor(between(rand, 0, 2.4));
      const bs = Array.from({ length: nb }, () => ({ t: between(rand, 0.55, 0.95), side: rand() < 0.5 ? -1 : 1, length: tw * between(rand, 1.4, 2.6), thick: tw * between(rand, 0.06, 0.1), rise: between(rand, 0.6, 1.1) }));
      const copies = [x];
      if (x - tw * 4 < 0) copies.push(x + W);
      if (x + tw * 4 > W) copies.push(x - W);
      for (const cx of copies) {
        const r = seeded(seed);
        const tr = trunk(r, { ...opts, x: cx });
        let br = "";
        for (const b of bs) br += branch(r, tr, b).d;
        defs += `<clipPath id="k${i}"><path d="${tr.d}"/></clipPath>`;
        body += `<path fill="#a4a596" d="${br}"/><path fill="url(#m)" d="${tr.d}"/><path fill="#8d8f86" fill-opacity="0.5" clip-path="url(#k${i})" d="${birchMarks(r, tr, { lenticels: Math.round(tw * 0.9), chevrons: 3 })}"/>`;
        i++;
      }
    }
    write("birchwood-mid.svg", svg(W, H, `${defs}</defs>${body}`));
  }
  // Sunlight, warm white, in four shafts from the upper left.
  write(
    "birchwood-light.svg",
    shafts(
      [
        { x0: 380, x1: 720, w0: 50, w1: 130 },
        { x0: 620, x1: 990, w0: 28, w1: 84 },
        { x0: 920, x1: 1300, w0: 60, w1: 150 },
        { x0: 1200, x1: 1560, w0: 24, w1: 74 },
      ],
      "#fffbe2",
      0.5,
    ),
  );
  // The floor: ferns and grass in fresh greens, wood anemones among them.
  write(
    "birchwood-floor.svg",
    floor(9307, {
      W: 2600,
      H: 300,
      mist: "#fbfcf3",
      mistPeak: 0.5,
      back: "#bccd9f",
      ground: "#cdd8b2",
      front: "#93b06c",
      extra: (rand, W, H, gy) => {
        let petals = "";
        let stems = "";
        let centres = "";
        for (const x of spread(rand, 26, W)) {
          const n = Math.floor(between(rand, 1, 4));
          for (let k = 0; k < n; k++) {
            const fx = x + k * between(rand, 10, 18);
            const f = anemone(fx, gy(fx) - between(rand, 6, 16), between(rand, 0.8, 1.2));
            petals += f.petals;
            stems += f.stem;
            centres += `<circle cx="${r0(f.centre[0])}" cy="${r0(f.centre[1])}" r="${r0(f.centre[2] * 10) / 10}"/>`;
          }
        }
        return `<path fill="#86a463" d="${stems}"/><path fill="#ffffff" d="${petals}"/><g fill="#e8c84a">${centres}</g>`;
      },
    }),
  );
  // Overhead: fresh birch leaves with the sun bright through the gaps.
  write("birchwood-canopy.svg", canopy(10409, { W: 1900, H: 320, glow: "#fffbe0", glowPeak: 0.9, far: "#cfe0ae", near: "#b3cf8a" }));

  // The nearest birches, at the left and right edges: white, lit warm on
  // the left and shaded on the right, marked in black, black at the foot.
  const near = (name, seed, W, trunks) => {
    const rand = seeded(seed);
    let defs = `<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffdf2"/><stop offset="0.4" stop-color="#f8f7f0"/><stop offset="0.8" stop-color="#d9dccf"/><stop offset="1" stop-color="#b9bfb0"/></linearGradient>`;
    let body = "";
    trunks.forEach((o, i) => {
      const tr = trunk(rand, { top: -20, bottom: H + 30, step: 30, ...o });
      let br = "";
      for (const b of o.branches ?? []) br += branch(rand, tr, b).d;
      defs += `<clipPath id="c${i}"><path d="${tr.d}"/></clipPath>`;
      const marks = birchMarks(rand, tr, { lenticels: Math.round(o.w * 1.1), chevrons: 4, base: 0.07 });
      body += `<path fill="#6f6e62" d="${br}"/><path fill="url(#s)" d="${tr.d}${roots(rand, tr, 2)}"/><path fill="#2b2a25" fill-opacity="0.85" clip-path="url(#c${i})" d="${marks}"/>`;
    });
    write(name, svg(W, H, `${defs}</defs>${body}`));
  };
  near("birchwood-left.svg", 11501, 200, [
    { x: 150, w: 30, lean: -8, taper: 0.75, flare: 0.5, branches: [{ t: 0.58, side: 1, length: 60, thick: 3, rise: 0.9 }] },
    { x: 46, w: 74, lean: 10, taper: 0.8, flare: 0.5, branches: [{ t: 0.74, side: 1, length: 100, thick: 5, rise: 0.8 }] },
  ]);
  near("birchwood-right.svg", 12607, 210, [
    { x: 50, w: 28, lean: 6, taper: 0.75, flare: 0.5 },
    { x: 160, w: 80, lean: -12, taper: 0.8, flare: 0.5, branches: [{ t: 0.64, side: -1, length: 100, thick: 5, rise: 0.85 }] },
  ]);
}
