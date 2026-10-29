#!/usr/bin/env node
/**
 * How the app feels on a slow phone: page loads and taps, measured in a real
 * browser against a running build. See docs/PERFORMANCE.md for what the
 * numbers mean and what they were last time.
 *
 *   MYREADS_USER=me MYREADS_PASSWORD=… node scripts/perf.mjs            # both
 *   MYREADS_USER=me MYREADS_PASSWORD=… node scripts/perf.mjs pages      # loads only
 *   MYREADS_USER=me MYREADS_PASSWORD=… node scripts/perf.mjs taps       # taps only
 *
 * Options (environment): BASE (default http://localhost:3000), RUNS (3),
 * CPU (6: the processor slowed six times, a low-end phone), THEME (light).
 *
 * Measure a production build (`npm run build && npm start`), never the dev
 * server, and a library of a few hundred books: an empty one hides most of
 * what matters. Nothing here writes to the account: the taps open and
 * close things and filter the library, which only changes the address.
 *
 * Needs Playwright and its Chromium, which the app itself doesn't:
 *   npm install --no-save playwright && npx playwright install chromium
 */

import { createRequire } from "node:module";

let chromium;
try {
  // require, not import(): it also finds a Playwright installed globally.
  ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
  console.error("Needs Playwright: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUNS = Number(process.env.RUNS ?? 3);
const CPU = Number(process.env.CPU ?? 6);
const THEME = process.env.THEME ?? "light";
const what = process.argv[2] ?? "all";
const user = process.env.MYREADS_USER;
const password = process.env.MYREADS_PASSWORD;
if (!user || !password) {
  console.error("Set MYREADS_USER and MYREADS_PASSWORD to an account with a library to measure.");
  process.exit(1);
}

/** A mid-range Android phone's screen. */
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
};
/** Slow 4G, as Lighthouse has it. */
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};

const browser = await chromium.launch();

// Signed in once; each run starts from a fresh context with that session.
const session = await (async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#username", user);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
})();

async function phonePage({ network = false } = {}) {
  const ctx = await browser.newContext({ ...PHONE, storageState: session });
  await ctx.addInitScript((theme) => {
    try {
      localStorage.setItem("myreads-device-theme", theme);
    } catch {}
  }, THEME);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (network) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  }
  return { ctx, page, cdp };
}

// ── Page loads ─────────────────────────────────────────────────────────

/** Paint, layout shift and long-task numbers, gathered as the page loads. */
const LOAD_OBSERVERS = () => {
  const m = (window.__perf = { fcp: 0, lcp: 0, cls: 0, long: [] });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.name === "first-contentful-paint") m.fcp = e.startTime;
  }).observe({ type: "paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) m.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) m.long.push([e.startTime, e.duration]);
  }).observe({ type: "longtask", buffered: true });
};

async function measureLoad(route) {
  const { ctx, page, cdp } = await phonePage({ network: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.addInitScript(LOAD_OBSERVERS);
  await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
  // Until the main thread has been quiet for two seconds, or ten have passed.
  await page.evaluate(
    () =>
      new Promise((done) => {
        const start = performance.now();
        const check = () => {
          const last = window.__perf.long.at(-1);
          const quiet = !last || performance.now() - (last[0] + last[1]) > 2000;
          if (quiet || performance.now() - start > 10000) done();
          else setTimeout(check, 250);
        };
        check();
      }),
  );
  const m = await page.evaluate(() => ({ ...window.__perf, nodes: document.getElementsByTagName("*").length }));
  await ctx.close();
  // Total blocking time: what each task past first paint held the page
  // beyond 50 ms.
  const tbt = m.long.filter(([s]) => s >= m.fcp).reduce((t, [, d]) => t + Math.max(0, d - 50), 0);
  return { fcp: m.fcp, lcp: m.lcp, tbt, cls: m.cls, nodes: m.nodes };
}

// ── Taps ───────────────────────────────────────────────────────────────

/** The slowest response to one tap or key: input to the next frame. */
const TAP_OBSERVER = () => {
  window.__events = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.interactionId) window.__events.push(e.duration);
  }).observe({ type: "event", durationThreshold: 16, buffered: false });
};

