"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  parseOutbox,
  readOutbox,
  readOutboxRaw,
  saveOutbox,
  settle,
  subscribeOutbox,
  toSend,
  wireItem,
  type OutboxItem,
  type SentResult,
} from "@/lib/outbox";

/**
 * MyReads without a connection, for every signed-in page:
 *
 * - Registers the service worker (public/sw.js), which keeps this build's
 *   scripts and styles and the pages opened lately, so the app opens
 *   offline. It's told which pages to keep fresh: each page a little after
 *   it's opened, and Now reading and the page on screen when the app goes
 *   to the background.
 * - Sends the reading saved on this device (lib/outbox.ts) as soon as the
 *   server answers: on load, when the connection comes back, when the app
 *   comes to the front, and every 30 seconds while anything waits. Then it
 *   reloads the page's data, so the server's copy takes over.
 *
 * The service worker only runs over HTTPS or on localhost, and only in a
 * production build (`swVersion` is empty otherwise). Saving reading on the
 * device works everywhere, so on a plain-http address a log made while the
 * wifi is gone still waits here and goes later.
 */

export type SendState = "idle" | "sending" | "unreachable" | "signed-out" | "server";

export interface OfflineState {
  userId: string;
  /** What the browser says about the connection. */
  online: boolean;
  /** How the last send went. */
  state: SendState;
  /** This account's items on the device, oldest first. */
  items: OutboxItem[];
  /** Items just written, still shown until the page has the server's data. */
  held: OutboxItem[];
  /** When the page on screen was saved, when it's a saved copy. */
  savedAt: number | null;
  sendNow: () => void;
}

const OfflineContext = createContext<OfflineState | null>(null);

/** The offline state, or null outside the signed-in pages. */
export function useOffline(): OfflineState | null {
  return useContext(OfflineContext);
}

/** Sent when a send wrote items: `{ written, results }`. Now reading uses
 *  it to offer Undo on a book finished offline. */
export const SENT_EVENT = "myreads-sent";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Runs `fn` unless another tab is sending; without Web Locks (plain
 *  http), runs it anyway: the server writes each item once. */
async function alone(fn: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return fn();
  await locks.request("myreads-outbox", { ifAvailable: true }, async (lock) => {
    if (lock) await fn();
  });
}

function toWorker(message: unknown) {
  navigator.serviceWorker?.controller?.postMessage(message);
}

/** Same-origin files this page loaded that a saved page needs too: the
 *  build's files, fonts, covers and theme pictures. Loaded before the
 *  service worker was there, they aren't kept yet. */
function loadedFiles(): string[] {
  return performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((name) => {
      try {
        const url = new URL(name);
        return (
          url.origin === location.origin &&
          /^\/(_next\/static|api\/covers|themes|textures|icons)\//.test(url.pathname)
        );
      } catch {
        return false;
      }
    });
}

const RETRY_MS = 30_000;

