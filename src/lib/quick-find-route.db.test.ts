import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ReadingStatus } from "@/lib/enums";
import { buildSearchText } from "@/lib/utils";
import type { QuickFindResult } from "@/lib/quick-find";

/**
 * Quick find's look-up (app/api/quick-find) against a real database: it
 * finds only the signed-in reader's books, shelves and authors, every word
 * of the query counts, and accents and LIKE's wildcards don't trip it.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
}));

const { GET } = await import("@/app/api/quick-find/route");

let userId: string;
let otherId: string;

async function find(q: string): Promise<QuickFindResult> {
  const res = await GET(new Request(`http://localhost/api/quick-find?q=${encodeURIComponent(q)}`));
  expect(res.status).toBe(200);
  return res.json();
}

async function book(owner: string, title: string, authors: string[], over: Record<string, unknown> = {}) {
  const seriesName = (over.seriesName as string | undefined) ?? null;
  return prisma.book.create({
    data: { userId: owner, title, authors, searchText: buildSearchText(title, authors, seriesName), ...over },
  });
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `qf-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `qf-other-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

describe("GET /api/quick-find", () => {
  it("refuses a visitor who isn't signed in", async () => {
    currentUserId = null;
    const res = await GET(new Request("http://localhost/api/quick-find?q=dune"));
    expect(res.status).toBe(401);
  });

  it("finds the reader's books, authors and series, never another reader's", async () => {
    await book(userId, "A Wizard of Earthsea", ["Ursula K. Le Guin"], { seriesName: "Earthsea" });
    await book(userId, "The Tombs of Atuan", ["Ursula K. Le Guin"], { seriesName: "Earthsea" });
    await book(userId, "The Dispossessed", ["Ursula K. Le Guin"]);
    await book(otherId, "Earthsea Revisioned", ["Ursula K. Le Guin"]);

    const earth = await find("earthsea");
    expect(earth.books.map((b) => b.title)).toEqual(["A Wizard of Earthsea", "The Tombs of Atuan"]);
    expect(earth.series).toEqual([{ name: "Earthsea", count: 2 }]);

    const author = await find("le guin");
    // Every book of theirs counts, whichever matched.
    expect(author.authors).toEqual([{ name: "Ursula K. Le Guin", count: 3 }]);
  });

  it("needs every word, and ignores case, accents and wildcards", async () => {
    await book(userId, "Thérèse Raquin", ["Émile Zola"]);
    await book(userId, "100% Wolf", ["Jayne Lyons"]);
    expect((await find("therese zola")).books).toHaveLength(1);
    expect((await find("therese tolstoy")).books).toHaveLength(0);
    expect((await find("%")).books.map((b) => b.title)).toEqual(["100% Wolf"]);
    expect((await find("_")).books).toHaveLength(0);
  });

  it("finds shelves of both kinds by name", async () => {
    await prisma.shelf.create({ data: { userId, name: "Beach reads" } });
    await prisma.smartShelf.create({ data: { userId, name: "Short reads", rules: "maxPages=200" } });
    await prisma.shelf.create({ data: { userId: otherId, name: "Their reads" } });
    const res = await find("reads");
    expect(res.shelves.map((s) => [s.name, s.smart])).toEqual([
      ["Beach reads", false],
      ["Short reads", true],
    ]);
  });

  it("lists the books being read when nothing is typed", async () => {
    await book(userId, "Reading this", [], { status: ReadingStatus.READING });
    await book(userId, "Not this", [], { status: ReadingStatus.WANT_TO_READ });
    const res = await find("");
    expect(res.books.map((b) => b.title)).toEqual(["Reading this"]);
    expect(res.authors).toEqual([]);
  });
});
