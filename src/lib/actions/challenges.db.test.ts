import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Challenges against a real database: made from a tag, a shelf or a saved
 * view in the reader's own account, renamed, retargeted and deleted, and
 * never anyone else's. Also which books each one's slice holds.
 */

const prisma = new PrismaClient();

let currentUserId: string | null = null;
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId ? { user: { id: currentUserId } } : null),
  signOut: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { createChallenge, deleteChallenge, updateChallenge } = await import(
  "@/lib/actions/challenges"
);
const { challengeMatches } = await import("@/lib/challenges-query");
const { DEFAULT_PREFERENCES } = await import("@/lib/preferences");

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `chal-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `chal-oth-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
  currentUserId = userId;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const challenges = (id = userId) =>
  prisma.challenge.findMany({
    where: { userId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, year: true, target: true, query: true },
  });

describe("createChallenge", () => {
  it("makes one from a tag, named after it when no name is given", async () => {
    const res = await createChallenge(
      {},
      form({ source: "tag:classics", sourceName: "Classics", target: "6", year: "2026", name: "" }),
    );
    expect(res).toEqual({ saved: true });
    expect(await challenges()).toMatchObject([
      { name: "Classics", year: 2026, target: 6, query: "tag=classics" },
    ]);
  });

  it("makes one from a shelf or a saved view in the reader's own account", async () => {
    const shelf = await prisma.shelf.create({ data: { userId, name: "Bedside" } });
    const view = await prisma.savedView.create({
      data: {
        userId,
        name: "Short sci-fi",
        query: "tag=sci-fi&format=EBOOK&group=none&sort=title&dir=asc",
      },
    });
    await createChallenge(
      {},
      form({ source: `shelf:${shelf.id}`, target: "4", year: "2026", name: "Clear it" }),
    );
    await createChallenge(
      {},
      form({ source: `view:${view.id}`, target: "3", year: "2027", sourceName: "Short sci-fi" }),
    );
    expect(await challenges()).toMatchObject([
      { name: "Clear it", query: `shelfId=${shelf.id}` },
      { name: "Short sci-fi", year: 2027, query: "tag=sci-fi&format=EBOOK" },
    ]);
  });

  it("refuses someone else's shelf or view, and anything it can't read", async () => {
    const shelf = await prisma.shelf.create({ data: { userId: otherUserId, name: "Theirs" } });
    const view = await prisma.savedView.create({
      data: { userId: otherUserId, name: "Theirs", query: "tag=x" },
    });
    const sources = [`shelf:${shelf.id}`, `view:${view.id}`, "tag:", "tag:a,b", "nope:1", ""];
    for (const source of sources) {
      expect(
        await createChallenge({}, form({ source, target: "4", year: "2026" })),
        source,
      ).toEqual({ error: "Pick which books count." });
    }
    for (const target of ["0", "1001", "abc", ""]) {
      expect(
        await createChallenge({}, form({ source: "tag:x", target, year: "2026" })),
        target,
      ).toEqual({ error: "Pick how many books, from 1 to 1000." });
    }
    expect(await challenges()).toEqual([]);
  });

  it("stops at the cap", async () => {
    await prisma.challenge.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId,
        name: `C${i}`,
        year: 2026,
        target: 1,
        query: "",
      })),
    });
    expect(await createChallenge({}, form({ source: "tag:x", target: "1", year: "2026" }))).toEqual({
      error: "You can keep up to 50 challenges.",
    });
  });

  it("refuses without a session", async () => {
    currentUserId = null;
    await expect(
      createChallenge({}, form({ source: "tag:x", target: "1", year: "2026" })),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("updateChallenge and deleteChallenge", () => {
  it("change only the reader's own challenge", async () => {
    const [mine, theirs] = await Promise.all([
      prisma.challenge.create({ data: { userId, name: "Mine", year: 2026, target: 3, query: "" } }),
      prisma.challenge.create({
        data: { userId: otherUserId, name: "Theirs", year: 2026, target: 3, query: "" },
      }),
    ]);

    expect(await updateChallenge(mine.id, "  Renamed  ", 5)).toBeUndefined();
    expect(await updateChallenge(theirs.id, "Hijacked", 5)).toBe("Challenge not found");
    expect(await updateChallenge(mine.id, " ", 5)).toBe("Give it a name.");
    expect(await updateChallenge(mine.id, "Ok", 0)).toBe("Pick how many books, from 1 to 1000.");
    // A client can send anything as the id.
    expect(await updateChallenge({ not: "" } as unknown as string, "x", 1)).toBe(
      "Challenge not found",
    );
    expect(await challenges()).toMatchObject([{ name: "Renamed", target: 5 }]);

    await deleteChallenge(theirs.id);
    await deleteChallenge({ not: "" } as unknown as string);
    expect(await challenges(otherUserId)).toHaveLength(1);
    await deleteChallenge(mine.id);
    expect(await challenges()).toEqual([]);
  });
});

describe("challengeMatches", () => {
  it("finds the books in each slice, only ever the reader's own", async () => {
    const shelf = await prisma.shelf.create({ data: { userId, name: "Bedside" } });
    const [classic, onShelf] = await Promise.all([
      prisma.book.create({
        data: {
          userId,
          title: "Persuasion",
          authors: ["Austen"],
          tags: ["classics"],
          searchText: "persuasion austen",
        },
      }),
      prisma.book.create({
        data: {
          userId,
          title: "Piranesi",
          authors: ["Clarke"],
          searchText: "piranesi clarke",
          shelves: { connect: { id: shelf.id } },
        },
      }),
      prisma.book.create({
        data: {
          userId: otherUserId,
          title: "Emma",
          authors: ["Austen"],
          tags: ["classics"],
          searchText: "emma austen",
        },
      }),
    ]);
    const matches = await challengeMatches(
      userId,
      [
        { id: "a", query: "tag=classics" },
        { id: "b", query: `shelfId=${shelf.id}` },
      ],
      DEFAULT_PREFERENCES,
    );
    expect([...matches.get("a")!]).toEqual([classic.id]);
    expect([...matches.get("b")!]).toEqual([onShelf.id]);
  });
});
