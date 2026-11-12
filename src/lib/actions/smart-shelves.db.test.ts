import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ReadingStatus } from "@/lib/enums";

/**
 * Smart shelves against a real database: the books their rules pick (and
 * how that composes with the tab on screen), the new page, year and added
 * filters, what saving refuses, how shelves of the reader's own and
 * challenges follow along, and the backup round trip.
 */

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId, name: "t" } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const {
  createSmartShelf,
  deleteSmartShelf,
  renameSmartShelf,
  startSmartShelfDraft,
  updateSmartShelfRules,
} = await import("@/lib/actions/smart-shelves");
const { createShelf, renameShelf } = await import("@/lib/actions/shelves");
const { createChallenge } = await import("@/lib/actions/challenges");
const { parseFilters } = await import("@/lib/library-filters");
const { resolveBookWhere } = await import("@/lib/library-where");
const { smartShelfCounts, smartShelvesHolding, smartShelvesOfBooks } = await import(
  "@/lib/smart-shelves-query"
);
const { DRAFT_COOKIE, parseDraft } = await import("@/lib/smart-shelf-draft");
const { GET: exportRoute } = await import("@/app/api/export/route");
const { importLibrary } = await import("@/lib/import");

const prefs = { searchAlsoIn: [], timeZone: "UTC" };

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `ss-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `ss2-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
  jar.clear();
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

function add(title: string, data: Partial<Prisma.BookUncheckedCreateInput> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title, searchText: title.toLowerCase(), ...data },
  });
}

async function titles(sp: Record<string, string>): Promise<string[]> {
  const where = await resolveBookWhere(userId, parseFilters(sp), prefs);
  const rows = await prisma.book.findMany({ where, select: { title: true }, orderBy: { title: "asc" } });
  return rows.map((r) => r.title);
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const WTR = ReadingStatus.WANT_TO_READ;
const READ = ReadingStatus.READ;

describe("the new filters", () => {
  it("finds books by page range, leaving out ones with no page count", async () => {
    await add("Short", { pageCount: 180 });
    await add("Long", { pageCount: 900 });
    await add("Unknown");
    await add("Zero", { pageCount: 0 });
    expect(await titles({ pages: "..300" })).toEqual(["Short"]);
    expect(await titles({ pages: "500.." })).toEqual(["Long"]);
    expect(await titles({ pages: "100..1000" })).toEqual(["Long", "Short"]);
  });

  it("reads the year in a published date the way the sort does", async () => {
    await add("Plain", { publishedDate: "1949" });
    await add("Month", { publishedDate: "1951-07" });
    await add("Circa", { publishedDate: "c. 1920" });
    await add("Modern", { publishedDate: "2003-07-15" });
    await add("Undated", { publishedDate: "unknown" });
    await add("Other reader's", { publishedDate: "1930" }, otherUserId);
    expect(await titles({ published: "..1950" })).toEqual(["Circa", "Plain"]);
    expect(await titles({ published: "1950..2000" })).toEqual(["Month"]);
    expect(await titles({ published: "2000.." })).toEqual(["Modern"]);
  });

  it("finds books added in the last so many days", async () => {
    await add("New");
    await add("Old", { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) });
    expect(await titles({ added: "30" })).toEqual(["New"]);
    expect(await titles({ added: "365" })).toEqual(["New", "Old"]);
  });
});

