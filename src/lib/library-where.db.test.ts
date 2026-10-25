import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BookOwnership, ReadingStatus } from "@/lib/enums";
import { parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";
import type { Preferences } from "@/lib/preferences";

/**
 * The library's filters against a real database: array containment on tags,
 * a year's finishes across time zones and archived reads, and every lookup
 * kept to the reader's own books.
 */

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { username: `whr-${stamp}`, passwordHash: "x" } }),
    prisma.user.create({ data: { username: `wh2-${stamp}`, passwordHash: "x" } }),
  ]);
  userId = a.id;
  otherUserId = b.id;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

function add(title: string, data: Partial<Prisma.BookUncheckedCreateInput> = {}, owner = userId) {
  return prisma.book.create({
    data: { userId: owner, title, searchText: title.toLowerCase(), ...data },
  });
}

async function titles(
  sp: Record<string, string>,
  prefs: Pick<Preferences, "searchAlsoIn" | "timeZone"> = { searchAlsoIn: [], timeZone: "UTC" },
): Promise<string[]> {
  const where = await resolveBookWhere(userId, parseFilters(sp), prefs);
  const rows = await prisma.book.findMany({ where, select: { title: true }, orderBy: { title: "asc" } });
  return rows.map((r) => r.title);
}

const READ = ReadingStatus.READ;

describe("Finished in", () => {
  it("files a late-night finish in the reader's own year", async () => {
    await add("New Year's Eve", { status: READ, dateFinished: new Date("2025-12-31T23:30:00Z") });
    const oslo = { searchAlsoIn: [], timeZone: "Europe/Oslo" };
    expect(await titles({ finished: "2026" }, oslo)).toEqual(["New Year's Eve"]);
    expect(await titles({ finished: "2025" }, oslo)).toEqual([]);
    expect(await titles({ finished: "2025" })).toEqual(["New Year's Eve"]);
  });

  it("keeps a date typed into a field on that day everywhere", async () => {
    await add("Typed", { status: READ, dateFinished: new Date("2026-01-01T00:00:00Z") });
    const ny = { searchAlsoIn: [], timeZone: "America/New_York" };
    expect(await titles({ finished: "2026" }, ny)).toEqual(["Typed"]);
    expect(await titles({ finished: "2025" }, ny)).toEqual([]);
  });

  it("counts re-reads, but not a date left on a book that isn't Read", async () => {
    const reread = await add("Re-read", { status: ReadingStatus.READING });
    await prisma.read.create({ data: { bookId: reread.id, dateFinished: new Date("2024-05-01T00:00:00Z") } });
    // Near New Year too, so the edge lookup has to find it.
    const late = await add("Late re-read", { status: ReadingStatus.WANT_TO_READ });
    await prisma.read.create({ data: { bookId: late.id, dateFinished: new Date("2024-12-31T20:00:00Z") } });
    await add("Stale", { status: ReadingStatus.WANT_TO_READ, dateFinished: new Date("2024-05-01T00:00:00Z") });
    await add("Mid-year", { status: READ, dateFinished: new Date("2024-07-14T18:00:00Z") });

    expect(await titles({ finished: "2024" })).toEqual(["Late re-read", "Mid-year", "Re-read"]);
    // On the Currently Reading tab, the archived pass still counts.
    expect(await titles({ finished: "2024", shelf: "READING" })).toEqual(["Re-read"]);
  });

  it("never finds another reader's books", async () => {
    await add("Theirs", { status: READ, dateFinished: new Date("2024-01-01T02:00:00Z") }, otherUserId);
    const theirs = await add("Their re-read", {}, otherUserId);
    await prisma.read.create({ data: { bookId: theirs.id, dateFinished: new Date("2024-12-31T23:00:00Z") } });
    expect(await titles({ finished: "2024" })).toEqual([]);
  });
});

