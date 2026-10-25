import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { BookField } from "@/lib/book-fields";
import { parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";

/**
 * The reader's own book fields against a real database: values written by
 * the add and edit forms, the search text kept beside them, values let go
 * when a field or option goes, the library's filters on them (Prisma's
 * JSON path filters, which only a real Postgres can vouch for), and backups.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect to ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

const { createBook, updateBook } = await import("@/lib/actions/books");
const { savePreferences } = await import("@/lib/actions/preferences");
const { importLibrary } = await import("@/lib/import");

const where: BookField = { id: "loc", name: "Where", type: "text", options: [] };
const price: BookField = { id: "pr", name: "Price", type: "number", options: [] };
const bought: BookField = { id: "bo", name: "Bought", type: "date", options: [] };
const signed: BookField = { id: "si", name: "Signed", type: "yesno", options: [] };
const edition: BookField = { id: "ed", name: "Edition", type: "choice", options: ["First", "Book club"] };
const fields = [where, price, bought, signed, edition];

let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: {
      username: `fl-${Date.now()}-${Math.random()}`,
      passwordHash: "x",
      preferences: { customFields: fields },
    },
  });
  userId = user.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const bookFields = { title: "Dune", authors: "Frank Herbert", tags: "", format: "PHYSICAL", ownership: "OWNED" };

/** Runs an action that ends in redirect(), and returns where it went. */
async function redirected(run: Promise<unknown>): Promise<string> {
  const err = await run.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof Redirect)) throw new Error(`expected a redirect, got ${String(err)}`);
  return err.url;
}

async function makeBook(title: string, values: Record<string, unknown> | undefined, search = "") {
  return prisma.book.create({
    data: { userId, title, searchText: title.toLowerCase(), fields: values as object, fieldSearchText: search },
  });
}

async function titles(sp: Record<string, string>): Promise<string[]> {
  const prefs = { searchAlsoIn: [], timeZone: "UTC", customFields: fields };
  const books = await prisma.book.findMany({
    where: await resolveBookWhere(userId, parseFilters(sp), prefs),
    select: { title: true },
    orderBy: { title: "asc" },
  });
  return books.map((b) => b.title);
}

describe("the book forms", () => {
  it("saves a new book's values, with its text ones searchable", async () => {
    await redirected(
      createBook(
        {},
        form({
          ...bookFields,
          "field:loc": "Hall, top shelf",
          "field:pr": "12,50",
          "field:bo": "2024-02-29",
          "field:si": "yes",
          "field:ed": "book club",
        }),
      ),
    );
    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.fields).toEqual({ loc: "Hall, top shelf", pr: 12.5, bo: "2024-02-29", si: true, ed: "Book club" });
    expect(book.fieldSearchText).toBe("hall, top shelf book club");
  });

  it("stores nothing for a book without values", async () => {
    await redirected(createBook({}, form({ ...bookFields, "field:loc": "  ", "field:si": "" })));
    const book = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(book.fields).toBeNull();
    expect(book.fieldSearchText).toBe("");
  });

  it("refuses a value that doesn't fit, and adds nothing", async () => {
    const res = await createBook({}, form({ ...bookFields, "field:bo": "next week" }));
    expect(res).toEqual({ error: "“Bought” needs a date." });
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
  });

  it("edits values, clears emptied ones and keeps ones the form didn't send", async () => {
    const book = await makeBook("Dune", { loc: "Hall", si: true, pr: 10 }, "hall");
    await redirected(
      updateBook(book.id, {}, form({ ...bookFields, "field:loc": "Study", "field:si": "", "field:ed": "First" })),
    );
    const after = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(after.fields).toEqual({ loc: "Study", pr: 10, ed: "First" });
    expect(after.fieldSearchText).toBe("study first");
  });
});

