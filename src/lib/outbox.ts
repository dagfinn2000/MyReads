import { dayKey } from "@/lib/dates";
import type { DateFormat } from "@/lib/preferences";
import { describeDay } from "@/lib/reading-log";

/**
 * Reading saved on this device while the server can't be reached: pages
 * logged, and books finished or stopped, from the quick-log row. They wait
 * in this browser's storage, oldest first, and go to the server when it
 * answers again (components/offline-provider.tsx sends them, through
 * POST /api/reading/sync). Until then the page shows them as if they were
 * logged: the book's bar moves, and the row lists what's waiting.
 *
 * Each item keeps the id it was made with, which the server stores with
 * the entry, so one sent twice (the answer lost on the way back) is
 * written once. One the server refuses (the book was finished on another
 * device, say) stays here with the reason until the reader removes it.
 *
 * Items name the account they belong to, so another reader signing in on
 * the same browser never sends them.
 */

export interface OutboxLog {
  kind: "log";
  id: string;
  bookId: string;
  page: number;
  /** The day it's for, as a key ("2026-10-11"), never "today": by the time
   *  it's sent, today may be another day. */
  day: string;
  value?: number;
  minutes?: number;
  /** When it was made (Date.now()). */
  at: number;
}

export interface OutboxMove {
  kind: "move";
  id: string;
  bookId: string;
  to: "READ" | "DNF";
  minutes?: number;
  at: number;
}

export type OutboxItem = (OutboxLog | OutboxMove) & {
  userId: string;
  /** For the lists: the book's title, and the position as typed ("page
   *  120", "42%"). */
  title: string;
  label: string;
  /** Why the server refused it. It stays until removed. */
  error?: string;
};

/** What the server answers for each item (lib/reading-sync.ts). */
export type SentResult =
  | { id: string; ok: true; message: string; undo?: { from: "READ" | "DNF"; finishedAt: string | null; page: number | null } }
  | { id: string; ok: false; error: string; retry?: boolean };

const KEY = "myreads-outbox";
const CHANGED = "myreads-outbox";

/** Sent this many at a time, the most the server takes. */
export const SEND_LIMIT = 100;

/**
 * A new id for an item: 22 random letters, digits, - and _. From
 * getRandomValues, which works on plain http too (randomUUID doesn't).
 */
export function newClientId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(22));
  let out = "";
  for (const b of bytes) out += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63];
  return out;
}

function isItem(v: unknown): v is OutboxItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.kind === "log" || o.kind === "move") &&
    typeof o.id === "string" &&
    typeof o.bookId === "string" &&
    typeof o.userId === "string" &&
    typeof o.at === "number"
  );
}

/** The items in `raw` (the stored text), any that can't be read left out. */
export function parseOutbox(raw: string | null): OutboxItem[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isItem) : [];
  } catch {
    return [];
  }
}

// When storage refuses (a private window), items live for this visit.
let memory: string | null = null;
let storageBroken = false;

export function readOutboxRaw(): string | null {
  if (storageBroken) return memory;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

export function readOutbox(): OutboxItem[] {
  return parseOutbox(readOutboxRaw());
}

/** Replaces the whole outbox (after a send, with what's left). */
export function saveOutbox(items: OutboxItem[]) {
  const raw = items.length > 0 ? JSON.stringify(items) : null;
  memory = raw;
  try {
    if (raw) window.localStorage.setItem(KEY, raw);
    else window.localStorage.removeItem(KEY);
  } catch {
    storageBroken = true;
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function addToOutbox(item: OutboxItem) {
  saveOutbox([...readOutbox(), item]);
}

/** Takes an item out (removed by the reader, or sent); returns it. */
export function removeFromOutbox(id: string): OutboxItem | null {
  const items = readOutbox();
  const found = items.find((i) => i.id === id) ?? null;
  if (found) saveOutbox(items.filter((i) => i !== found));
  return found;
}

export function subscribeOutbox(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** The account's items still to send: not refused, oldest first, as many
 *  as go in one request. */
export function toSend(items: OutboxItem[], userId: string): OutboxItem[] {
  return items.filter((i) => i.userId === userId && !i.error).slice(0, SEND_LIMIT);
}

/** What the server is sent for an item: the item without the parts only
 *  this device needs. */
export function wireItem(item: OutboxItem): OutboxLog | OutboxMove {
  if (item.kind === "log") {
    const { kind, id, bookId, page, day, value, minutes, at } = item;
    return { kind, id, bookId, page, day, value, minutes, at };
  }
  const { kind, id, bookId, to, minutes, at } = item;
  return { kind, id, bookId, to, minutes, at };
}

/**
 * The outbox once the server has answered: written items gone, refused
 * ones kept with the reason, and ones the server failed on (or didn't
 * answer for) kept to send again. `items` is the outbox as it is now, read
 * again after the answer, so anything saved meanwhile stays.
 */
export function settle(
  items: OutboxItem[],
  results: SentResult[],
): { items: OutboxItem[]; written: OutboxItem[]; refused: OutboxItem[] } {
  const byId = new Map(results.map((r) => [r.id, r]));
  const written: OutboxItem[] = [];
  const refused: OutboxItem[] = [];
  const left: OutboxItem[] = [];
  for (const item of items) {
    const result = byId.get(item.id);
    if (result?.ok) {
      written.push(item);
    } else if (result && !result.retry && !item.error) {
      const failed = { ...item, error: result.error };
      refused.push(failed);
      left.push(failed);
    } else {
      left.push(item);
    }
  }
  return { items: left, written, refused };
}

/**
 * The page a book shows with what's waiting: the furthest page logged here
 * and not yet written, when that's further than the server's.
 */
export function pendingPage(items: OutboxItem[], bookId: string, currentPage: number | null): number | null {
  let page = currentPage;
  for (const item of items) {
    if (item.kind === "log" && item.bookId === bookId && !item.error && (page == null || item.page > page)) {
      page = item.page;
    }
  }
  return page;
}

/**
 * True for a server action that didn't reach MyReads' code, so what it
 * carried is worth keeping and sending through the outbox instead: the
 * network failed (a TypeError); something else answered in MyReads' place,
 * such as a proxy in front of a server that's down ("An unexpected
 * response was received from the server"); or the server was updated
 * since the page opened, so the page's actions are gone ("Server Action
 * unavailable"), which the outbox's route doesn't mind.
 */
export function isConnectionError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  return (
    err instanceof Error &&
    /unexpected response was received from the server|^Server Action unavailable/i.test(err.message)
  );
}

/** When a page was saved: "today at 14:05", "yesterday at 21:30",
 *  "9 Oct 2026 at 08:10". */
export function savedWhen(ms: number, now: Date, timeZone: string, format?: DateFormat): string {
  const day = describeDay(dayKey(new Date(ms), timeZone), dayKey(now, timeZone), format);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(ms);
  return `${day} at ${time}`;
}
