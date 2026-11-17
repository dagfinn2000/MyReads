#!/usr/bin/env node
// Draws the pictures shelf wear lays over covers and spines
// (globals.css, "Shelf wear"), into public/textures/:
//
// - wear-dust-a/b/c.svg: dust on a cover. Fine specks, most of them pale
//   (dust is lighter than most covers) and some darker (so it shows on pale
//   covers too), with a few fibres. They thicken towards the top, where
//   dust settles on a book that stands still. Three different scatterings,
//   so a shelf of dusty books doesn't repeat itself.
// - wear-cover-1/2/3.svg: a well-read cover, from a little to a lot. Creases
//   down the hinge by the spine, where the cover has been opened over and
//   over; scuffs along the fore-edge and its corners, where thumbs go; and
//   on the more worn ones a corner that was once folded back.
// - wear-spine-1/2/3.svg: reading creases across a spine, as a paperback's
//   spine cracks when it is opened flat, from a few to many.
//
// Each crease is a pale line beside a dark one, as a fold catches the light
// on one side. The pictures are drawn at a cover's 2:3 (a spine's 1:10)
// and stretched to fit (preserveAspectRatio="none"); lines keep their width
// with non-scaling-stroke. Positions come from a seeded random number, so a
// run draws the same pictures again, and are rounded to keep the files
// small. No SVG filters, which the browser would run on every repaint.
//
//   node scripts/shelf-wear-pictures.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "textures");

