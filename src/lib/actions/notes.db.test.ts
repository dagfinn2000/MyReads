import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Chapter notes: the note actions only ever touch the signed-in reader's
 * own notes, check what they're given, and the one add form adds a quote
 * or a note by its kind.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

const revalidated: string[] = [];
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));

const { addNote, addNoteOrQuote, updateNote, deleteNote } = await import("@/lib/actions/notes");
const { updateQuote } = await import("@/lib/actions/quotes");

let userId: string;
let otherUserId: string;

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const makeBook = (owner: string, pageCount: number | null = 300) =>
  prisma.book.create({ data: { userId: owner, title: "Book", searchText: "book", pageCount } });

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `na-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `nb-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  revalidated.length = 0;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("note actions", () => {
  it("addNote saves the text, page and tidied chapter", async () => {
    const book = await makeBook(userId);
    const res = await addNote({}, form({ bookId: book.id, text: "  Who wrote the letter? ", page: "42", chapter: " Chapter   3 " }));
    expect(res).toEqual({ success: true });
    const [note] = await prisma.bookNote.findMany({ where: { bookId: book.id } });
    expect(note).toMatchObject({ text: "Who wrote the letter?", page: 42, chapter: "Chapter 3" });
    expect(revalidated).toContain(`/books/${book.id}`);
  });

  it("addNote takes a note with neither page nor chapter", async () => {
    const book = await makeBook(userId);
    expect(await addNote({}, form({ bookId: book.id, text: "Loved it", page: "", chapter: "" }))).toEqual({
      success: true,
    });
    const [note] = await prisma.bookNote.findMany({ where: { bookId: book.id } });
    expect(note).toMatchObject({ page: null, chapter: null });
  });

  it("addNote refuses an empty note, a page past the end and a chapter too long", async () => {
    const book = await makeBook(userId, 300);
    expect(await addNote({}, form({ bookId: book.id, text: "   " }))).toEqual({ error: "Write the note first." });
    expect(await addNote({}, form({ bookId: book.id, text: "x", page: "301" }))).toEqual({
      error: "Page 301 is past the end of the book (300 pages)",
    });
    expect((await addNote({}, form({ bookId: book.id, text: "x", chapter: "c".repeat(121) }))).error).toMatch(
      /chapter to 120/,
    );
    expect(await prisma.bookNote.count({ where: { bookId: book.id } })).toBe(0);
  });

  it("addNote refuses another reader's book", async () => {
    const theirs = await makeBook(otherUserId);
    expect(await addNote({}, form({ bookId: theirs.id, text: "Mine now" }))).toEqual({ error: "Book not found" });
    expect(await prisma.bookNote.count({ where: { bookId: theirs.id } })).toBe(0);
  });

  it("addNoteOrQuote adds a quote when asked for one, with its chapter and why", async () => {
    const book = await makeBook(userId);
    const res = await addNoteOrQuote(
      {},
      form({ bookId: book.id, kind: "quote", text: "It was a dark night.", page: "1", chapter: "1", note: "Opening" }),
    );
    expect(res).toEqual({ success: true });
    const [quote] = await prisma.quote.findMany({ where: { bookId: book.id } });
    expect(quote).toMatchObject({ text: "It was a dark night.", page: 1, chapter: "1", note: "Opening" });
    expect(await prisma.bookNote.count({ where: { bookId: book.id } })).toBe(0);

    await addNoteOrQuote({}, form({ bookId: book.id, kind: "note", text: "A note" }));
    expect(await prisma.bookNote.count({ where: { bookId: book.id } })).toBe(1);
  });

  it("updateNote edits your own note, and an empty chapter clears it", async () => {
    const book = await makeBook(userId);
    const note = await prisma.bookNote.create({ data: { bookId: book.id, text: "Old", page: 5, chapter: "1" } });
    const res = await updateNote(note.id, {}, form({ text: "New", page: "0", chapter: "" }));
    expect(res).toEqual({ success: true });
    expect(await prisma.bookNote.findUniqueOrThrow({ where: { id: note.id } })).toMatchObject({
      text: "New",
      page: null,
      chapter: null,
    });
  });

  it("updateNote and deleteNote leave another reader's note alone", async () => {
    const book = await makeBook(otherUserId);
    const theirs = await prisma.bookNote.create({ data: { bookId: book.id, text: "Theirs" } });
    expect(await updateNote(theirs.id, {}, form({ text: "Hijacked" }))).toEqual({ error: "Note not found" });
    await deleteNote(theirs.id);
    expect(await prisma.bookNote.findUniqueOrThrow({ where: { id: theirs.id } })).toMatchObject({ text: "Theirs" });
  });

  it("refuses an id that isn't a string before it reaches the database", async () => {
    const book = await makeBook(userId);
    const note = await prisma.bookNote.create({ data: { bookId: book.id, text: "Keep" } });
    const quote = await prisma.quote.create({ data: { bookId: book.id, text: "Keep" } });
    const filter = { not: "" } as unknown as string;
    expect(await updateNote(filter, {}, form({ text: "Gone" }))).toEqual({ error: "Note not found" });
    expect(await updateQuote(filter, {}, form({ text: "Gone" }))).toEqual({ error: "Quote not found" });
    await deleteNote(filter);
    expect(await prisma.bookNote.findUniqueOrThrow({ where: { id: note.id } })).toMatchObject({ text: "Keep" });
    expect(await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).toMatchObject({ text: "Keep" });
  });

  it("deleteNote removes your own note, and deleting the book takes its notes", async () => {
    const book = await makeBook(userId);
    const a = await prisma.bookNote.create({ data: { bookId: book.id, text: "a" } });
    await prisma.bookNote.create({ data: { bookId: book.id, text: "b" } });
    await deleteNote(a.id);
    expect(await prisma.bookNote.findUnique({ where: { id: a.id } })).toBeNull();
    await prisma.book.delete({ where: { id: book.id } });
    expect(await prisma.bookNote.count({ where: { bookId: book.id } })).toBe(0);
  });

  it("updateQuote keeps the chapter when the form has no chapter box", async () => {
    const book = await makeBook(userId);
    const quote = await prisma.quote.create({ data: { bookId: book.id, text: "Q", chapter: "Prologue" } });
    expect(await updateQuote(quote.id, {}, form({ text: "Q2" }))).toEqual({ success: true });
    expect(await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).toMatchObject({
      text: "Q2",
      chapter: "Prologue",
    });
  });
});
