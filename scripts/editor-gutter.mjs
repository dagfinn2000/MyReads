#!/usr/bin/env node
// Draws the Editor theme's gutter, public/themes/editor-gutter.svg: the
// line numbers a code editor shows down the left of a file, 1 to 999, one
// every 24 pixels, right-aligned in a column 48 pixels wide. The page shows
// it down the left of its content, where it scrolls along with the page.
// The numbers are in the device's own monospaced face, as a picture can't
// use the app's fonts; they are only there to be looked at.
//
//   node scripts/editor-gutter.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LINES = 999;
const STEP = 24;
const WIDTH = 48;

const numbers = Array.from({ length: LINES }, (_, i) => `<tspan x="38" y="${(i + 1) * STEP - 8}">${i + 1}</tspan>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${LINES * STEP}" viewBox="0 0 ${WIDTH} ${LINES * STEP}"><text fill="#6e7681" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace" font-size="12" text-anchor="end">${numbers}</text></svg>\n`;

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/themes/editor-gutter.svg");
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