describe("tags, author, rating and missing details", () => {
  beforeEach(async () => {
    await add("Fantasy classic", { tags: ["fantasy", "classic"], status: READ, rating: 8 });
    await add("Just fantasy", { tags: ["fantasy"], status: READ });
    await add("Horror", { tags: ["horror"], status: ReadingStatus.WANT_TO_READ });
    await add("Untagged", {
      authors: ["Ursula K. Le Guin"],
      status: ReadingStatus.DNF,
      coverUrl: "",
      pageCount: 0,
      isbn: "",
    });
    await add("Other's fantasy", { tags: ["fantasy"] }, otherUserId);
  });

  it("matches tags any, all or not", async () => {
    expect(await titles({ tag: "fantasy,horror" })).toEqual(["Fantasy classic", "Horror", "Just fantasy"]);
    expect(await titles({ tag: "fantasy,classic", tagMatch: "all" })).toEqual(["Fantasy classic"]);
    expect(await titles({ tag: "fantasy", notTag: "classic" })).toEqual(["Just fantasy"]);
    expect(await titles({ notTag: "fantasy,horror" })).toEqual(["Untagged"]);
  });

  it("matches the author exactly", async () => {
    expect(await titles({ author: "Ursula K. Le Guin" })).toEqual(["Untagged"]);
    expect(await titles({ author: "Le Guin" })).toEqual([]);
  });

  it("lists unrated books that aren't on Want to Read, keeping the tab", async () => {
    expect(await titles({ minRating: "unrated" })).toEqual(["Just fantasy", "Untagged"]);
    expect(await titles({ minRating: "unrated", shelf: "READ" })).toEqual(["Just fantasy"]);
  });

  it("finds books missing a detail, empty or zero counting as missing", async () => {
    // Every fixture but "Untagged" has a null cover, page count and ISBN.
    expect(await titles({ missing: "cover" })).toHaveLength(4);
    expect(await titles({ missing: "pages", tag: "horror" })).toEqual(["Horror"]);
    expect(await titles({ missing: "isbn", author: "Ursula K. Le Guin" })).toEqual(["Untagged"]);
    expect(await titles({ missing: "tags" })).toEqual(["Untagged"]);
    await prisma.book.updateMany({
      where: { userId },
      data: { coverUrl: "/api/covers/x.jpg", pageCount: 100, isbn: "9780261102217" },
    });
    expect(await titles({ missing: "cover" })).toEqual([]);
    expect(await titles({ missing: "pages" })).toEqual([]);
    expect(await titles({ missing: "isbn" })).toEqual([]);
  });

  it("ignores an ownership value it doesn't know", async () => {
    await prisma.book.updateMany({ where: { userId, title: "Horror" }, data: { ownership: BookOwnership.WISHLIST } });
    expect(await titles({ owned: "constructor" })).toHaveLength(4);
    expect(await titles({ owned: "wishlist" })).toEqual(["Horror"]);
  });
});

describe("Overdue", () => {
  it("lists lent books past their due day, by the reader's day", async () => {
    const late = await add("Late");
    const today = await add("Due today");
    const undated = await add("No due date");
    const returned = await add("Back already");
    await add("Never lent");
    const now = Date.now();
    const day = (offset: number) =>
      new Date(new Date(now + offset * 86_400_000).toISOString().slice(0, 10));
    await prisma.loan.createMany({
      data: [
        { bookId: late.id, borrower: "Kari", dueAt: day(-3) },
        { bookId: today.id, borrower: "Ola", dueAt: day(0) },
        { bookId: undated.id, borrower: "Per" },
        { bookId: returned.id, borrower: "Liv", dueAt: day(-9), returnedAt: day(-1) },
      ],
    });
    // Another reader's overdue loan never shows.
    const theirs = await add("Theirs", {}, otherUserId);
    await prisma.loan.create({ data: { bookId: theirs.id, borrower: "Kari", dueAt: day(-3) } });

    expect(await titles({ owned: "overdue" })).toEqual(["Late"]);
    expect(await titles({ owned: "lent" })).toEqual(["Due today", "Late", "No due date"]);
  });
});
