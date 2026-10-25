import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * The quote actions, now that the quotes page edits and deletes too: each
 * one only ever touches the signed-in reader's own quotes.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

// Server actions call revalidatePath, which needs a request scope.
const revalidated: string[] = [];
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));

const { addQuote, updateQuote, deleteQuote, importKindleQuotes, kindleLibrary } = await import(
  "@/lib/actions/quotes"
);

let userId: string;
let otherUserId: string;

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function makeQuote(owner: string, text = "Original") {
  const book = await prisma.book.create({
    data: { userId: owner, title: "Book", searchText: "book" },
  });
  return prisma.quote.create({ data: { bookId: book.id, text, page: 10, note: "n" } });
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `qa-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `qb-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  revalidated.length = 0;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("quote actions", () => {
  it("updateQuote saves text, page and note, and refreshes the quotes page", async () => {
    const q = await makeQuote(userId);
    const res = await updateQuote(q.id, {}, form({ text: "Edited", page: "0", note: "" }));
    expect(res).toEqual({ success: true });

    const saved = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(saved).toMatchObject({ text: "Edited", page: null, note: null });
    expect(revalidated).toContain("/quotes");
    expect(revalidated).toContain(`/books/${q.bookId}`);
  });

  it("updateQuote refuses another reader's quote and leaves it alone", async () => {
    const theirs = await makeQuote(otherUserId, "Theirs");
    const res = await updateQuote(theirs.id, {}, form({ text: "Hijacked" }));
    expect(res).toEqual({ error: "Quote not found" });
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(after.text).toBe("Theirs");
  });

  it("deleteQuote removes your own quote", async () => {
    const q = await makeQuote(userId);
    await deleteQuote(q.id);
    expect(await prisma.quote.findUnique({ where: { id: q.id } })).toBeNull();
    expect(revalidated).toContain("/quotes");
  });

  it("deleteQuote does nothing to another reader's quote", async () => {
    const theirs = await makeQuote(otherUserId);
    await deleteQuote(theirs.id);
    expect(await prisma.quote.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  it("addQuote refuses another reader's book", async () => {
    const theirs = await makeQuote(otherUserId);
    const res = await addQuote({}, form({ bookId: theirs.bookId, text: "Sneaky" }));
    expect(res).toEqual({ error: "Book not found" });
    expect(await prisma.quote.count({ where: { bookId: theirs.bookId } })).toBe(1);
  });

  it("refuses a page past the end of the book, as the reading card does", async () => {
    const q = await makeQuote(userId);
    await prisma.book.update({ where: { id: q.bookId }, data: { pageCount: 300 } });

    const added = await addQuote({}, form({ bookId: q.bookId, text: "Typo", page: "3000" }));
    expect(added).toEqual({ error: "Page 3000 is past the end of the book (300 pages)" });
    const edited = await updateQuote(q.id, {}, form({ text: "Edited", page: "301" }));
    expect(edited).toEqual({ error: "Page 301 is past the end of the book (300 pages)" });
    expect(await prisma.quote.findMany({ where: { bookId: q.bookId } })).toMatchObject([
      { text: "Original", page: 10 },
    ]);

    // The last page itself, and any page of a book with no page count, are fine.
    expect(await updateQuote(q.id, {}, form({ text: "Last", page: "300" }))).toEqual({
      success: true,
    });
    await prisma.book.update({ where: { id: q.bookId }, data: { pageCount: null } });
    expect(await addQuote({}, form({ bookId: q.bookId, text: "Any", page: "3000" }))).toEqual({
      success: true,
    });
  });

  it("all of them need a session", async () => {
    const q = await makeQuote(userId);
    currentUserId = null;
    await expect(updateQuote(q.id, {}, form({ text: "x" }))).rejects.toThrow("Not authenticated");
    await expect(deleteQuote(q.id)).rejects.toThrow("Not authenticated");
  });
});

describe("importing Kindle highlights", () => {
  const highlight = (text: string, extra: Record<string, unknown> = {}) => ({
    text,
    page: null,
    note: null,
    addedAt: null,
    ...extra,
  });

  it("adds them as quotes, dated when they were highlighted, with page and note", async () => {
    const book = await prisma.book.create({
      data: { userId, title: "The Name of the Wind", searchText: "x", pageCount: 662 },
    });
    const res = await importKindleQuotes(book.id, [
      highlight("It was night again.", { page: 12, note: "Lovely.", addedAt: "2023-03-05T20:14:03.000Z" }),
      // Past the end of this edition: kept, without the page.
      highlight("Words are pale shadows.", { page: 900 }),
    ]);
    expect(res).toEqual({ added: 2, already: 0 });

    const quotes = await prisma.quote.findMany({ where: { bookId: book.id }, orderBy: { createdAt: "asc" } });
    expect(quotes).toMatchObject([
      { text: "It was night again.", page: 12, note: "Lovely.", createdAt: new Date("2023-03-05T20:14:03.000Z") },
      { text: "Words are pale shadows.", page: null, note: null },
    ]);
    // No date: it dates from the import.
    expect(Date.now() - quotes[1].createdAt.getTime()).toBeLessThan(60_000);
    expect(revalidated).toContain("/quotes");
  });

  it("only adds what's new when the same file comes again", async () => {
    const book = await prisma.book.create({ data: { userId, title: "Book", searchText: "book" } });
    await prisma.quote.create({ data: { bookId: book.id, text: "Typed in  by HAND." } });
    expect(await importKindleQuotes(book.id, [highlight("One."), highlight("typed in by hand.")])).toEqual({
      added: 1,
      already: 1,
    });
    expect(await importKindleQuotes(book.id, [highlight("One."), highlight("Two.")])).toEqual({
      added: 1,
      already: 1,
    });
    expect(await prisma.quote.count({ where: { bookId: book.id } })).toBe(3);
  });

  it("ignores a date from the future or before the Kindle", async () => {
    const book = await prisma.book.create({ data: { userId, title: "Book", searchText: "book" } });
    await importKindleQuotes(book.id, [
      highlight("Future.", { addedAt: "2999-01-01T00:00:00.000Z" }),
      highlight("Past.", { addedAt: "1999-01-01T00:00:00.000Z" }),
    ]);
    const quotes = await prisma.quote.findMany({ where: { bookId: book.id } });
    for (const q of quotes) expect(Date.now() - q.createdAt.getTime()).toBeLessThan(60_000);
  });

  it("refuses another reader's book and anything that isn't highlights", async () => {
    const theirs = await prisma.book.create({ data: { userId: otherUserId, title: "Theirs", searchText: "x" } });
    expect(await importKindleQuotes(theirs.id, [highlight("Sneaky.")])).toEqual({ error: "Book not found" });
    expect(await prisma.quote.count({ where: { bookId: theirs.id } })).toBe(0);

    const mine = await prisma.book.create({ data: { userId, title: "Mine", searchText: "x" } });
    expect(await importKindleQuotes(mine.id, [])).toEqual({ error: "Those highlights couldn't be read" });
    expect(await importKindleQuotes(mine.id, [{ text: "" }])).toEqual({
      error: "Those highlights couldn't be read",
    });
    expect(await importKindleQuotes(mine.id, "nonsense")).toEqual({
      error: "Those highlights couldn't be read",
    });
  });

  it("matches against the reader's own books only", async () => {
    await prisma.book.create({ data: { userId, title: "Mine", searchText: "x", authors: ["Me"] } });
    await prisma.book.create({ data: { userId: otherUserId, title: "Theirs", searchText: "x" } });
    expect(await kindleLibrary()).toEqual([
      { id: expect.any(String), title: "Mine", authors: ["Me"], format: "PHYSICAL" },
    ]);
    currentUserId = null;
    await expect(kindleLibrary()).rejects.toThrow("Not authenticated");
    await expect(importKindleQuotes("x", [])).rejects.toThrow("Not authenticated");
  });
});
