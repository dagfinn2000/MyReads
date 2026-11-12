/*
 * MyReads' service worker. Two jobs:
 *
 * 1. Opening the app without a connection. It keeps this build's scripts
 *    and styles (listed by /api/offline/assets) and the pages opened
 *    lately. A page is fetched from the server first; when the server
 *    doesn't answer within a few seconds, or there's no connection, the
 *    saved copy shows instead, and a page never saved shows /offline.
 *    Logging reading offline is the page's own work (src/lib/outbox.ts);
 *    this only makes sure the page can open.
 *
 * 2. Reading reminders (Preferences › Reading reminders;
 *    src/lib/reminders-run.ts sends them): it shows the reminder the
 *    server pushes and opens Now reading when it's tapped.
 *
 * It's registered as /sw.js?v=<build id> (components/offline-provider.tsx),
 * so each update of the server installs a fresh one, and the files and
 * pages of the build before are dropped. Without a version (registered
 * for reminders on a development server) it keeps nothing and only shows
 * reminders.
 *
 * Saved pages hold what the reader's library looked like, so they're
 * forgotten when the sign-in page shows: after signing out, or when the
 * session has run out.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "";
const KEEPING = VERSION !== "";

const STATIC = "myreads-static-" + VERSION; // this build's files, and /offline
const EXTRAS = "myreads-extras-" + VERSION; // fonts, theme pictures and other files, as they're used
const PAGES = "myreads-pages-" + VERSION; // pages opened lately
const COVERS = "myreads-covers"; // cover images, whose names change when the picture does
const META = "myreads-meta"; // where the installed app opens

const MAX_PAGES = 40;
const MAX_EXTRAS = 300;
const MAX_COVERS = 500;
// How long a page may take before its saved copy shows instead.
const PATIENCE_MS = 5000;
// A page saved this recently isn't fetched again to save it.
const FRESH_MS = 30_000;

// Pages never kept: forms, sign-in, and the offline page itself.
const NOT_KEPT = /^\/(account|login|register|offline|api)(\/|$)|^\/books\/(new|check)(\/|$)|\/edit$/;

// Navigations answered from a saved copy, by the page they made, for the
// page to ask about ("copy?"). Lost if the worker stops, which only
// costs the "saved copy" note.
const copies = new Map();

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (KEEPING) event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = KEEPING ? [STATIC, EXTRAS, PAGES, COVERS, META] : [];
      for (const name of await caches.keys()) {
        if (name.startsWith("myreads-") && !keep.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

async function precache() {
  const res = await fetch("/api/offline/assets?v=" + encodeURIComponent(VERSION), { cache: "no-store" });
  if (!res.ok) throw new Error("No file list");
  const { files } = await res.json();
  const cache = await caches.open(STATIC);
  // A few at a time; one that fails is fetched again when a page asks.
  const queue = [...files];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        try {
          const file = await fetch(url);
          if (file.ok) await cache.put(url, file);
        } catch {}
      }
    }),
  );
  // The offline page as anyone sees it: it takes the theme from the
  // device, so it holds nothing of the reader's.
  const offline = await fetch("/offline", { credentials: "omit" });
  if (offline.ok) await cache.put("/offline", offline);
  // The pages a reader opens the app on, ready before they're visited
  // under this build.
  const start = await startPath();
  await Promise.all([...new Set(["/reading", start || "/reading"])].map((path) => savePage(path, true)));
}

self.addEventListener("fetch", (event) => {
  if (!KEEPING) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(navigate(event, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, EXTRAS, MAX_EXTRAS));
  } else if (url.pathname.startsWith("/api/covers/")) {
    event.respondWith(cacheFirst(req, COVERS, MAX_COVERS));
  } else if (
    /^\/(themes|textures|icons)\//.test(url.pathname) ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(event, req));
  }
  // Everything else (the app's own data requests, saving, sign-in) goes
  // to the server as it would without this worker.
});

/** A build file: kept, so whatever's kept is answered at once. */
async function cacheFirst(req, into, max) {
  const hit = await caches.match(req, { ignoreSearch: req.url.includes("/_next/static/") });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200 && res.type === "basic") {
    const copy = res.clone();
    const cache = await caches.open(into);
    await cache.put(req, copy);
    await trim(cache, max);
  }
  return res;
}

/** A file that may change without changing its name: the kept copy now,
 *  and a fresh one for next time. */
async function staleWhileRevalidate(event, req) {
  const hit = await caches.match(req);
  const fresh = fetch(req).then(async (res) => {
    if (res.ok && res.status === 200 && res.type === "basic") {
      const cache = await caches.open(EXTRAS);
      await cache.put(req, res.clone());
      await trim(cache, MAX_EXTRAS);
    }
    return res;
  });
  if (hit) {
    event.waitUntil(fresh.catch(() => {}));
    return hit;
  }
  return fresh;
}