describe("changing the fields", () => {
  it("takes a removed field's values off the books, and its search text", async () => {
    const a = await makeBook("A", { loc: "Hall", si: true }, "hall");
    const b = await makeBook("B", { loc: "Study" }, "study");
    const c = await makeBook("C", { si: false });
    await savePreferences({ customFields: [price, bought, signed, edition] });
    const books = await prisma.book.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, orderBy: { title: "asc" } });
    expect(books.map((x) => [x.fields, x.fieldSearchText])).toEqual([
      [{ si: true }, ""],
      [null, ""],
      [{ si: false }, ""],
    ]);
  });

  it("takes an option off the books that had it", async () => {
    const a = await makeBook("A", { ed: "Book club", pr: 3 }, "book club");
    const b = await makeBook("B", { ed: "First" }, "first");
    await savePreferences({ customFields: [where, price, bought, signed, { ...edition, options: ["First"] }] });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: a.id } })).fields).toEqual({ pr: 3 });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: b.id } })).fields).toEqual({ ed: "First" });
  });

  it("keeps every value through a rename", async () => {
    const a = await makeBook("A", { loc: "Hall" }, "hall");
    await savePreferences({ customFields: [{ ...where, name: "Shelf" }, price, bought, signed, edition] });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: a.id } })).fields).toEqual({ loc: "Hall" });
  });
});

describe("the library's filters", () => {
  beforeEach(async () => {
    await makeBook("Cheap", { pr: 4.5, bo: "2023-06-01", si: false, ed: "Book club" }, "book club");
    await makeBook("Dear", { pr: 40, bo: "2024-01-15", si: true, ed: "First", loc: "Hall" }, "first hall");
    await makeBook("Bare", undefined);
  });

  it("finds books with a value, and without one", async () => {
    expect(await titles({ field: "pr" })).toEqual(["Cheap", "Dear"]);
    expect(await titles({ field: "loc!" })).toEqual(["Bare", "Cheap"]);
  });

  it("finds a choice, and yes or no", async () => {
    expect(await titles({ field: "ed=first" })).toEqual(["Dear"]);
    expect(await titles({ field: "si=no" })).toEqual(["Cheap"]);
  });

  it("finds numbers and dates in a range", async () => {
    expect(await titles({ field: "pr:4..10" })).toEqual(["Cheap"]);
    expect(await titles({ field: "pr:10.." })).toEqual(["Dear"]);
    expect(await titles({ field: "bo:2024-01-01.." })).toEqual(["Dear"]);
    expect(await titles({ field: "bo:..2023-12-31" })).toEqual(["Cheap"]);
  });

  it("ignores a filter that no longer fits a field", async () => {
    expect(await titles({ field: "gone" })).toEqual(["Bare", "Cheap", "Dear"]);
    expect(await titles({ field: "ed=Third" })).toEqual(["Bare", "Cheap", "Dear"]);
  });

  it("searches text and choice values", async () => {
    expect(await titles({ q: "hall" })).toEqual(["Dear"]);
    expect(await titles({ q: "club" })).toEqual(["Cheap"]);
  });
});

describe("restoring a backup", () => {
  const exported = (title: string, values?: unknown) => ({
    title,
    authors: ["Someone"],
    format: "PHYSICAL",
    ownership: "OWNED",
    status: "READ",
    tags: [],
    shelves: [],
    quotes: [],
    reads: [],
    progress: [],
    ...(values !== undefined && { fields: values }),
  });

  it("keeps values the account's fields take, and drops the rest", async () => {
    const res = await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [
        exported("Kept", { loc: "Hall", si: true, gone: "x", ed: "Ninth" }),
        exported("Junk", "not an object"),
        exported("Older backup"),
      ],
    });
    expect(res).not.toHaveProperty("error");
    const books = await prisma.book.findMany({
      where: { userId },
      select: { title: true, fields: true, fieldSearchText: true },
      orderBy: { title: "asc" },
    });
    expect(books).toEqual([
      { title: "Junk", fields: null, fieldSearchText: "" },
      { title: "Kept", fields: { loc: "Hall", si: true }, fieldSearchText: "hall" },
      { title: "Older backup", fields: null, fieldSearchText: "" },
    ]);
  });

  it("brings the fields back with the values onto a fresh account", async () => {
    await prisma.user.update({ where: { id: userId }, data: { preferences: {} } });
    await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [exported("Dune", { ed: "First" })],
      settings: { theme: null, defaultViewName: null, preferences: { customFields: [edition] } },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.preferences).toEqual({ customFields: [edition] });
    expect((await prisma.book.findFirstOrThrow({ where: { userId } })).fields).toEqual({ ed: "First" });
  });
});