/** A small seeded random number generator (mulberry32). */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n) => Math.round(n * 10) / 10;

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${body}</svg>\n`;

// ── Dust ─────────────────────────────────────────────────────────────────
const PALE = "#ebe5d8";
const DARK = "#4f483f";

function dust(seed) {
  const rnd = random(seed);
  // Specks are round dots (a zero-length line with round ends), in three
  // sizes, pale or dark: one path for each.
  const SIZES = [0.8, 1.4, 2.4];
  const dots = { pale: SIZES.map(() => []), dark: SIZES.map(() => []) };
  for (let i = 0; i < 230; i++) {
    // Thicker towards the top: most specks in the top third.
    const y = 300 * Math.pow(rnd(), 1.7);
    const x = 200 * rnd();
    const size = Math.min(2, Math.floor(Math.pow(rnd(), 2.2) * 3));
    dots[rnd() < 0.72 ? "pale" : "dark"][size].push(`M${r1(x)} ${r1(y)}h0`);
  }
  const fibres = [];
  for (let i = 0; i < 9; i++) {
    const x = 10 + 180 * rnd();
    const y = 150 * Math.pow(rnd(), 1.4);
    const a = rnd() * Math.PI * 2;
    const len = 5 + rnd() * 9;
    const bend = (rnd() - 0.5) * 8;
    const ex = Math.cos(a) * len;
    const ey = Math.sin(a) * len;
    fibres.push(`M${r1(x)} ${r1(y)}q${r1(ex / 2 - ey * bend * 0.05)} ${r1(ey / 2 + ex * bend * 0.05)} ${r1(ex)} ${r1(ey)}`);
  }
  const paths = (list, colour, opacity) =>
    list
      .map((d, size) =>
        d.length
          ? `<path fill="none" stroke="${colour}" stroke-opacity="${opacity}" stroke-width="${SIZES[size]}" stroke-linecap="round" d="${d.join("")}"/>`
          : "",
      )
      .join("");
  return svg(
    200,
    300,
    paths(dots.pale, PALE, 0.7) +
      paths(dots.dark, DARK, 0.38) +
      `<path fill="none" stroke="${PALE}" stroke-opacity="0.6" stroke-width="0.45" stroke-linecap="round" d="${fibres.join("")}"/>`,
  );
}

// ── A worn cover ─────────────────────────────────────────────────────────
/** A crease: a pale line and a dark one beside it, through `points`, each
 *  wandering a little. */
function crease(points, rnd, { light = 0.42, shade = 0.22, dx = 0.9, dy = 0 } = {}) {
  const wobble = (p) => p.map(([x, y]) => [x + (rnd() - 0.5) * 0.8, y + (rnd() - 0.5) * 0.8]);
  const line = (p, ox, oy) =>
    "M" + p.map(([x, y]) => `${r1(x + ox)} ${r1(y + oy)}`).join("L");
  const p = wobble(points);
  return (
    `<path fill="none" vector-effect="non-scaling-stroke" stroke="#fff" stroke-opacity="${light}" stroke-width="1" d="${line(p, 0, 0)}"/>` +
    `<path fill="none" vector-effect="non-scaling-stroke" stroke="#000" stroke-opacity="${shade}" stroke-width="1" d="${line(p, dx, dy)}"/>`
  );
}

/** Lines down the cover at about `x`, bending a little on the way, in
 *  stretches with gaps between, as a crease cracks the colour in places. */
function hinge(x, rnd) {
  const lines = [];
  let y = rnd() * 20;
  while (y < 300) {
    const len = 30 + rnd() * 110;
    const pts = [];
    for (let at = y; at < Math.min(300, y + len); at += 15) pts.push([x + (rnd() - 0.5) * 1.2, at]);
    pts.push([x + (rnd() - 0.5) * 1.2, Math.min(300, y + len)]);
    lines.push(pts);
    y += len + 6 + rnd() * 30;
  }
  return lines;
}

/** Short pale scratches near a point, as thumbs rub the colour off. */
function scuffs(cx, cy, spread, count, rnd) {
  const d = [];
  for (let i = 0; i < count; i++) {
    const x = cx + (rnd() - 0.5) * spread * 2;
    const y = cy + (rnd() - 0.5) * spread * 2;
    const a = rnd() * Math.PI;
    const len = 1.5 + rnd() * 5;
    d.push(`M${r1(x)} ${r1(y)}l${r1(Math.cos(a) * len)} ${r1(Math.sin(a) * len)}`);
  }
  return `<path fill="none" vector-effect="non-scaling-stroke" stroke="#fff" stroke-opacity="0.38" stroke-width="1" stroke-linecap="round" d="${d.join("")}"/>`;
}

/** A crease down the hinge, in its stretches. */
function hingeCrease(x, rnd, look) {
  return hinge(x, rnd)
    .map((pts) => crease(pts, rnd, look))
    .join("");
}

function wornCover(level) {
  const rnd = random(40 + level);
  let body = hingeCrease(11, rnd, { light: 0.4, shade: 0.13 });
  // Thumb scuffs at the fore-edge corners and down the fore-edge.
  body += scuffs(196, 6, 7, 6 * level, rnd);
  body += scuffs(196, 294, 7, 6 * level, rnd);
  body += scuffs(198, 150, 4, 3 * level, rnd);
  if (level >= 2) {
    body += hingeCrease(16, rnd, { light: 0.3, shade: 0.1 });
    // A top corner folded back once to keep the place.
    body += crease([[168, 0], [184, 15], [200, 31]], rnd, { dx: 0, dy: 0.9 });
    body += scuffs(4, 296, 5, 2 * level, rnd);
  }
  if (level >= 3) {
    body += hingeCrease(6.5, rnd, { light: 0.3, shade: 0.1 });
    // The foot corner folded once too.
    body += crease([[178, 300], [189, 289], [200, 277]], rnd, { dx: 0, dy: -0.9 });
    body += scuffs(4, 4, 5, 4, rnd);
  }
  return svg(200, 300, body);
}

// ── A worn spine ─────────────────────────────────────────────────────────
function wornSpine(level) {
  const rnd = random(70 + level);
  const count = [0, 3, 6, 10][level];
  let body = "";
  for (let i = 0; i < count; i++) {
    // Spread down the spine, avoiding its very ends.
    const y = 30 + (340 * (i + 0.2 + rnd() * 0.6)) / count;
    const tilt = (rnd() - 0.5) * 6;
    // Most cracks run right across; some stop part way.
    const from = rnd() < 0.7 ? 0 : 6 + rnd() * 12;
    const to = rnd() < 0.7 ? 40 : 22 + rnd() * 12;
    const mid = (from + to) / 2;
    body += crease(
      [
        [from, y - tilt / 2],
        [mid, y + (rnd() - 0.5) * 3],
        [to, y + tilt / 2],
      ],
      rnd,
      { light: 0.45, shade: 0.3, dx: 0, dy: 1 },
    );
  }
  return svg(40, 400, body);
}

const files = {
  "wear-dust-a.svg": dust(11),
  "wear-dust-b.svg": dust(23),
  "wear-dust-c.svg": dust(37),
  "wear-cover-1.svg": wornCover(1),
  "wear-cover-2.svg": wornCover(2),
  "wear-cover-3.svg": wornCover(3),
  "wear-spine-1.svg": wornSpine(1),
  "wear-spine-2.svg": wornSpine(2),
  "wear-spine-3.svg": wornSpine(3),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(path.join(OUT, name), content);
  console.log(name, content.length, "bytes");
}
