import { describe, expect, it } from "vitest";
import { clientIdSchema } from "@/lib/reading-log-input";
import {
  SEND_LIMIT,
  isConnectionError,
  newClientId,
  parseOutbox,
  pendingPage,
  savedWhen,
  settle,
  toSend,
  wireItem,
  type OutboxItem,
} from "@/lib/outbox";

const log = (id: string, over: Partial<OutboxItem> = {}): OutboxItem =>
  ({
    kind: "log",
    id,
    bookId: "b1",
    page: 120,
    day: "2026-11-11",
    at: 1_000,
    userId: "u1",
    title: "Mistborn",
    label: "page 120",
    ...over,
  }) as OutboxItem;

describe("newClientId", () => {
  it("makes ids the server takes, different each time", () => {
    const ids = new Set(Array.from({ length: 200 }, newClientId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(clientIdSchema.safeParse(id).success).toBe(true);
  });
});

describe("parseOutbox", () => {
  it("reads what it wrote and leaves out what it can't read", () => {
    const item = log("a");
    expect(parseOutbox(JSON.stringify([item, { kind: "nap" }, null, "x"]))).toEqual([item]);
    expect(parseOutbox("{not json")).toEqual([]);
    expect(parseOutbox(JSON.stringify({ items: [] }))).toEqual([]);
    expect(parseOutbox(null)).toEqual([]);
  });
});

describe("toSend", () => {
  it("sends the account's waiting items, oldest first, at most a request's worth", () => {
    const items = [
      log("a"),
      log("b", { userId: "someone else" }),
      log("c", { error: "Book not found" }),
      log("d"),
    ];
    expect(toSend(items, "u1").map((i) => i.id)).toEqual(["a", "d"]);
    const many = Array.from({ length: SEND_LIMIT + 5 }, (_, i) => log(`x${i}`));
    expect(toSend(many, "u1")).toHaveLength(SEND_LIMIT);
  });
});

describe("wireItem", () => {
  it("sends only what the server needs", () => {
    expect(wireItem(log("a", { minutes: 25, error: "x" }))).toEqual({
      kind: "log",
      id: "a",
      bookId: "b1",
      page: 120,
      day: "2026-11-11",
      value: undefined,
      minutes: 25,
      at: 1_000,
    });
    const move = { ...log("m"), kind: "move", to: "READ" } as OutboxItem;
    expect(wireItem(move)).toEqual({ kind: "move", id: "m", bookId: "b1", to: "READ", minutes: undefined, at: 1_000 });
  });
});

describe("settle", () => {
  it("drops what was written, keeps what was refused with its reason, and keeps the rest", () => {
    const items = [log("ok"), log("no"), log("retry"), log("unanswered"), log("saved meanwhile")];
    const out = settle(items, [
      { id: "ok", ok: true, message: "Logged page 120 for yesterday." },
      { id: "no", ok: false, error: "Book not found" },
      { id: "retry", ok: false, error: "The server couldn't save this one.", retry: true },
    ]);
    expect(out.written.map((i) => i.id)).toEqual(["ok"]);
    expect(out.refused).toEqual([{ ...items[1], error: "Book not found" }]);
    expect(out.items.map((i) => [i.id, i.error])).toEqual([
      ["no", "Book not found"],
      ["retry", undefined],
      ["unanswered", undefined],
      ["saved meanwhile", undefined],
    ]);
  });

  it("keeps an item removed meanwhile removed", () => {
    const out = settle([log("b")], [{ id: "a", ok: true, message: "" }]);
    expect(out.items.map((i) => i.id)).toEqual(["b"]);
    expect(out.written).toEqual([]);
  });
});

describe("pendingPage", () => {
  it("is the furthest page saved for the book, when it's past the server's", () => {
    const items = [log("a", { page: 90 }), log("b", { page: 130 }), log("c", { page: 400, bookId: "b2" })];
    expect(pendingPage(items, "b1", 60)).toBe(130);
    expect(pendingPage(items, "b1", 200)).toBe(200);
    expect(pendingPage(items, "b1", null)).toBe(130);
    expect(pendingPage([], "b1", null)).toBe(null);
  });

  it("leaves out refused logs and moves", () => {
    const items = [log("a", { page: 300, error: "No" }), { ...log("m"), kind: "move", to: "READ" } as OutboxItem];
    expect(pendingPage(items, "b1", 60)).toBe(60);
  });
});

describe("savedWhen", () => {
  it("says the day and the time in the reader's zone", () => {
    const now = new Date("2026-11-12T12:00:00.000Z");
    expect(savedWhen(Date.parse("2026-11-12T13:05:00.000Z"), now, "Europe/Oslo")).toBe("today at 14:05");
    expect(savedWhen(Date.parse("2026-11-11T20:30:00.000Z"), now, "Europe/Oslo")).toBe("yesterday at 21:30");
    expect(savedWhen(Date.parse("2026-11-09T07:10:00.000Z"), now, "Europe/Oslo")).toMatch(/^9 Nov 2026 at 08:10$/);
  });
});

describe("isConnectionError", () => {
  it("is a log worth keeping when the network or the server's stand-in answered", () => {
    expect(isConnectionError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectionError(new Error("An unexpected response was received from the server."))).toBe(true);
    expect(isConnectionError(new Error("Server Action unavailable."))).toBe(true);
    expect(isConnectionError(new Error("Not authenticated"))).toBe(false);
    expect(isConnectionError("nope")).toBe(false);
  });
});