const listOpen = `!!document.querySelector('[role="listbox"]')`;
const menuOpen = `!!document.querySelector('[role="menu"]')`;
const tap = (selector) => async (page) => page.locator(selector).first().tap();

/** Each tap: what to press, and when its result is on screen. */
const TAPS = [
  { route: "/books", name: "Open the format list", act: tap('[data-slot="select-trigger"]:has-text("All formats")'), shown: listOpen },
  {
    route: "/books",
    name: "Pick a format",
    before: tap('[data-slot="select-trigger"]:has-text("All formats")'),
    act: tap('[role="option"]:has-text("Ebook")'),
    shown: `new URL(location.href).searchParams.get("format") === "EBOOK" && !document.querySelector('[role="listbox"]')`,
  },
  { route: "/books", name: "Open the sort list", act: tap('[aria-label="Sort by"]'), shown: listOpen },
  { route: "/books", name: "Open the View menu", act: tap('button[title^="View:"]'), shown: menuOpen },
  { route: "/books", name: "Open the theme palette", act: tap('button[title="Theme"]'), shown: `!!document.querySelector("[data-swatch]")` },
  {
    route: "/books",
    name: "Start picking books",
    act: tap('button:text-is("Select")'),
    shown: `[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Select all")`,
  },
  {
    route: "/books",
    name: "Pick a book",
    before: tap('button:text-is("Select")'),
    act: tap('button[aria-label^="Select "][aria-pressed]'),
    shown: `/1 selected/.test(document.body.textContent)`,
  },
  {
    route: "/books",
    name: "Open a book",
    act: tap("[data-library-view] a[data-book-link]"),
    shown: `location.pathname.startsWith("/books/") && !!document.querySelector("main h1")`,
  },
  {
    route: "/books",
    name: "Go to Now reading",
    act: tap('a[href="/reading"]'),
    shown: `location.pathname === "/reading" && !!document.querySelector('form[aria-label^="Log progress"]')`,
  },
];

async function measureTap(t) {
  const { ctx, page, cdp } = await phonePage();
  await page.addInitScript(TAP_OBSERVER);
  await page.goto(BASE + t.route, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  if (t.before) {
    await t.before(page);
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => {
    window.__events = [];
  });
  const start = Date.now();
  await t.act(page);
  await page.waitForFunction(t.shown, null, { timeout: 60000, polling: 50 });
  // One more frame, so what was shown has been painted.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
  const shown = Date.now() - start;
  await page.waitForTimeout(500);
  const response = await page.evaluate(() => Math.max(0, ...window.__events));
  await ctx.close();
  return { response, shown };
}

// ── Report ─────────────────────────────────────────────────────────────

const ms = (x) => (x == null ? "-" : `${Math.round(x)} ms`).padStart(9);
console.log(`${BASE}, theme ${THEME}, phone 390×844, CPU ${CPU}× slower, ${RUNS} runs, medians\n`);

if (what === "all" || what === "pages") {
  console.log("Page (cold, slow 4G)     first paint  largest paint  blocking   shift   elements");
  for (const route of ["/books", "/reading", "/stats", "/quotes", "/room"]) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measureLoad(route));
    const pick = (k) => median(runs.map((r) => r[k]));
    console.log(
      `${route.padEnd(24)}${ms(pick("fcp"))}    ${ms(pick("lcp"))}  ${ms(pick("tbt"))}  ${pick("cls").toFixed(3)}  ${String(pick("nodes")).padStart(8)}`,
    );
  }
  console.log("");
}

if (what === "all" || what === "taps") {
  console.log("Tap                         response    shown");
  for (const t of TAPS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measureTap(t));
    console.log(`${t.name.padEnd(26)}${ms(median(runs.map((r) => r.response)))}${ms(median(runs.map((r) => r.shown)))}`);
  }
}

await browser.close();