describe("a smart shelf's books", () => {
  async function scifi() {
    await add("Short unread", { tags: ["sci-fi"], pageCount: 250, status: WTR });
    await add("Long unread", { tags: ["sci-fi"], pageCount: 600, status: WTR });
    await add("Short read", { tags: ["sci-fi"], pageCount: 200, status: READ });
    await add("Short fantasy", { tags: ["fantasy"], pageCount: 200, status: WTR });
    const res = await createSmartShelf("Short sci-fi", "shelf=WANT_TO_READ&tag=sci-fi&pages=..300&sort=title");
    expect(res.error).toBeUndefined();
    return res.id!;
  }

  it("are the ones its rules pick, and compose with the tab on screen", async () => {
    const id = await scifi();
    expect(await titles({ shelfId: id })).toEqual(["Short unread"]);
    // Its own status rule still holds on another tab: nothing there.
    expect(await titles({ shelfId: id, shelf: READ })).toEqual([]);
    expect(await titles({ shelfId: id, q: "nothing like it" })).toEqual([]);
  });

  it("follow the books as they change", async () => {
    const id = await scifi();
    const long = await prisma.book.findFirstOrThrow({ where: { userId, title: "Long unread" } });
    await prisma.book.update({ where: { id: long.id }, data: { pageCount: 280 } });
    expect(await titles({ shelfId: id })).toEqual(["Long unread", "Short unread"]);
  });

  it("keep to another reader's library: their smart shelf picks nothing here", async () => {
    await add("Mine", { tags: ["sci-fi"] });
    currentUserId = otherUserId;
    const theirs = await createSmartShelf("Theirs", "tag=sci-fi");
    currentUserId = userId;
    expect(await titles({ shelfId: theirs.id! })).toEqual([]);
  });

  it("are counted, found per book and grouped", async () => {
    const id = await scifi();
    const shelves = await prisma.smartShelf.findMany({ where: { userId } });
    expect((await smartShelfCounts(userId, shelves, prefs)).get(id)).toBe(1);
    const short = await prisma.book.findFirstOrThrow({ where: { userId, title: "Short unread" } });
    const long = await prisma.book.findFirstOrThrow({ where: { userId, title: "Long unread" } });
    expect((await smartShelvesHolding(userId, short.id, shelves, prefs)).map((s) => s.id)).toEqual([id]);
    expect(await smartShelvesHolding(userId, long.id, shelves, prefs)).toEqual([]);
    const grouped = await smartShelvesOfBooks(userId, { userId }, shelves, prefs);
    expect([...grouped.keys()]).toEqual([short.id]);
  });

  it("can keep to a shelf of the reader's own", async () => {
    await createShelf({}, formData({ name: "Fantasy" }));
    const shelf = await prisma.shelf.findFirstOrThrow({ where: { userId } });
    await add("On it, unread", { status: WTR, shelves: { connect: { id: shelf.id } } });
    await add("On it, read", { status: READ, shelves: { connect: { id: shelf.id } } });
    await add("Off it", { status: WTR });
    const res = await createSmartShelf("Fantasy to read", `shelfId=${shelf.id}&shelf=WANT_TO_READ`);
    expect(await titles({ shelfId: res.id! })).toEqual(["On it, unread"]);
  });
});

