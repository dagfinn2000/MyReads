import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * The quote actions, now that the quotes page edits and deletes too: each
 * one only ever touches the signed-in reader's own quotes.
 */
const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

// Server actions call revalidatePath, which needs a request scope.
const revalidated: string[] = [];
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));

const { addQuote, updateQuote, deleteQuote } = await import("@/lib/actions/quotes");

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
