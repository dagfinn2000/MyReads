// Draws public/themes/contour.svg, the Contour theme's picture: a
// topographic map. Hills and a valley from a seeded height field, contour
// lines every 20 m with a heavier one every 100 m and its height written
// along it, woods in pale green, a lake in blue, the survey grid, spot
// heights on the summits and a north arrow. Run with
// `node scripts/contour-picture.mjs`.
//
// Everything comes from a seeded random generator, so the file is the
// same each run and the map never repeats across a wide screen. No
// filters, only plain fills and strokes, so it costs nothing to paint.
import { writeFileSync } from "node:fs";

const W = 1600;
const H = 1000;
const STEP = 8; // the height field's sample spacing
const PAD = 96; // sampled past the edges, so woods and lakes close out of sight

let seed = 0x70b0;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Smooth value noise: random values on a lattice, eased between.
function makeNoise(cell) {
  const values = new Map();
  const at = (i, j) => {
    const key = i * 7919 + j;
    if (!values.has(key)) values.set(key, random());
    return values.get(key);
  };
  const ease = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = ease(fx - i);
    const v = ease(fy - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
    return a + (b - a) * v;
  };
}

const rough = [makeNoise(520), makeNoise(260), makeNoise(130), makeNoise(65)];
const woodNoise = [makeNoise(300), makeNoise(140), makeNoise(70)];
const hills = [
  { x: 330, y: 300, r: 260, h: 0.55 },
  { x: 1180, y: 250, r: 300, h: 0.7 },
  { x: 1420, y: 760, r: 220, h: 0.45 },
  { x: 240, y: 860, r: 200, h: 0.3 },
  { x: 760, y: 120, r: 180, h: 0.28 },
];
const basin = { x: 760, y: 600, r: 190, h: 0.8 };

function height(x, y) {
  let h = 0.18;
  rough.forEach((n, k) => (h += (n(x + 4000, y + 4000) - 0.5) * (0.5 / 2 ** k)));
  for (const hill of hills) h += hill.h * Math.exp(-((x - hill.x) ** 2 + (y - hill.y) ** 2) / (2 * hill.r ** 2));
  h -= basin.h * Math.exp(-((x - basin.x) ** 2 + (y - basin.y) ** 2) / (2 * basin.r ** 2));
  return 200 + h * 900; // metres
}
function woods(x, y) {
  let v = 0;
  woodNoise.forEach((n, k) => (v += (n(x + 9000, y + 9000) - 0.5) / 2 ** k));
  return v;
}

// Sample a field over the picture and a margin round it.
function sample(fn, edge) {
  const cols = Math.ceil((W + 2 * PAD) / STEP) + 1;
  const rows = Math.ceil((H + 2 * PAD) / STEP) + 1;
  const grid = [];
  for (let j = 0; j < rows; j++) {
    const row = [];
    for (let i = 0; i < cols; i++) {
      const outside = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
      row.push(outside && edge !== undefined ? edge : fn(i * STEP - PAD, j * STEP - PAD));
    }
    grid.push(row);
  }
  return grid;
}