describe("saving a smart shelf", () => {
  it("stores the filters canonically, without the layout, and clears the draft", async () => {
    jar.set(DRAFT_COOKIE, JSON.stringify({ id: null, name: "Short" }));
    const res = await createSmartShelf("  Short  ", "dir=asc&sort=title&group=none&pages=..300&tag=b,a");
    const shelf = await prisma.smartShelf.findUniqueOrThrow({ where: { id: res.id } });
    expect(shelf).toMatchObject({ name: "Short", rules: "tag=a%2Cb&pages=..300" });
    expect(jar.has(DRAFT_COOKIE)).toBe(false);
  });

  it("refuses no filters, a taken name of either kind, and the cap", async () => {
    expect((await createSmartShelf("All", "sort=title&shelf=all")).error).toMatch(/filter/);
    await createShelf({}, formData({ name: "Fantasy" }));
    expect((await createSmartShelf("fantasy", "tag=x")).error).toMatch(/shelf called “Fantasy”/);
    await createSmartShelf("Short", "pages=..300");
    expect((await createSmartShelf("SHORT", "tag=x")).error).toMatch(/smart shelf called “Short”/);
    await prisma.smartShelf.createMany({
      data: Array.from({ length: 29 }, (_, i) => ({ userId, name: `S${i}`, rules: "tag=x" })),
    });
    expect((await createSmartShelf("One more", "tag=y")).error).toMatch(/up to 30/);
  });

  it("refuses rules built on a smart shelf, on itself, or on a shelf that isn't theirs", async () => {
    const a = await createSmartShelf("A", "tag=x");
    expect((await createSmartShelf("B", `shelfId=${a.id}`)).error).toMatch(/another smart shelf/);
    expect((await updateSmartShelfRules(a.id!, `shelfId=${a.id}`)).error).toMatch(/smart shelf/);
    currentUserId = otherUserId;
    await createShelf({}, formData({ name: "Theirs" }));
    const theirs = await prisma.shelf.findFirstOrThrow({ where: { userId: otherUserId } });
    currentUserId = userId;
    expect((await createSmartShelf("C", `shelfId=${theirs.id}`)).error).toMatch(/gone/);
  });

  it("changes rules and names, and never another reader's shelf", async () => {
    const res = await createSmartShelf("A", "tag=x");
    expect(await updateSmartShelfRules(res.id!, "tag=y&sort=title")).toEqual({ id: res.id });
    expect((await prisma.smartShelf.findUniqueOrThrow({ where: { id: res.id } })).rules).toBe("tag=y");
    expect(await renameSmartShelf(res.id!, "Renamed")).toEqual({ name: "Renamed" });
    await createShelf({}, formData({ name: "Mine" }));
    expect((await renameSmartShelf(res.id!, "mine")).error).toMatch(/shelf called “Mine”/);
    currentUserId = otherUserId;
    expect((await updateSmartShelfRules(res.id!, "tag=z")).error).toBeDefined();
    expect((await renameSmartShelf(res.id!, "Stolen")).error).toBeDefined();
    await deleteSmartShelf(res.id!);
    currentUserId = userId;
    expect(await prisma.smartShelf.count({ where: { id: res.id } })).toBe(1);
  });

  it("starts a draft for a new shelf or an existing one", async () => {
    expect(await startSmartShelfDraft({ name: "New one" })).toEqual({});
    expect(parseDraft(jar.get(DRAFT_COOKIE))).toEqual({ id: null, name: "New one" });
    const res = await createSmartShelf("Old one", "tag=x");
    expect(await startSmartShelfDraft({ id: res.id })).toEqual({ rules: "tag=x" });
    expect(parseDraft(jar.get(DRAFT_COOKIE))).toEqual({ id: res.id, name: "Old one" });
    expect((await startSmartShelfDraft({ name: "old ONE" })).error).toMatch(/smart shelf called/);
  });
});

describe("shelves of the reader's own", () => {
  it("can't take a smart shelf's name, by making or renaming", async () => {
    await createSmartShelf("Short", "pages=..300");
    expect((await createShelf({}, formData({ name: "short" }))).error).toMatch(/smart shelf called "Short"/);
    await createShelf({}, formData({ name: "Long" }));
    const long = await prisma.shelf.findFirstOrThrow({ where: { userId } });
    expect((await renameShelf(long.id, "SHORT")).error).toMatch(/smart shelf/);
  });

  it("take smart shelves along when merged", async () => {
    await createShelf({}, formData({ name: "Old" }));
    await createShelf({}, formData({ name: "New" }));
    const old = await prisma.shelf.findFirstOrThrow({ where: { userId, name: "Old" } });
    const target = await prisma.shelf.findFirstOrThrow({ where: { userId, name: "New" } });
    const res = await createSmartShelf("Old unread", `shelfId=${old.id}&shelf=WANT_TO_READ`);
    expect((await renameShelf(old.id, "New")).merged).toBe(true);
    expect((await prisma.smartShelf.findUniqueOrThrow({ where: { id: res.id } })).rules).toBe(
      `shelf=WANT_TO_READ&shelfId=${target.id}`,
    );
  });
});

