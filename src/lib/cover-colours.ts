import { useEffect, useSyncExternalStore } from "react";
import { spineColour } from "@/lib/spine-colour";
import { coverAt } from "@/lib/cover-src";

/**
 * The main colour of each cover, for the spines in the reading room and in
 * the library's Spines view (lib/spine-colour.ts picks it from the pixels).
 *
 * Kept in localStorage by cover address. A cover's address changes when the
 * image does (lib/covers.ts names files by their content), so an entry
 * never goes stale. "" marks a cover that can't be read (another site's
 * image without CORS), which then keeps its drawn colour.
 */

const COLOUR_KEY = "myreads:spine-colours";
const MAX_COLOURS = 5000;
let colours: Record<string, string> | null = null;
const listeners = new Set<() => void>();
const NO_COLOURS: Record<string, string> = {};

function loadColours(): Record<string, string> {
  if (colours) return colours;
  colours = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLOUR_KEY) ?? "{}");
    if (parsed && typeof parsed === "object") {
      for (const [url, value] of Object.entries(parsed)) {
        if (typeof value === "string" && /^(#[0-9a-f]{6})?$/.test(value)) colours[url] = value;
      }
    }
  } catch {
    // Storage blocked or garbled: start afresh.
  }
  return colours;
}

function rememberColours(found: Record<string, string>) {
  const next = { ...loadColours(), ...found };
  const urls = Object.keys(next);
  for (const url of urls.slice(0, Math.max(0, urls.length - MAX_COLOURS))) delete next[url];
  colours = next;
  try {
    localStorage.setItem(COLOUR_KEY, JSON.stringify(next));
  } catch {
    // Full or blocked: the colours last until the tab closes.
  }
  listeners.forEach((fn) => fn());
}

const subscribeColours = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The cover's spine colour; "" when it can't be read, null when it might
 *  work another time (a network hiccup). */
function readCover(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const local = url.startsWith("/");
    if (!local) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 36;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, 24, 36);
        resolve(spineColour(ctx.getImageData(0, 0, 24, 36).data) ?? "");
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve(local ? null : "");
    // 24 by 36 pixels are read, so the smallest copy of a cached cover
    // does (lib/cover-src.ts); the colour stays filed under the cover.
    img.src = coverAt(url, 160);
  });
}

/** Reads the covers that have no colour yet, a few at a time, and saves
 *  what it finds in batches so the shelves don't redraw for every book.
 *  Returns every colour known so far, by cover address. */
export function useCoverColours(urls: string[]): Record<string, string> {
  const known = useSyncExternalStore(subscribeColours, loadColours, () => NO_COLOURS);
  const wanted = urls.join("\n");

  useEffect(() => {
    const queue = wanted.split("\n").filter((u) => u && !(u in loadColours()));
    if (!queue.length) return;
    let stopped = false;
    let found: Record<string, string> = {};
    const flush = () => {
      if (Object.keys(found).length) rememberColours(found);
      found = {};
    };
    const timer = setInterval(flush, 400);
    const worker = async () => {
      while (!stopped && queue.length) {
        const url = queue.shift()!;
        const colour = await readCover(url);
        if (colour !== null) found[url] = colour;
      }
    };
    void Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      clearInterval(timer);
      if (!stopped) flush();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      flush();
    };
  }, [wanted]);

  return known;
}
