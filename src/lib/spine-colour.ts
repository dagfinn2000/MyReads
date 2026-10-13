import { coverArt } from "@/lib/cover-art";

/**
 * The colour of a book's spine in the reading room: the main colour of its
 * cover, as a real spine usually carries on the cover's background.
 *
 * The room draws the cover small on a canvas and hands the pixels here.
 * Each pixel lands in one of 512 colour buckets; the bucket with the most
 * weight wins and its pixels are averaged. Colourful pixels weigh a little
 * more than grey ones, so a red cover with a white title comes out red,
 * not pink. The result is kept out of the very lightest and darkest
 * shades, which would lose the spine's edges against the shelf.
 */
export function spineColour(rgba: ArrayLike<number>): string | null {
  const weight = new Float64Array(512);
  const sums = new Float64Array(512 * 3);
  const counts = new Uint32Array(512);
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const bucket = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const max = Math.max(r, g, b);
    const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    weight[bucket] += 1 + 1.5 * saturation;
    sums[bucket * 3] += r;
    sums[bucket * 3 + 1] += g;
    sums[bucket * 3 + 2] += b;
    counts[bucket]++;
  }
  let best = -1;
  for (let i = 0; i < 512; i++) if (counts[i] && (best < 0 || weight[i] > weight[best])) best = i;
  if (best < 0) return null;
  const n = counts[best];
  return clampLightness(sums[best * 3] / n, sums[best * 3 + 1] / n, sums[best * 3 + 2] / n);
}

const MIN_LIGHT = 0.14;
const MAX_LIGHT = 0.86;

/** "#rrggbb" for the colour, with its HSL lightness held between
 *  MIN_LIGHT and MAX_LIGHT. */
function clampLightness(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const light = (max + min) / 2;
  const target = Math.min(MAX_LIGHT, Math.max(MIN_LIGHT, light));
  if (target !== light) {
    // Scale the channels towards black or white, keeping the hue.
    const towards = target > light ? 255 : 0;
    const t = Math.abs(target - light) / Math.abs((towards / 255) - light);
    r += (towards - r) * t;
    g += (towards - g) * t;
    b += (towards - b) * t;
  }
  const hex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** The spine of a book without a cover image: its drawn cover's colour
 *  (lib/cover-art.ts), a shade lighter so it reads on a dark shelf. */
export function drawnSpineColour(title: string): string {
  const art = coverArt(title);
  return `hsl(${art.hue} ${art.saturation}% ${art.lightness + 8}%)`;
}