describe("challenges", () => {
  it("count a smart shelf's books, and go with it", async () => {
    await add("Short read", { pageCount: 200, status: READ, dateFinished: new Date() });
    const res = await createSmartShelf("Short", "pages=..300");
    const year = new Date().getUTCFullYear();
    const saved = await createChallenge(
      {},
      formData({ source: `shelf:${res.id}`, sourceName: "Short", year: String(year), target: "3" }),
    );
    expect(saved.error).toBeUndefined();
    const challenge = await prisma.challenge.findFirstOrThrow({ where: { userId } });
    expect(new URLSearchParams(challenge.query).get("shelfId")).toBe(res.id);
    await deleteSmartShelf(res.id!);
    expect(await prisma.challenge.count({ where: { userId } })).toBe(0);
  });
});

describe("backups", () => {
  it("bring smart shelves back, pointed at the shelves and challenges they had", async () => {
    await createShelf({}, formData({ name: "Fantasy" }));
    const fantasy = await prisma.shelf.findFirstOrThrow({ where: { userId } });
    await add("Hobbit", { status: WTR, shelves: { connect: { id: fantasy.id } } });
    const onShelf = await createSmartShelf("Fantasy to read", `shelfId=${fantasy.id}&shelf=WANT_TO_READ`);
    const short = await createSmartShelf("Short", "pages=..300");
    const year = new Date().getUTCFullYear();
    await createChallenge(
      {},
      formData({ source: `shelf:${short.id}`, sourceName: "Short", year: String(year), target: "3" }),
    );
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: { shelfOrder: [short.id!, fantasy.id], hiddenShelves: [onShelf.id!] } },
    });

    const res = await exportRoute();
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    const payload = JSON.parse(await zip.file("library.json")!.async("string"));
    expect(payload.smartShelves).toEqual([
      { name: "Fantasy to read", rules: `shelf=WANT_TO_READ&shelfId=${fantasy.id}`, shelfName: "Fantasy" },
      { name: "Short", rules: "pages=..300" },
    ]);
    // An older MyReads sees no new shelves.
    expect(payload.shelves.map((s: { name: string }) => s.name)).toEqual(["Fantasy"]);

    const summary = await importLibrary(otherUserId, payload);
    expect(summary).toMatchObject({ smartShelvesRestored: 2, challengesRestored: 1 });
    const [newFantasy, restored, challenge, user] = await Promise.all([
      prisma.shelf.findFirstOrThrow({ where: { userId: otherUserId } }),
      prisma.smartShelf.findMany({ where: { userId: otherUserId }, orderBy: { name: "asc" } }),
      prisma.challenge.findFirstOrThrow({ where: { userId: otherUserId } }),
      prisma.user.findUniqueOrThrow({ where: { id: otherUserId } }),
    ]);
    expect(restored.map((s) => [s.name, s.rules])).toEqual([
      ["Fantasy to read", `shelf=WANT_TO_READ&shelfId=${newFantasy.id}`],
      ["Short", "pages=..300"],
    ]);
    expect(new URLSearchParams(challenge.query).get("shelfId")).toBe(restored[1].id);
    expect(user.preferences).toMatchObject({
      shelfOrder: [restored[1].id, newFantasy.id],
      hiddenShelves: [restored[0].id],
    });

    // Again: nothing doubles.
    const again = await importLibrary(otherUserId, payload);
    expect(again).toMatchObject({ smartShelvesRestored: 0 });
  });

  it("leave out a smart shelf whose shelf can't be found", async () => {
    const summary = await importLibrary(otherUserId, {
      format: "myreads-export",
      version: 1,
      shelves: [],
      readingGoals: [],
      books: [],
      smartShelves: [
        { name: "Lost", rules: "shelfId=abc&tag=x", shelfName: "Nowhere" },
        { name: "Empty", rules: "sort=title" },
        { name: "Kept", rules: "tag=x&sort=title" },
      ],
    });
    expect(summary).toMatchObject({ smartShelvesRestored: 1 });
    expect(await prisma.smartShelf.findMany({ where: { userId: otherUserId }, select: { name: true, rules: true } }))
      .toEqual([{ name: "Kept", rules: "tag=x" }]);
  });
});
