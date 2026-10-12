import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { parseQuotesParams, type QuotesParams } from "@/lib/quote-order";
import { loadQuotes, quoteSources } from "@/lib/quotes-query";

/**
 * The quotes page's queries against a real database: every filter stays
 * inside the reader's own library, the From filter and search match what
 * they say, and Show more and shuffle agree with each other.
 */
const prisma = new PrismaClient();

let userId: string;
let otherUserId: string;

const PREFS = { quotesOrder: "newest", quotesGroupByBook: false } as const;
const SORT = {};

function params(over: Partial<QuotesParams> = {}): QuotesParams {
  return { ...parseQuotesParams({}, PREFS), ...over };
}

async function makeBook(owner: string, over: Record<string, unknown> = {}) {
  return prisma.book.create({
    data: { userId: owner, title: "Untitled", searchText: "untitled", ...over },
  });
}

async function addQuotes(bookId: string, quotes: { text: string; page?: number; note?: string; at?: string }[]) {
  for (const q of quotes) {
    await prisma.quote.create({
      data: {
        bookId,
        text: q.text,
        page: q.page ?? null,
        note: q.note ?? null,
        ...(q.at && { createdAt: new Date(q.at) }),
      },
    });
  }
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `qq-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `qo-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("loadQuotes", () => {
  it("never shows another reader's quotes, even with their shelf or tag", async () => {
    const theirShelf = await prisma.shelf.create({ data: { userId: otherUserId, name: "Theirs" } });
    const theirs = await makeBook(otherUserId, {
      title: "Their Book",
      tags: ["secret"],
      shelves: { connect: { id: theirShelf.id } },
    });
    await addQuotes(theirs.id, [{ text: "Not yours" }]);
    const mine = await makeBook(userId, { title: "My Book", tags: ["secret"] });
    await addQuotes(mine.id, [{ text: "Mine" }]);

    const all = await loadQuotes(userId, params(), SORT);
    expect(all.list!.map((q) => q.text)).toEqual(["Mine"]);

    const byShelf = await loadQuotes(userId, params({ shelfId: theirShelf.id }), SORT);
    expect(byShelf.total).toBe(0);
    const byTag = await loadQuotes(userId, params({ tag: "secret" }), SORT);
    expect(byTag.list!.map((q) => q.text)).toEqual(["Mine"]);
  });

  it("filters by tag or by shelf", async () => {
    const shelf = await prisma.shelf.create({ data: { userId, name: "Favourites" } });
    const fantasy = await makeBook(userId, { title: "Dragons", tags: ["fantasy"] });
    const shelved = await makeBook(userId, {
      title: "Shelved",
      shelves: { connect: { id: shelf.id } },
    });
    const plain = await makeBook(userId, { title: "Plain" });
    await addQuotes(fantasy.id, [{ text: "Here be dragons" }]);
    await addQuotes(shelved.id, [{ text: "On the shelf" }]);
    await addQuotes(plain.id, [{ text: "Nothing special" }]);

    const byTag = await loadQuotes(userId, params({ tag: "fantasy" }), SORT);
    expect(byTag.list!.map((q) => q.text)).toEqual(["Here be dragons"]);
    const byShelf = await loadQuotes(userId, params({ shelfId: shelf.id }), SORT);
    expect(byShelf.list!.map((q) => q.text)).toEqual(["On the shelf"]);
  });

  it("searches the quote, its note, and the book", async () => {
    const book = await makeBook(userId, {
      title: "Brontë",
      authors: ["Emily Brontë"],
      searchText: "wuthering heights emily bronte",
    });
    const other = await makeBook(userId, { title: "Other" });
    await addQuotes(book.id, [{ text: "Whatever our souls are made of" }]);
    await addQuotes(other.id, [
      { text: "Something about moors" },
      { text: "Plain", note: "remember the MOORS" },
      { text: "Nothing" },
    ]);

    const text = (q: string) =>
      loadQuotes(userId, params({ q }), SORT).then((r) => r.list!.map((x) => x.text).sort());
    expect(await text("moors")).toEqual(["Plain", "Something about moors"]);
    expect(await text("bronte")).toEqual(["Whatever our souls are made of"]);
    expect(await text("heights emily")).toEqual(["Whatever our souls are made of"]);
  });

  it("counts every match while showing up to the limit", async () => {
    const book = await makeBook(userId);
    await prisma.quote.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        bookId: book.id,
        text: `Quote ${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
      })),
    });

    const first = await loadQuotes(userId, params(), SORT);
    expect(first.total).toBe(205);
    expect(first.shown).toBe(200);
    expect(first.list).toHaveLength(200);
    expect(first.list![0].text).toBe("Quote 204");

    const more = await loadQuotes(userId, params({ limit: 400 }), SORT);
    expect(more.shown).toBe(205);
    expect(more.list!.at(-1)!.text).toBe("Quote 0");
  });

  it("keeps a shuffle stable as more are shown", async () => {
    const book = await makeBook(userId);
    await prisma.quote.createMany({
      data: Array.from({ length: 250 }, (_, i) => ({ bookId: book.id, text: `Q${i}` })),
    });

    const shuffle = (limit: number, seed = 777) =>
      loadQuotes(userId, params({ order: "shuffle", seed, limit }), SORT).then((r) =>
        r.list!.map((q) => q.id),
      );
    const page1 = await shuffle(200);
    const page2 = await shuffle(400);
    expect(page1).toHaveLength(200);
    expect(page2).toHaveLength(250);
    expect(page2.slice(0, 200)).toEqual(page1);
    expect(await shuffle(200, 778)).not.toEqual(page1);
    const newest = (await loadQuotes(userId, params(), SORT)).list!.map((q) => q.id);
    expect(page1).not.toEqual(newest);
  });

  it("groups by book with real totals and page order", async () => {
    const a = await makeBook(userId, { title: "Alpha" });
    const b = await makeBook(userId, { title: "Beta" });
    await addQuotes(a.id, [
      { text: "a-late", page: 90, at: "2026-01-01T00:00:00Z" },
      { text: "a-unpaged", at: "2026-01-02T00:00:00Z" },
      { text: "a-early", page: 3, at: "2026-01-03T00:00:00Z" },
    ]);
    await addQuotes(b.id, [{ text: "b-only", page: 1, at: "2026-05-01T00:00:00Z" }]);

    const grouped = await loadQuotes(userId, params({ group: true }), SORT);
    expect(grouped.list).toBeNull();
    expect(grouped.total).toBe(4);
    expect(
      grouped.groups!.map((g) => [g.book.title, g.total, g.quotes.map((q) => q.text)]),
    ).toEqual([
      // Newest: Beta's quote is the newest of all.
      ["Beta", 1, ["b-only"]],
      ["Alpha", 3, ["a-early", "a-late", "a-unpaged"]],
    ]);

    const byBook = await loadQuotes(userId, params({ group: true, order: "book" }), SORT);
    expect(byBook.groups!.map((g) => g.book.title)).toEqual(["Alpha", "Beta"]);
  });
});

describe("quoteSources", () => {
  it("offers only shelves and tags with quotes, from this reader's library", async () => {
    const [withQuotes, empty, theirs] = await Promise.all([
      prisma.shelf.create({ data: { userId, name: "Has quotes" } }),
      prisma.shelf.create({ data: { userId, name: "Empty" } }),
      prisma.shelf.create({ data: { userId: otherUserId, name: "Theirs" } }),
    ]);
    const quoted = await makeBook(userId, {
      tags: ["poetry", "classics"],
      shelves: { connect: { id: withQuotes.id } },
    });
    await makeBook(userId, { tags: ["unquoted"], shelves: { connect: { id: empty.id } } });
    const theirBook = await makeBook(otherUserId, {
      tags: ["their-tag"],
      shelves: { connect: { id: theirs.id } },
    });
    await addQuotes(quoted.id, [{ text: "A" }, { text: "B" }]);
    await addQuotes(theirBook.id, [{ text: "C" }]);

    const sources = await quoteSources(userId);
    expect(sources.shelves).toEqual([{ id: withQuotes.id, name: "Has quotes" }]);
    expect(sources.tags).toEqual(["classics", "poetry"]);

    // The shelf in the URL shows up even without quotes, but only if it's
    // this reader's.
    const picked = await quoteSources(userId, { shelfId: empty.id });
    expect(picked.shelves.map((s) => s.name)).toEqual(["Empty", "Has quotes"]);
    const foreign = await quoteSources(userId, { shelfId: theirs.id });
    expect(foreign.shelves.map((s) => s.name)).toEqual(["Has quotes"]);
  });
});
