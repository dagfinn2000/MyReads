#!/usr/bin/env node
// Draws the pictures of the scene themes added on 2026-11-13, and the
// Bowling Alley's carpet, into public/themes:
//
//   balloons.svg        three hot-air balloons high on the right of a sky
//   lemon-tree.svg      a lemon branch hanging in over a top right corner
//   dunes.svg           sand dunes along the foot of the window
//   poppies.svg         poppies rising from a bottom left corner
//   deep-sea.svg        three jellyfish glowing in a top right corner
//   constellations.svg  a corner of a star chart
//   bowling-alley.svg   one tile of a cosmic bowling alley carpet
//   vaporwave.svg       a striped sunset sun over a grid running to the horizon
//
// Each picture lies under writing somewhere, so on the light themes it is
// drawn pale and on the dark ones dim: text over any part of it still
// reads. No SVG filters (see the Golden Gate picture: the browser runs them
// again on every repaint); soft light is gradients. Anything scattered is
// placed by a seeded generator, so the pictures come out the same each run,
// and every number is rounded so the files stay small.
//
//   node scripts/scene-pictures.mjs
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
const r1 = (n) => Math.round(n * 10) / 10;
const r0 = (n) => Math.round(n);
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const write = (name, text) => {
  writeFileSync(path.join(OUT, name), text);
  console.log(`${name}: ${text.length} bytes`);
};

// ── Balloons ────────────────────────────────────────────────────────────────
// Each balloon is an envelope (a round top narrowing to its mouth) striped
// in curved gores: ellipses of the two colours, narrower and narrower, cut
// to the envelope's shape. A gradient shades its far side and a glint lights
// its near one; under it, a wicker basket on four ropes. The farther the
// balloon, the paler it is, as air pales what is far off. They keep to the
// right edge, where the page's margin is, so the controls stay clear.
function balloon(id, cx, cy, r, [a, b], basket, fade) {
  const n = (v) => r1(v);
  const env = `M${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 0 1 ${n(cx + r)} ${n(cy)}C${n(cx + r)} ${n(cy + 0.58 * r)} ${n(cx + 0.36 * r)} ${n(cy + 1.02 * r)} ${n(cx + 0.2 * r)} ${n(cy + 1.34 * r)}L${n(cx - 0.2 * r)} ${n(cy + 1.34 * r)}C${n(cx - 0.36 * r)} ${n(cy + 1.02 * r)} ${n(cx - r)} ${n(cy + 0.58 * r)} ${n(cx - r)} ${n(cy)}Z`;
  const gores = [1, 0.74, 0.48, 0.22]
    .map((f, i) => `<ellipse cx="${n(cx)}" cy="${n(cy + 0.25 * r)}" rx="${n(f * r)}" ry="${n(1.5 * r)}" fill="${i % 2 ? b : a}"/>`)
    .join("");
  const by = cy + 1.56 * r;
  const bw = 0.26 * r;
  const ropes = [
    [cx - 0.2 * r, cx - bw / 2],
    [cx - 0.07 * r, cx - bw / 6],
    [cx + 0.07 * r, cx + bw / 6],
    [cx + 0.2 * r, cx + bw / 2],
  ]
    .map(([x1, x2]) => `<path d="M${n(x1)} ${n(cy + 1.34 * r)}L${n(x2)} ${n(by)}"/>`)
    .join("");
  return `<g opacity="${fade}"><clipPath id="${id}"><path d="${env}"/></clipPath><g clip-path="url(#${id})">${gores}<rect x="${n(cx - r)}" y="${n(cy - r)}" width="${n(2 * r)}" height="${n(2.4 * r)}" fill="url(#shade)"/></g><ellipse cx="${n(cx - 0.42 * r)}" cy="${n(cy - 0.38 * r)}" rx="${n(0.16 * r)}" ry="${n(0.3 * r)}" fill="#ffffff" opacity="0.5" transform="rotate(24 ${n(cx - 0.42 * r)} ${n(cy - 0.38 * r)})"/><g stroke="${basket}" stroke-width="${n(Math.max(1, r / 60))}">${ropes}</g><rect x="${n(cx - bw / 2)}" y="${n(by)}" width="${n(bw)}" height="${n(0.2 * r)}" rx="${n(0.03 * r)}" fill="${basket}"/></g>`;
}
{
  const defs = `<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0.45" stop-color="#3a2a40" stop-opacity="0"/><stop offset="1" stop-color="#3a2a40" stop-opacity="0.16"/></linearGradient><radialGradient id="cloud"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>`;
  const clouds = [
    [1330, 560, 150, 22],
    [1250, 300, 110, 16],
    [1380, 210, 80, 12],
  ]
    .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#cloud)"/>`)
    .join("");
  const body =
    defs +
    clouds +
    balloon("b3", 1412, 640, 22, ["#c6d3ee", "#eef1f8"], "#c9b9a6", 0.8) +
    balloon("b2", 1318, 430, 36, ["#a9dbd3", "#f5ecd0"], "#c4ab8f", 0.88) +
    balloon("b1", 1392, 118, 60, ["#f5ae9c", "#fbe7d6"], "#b89a7c", 0.95);
  write("balloons.svg", svg(1440, 900, body));
}

