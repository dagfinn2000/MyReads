import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * The settings actions against a real database. Each one merges a few keys
 * into a JSON column with SQL, so the things worth pinning down are that a
 * save leaves the other keys alone, that only real settings get written,
 * and that saved views stay with their owner.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { savePreferences } = await import("@/lib/actions/preferences");
const { saveLibraryView } = await import("@/lib/actions/library-view");
const { saveView, deleteView } = await import("@/lib/actions/saved-views");
const { setReadingGoal } = await import("@/lib/actions/goals");

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `prf-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `prf-oth-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

async function storedPreferences(id = userId) {
  return (await prisma.user.findUniqueOrThrow({ where: { id } })).preferences;
}

describe("savePreferences", () => {
  it("merges each save into what is already stored", async () => {
    await savePreferences({ dateFormat: "iso" });
    await savePreferences({ ratingStyle: "ten" });
    expect(await storedPreferences()).toEqual({ dateFormat: "iso", ratingStyle: "ten" });
  });

  it("writes only real settings, made valid", async () => {
    await savePreferences({
      textSize: "enormous",
      isAdmin: true,
    } as unknown as Parameters<typeof savePreferences>[0]);
    expect(await storedPreferences()).toEqual({ textSize: "normal" });
  });

  it("stores only the Find it at links that are safe, and every book-page card", async () => {
    await savePreferences({
      findLinks: [
        { name: "Sneaky", url: "javascript:alert(1)" },
        { name: " Library ", url: " https://lib.example/search?q={isbn} " },
        { name: "Unknown", url: "https://lib.example/?q={publisher}" },
      ],
      bookPageCards: ["quotes", "bogus"],
    } as unknown as Parameters<typeof savePreferences>[0]);
    expect(await storedPreferences()).toEqual({
      findLinks: [{ name: "Library", url: "https://lib.example/search?q={isbn}" }],
      bookPageCards: ["quotes", "shelves", "reading", "history", "lending"],
    });
  });

  it("changes only the signed-in account", async () => {
    await savePreferences({ weekStart: "sunday" });
    expect(await storedPreferences(otherUserId)).toBeNull();
  });
});

describe("saveLibraryView", () => {
  it("keeps the sort when the display changes, and the other way round", async () => {
    await saveLibraryView({ sort: "title", dir: "asc" });
    await saveLibraryView({ layout: "list", showRating: false });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.libraryView).toEqual({
      sort: "title",
      dir: "asc",
      layout: "list",
      showRating: false,
    });
  });
});

describe("saved views", () => {
  it("stores the view's query in canonical form", async () => {
    const { id } = await saveView("Fantasy", "sort=title&tag=fantasy&limit=999");
    const view = await prisma.savedView.findUniqueOrThrow({ where: { id } });
    // No direction given: titles open A to Z, as the library would show them.
    expect(view.query).toBe("tag=fantasy&group=none&sort=title&dir=asc");
  });

  it("replaces a view saved again under the same name", async () => {
    const first = await saveView("Next up", "shelf=WANT_TO_READ");
    const second = await saveView("Next up", "shelf=READING");
    expect(second.id).toBe(first.id);
    const views = await prisma.savedView.findMany({ where: { userId } });
    expect(views).toHaveLength(1);
    expect(views[0].query).toContain("shelf=READING");
  });

  it("refuses an empty name", async () => {
    expect(await saveView("   ", "")).toHaveProperty("error");
    expect(await prisma.savedView.count({ where: { userId } })).toBe(0);
  });

  it("opens the plain library again when the default view is deleted", async () => {
    const { id } = await saveView("Next up", "shelf=WANT_TO_READ");
    await savePreferences({ defaultViewId: id, dateFormat: "iso" });

    await deleteView(id!);
    expect(await prisma.savedView.count({ where: { userId } })).toBe(0);
    expect(await storedPreferences()).toEqual({ defaultViewId: "", dateFormat: "iso" });
  });

  it("can't delete someone else's view", async () => {
    const theirs = await prisma.savedView.create({
      data: { userId: otherUserId, name: "Theirs", query: "group=none&sort=title&dir=asc" },
    });
    await deleteView(theirs.id);
    expect(await prisma.savedView.count({ where: { id: theirs.id } })).toBe(1);
  });
});

describe("setReadingGoal", () => {
  function goalForm(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  it("saves a pages goal that leaves out re-reads", async () => {
    await setReadingGoal(goalForm({ year: "2026", target: "8000", unit: "PAGES" }));
    const goal = await prisma.readingGoal.findFirstOrThrow({ where: { userId } });
    expect(goal).toMatchObject({ target: 8000, unit: "PAGES", countRereads: false });
  });

  it("falls back to a book count for an unknown unit", async () => {
    await setReadingGoal(
      goalForm({ year: "2026", target: "12", unit: "CHAPTERS", countRereads: "on" }),
    );
    const goal = await prisma.readingGoal.findFirstOrThrow({ where: { userId } });
    expect(goal).toMatchObject({ target: 12, unit: "BOOKS", countRereads: true });
  });
});