// Marching squares: the lines where a sampled field crosses `level`,
// joined into polylines (closed ones end where they start).
function isolines(grid, level) {
  const rows = grid.length;
  const cols = grid[0].length;
  const point = (key) => {
    const [kind, i, j] = key.split(",");
    const a = +i;
    const b = +j;
    if (kind === "h") {
      const t = (level - grid[b][a]) / (grid[b][a + 1] - grid[b][a]);
      return [(a + t) * STEP - PAD, b * STEP - PAD];
    }
    const t = (level - grid[b][a]) / (grid[b + 1][a] - grid[b][a]);
    return [a * STEP - PAD, (b + t) * STEP - PAD];
  };
  const links = new Map();
  const link = (p, q) => {
    if (!links.has(p)) links.set(p, []);
    if (!links.has(q)) links.set(q, []);
    links.get(p).push(q);
    links.get(q).push(p);
  };
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const tl = grid[j][i] > level;
      const tr = grid[j][i + 1] > level;
      const br = grid[j + 1][i + 1] > level;
      const bl = grid[j + 1][i] > level;
      const top = `h,${i},${j}`;
      const bottom = `h,${i},${j + 1}`;
      const left = `v,${i},${j}`;
      const right = `v,${i + 1},${j}`;
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      const centre = (grid[j][i] + grid[j][i + 1] + grid[j + 1][i + 1] + grid[j + 1][i]) / 4 > level;
      switch (code) {
        case 1: case 14: link(left, bottom); break;
        case 2: case 13: link(bottom, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(top, right); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(left, top); break;
        case 5:
          if (centre) { link(left, top); link(bottom, right); } else { link(left, bottom); link(top, right); }
          break;
        case 10:
          if (centre) { link(left, bottom); link(top, right); } else { link(left, top); link(bottom, right); }
          break;
      }
    }
  }
  const seen = new Set();
  const lines = [];
  const walk = (start) => {
    const keys = [start];
    seen.add(start);
    let here = start;
    for (;;) {
      const next = links.get(here).find((k) => !seen.has(k));
      if (!next) break;
      seen.add(next);
      keys.push(next);
      here = next;
    }
    return keys;
  };
  // Open lines first, from an end; then the closed loops.
  for (const [key, to] of links) if (to.length === 1 && !seen.has(key)) lines.push({ keys: walk(key), closed: false });
  for (const key of links.keys()) if (!seen.has(key)) lines.push({ keys: walk(key), closed: true });
  return lines.map(({ keys, closed }) => ({ points: keys.map(point), closed }));
}

// Ramer-Douglas-Peucker, to drop points the eye can't tell from a line.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const length = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}
const r = (n) => Math.round(n);
function path({ points, closed }) {
  // A loop comes back to its first point, so it closes smoothly; it is
  // simplified in two halves, as a line from a point to itself has no
  // direction to measure from.
  const half = Math.floor(points.length / 2);
  const p = closed
    ? [...simplify(points.slice(0, half + 1), 1.1).slice(0, -1), ...simplify([...points.slice(half), points[0]], 1.1)]
    : simplify(points, 1.1);
  if (p.length < 2) return "";
  let d = `M${r(p[0][0])} ${r(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i === 0 ? (closed ? p.length - 2 : 0) : i - 1];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const p3 = p[i + 2 >= p.length ? (closed ? 1 : p.length - 1) : i + 2];
    d += `C${r(x1 + (x2 - p0[0]) / 6)} ${r(y1 + (y2 - p0[1]) / 6)} ${r(x2 - (p3[0] - x1) / 6)} ${r(y2 - (p3[1] - y1) / 6)} ${r(x2)} ${r(y2)}`;
  }
  return d + (closed ? "Z" : "");
}
const visible = ({ points }) => points.some(([x, y]) => x > -20 && x < W + 20 && y > -20 && y < H + 20);

const heights = sample(height);
const wood = sample(woods, -9);
const out = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
  `<!-- Drawn by scripts/contour-picture.mjs: a topographic map. -->`,
  `<rect width="${W}" height="${H}" fill="#f4f0e2"/>`,
];

// Woods: pale green where the second field is high.
const woodLines = isolines(wood, 0.12).filter((l) => l.closed && visible(l));
out.push(`<path fill="#d9e6bf" fill-rule="evenodd" d="${woodLines.map(path).join("")}"/>`);

// The survey grid.
let grid = "";
for (let x = 80; x < W; x += 160) grid += `M${x} 0V${H}`;
for (let y = 60; y < H; y += 160) grid += `M0 ${y}H${W}`;
out.push(`<path d="${grid}" stroke="#7fa6d4" stroke-opacity="0.45" stroke-width="1"/>`);

// The lake: the floor of the basin.
let low = Infinity;
for (let y = basin.y - basin.r; y <= basin.y + basin.r; y += 4) {
  for (let x = basin.x - basin.r; x <= basin.x + basin.r; x += 4) low = Math.min(low, height(x, y));
}
const shore = low + 55;
const lake = isolines(heights, shore).filter((l) => l.closed && visible(l));
out.push(`<path fill="#bfdcef" stroke="#4f8fc8" stroke-width="1.6" d="${lake.map(path).join("")}"/>`);

// Contours: every 20 m, heavier every 100 m.
const top = Math.max(...heights.flat());
const minor = [];
const index = [];
const labelled = [];
for (let level = Math.ceil(shore / 20) * 20; level < top; level += 20) {
  const lines = isolines(heights, level).filter(visible);
  const d = lines.map(path).join("");
  if (level % 100 === 0) {
    index.push(d);
    // A height written along the longest stretch of this contour.
    const long = lines.filter((l) => l.points.length > 60).sort((a, b) => b.points.length - a.points.length)[0];
    if (long) {
      for (const at of [0.3, 0.72]) {
        const i = Math.floor(long.points.length * at);
        const [x, y] = long.points[i];
        if (x < 60 || x > W - 60 || y < 40 || y > H - 40) continue;
        if (x > W - 170 && y > H - 200) continue; // the north arrow's corner
        const [x2, y2] = long.points[Math.min(long.points.length - 1, i + 4)];
        const [x0, y0] = long.points[Math.max(0, i - 4)];
        let angle = (Math.atan2(y2 - y0, x2 - x0) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        labelled.push(`<text transform="translate(${r(x)} ${r(y)}) rotate(${r(angle)})" dy="3.5">${level}</text>`);
      }
    }
  } else {
    minor.push(d);
  }
}
out.push(`<path fill="none" stroke="#b07a43" stroke-opacity="0.62" stroke-width="0.9" d="${minor.join("")}"/>`);
out.push(`<path fill="none" stroke="#99602d" stroke-opacity="0.85" stroke-width="1.8" d="${index.join("")}"/>`);
out.push(
  `<g font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#99602d" text-anchor="middle" stroke="#f4f0e2" stroke-width="4" paint-order="stroke">${labelled.join("")}</g>`,
);