// ── Lemon tree ──────────────────────────────────────────────────────────────
// A branch comes in over the top right corner and bows down to the left,
// with pointed leaves along it in two greens and four lemons hanging from
// it. Leaves and wood are kept light so writing over them still reads.
{
  const rnd = seeded(7);
  const W = 600;
  const H = 600;
  // The branch, a curve from off the right edge down to its tip.
  const branch = "M640 40C540 70 470 120 400 190C340 250 300 300 250 330C215 352 185 360 150 366";
  const twigs = ["M470 118C470 160 455 190 430 214", "M330 268C350 300 352 330 340 360", "M560 66C580 110 578 150 560 182"];
  const along = [
    [600, 52], [560, 66], [520, 84], [480, 108], [445, 140], [410, 178], [380, 210], [345, 245],
    [312, 278], [280, 306], [245, 332], [210, 350], [175, 360], [150, 366],
  ];
  let leaves = "";
  along.forEach(([x, y], i) => {
    for (const side of [-1, 1]) {
      if (rnd() < 0.25) continue;
      const len = 46 + rnd() * 30;
      const ang = (side < 0 ? 200 : 70) + (rnd() - 0.5) * 50 + i * 2;
      const w = len * 0.32;
      const fill = rnd() < 0.5 ? "#a9c79a" : "#93b884";
      const vein = "#7fa271";
      leaves += `<g transform="translate(${x} ${y}) rotate(${r0(ang)})"><path d="M0 0C${r1(len * 0.3)} ${r1(-w)} ${r1(len * 0.75)} ${r1(-w * 0.8)} ${r1(len)} 0C${r1(len * 0.75)} ${r1(w * 0.8)} ${r1(len * 0.3)} ${r1(w)} 0 0Z" fill="${fill}"/><path d="M2 0L${r1(len * 0.92)} 0" stroke="${vein}" stroke-width="1.2" opacity="0.6"/></g>`;
    }
  });
  const lemon = (x, y, s, rot) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -6L0 10" stroke="#a48d6c" stroke-width="2.4"/><path d="M-5 14L0 7L5 14C22 18 32 32 32 50C32 70 20 82 6 86L0 94L-6 86C-20 82 -32 70 -32 50C-32 32 -22 18 -5 14Z" fill="#f7d75e"/><path d="M-5 14L0 7L5 14C22 18 32 32 32 50C32 70 20 82 6 86L0 94L-6 86C-20 82 -32 70 -32 50C-32 32 -22 18 -5 14Z" fill="url(#rind)"/><ellipse cx="-13" cy="40" rx="6" ry="13" fill="#fff7cf" opacity="0.7" transform="rotate(18 -12 32)"/></g>`;
  const defs = `<defs><radialGradient id="rind" cx="0.38" cy="0.32" r="0.75"><stop offset="0.55" stop-color="#e9b934" stop-opacity="0"/><stop offset="1" stop-color="#e2ad2a" stop-opacity="0.6"/></radialGradient></defs>`;
  const body =
    defs +
    `<g fill="none" stroke="#b9a283" stroke-linecap="round"><path d="${branch}" stroke-width="9"/>${twigs.map((d) => `<path d="${d}" stroke-width="5"/>`).join("")}</g>` +
    leaves +
    lemon(430, 214, 1, -8) +
    lemon(340, 360, 0.86, 6) +
    lemon(560, 182, 0.92, -14) +
    lemon(250, 334, 0.7, 10);
  write("lemon-tree.svg", svg(W, H, body));
}

