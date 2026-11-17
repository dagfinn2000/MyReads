import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildBackupZip } from "@/lib/backup-zip";

/**
 * Stickers on covers against a real database: pinning and peeling them
 * from the book page, refusing another reader's book or a made-up id, and
 * backups taking them out and bringing them back.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect to ${url}`);
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

const { setBookStickers } = await import("@/lib/actions/stickers");
const { importLibrary } = await import("@/lib/import");

let userId: string;
let otherId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `st-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `st2-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

function book(title: string, stickers: string[] = [], owner = userId) {
  return prisma.book.create({ data: { userId: owner, title, searchText: title.toLowerCase(), stickers } });
}

const stickersOf = async (id: string) =>
  (await prisma.book.findUniqueOrThrow({ where: { id }, select: { stickers: true } })).stickers;

describe("pinning stickers", () => {
  it("starts with none", async () => {
    const b = await book("Plain");
    expect(await stickersOf(b.id)).toEqual([]);
  });

  it("saves them in the order pinned, known ones once each", async () => {
    const b = await book("Pinned");
    expect(await setBookStickers(b.id, ["gift", "signed", "gift", "glitter"])).toEqual(["gift", "signed"]);
    expect(await stickersOf(b.id)).toEqual(["gift", "signed"]);
  });

  it("peels them off", async () => {
    const b = await book("Peeled", ["gift", "signed", "rare"]);
    await setBookStickers(b.id, ["rare"]);
    expect(await stickersOf(b.id)).toEqual(["rare"]);
    await setBookStickers(b.id, []);
    expect(await stickersOf(b.id)).toEqual([]);
  });

  it("leaves another reader's book alone", async () => {
    const theirs = await book("Theirs", ["loved"], otherId);
    expect(await setBookStickers(theirs.id, ["rare"])).toBeNull();
    expect(await stickersOf(theirs.id)).toEqual(["loved"]);
  });

  it("refuses an id or list that isn't one", async () => {
    const b = await book("Safe", ["gift"]);
    expect(await setBookStickers({ not: "" }, ["rare"])).toBeNull();
    expect(await setBookStickers(b.id, "rare")).toBeNull();
    expect(await setBookStickers(b.id, Array(101).fill("rare"))).toBeNull();
    expect(await stickersOf(b.id)).toEqual(["gift"]);
  });

  it("needs someone signed in", async () => {
    const b = await book("Locked", ["gift"]);
    currentUserId = null;
    await expect(setBookStickers(b.id, ["rare"])).rejects.toThrow();
    expect(await stickersOf(b.id)).toEqual(["gift"]);
  });
});

describe("backups", () => {
  const exported = (over: Record<string, unknown>) => ({
    title: "The Hobbit",
    authors: ["J.R.R. Tolkien"],
    format: "PHYSICAL",
    ownership: "OWNED",
    status: "READ",
    tags: [],
    shelves: [],
    ...over,
  });

  it("go out with the book", async () => {
    await book("Stuck", ["signed", "first-edition"]);
    const zip = await buildBackupZip(userId);
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      zip.stream.on("data", (c) => chunks.push(c)).on("end", () => resolve()).on("error", reject).resume();
    });
    const JSZip = (await import("jszip")).default;
    const unzipped = await JSZip.loadAsync(Buffer.concat(chunks));
    const data = JSON.parse(await unzipped.file("library.json")!.async("string"));
    expect(data.books[0].stickers).toEqual(["signed", "first-edition"]);
  });

  it("come back in their order, dropping ones no longer known", async () => {
    const res = await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [
        exported({ title: "Kept", stickers: ["rare", "glitter", "gift", "rare"] }),
        exported({ title: "Not a list", stickers: "gift" }),
        exported({ title: "Older backup" }),
      ],
    });
    expect(res).not.toHaveProperty("error");
    const books = await prisma.book.findMany({ where: { userId }, select: { title: true, stickers: true } });
    expect(Object.fromEntries(books.map((b) => [b.title, b.stickers]))).toEqual({
      Kept: ["rare", "gift"],
      "Not a list": [],
      "Older backup": [],
    });
  });
});
