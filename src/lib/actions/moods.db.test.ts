import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildBackupZip } from "@/lib/backup-zip";
import { parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";
import type { CustomMood } from "@/lib/moods";

/**
 * Reading moods against a real database: setting them on a book, the
 * library's mood filter (array containment, like tags), bulk edit putting
 * them on and taking them off, a removed mood of the reader's own coming
 * off its books, challenges counted by mood, and backups.
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

const { setBookMoods } = await import("@/lib/actions/moods");
const { bulkUpdateBooks } = await import("@/lib/actions/bulk");
const { savePreferences } = await import("@/lib/actions/preferences");
const { createChallenge } = await import("@/lib/actions/challenges");
const { importLibrary } = await import("@/lib/import");

const epic: CustomMood = { key: "ep1c", name: "Epic", icon: "swords", color: "teal" };

let userId: string;
let otherId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({
      data: { username: `md-${stamp}`, passwordHash: "x", preferences: { customMoods: [epic] } },
    }),
    prisma.user.create({
      data: { username: `md2-${stamp}`, passwordHash: "x", preferences: { customMoods: [epic] } },
    }),
  ]);
  userId = a.id;
  otherId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

function book(title: string, moods: string[] = [], owner = userId) {
  return prisma.book.create({ data: { userId: owner, title, searchText: title.toLowerCase(), moods } });
}

const moodsOf = async (id: string) =>
  (await prisma.book.findUniqueOrThrow({ where: { id }, select: { moods: true } })).moods;

async function titles(sp: Record<string, string>): Promise<string[]> {
  const where = await resolveBookWhere(userId, parseFilters(sp), { searchAlsoIn: [], timeZone: "UTC" });
  const rows = await prisma.book.findMany({ where, select: { title: true }, orderBy: { title: "asc" } });
  return rows.map((r) => r.title);
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("a book's moods", () => {
  it("keeps the moods the reader has, each once, in list order", async () => {
    const b = await book("Piranesi");
    expect(await setBookMoods(b.id, ["mysterious", "cosy", "ep1c", "cosy", "nope", 42])).toEqual([
      "cosy",
      "mysterious",
      "ep1c",
    ]);
    expect(await moodsOf(b.id)).toEqual(["cosy", "mysterious", "ep1c"]);
    expect(await setBookMoods(b.id, [])).toEqual([]);
    expect(await moodsOf(b.id)).toEqual([]);
  });

  it("won't touch another reader's book, or take what isn't a list", async () => {
    const theirs = await book("Theirs", ["dark"], otherId);
    expect(await setBookMoods(theirs.id, ["cosy"])).toBeNull();
    expect(await moodsOf(theirs.id)).toEqual(["dark"]);
    const mine = await book("Mine", ["dark"]);
    expect(await setBookMoods(mine.id, "cosy")).toBeNull();
    expect(await setBookMoods({ not: "" }, ["cosy"])).toBeNull();
    expect(await moodsOf(mine.id)).toEqual(["dark"]);
  });
});

describe("the mood filter", () => {
  beforeEach(async () => {
    await book("Cosy", ["cosy"]);
    await book("Cosy and funny", ["cosy", "funny"]);
    await book("Funny and dark", ["funny", "dark"]);
    await book("No mood");
    await book("Someone else's cosy", ["cosy"], otherId);
  });

  it("finds books with any of the moods, or all of them", async () => {
    expect(await titles({ mood: "cosy" })).toEqual(["Cosy", "Cosy and funny"]);
    expect(await titles({ mood: "cosy,funny" })).toEqual(["Cosy", "Cosy and funny", "Funny and dark"]);
    expect(await titles({ mood: "cosy,funny", moodMatch: "all" })).toEqual(["Cosy and funny"]);
  });

  it("leaves out the moods switched to Not, books without moods included", async () => {
    expect(await titles({ notMood: "dark" })).toEqual(["Cosy", "Cosy and funny", "No mood"]);
    expect(await titles({ mood: "funny", notMood: "dark" })).toEqual(["Cosy and funny"]);
  });
});

describe("bulk edit", () => {
  it("puts a mood on the books that lack it and takes it off again", async () => {
    const a = await book("A", ["cosy"]);
    const b = await book("B", ["dark"]);
    const theirs = await book("Theirs", [], otherId);
    const res = await bulkUpdateBooks({ bookIds: [a.id, b.id, theirs.id], addMood: "cosy" });
    expect(res).not.toHaveProperty("error");
    expect(await moodsOf(a.id)).toEqual(["cosy"]);
    expect(await moodsOf(b.id)).toEqual(["dark", "cosy"]);
    expect(await moodsOf(theirs.id)).toEqual([]);

    await bulkUpdateBooks({ matching: { mood: "cosy" }, removeMood: "cosy" });
    expect(await moodsOf(a.id)).toEqual([]);
    expect(await moodsOf(b.id)).toEqual(["dark"]);
  });

  it("refuses a mood the reader doesn't have", async () => {
    const a = await book("A");
    expect(await bulkUpdateBooks({ bookIds: [a.id], addMood: "zz9" })).toEqual({ error: "Mood not found" });
    expect(await moodsOf(a.id)).toEqual([]);
  });
});

describe("removing a mood of the reader's own", () => {
  it("takes it off their books, and only theirs", async () => {
    const mine = await book("Mine", ["cosy", "ep1c", "dark"]);
    const theirs = await book("Theirs", ["ep1c"], otherId);
    await savePreferences({ customMoods: [] });
    expect(await moodsOf(mine.id)).toEqual(["cosy", "dark"]);
    expect(await moodsOf(theirs.id)).toEqual(["ep1c"]);
  });

  it("leaves the books of a mood that's only renamed, or a built-in one hidden", async () => {
    const mine = await book("Mine", ["spooky", "ep1c"]);
    await savePreferences({ customMoods: [{ ...epic, name: "Grand" }], hiddenMoods: ["spooky"] });
    expect(await moodsOf(mine.id)).toEqual(["spooky", "ep1c"]);
  });
});

describe("challenges", () => {
  it("counts a mood's books, and only a mood the reader has", async () => {
    expect(
      await createChallenge({}, form({ source: "mood:cosy", sourceName: "Cosy", target: "5", year: "2026" })),
    ).toEqual({ saved: true });
    expect(
      await createChallenge({}, form({ source: "mood:zz9", sourceName: "?", target: "5", year: "2026" })),
    ).toEqual({ error: "Pick which books count." });
    const rows = await prisma.challenge.findMany({ where: { userId }, select: { name: true, query: true } });
    expect(rows).toEqual([{ name: "Cosy", query: "mood=cosy" }]);
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

  it("goes out with the book", async () => {
    await book("Moody", ["cosy", "ep1c"]);
    const zip = await buildBackupZip(userId);
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      zip.stream.on("data", (c) => chunks.push(c)).on("end", () => resolve()).on("error", reject).resume();
    });
    const JSZip = (await import("jszip")).default;
    const unzipped = await JSZip.loadAsync(Buffer.concat(chunks));
    const data = JSON.parse(await unzipped.file("library.json")!.async("string"));
    expect(data.books[0].moods).toEqual(["cosy", "ep1c"]);
  });

  it("keeps the moods the account has and drops the rest", async () => {
    const res = await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [
        exported({ title: "Kept", moods: ["dark", "ep1c", "cosy", "dark"] }),
        exported({ title: "Unknown", moods: ["zz9", 7, null] }),
        exported({ title: "Not a list", moods: "cosy" }),
        exported({ title: "Older backup" }),
      ],
    });
    expect(res).not.toHaveProperty("error");
    const books = await prisma.book.findMany({ where: { userId }, select: { title: true, moods: true } });
    expect(Object.fromEntries(books.map((b) => [b.title, b.moods]))).toEqual({
      Kept: ["cosy", "dark", "ep1c"],
      Unknown: [],
      "Not a list": [],
      "Older backup": [],
    });
  });

  it("brings the reader's own moods back with the books onto a fresh account", async () => {
    await prisma.user.update({ where: { id: userId }, data: { preferences: {} } });
    const other: CustomMood = { key: "gr4nd", name: "Grand", icon: "crown", color: "amber" };
    await importLibrary(userId, {
      format: "myreads-export",
      version: 1,
      books: [exported({ moods: ["gr4nd", "cosy"] })],
      settings: { theme: null, defaultViewName: null, preferences: { customMoods: [other] } },
    });
    expect((await prisma.book.findFirstOrThrow({ where: { userId } })).moods).toEqual(["cosy", "gr4nd"]);
  });
});