// ── Dunes ───────────────────────────────────────────────────────────────────
// Three ranges of dunes, the farthest palest. Each dune is a smooth hill
// with a crest running down it: the side towards the sun lit, the other
// shaded, the line between them sharp, as wind leaves it.
{
  const W = 1600;
  const H = 520;
  const rows = [
    { base: 300, lit: "#f8dcc0", shade: "#f2cdae", crests: [[260, 170], [760, 140], [1250, 180], [1600, 160]] },
    { base: 380, lit: "#f4cfaa", shade: "#ecbd94", crests: [[80, 280], [560, 235], [1020, 270], [1460, 230]] },
    { base: 460, lit: "#efc298", shade: "#e4ad7f", crests: [[330, 350], [880, 320], [1380, 360]] },
  ];
  let body = "";
  for (const { lit, shade, crests } of rows) {
    // The hill: up to each crest and down again, smooth.
    let d = `M0 ${H}L0 ${crests[0][1] + 60}`;
    let x0 = 0;
    let y0 = crests[0][1] + 60;
    for (const [cx, cy] of crests) {
      d += `C${r0(x0 + (cx - x0) * 0.5)} ${y0} ${r0(cx - (cx - x0) * 0.35)} ${cy} ${cx} ${cy}`;
      x0 = cx;
      y0 = cy;
    }
    d += `C${r0(x0 + 120)} ${y0} ${W} ${y0 + 40} ${W} ${y0 + 50}L${W} ${H}Z`;
    body += `<path d="${d}" fill="${lit}"/>`;
    // Each crest's shaded side, from the crest down to the right and away.
    for (const [cx, cy] of crests) {
      body += `<path d="M${cx} ${cy}C${cx + 60} ${cy + 18} ${cx + 150} ${cy + 70} ${cx + 210} ${H}L${cx + 360} ${H}C${cx + 300} ${cy + 80} ${cx + 160} ${cy + 20} ${cx} ${cy}Z" fill="${shade}"/>`;
    }
  }
  write("dunes.svg", svg(W, H, body));
}

// ── Poppies ─────────────────────────────────────────────────────────────────
// Stems rise from the bottom left corner and bend a little; three poppies
// open at their tops (four petals, a dark heart), one still a nodding bud
// and one gone to a seed head. Petals a soft red, so writing over them reads.
{
  const W = 420;
  const H = 720;
  const stems = [
    { d: "M60 720C70 600 40 470 90 330", top: [90, 330], kind: "flower", s: 1 },
    { d: "M120 720C130 610 170 520 180 430", top: [180, 430], kind: "flower", s: 0.82 },
    { d: "M20 720C30 640 10 570 30 500", top: [30, 500], kind: "flower", s: 0.7 },
    { d: "M150 720C160 640 220 590 250 560", top: [250, 560], kind: "bud", s: 0.8 },
    { d: "M90 720C95 660 120 620 130 590", top: [130, 590], kind: "seed", s: 0.7 },
  ];
  const flower = (x, y, s) => {
    const petal = (rot, c) =>
      `<path d="M0 0C-34 -6 -52 -40 -30 -62C-14 -78 14 -78 30 -62C52 -40 34 -6 0 0Z" fill="${c}" transform="rotate(${rot})"/>`;
    return `<g transform="translate(${x} ${y}) scale(${s})">${petal(-50, "#e8705e")}${petal(50, "#e8705e")}${petal(-140, "#ef8270")}${petal(140, "#ef8270")}${petal(0, "#f08a78")}<circle r="11" fill="#4a3d3a"/><circle r="5" fill="#8a7d5a"/></g>`;
  };
  const bud = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s}) rotate(150)"><path d="M0 0C-14 4 -16 30 0 44C16 30 14 4 0 0Z" fill="#a7c08f"/><path d="M0 40C-6 34 -6 20 0 10" stroke="#e8705e" stroke-width="3" fill="none"/></g>`;
  const seed = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 0C-16 -22 16 -22 14 0C12 12 -12 12 -14 0Z" fill="#b9c79e"/><path d="M-16 -16L16 -16" stroke="#9aa77e" stroke-width="5" stroke-linecap="round"/></g>`;
  let body = `<g fill="none" stroke="#a7bd92" stroke-linecap="round">${stems.map(({ d }) => `<path d="${d}" stroke-width="4"/>`).join("")}</g>`;
  // Two leaves low on the stems, cut deep as a poppy's are.
  body += `<path d="M50 690C10 660 0 620 14 600C30 620 40 650 50 690Z" fill="#b3c69e"/><path d="M130 700C170 670 186 640 178 616C160 636 140 660 130 700Z" fill="#b3c69e"/>`;
  for (const { top: [x, y], kind, s } of stems) body += kind === "flower" ? flower(x, y, s) : kind === "bud" ? bud(x, y, s) : seed(x, y, s);
  write("poppies.svg", svg(W, H, body));
}