/** Opening a page. */
async function navigate(event, url) {
  const path = url.pathname + url.search;
  // The page goes to the browser as it streams in; a copy is kept beside it.
  const network = fetch(event.request).then((res) => {
    if (url.pathname === "/login" && res.ok) {
      // Signed out: the saved pages go.
      event.waitUntil(forget());
    } else if (keepable(url) && isPage(res)) {
      event.waitUntil(keepPage(path, res.clone()).catch(() => {}));
    }
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  const saved = await savedCopy(url);
  if (!saved) {
    try {
      return await network;
    } catch {
      return offlinePage();
    }
  }
  return new Promise((resolve) => {
    let settled = false;
    const answer = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    const useCopy = () => answer(served(event, saved));
    const timer = setTimeout(useCopy, self.navigator.onLine === false ? 0 : PATIENCE_MS);
    network.then(
      // A server that's down behind its proxy answers 502 or 503: the copy
      // is more use.
      (res) => (res.status >= 500 ? useCopy() : answer(res)),
      useCopy,
    );
  });
}

/** The saved copy of a page, or for "/" a step to the start page. */
async function savedCopy(url) {
  if (url.pathname === "/" && !url.search) {
    const start = await startPath();
    if (start && (await caches.match(start, { cacheName: PAGES }))) return Response.redirect(start, 302);
    return null;
  }
  return (await caches.match(url.pathname + url.search, { cacheName: PAGES })) || null;
}

/** Answers with a saved copy, remembering that the page is one. */
function served(event, res) {
  const savedAt = Number(res.headers.get("x-myreads-saved")) || null;
  if (event.resultingClientId && savedAt) {
    copies.set(event.resultingClientId, savedAt);
    if (copies.size > 50) copies.delete(copies.keys().next().value);
  }
  return res;
}

async function offlinePage() {
  const page = await caches.match("/offline", { cacheName: STATIC });
  return page || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function keepable(url) {
  return !NOT_KEPT.test(url.pathname);
}

function isPage(res) {
  return (
    res.ok &&
    res.status === 200 &&
    res.type === "basic" &&
    !res.redirected &&
    (res.headers.get("content-type") || "").startsWith("text/html")
  );
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[name.toLowerCase()] ?? all;
  });
}

/** The page's name for /offline's list: its title, or where that's only
 *  "MyReads" (a book's page), its heading. */
function pageTitle(html) {
  const title = decodeEntities((/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || "").trim();
  if (title && title !== "MyReads") return title;
  const heading = (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || "";
  return decodeEntities(heading.replace(/<[^>]*>/g, "")).trim() || title;
}

/** Keeps a page, with when it was saved and its name (for /offline's
 *  list), and only the newest MAX_PAGES. */
async function keepPage(path, res) {
  const html = await res.text();
  const title = pageTitle(html);
  const headers = new Headers({
    "Content-Type": res.headers.get("content-type") || "text/html; charset=utf-8",
    "x-myreads-saved": String(Date.now()),
    "x-myreads-title": encodeURIComponent(title),
  });
  const cache = await caches.open(PAGES);
  await cache.put(path, new Response(html, { status: 200, headers }));
  await trim(cache, MAX_PAGES);
}

/** Fetches a page to keep it, unless it was saved a moment ago. */
async function savePage(path, force) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || !keepable(url)) return;
  if (!force) {
    const old = await caches.match(path, { cacheName: PAGES });
    if (old && Date.now() - Number(old.headers.get("x-myreads-saved")) < FRESH_MS) return;
  }
  const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/html" } });
  if (isPage(res)) await keepPage(path, res);
}

/** Drops the oldest entries past `max` (a put moves an entry to the end). */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

async function forget() {
  for (const name of await caches.keys()) {
    if (name.startsWith("myreads-pages-") || name === COVERS) await caches.delete(name);
  }
}

async function startPath() {
  const res = await caches.match("/start", { cacheName: META });
  return res ? res.text() : null;
}

/** Files a page loaded before this worker was there to keep them. */
async function keepFiles(urls) {
  for (const href of urls.slice(0, 300)) {
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (url.origin !== self.location.origin) continue;
    const req = new Request(url.href);
    if (await caches.match(req, { ignoreSearch: url.pathname.startsWith("/_next/static/") })) continue;
    const into = url.pathname.startsWith("/api/covers/") ? COVERS : EXTRAS;
    try {
      const res = await fetch(req);
      if (res.ok && res.status === 200 && res.type === "basic") await (await caches.open(into)).put(req, res);
    } catch {}
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "copy?") {
    const savedAt = (event.source && copies.get(event.source.id)) || null;
    event.source?.postMessage({ type: "copy", savedAt });
    return;
  }
  if (data.type === "forget") {
    event.waitUntil(forget());
    return;
  }
  if (!KEEPING) return;
  if (data.type === "save" && Array.isArray(data.paths)) {
    const paths = data.paths.filter((p) => typeof p === "string" && p.startsWith("/") && !p.startsWith("//"));
    event.waitUntil(Promise.all([...new Set(paths)].slice(0, 4).map((p) => savePage(p).catch(() => {}))));
  } else if (data.type === "keep" && Array.isArray(data.urls)) {
    event.waitUntil(keepFiles(data.urls.filter((u) => typeof u === "string")));
  } else if (data.type === "start" && typeof data.path === "string" && /^\/[a-z/]*$/.test(data.path)) {
    event.waitUntil(caches.open(META).then((cache) => cache.put("/start", new Response(data.path))));
  }
});

/* ---- Reading reminders ---- */

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    // Not one of ours: show the plain reminder rather than nothing, since a
    // push that shows nothing counts against the site in some browsers.
  }
  const url = typeof message.url === "string" && message.url.startsWith("/") ? message.url : "/reading";
  event.waitUntil(
    self.registration.showNotification(message.title || "Time to read", {
      body: message.body || "",
      icon: "/icons/icon-192.png",
      // One at a time: a new reminder replaces one still showing.
      tag: "reading-reminder",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/reading", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) await client.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// The push service moved this browser's subscription: subscribe again with
// the same key and tell the server the new address, so reminders keep
// coming.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const key = old && old.options && old.options.applicationServerKey;
      const fresh =
        event.newSubscription ||
        (key && (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })));
      if (!fresh) return;
      await fetch("/api/push/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ oldEndpoint: old ? old.endpoint : null, subscription: fresh.toJSON() }),
      });
    })(),
  );
});
