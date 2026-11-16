import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { BookFormat } from "@/lib/enums";
import type { BookDetails } from "@/lib/metadata/types";

/**
 * Tidy up's actions against a real database: leaving things alone (two
 * quick taps both stick), bringing them back, and filling covers and page
 * counts from the catalogues only where they're missing, only for the
 * reader's own books, and only by ISBN or Open Library id.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
// The cover download runs after the response; nothing to fetch here.
vi.mock("@/lib/cover-localize", () => ({ localizeCoverAfterResponse: () => {} }));
const getBookDetails = vi.fn<() => Promise<BookDetails>>();
vi.mock("@/lib/metadata", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/metadata")>()),
  getBookDetails: () => getBookDetails(),
}));

const { leaveTidyItem, bringBackTidyItems, fillFromCatalogue } = await import("@/lib/actions/tidy");
const { parsePreferences } = await import("@/lib/preferences");

let userId: string;
let otherUserId: string;

const details = (over: Partial<BookDetails> = {}): BookDetails => ({
  description: null,
  pageCount: 412,
  tags: [],
  coverUrl: "https://covers.example.org/b/1-L.jpg",
  ...over,
});

async function makeBook(over: Record<string, unknown> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title: "Dune", authors: ["Frank Herbert"], searchText: "dune", ...over },
  });
}

async function skipped() {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferences: true } });
  return parsePreferences(u.preferences).tidySkipped;
}

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `td-${stamp}`, passwordHash: "x", preferences: { theme: "x" } } }),
    prisma.user.create({ data: { username: `tdo-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  getBookDetails.mockReset();
  getBookDetails.mockResolvedValue(details());
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("leaving things alone", () => {
  it("keeps both of two quick taps, and brings them all back", async () => {
    await Promise.all([leaveTidyItem("cover:abc"), leaveTidyItem("dup:a+b")]);
    expect((await skipped()).sort()).toEqual(["cover:abc", "dup:a+b"]);
    await bringBackTidyItems();
    expect(await skipped()).toEqual([]);
  });

  it("refuses a key of the wrong shape, and leaves other preferences be", async () => {
    expect(await leaveTidyItem("cover:a b")).toEqual({ error: "Invalid input" });
    expect(await leaveTidyItem({ not: "" } as unknown as string)).toEqual({ error: "Invalid input" });
    await leaveTidyItem("pages:x1");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferences: true } });
    expect(u.preferences).toMatchObject({ theme: "x", tidySkipped: ["pages:x1"] });
  });
});

describe("fillFromCatalogue", () => {
  it("fills a missing cover and page count", async () => {
    const bk = await makeBook({ isbn: "9780441013593" });
    expect(await fillFromCatalogue(bk.id)).toEqual({ kind: "filled", cover: true, pages: true });
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.coverUrl).toBe("https://covers.example.org/b/1-L.jpg");
    expect(after.pageCount).toBe(412);
  });

  it("never replaces what the reader set", async () => {
    const bk = await makeBook({ isbn: "9780441013593", coverUrl: "/api/covers/mine.jpg" });
    expect(await fillFromCatalogue(bk.id)).toEqual({ kind: "filled", cover: false, pages: true });
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bk.id } });
    expect(after.coverUrl).toBe("/api/covers/mine.jpg");
  });

  it("asks nothing for a book without an ISBN or id, an audiobook's pages, or another reader's book", async () => {
    const byTitle = await makeBook();
    const audiobook = await makeBook({ isbn: "9780441013593", format: BookFormat.AUDIOBOOK, coverUrl: "/c.jpg" });
    const theirs = await makeBook({ isbn: "9780441013593" }, otherUserId);
    expect(await fillFromCatalogue(byTitle.id)).toEqual({ kind: "nothing" });
    expect(await fillFromCatalogue(audiobook.id)).toEqual({ kind: "nothing" });
    expect(await fillFromCatalogue(theirs.id)).toEqual({ kind: "error", message: "Book not found" });
    expect(getBookDetails).not.toHaveBeenCalled();
    expect((await prisma.book.findUniqueOrThrow({ where: { id: theirs.id } })).pageCount).toBeNull();
  });

  it("ignores a cover that isn't a web address and a page count out of range", async () => {
    getBookDetails.mockResolvedValue(details({ coverUrl: "javascript:alert(1)", pageCount: 2_000_000 }));
    const bk = await makeBook({ openLibraryId: "OL1W" });
    expect(await fillFromCatalogue(bk.id)).toEqual({ kind: "nothing" });
  });
});