// ── Deep sea ────────────────────────────────────────────────────────────────
// Three jellyfish drifting in a top right corner: a soft bell, see-through,
// with a glow round it, a fringe at its rim and long tentacles trailing.
// Specks of marine snow drift past. All of it dim, so writing over it reads.
{
  const rnd = seeded(31);
  const W = 520;
  const H = 640;
  const jelly = (x, y, s, rot) => {
    let tentacles = "";
    for (let i = 0; i < 7; i++) {
      const tx = -34 + i * 11.3;
      const len = 120 + rnd() * 90;
      const sway = 10 + rnd() * 14;
      tentacles += `<path d="M${r1(tx)} 6C${r1(tx + sway)} ${r1(len * 0.3)} ${r1(tx - sway)} ${r1(len * 0.6)} ${r1(tx + sway * 0.5)} ${r1(len)}" stroke="#7ef0ff" stroke-width="${i % 3 === 1 ? 2 : 1.2}" opacity="${r1(0.18 + rnd() * 0.14)}"/>`;
    }
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="none" stroke-linecap="round"><circle r="90" fill="url(#glow)" stroke="none"/>${tentacles}<path d="M-44 6C-46 -40 -20 -58 0 -58C20 -58 46 -40 44 6C30 0 14 10 0 4C-14 10 -30 0 -44 6Z" fill="#7ef0ff" fill-opacity="0.16" stroke="#9ff6ff" stroke-opacity="0.5" stroke-width="1.6"/><path d="M-26 -30C-16 -44 4 -48 18 -40" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/></g>`;
  };
  let snow = "";
  for (let i = 0; i < 46; i++) snow += `<circle cx="${r0(rnd() * W)}" cy="${r0(rnd() * H)}" r="${r1(0.6 + rnd() * 1.2)}"/>`;
  const defs = `<defs><radialGradient id="glow"><stop offset="0" stop-color="#5fe6ff" stop-opacity="0.2"/><stop offset="1" stop-color="#5fe6ff" stop-opacity="0"/></radialGradient></defs>`;
  const body = defs + `<g fill="#bfefff" opacity="0.35">${snow}</g>` + jelly(380, 120, 1, -10) + jelly(200, 260, 0.62, 8) + jelly(440, 380, 0.45, -18);
  write("deep-sea.svg", svg(W, H, body));
}

// ── Constellations ─────────────────────────────────────────────────────────
// A corner of an old star chart: two faint arcs of its grid, scattered faint
// stars, and three constellations (Cassiopeia's W, the Plough, and Orion's
// belt and shoulders) with their stars joined by fine gold lines.
{
  const rnd = seeded(5);
  const W = 640;
  const H = 640;
  const groups = [
    // [x, y, size] stars, then the lines between them by index.
    { stars: [[300, 70, 3.2], [345, 112, 2.6], [390, 84, 3], [432, 126, 2.8], [478, 92, 3.4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { stars: [[420, 250, 3.2], [480, 262, 2.8], [520, 300, 3], [566, 318, 2.6], [574, 376, 3.2], [516, 392, 3], [500, 340, 2.6]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
    { stars: [[250, 330, 3.6], [330, 320, 3], [268, 420, 2.4], [284, 414, 2.4], [300, 408, 2.4], [240, 500, 3.2], [338, 494, 3.8]], lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  ];
  let body = `<g fill="none" stroke="#f5d77a" stroke-opacity="0.09" stroke-width="1"><circle cx="640" cy="0" r="300"/><circle cx="640" cy="0" r="520"/><path d="M640 0L180 640M640 0L20 300"/></g>`;
  let faint = "";
  for (let i = 0; i < 90; i++) faint += `<circle cx="${r0(rnd() * W)}" cy="${r0(rnd() * H)}" r="${r1(0.5 + rnd() * 1.1)}" opacity="${r1(0.2 + rnd() * 0.35)}"/>`;
  body += `<g fill="#e8e4ff">${faint}</g>`;
  for (const { stars, lines } of groups) {
    body += `<g stroke="#f5d77a" stroke-opacity="0.38" stroke-width="1.2">${lines.map(([a, b]) => `<path d="M${stars[a][0]} ${stars[a][1]}L${stars[b][0]} ${stars[b][1]}"/>`).join("")}</g>`;
    body += `<g fill="#fff3c8">${stars.map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}"/><circle cx="${x}" cy="${y}" r="${r1(s * 2.6)}" opacity="0.12"/>`).join("")}</g>`;
  }
  write("constellations.svg", svg(W, H, body));
}