// Spot heights on the summits.
const spots = [];
for (const hill of hills) {
  let best = { h: -Infinity, x: 0, y: 0 };
  for (let y = hill.y - 120; y <= hill.y + 120; y += 4) {
    for (let x = hill.x - 120; x <= hill.x + 120; x += 4) {
      const h = height(x, y);
      if (h > best.h) best = { h, x, y };
    }
  }
  if (best.x < 40 || best.x > W - 80 || best.y < 30 || best.y > H - 30) continue;
  spots.push(
    `<path d="M${r(best.x)} ${r(best.y) - 5}l5 8.5h-10z" fill="#5a3b1c"/>`,
    `<text x="${r(best.x) + 9}" y="${r(best.y) + 4}">${r(best.h)}</text>`,
  );
}
out.push(
  `<g font-family="Helvetica, Arial, sans-serif" font-size="13" font-style="italic" fill="#5a3b1c" stroke="#f4f0e2" stroke-width="4" paint-order="stroke">${spots.join("")}</g>`,
);

// A north arrow in the lower right corner.
out.push(
  `<g transform="translate(${W - 90} ${H - 120})" stroke="#5a3b1c" stroke-width="1.4">`,
  `<circle r="34" fill="#f4f0e2" fill-opacity="0.85"/><circle r="28" fill="none" stroke-opacity="0.5"/>`,
  `<path d="M0 -40L9 0H-9z" fill="#5a3b1c"/><path d="M0 40L9 0H-9z" fill="#f4f0e2"/>`,
  `<text y="-48" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="#5a3b1c" stroke="none">N</text>`,
  `</g>`,
);
out.push("</svg>");

const file = new URL("../public/themes/contour.svg", import.meta.url);
writeFileSync(file, out.join("\n") + "\n");
console.log(`contour.svg: ${minor.length + index.length} contours, ${woodLines.length} woods, ${lake.length} lake(s), ${labelled.length} labels`);