export function OfflineProvider({
  userId,
  swVersion,
  startPath,
  children,
}: {
  userId: string;
  /** This build's id; empty means no service worker (development). */
  swVersion: string;
  /** Where the installed app opens ("/" sends the reader there). */
  startPath: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribeOutbox, readOutboxRaw, () => null);
  const items = useMemo(() => parseOutbox(raw).filter((i) => i.userId === userId), [raw, userId]);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [state, setState] = useState<SendState>("idle");
  const [held, setHeld] = useState<OutboxItem[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const busy = useRef(false);
  // The page has fetched its data since it opened, so it's no saved copy
  // any more, whatever the service worker says.
  const fresh = useRef(false);
  const wasRefreshing = useRef(false);

  // What was just written shows until the page has the server's data, so a
  // book's bar doesn't slip back for a moment between the two.
  useEffect(() => {
    if (refreshing) {
      wasRefreshing.current = true;
      return;
    }
    const done = wasRefreshing.current && navigator.onLine;
    wasRefreshing.current = false;
    const t = setTimeout(() => {
      setHeld([]);
      if (done) {
        fresh.current = true;
        setSavedAt(null);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [refreshing]);

  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  const send = useCallback(async () => {
    if (busy.current) return;
    if (toSend(readOutbox(), userId).length === 0) return;
    if (!navigator.onLine) return;
    busy.current = true;
    try {
      await alone(async () => {
        // Again, now that no other tab is sending: it may have sent them.
        const batch = toSend(readOutbox(), userId);
        if (batch.length === 0) return;
        setState("sending");
        let res: Response;
        try {
          res = await fetch("/api/reading/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: batch.map(wireItem) }),
            // Signed out, the server sends the sign-in page instead.
            redirect: "manual",
            cache: "no-store",
          });
        } catch {
          setState("unreachable");
          return;
        }
        if (res.type === "opaqueredirect" || res.status === 401) return setState("signed-out");
        const body: unknown = res.ok ? await res.json().catch(() => null) : null;
        const results = (body as { results?: unknown } | null)?.results;
        if (!Array.isArray(results)) return setState("server");
        const out = settle(readOutbox(), results as SentResult[]);
        saveOutbox(out.items);
        setState("idle");
        if (out.written.length > 0) {
          setHeld((h) => [...h, ...out.written]);
          refresh();
          window.dispatchEvent(
            new CustomEvent(SENT_EVENT, { detail: { written: out.written, results } }),
          );
        }
      });
    } finally {
      busy.current = false;
    }
  }, [userId, refresh]);

  // On load, when the connection comes back, and when the app comes back
  // to the front. Back online on a saved copy, the page fetches its data.
  const backOnline = useEffectEvent(() => {
    void send();
    if (savedAt !== null) {
      setSavedAt(null);
      refresh();
    }
  });
  useEffect(() => {
    void send();
    const onOnline = () => backOnline();
    const onVisible = () => {
      if (document.visibilityState === "visible") void send();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [send]);

  // Soon after something is saved, and then now and then while it waits.
  const waiting = items.filter((i) => !i.error).length;
  useEffect(() => {
    if (waiting === 0) return;
    const soon = setTimeout(() => void send(), 300);
    const again = setInterval(() => void send(), RETRY_MS);
    return () => {
      clearTimeout(soon);
      clearInterval(again);
    };
  }, [waiting, send]);

  // The service worker: register it, tell it the start page and what this
  // page loaded, and ask whether this page is a saved copy.
  useEffect(() => {
    if (!swVersion || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; savedAt?: unknown } | null;
      if (data?.type === "copy" && !fresh.current) {
        setSavedAt(typeof data.savedAt === "number" ? data.savedAt : null);
      }
    };
    sw.addEventListener("message", onMessage);
    sw.startMessages();
    toWorker({ type: "copy?" });
    sw.register(`/sw.js?v=${encodeURIComponent(swVersion)}`, { scope: "/" }).catch(() => {});
    void sw.ready.then((reg) => {
      reg.active?.postMessage({ type: "start", path: startPath });
      reg.active?.postMessage({ type: "keep", urls: loadedFiles() });
    });
    return () => sw.removeEventListener("message", onMessage);
  }, [swVersion, startPath]);

  // Keep each page a little after it's opened, and Now reading and the page
  // on screen when the app goes to the background, so a saved copy is
  // never far behind.
  useEffect(() => {
    if (!swVersion) return;
    const t = setTimeout(() => toWorker({ type: "save", paths: [location.pathname + location.search] }), 2000);
    return () => clearTimeout(t);
  }, [pathname, swVersion]);
  useEffect(() => {
    if (!swVersion) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        toWorker({ type: "save", paths: ["/reading", location.pathname + location.search] });
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [swVersion]);

  const value = useMemo<OfflineState>(
    () => ({ userId, online, state, items, held, savedAt, sendNow: () => void send() }),
    [userId, online, state, items, held, savedAt, send],
  );
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

/**
 * A book's items on the device (waiting, or refused with a reason), and
 * the ones just written that the page doesn't show yet.
 */
export function usePendingItems(bookId: string): { items: OutboxItem[]; held: OutboxItem[] } {
  const offline = useOffline();
  return useMemo(
    () => ({
      items: offline?.items.filter((i) => i.bookId === bookId) ?? [],
      held: offline?.held.filter((i) => i.bookId === bookId) ?? [],
    }),
    [offline, bookId],
  );
}