// ── Bowling alley ───────────────────────────────────────────────────────────
// One square of a cosmic bowling alley carpet: neon squiggles, stars,
// rings and little planets scattered on black. Shapes that leave one edge
// come back at the other, so the squares join without a seam. Dimmed, so
// writing over the carpet still reads.
{
  const rnd = seeded(1987);
  const S = 360;
  const colours = ["#39f0ff", "#ff4fd8", "#ffe14d", "#6bff7a", "#9b6bff"];
  const shapes = [];
  for (let i = 0; i < 22; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const c = colours[i % colours.length];
    const kind = i % 4;
    const rot = r0(rnd() * 360);
    let el;
    if (kind === 0) el = `<path d="M-22 0C-14 -12 -6 12 2 0C10 -12 18 12 26 0" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
    else if (kind === 1) el = `<path d="M0 -12L3.5 -3.5L12 -3.5L5 2L8 11L0 5.5L-8 11L-5 2L-12 -3.5L-3.5 -3.5Z" fill="${c}"/>`;
    else if (kind === 2) el = `<circle r="9" fill="none" stroke="${c}" stroke-width="3"/>`;
    else el = `<circle r="8" fill="${c}"/><ellipse rx="15" ry="4" fill="none" stroke="${c}" stroke-width="2"/>`;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const px = x + dx;
      const py = y + dy;
      if (px < -40 || px > S + 40 || py < -40 || py > S + 40) continue;
      shapes.push(`<g transform="translate(${r0(px)} ${r0(py)}) rotate(${rot})">${el}</g>`);
    }
  }
  write("bowling-alley.svg", svg(S, S, `<g opacity="0.3">${shapes.join("")}</g>`));
}

// ── Vaporwave ───────────────────────────────────────────────────────────────
// A sun going down on the right, cut by stripes that widen towards its foot,
// over a grid that runs away to the horizon: its cross lines closer
// together the farther off they are, its long lines all meeting at one
// point on the horizon. Pastel and see-through, as the page's writing
// passes over it.
{
  const W = 1600;
  const H = 600;
  const HORIZON = 300;
  const [sx, sr] = [1450, 170];
  let clip = "";
  // The sun's stripes: whole down to a third of the way, then cut.
  let y = HORIZON - sr;
  clip += `<rect x="${sx - sr}" y="${y}" width="${2 * sr}" height="${r0(sr * 0.9)}"/>`;
  y += sr * 0.9;
  for (let i = 0; y < HORIZON; i++) {
    const gap = 5 + i * 3;
    const band = Math.max(6, 22 - i * 3);
    y += gap;
    clip += `<rect x="${sx - sr}" y="${r0(y)}" width="${2 * sr}" height="${r0(Math.min(band, HORIZON - y))}"/>`;
    y += band;
  }
  let grid = "";
  // Cross lines: each step nearer is farther apart.
  for (let i = 1, gy = HORIZON; gy < H; i++) {
    gy = HORIZON + 4 * i * i;
    if (gy > H) break;
    grid += `<path d="M0 ${r0(gy)}H${W}"/>`;
  }
  // Long lines, all from the vanishing point.
  const VX = 800;
  for (let x = -2400; x <= 4000; x += 160) grid += `<path d="M${VX} ${HORIZON}L${x} ${H}"/>`;
  const defs = `<defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff8fc6"/></linearGradient><clipPath id="stripes">${clip}</clipPath><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="${HORIZON}" x2="0" y2="${H}"><stop offset="0" stop-color="#b07ad6" stop-opacity="0"/><stop offset="0.25" stop-color="#b07ad6" stop-opacity="0.45"/><stop offset="1" stop-color="#b07ad6" stop-opacity="0.55"/></linearGradient></defs>`;
  const body =
    defs +
    `<circle cx="${sx}" cy="${HORIZON}" r="${sr}" fill="url(#sun)" opacity="0.6" clip-path="url(#stripes)"/>` +
    `<rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="#f6d2ef" opacity="0.5"/>` +
    `<g stroke="url(#fade)" stroke-width="1.5" fill="none">${grid}</g>`;
  write("vaporwave.svg", svg(W, H, body));
}
