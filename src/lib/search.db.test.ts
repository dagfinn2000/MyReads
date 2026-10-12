import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildBookWhere, parseFilters } from "@/lib/library-filters";
import { resolveBookWhere } from "@/lib/library-where";
import type { SearchField } from "@/lib/preferences";
import { buildSearchText, foldForSearch } from "@/lib/utils";

/**
 * Library search against a real database: the words, accents and LIKE
 * wildcards are all about what Postgres does with the pattern, which a fake
 * would only guess at.
 */
const prisma = new PrismaClient();

let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { username: `srch-${Date.now()}-${Math.random()}`, passwordHash: "x" },
  });
  userId = user.id;
  const books: [string, string[]][] = [
    ["The Hobbit", ["J.R.R. Tolkien"]],
    ["Jane Eyre", ["Charlotte Brontë"]],
    ["Lykkeland", ["Bjørn Olav Nordahl"]],
    ["100% Cotton", ["Some Author"]],
    ["Harry Potter and the Philosopher's Stone", ["J.K. Rowling"]],
  ];
  await prisma.book.createMany({
    data: books.map(([title, authors]) => ({
      userId,
      title,
      authors,
      searchText: buildSearchText(title, authors, null),
    })),
  });
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

async function search(q: string): Promise<string[]> {
  const where = buildBookWhere(userId, parseFilters({ q }));
  const rows = await prisma.book.findMany({ where, select: { title: true }, orderBy: { title: "asc" } });
  return rows.map((r) => r.title);
}

describe("library search", () => {
  it("ignores spaces around the query", async () => {
    expect(await search("   harry   ")).toEqual(["Harry Potter and the Philosopher's Stone"]);
  });

  it("matches each word anywhere in title, authors or series", async () => {
    expect(await search("tolkien hobbit")).toEqual(["The Hobbit"]);
    expect(await search("tolkien eyre")).toEqual([]);
  });

  it("ignores accents on either side", async () => {
    expect(await search("bronte")).toEqual(["Jane Eyre"]);
    expect(await search("Brontë")).toEqual(["Jane Eyre"]);
    expect(await search("bjorn")).toEqual(["Lykkeland"]);
  });

  it("treats % and _ as plain characters", async () => {
    expect(await search("%")).toEqual(["100% Cotton"]);
    expect(await search("_")).toEqual([]);
  });

  it("survives a null byte in the URL", async () => {
    // Postgres refuses \0 in text; the page used to crash on ?tag=%00.
    const where = buildBookWhere(userId, parseFilters({ tag: "\0", q: "hob\0bit" }));
    await expect(prisma.book.count({ where })).resolves.toBe(1);
  });
});

describe("searching tags, ISBN and reviews too", () => {
  /** Search as the reader with these Preferences would. */
  async function searchIn(q: string, fields: SearchField[]): Promise<string[]> {
    const where = await resolveBookWhere(userId, parseFilters({ q }), {
      searchAlsoIn: fields,
      timeZone: "UTC",
    });
    const rows = await prisma.book.findMany({ where, select: { title: true }, orderBy: { title: "asc" } });
    return rows.map((r) => r.title);
  }

  beforeEach(async () => {
    const set = (title: string, data: object) =>
      prisma.book.updateMany({ where: { userId, title }, data });
    await set("The Hobbit", { tags: ["fantasy", "æventyr"], isbn: "9780261102217" });
    // Saved the way updateReading and import save a review: with its
    // folded copy, which is what search reads.
    const review = (text: string) => ({ review: text, reviewSearchText: foldForSearch(text) });
    await set("Jane Eyre", review("ÆRØ ÉMILE, all in capitals"));
    await set("Lykkeland", { ...review("Better than anything by a Brontë."), isbn: "080442957x" });
    await set("100% Cotton", { isbn: "9781984000000", ...review("Half_way there") });
  });

  it("looks only where it always has until asked", async () => {
    expect(await searchIn("fantasy", [])).toEqual([]);
    expect(await searchIn("better", [])).toEqual([]);
    expect(await searchIn("9780261102217", [])).toEqual([]);
  });

  it("finds tags, accents folded", async () => {
    expect(await searchIn("fantasy", ["tags"])).toEqual(["The Hobbit"]);
    expect(await searchIn("aeventyr", ["tags"])).toEqual(["The Hobbit"]);
    expect(await searchIn("Æventyr", ["tags"])).toEqual(["The Hobbit"]);
  });

  it("still wants every word to match somewhere", async () => {
    expect(await searchIn("tolkien fantasy", ["tags"])).toEqual(["The Hobbit"]);
    expect(await searchIn("rowling fantasy", ["tags"])).toEqual([]);
  });

  it("finds reviews, accents and capitals folded either way", async () => {
    // Jane Eyre by its author, Lykkeland by its review.
    expect(await searchIn("bronte", ["review"])).toEqual(["Jane Eyre", "Lykkeland"]);
    expect(await searchIn("Brontë better", ["review"])).toEqual(["Lykkeland"]);
    expect(await searchIn("aero emile", ["review"])).toEqual(["Jane Eyre"]);
  });

  it("treats % and _ in a review as plain characters", async () => {
    expect(await searchIn("half_way", ["review"])).toEqual(["100% Cotton"]);
    expect(await searchIn("half%way", ["review"])).toEqual([]);
  });

  it("finds an ISBN however it's typed", async () => {
    for (const q of ["9780261102217", "978-0-261-10221-7", "978 0 261 10221 7", "0261102214", "0-261"]) {
      expect(await searchIn(q, ["isbn"]), q).toEqual(["The Hobbit"]);
    }
    // Stored with a lowercase check digit.
    expect(await searchIn("080442957X", ["isbn"])).toEqual(["Lykkeland"]);
    expect(await searchIn("9780804429573", ["isbn"])).toEqual(["Lykkeland"]);
  });

  it("doesn't take a year for part of an ISBN", async () => {
    expect(await searchIn("1984", ["isbn"])).toEqual([]);
  });

  it("never matches another reader's tags or reviews", async () => {
    const other = await prisma.user.create({
      data: { username: `srch-o-${Date.now()}-${Math.random()}`, passwordHash: "x" },
    });
    try {
      await prisma.book.create({
        data: {
          userId: other.id,
          title: "Theirs",
          searchText: "theirs",
          tags: ["secret-tag"],
          review: "secret words",
          reviewSearchText: "secret words",
          isbn: "9780000000002",
        },
      });
      expect(await searchIn("secret", ["tags", "review", "isbn"])).toEqual([]);
      expect(await searchIn("9780000000002", ["tags", "review", "isbn"])).toEqual([]);
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });

  it("matches reviews in SQL, without reading them first", async () => {
    // However many reviews match, the search is one condition per word.
    const where = await resolveBookWhere(userId, parseFilters({ q: "bronte better" }), {
      searchAlsoIn: ["review"],
      timeZone: "UTC",
    });
    expect(where.AND).toEqual([
      { OR: [{ searchText: { contains: "bronte" } }, { reviewSearchText: { contains: "bronte" } }] },
      { OR: [{ searchText: { contains: "better" } }, { reviewSearchText: { contains: "better" } }] },
    ]);
  });
});

describe("accent_insensitive_search migration", () => {
  it("folds stored searchText exactly as buildSearchText does", async () => {
    // Rows as the previous version stored them: lowercased, accents intact.
    const titles: [string, string[], string | null][] = [
      ["Jane Eyre", ["Charlotte Brontë"], "Brontë Novels"],
      ["Straße der Ölsardinen", ["Łukasz Þórsson"], null],
      ["Ærø og Œuvre", ["Đặng Thùy Trâm"], null],
      ["がっこう", ["김영하"], null],
    ];
    const created = await Promise.all(
      titles.map(([title, authors, series]) =>
        prisma.book.create({
          data: {
            userId,
            title,
            authors,
            seriesName: series,
            searchText: [title, ...authors, series ?? ""].join(" ").trim().toLowerCase(),
          },
        }),
      ),
    );

    const sql = await fs.readFile(
      path.join(__dirname, "../../prisma/migrations/20261011000000_accent_insensitive_search/migration.sql"),
      "utf8",
    );
    await prisma.$executeRawUnsafe(sql);

    for (const [i, [title, authors, series]] of titles.entries()) {
      const row = await prisma.book.findUniqueOrThrow({ where: { id: created[i].id } });
      expect(row.searchText, title).toBe(buildSearchText(title, authors, series));
    }
  });
});

describe("review_search_text migration", () => {
  it("folds stored reviews exactly as foldForSearch does", async () => {
    // Capitals the database's own lower() may not know, and a final sigma.
    const reviews = [
      "ÉMILE BRONTË, ÆRØ ŒUVRE",
      "Straße der Ölsardinen, ŁUKASZ ÞÓRSSON, ĐẶNG THÙY TRÂM",
      "ΟΔΟΣ and İstanbul",
      "がっこう 김영하",
    ];
    const created = await Promise.all(
      reviews.map((review) =>
        prisma.book.create({ data: { userId, title: "Reviewed", review } }),
      ),
    );
    const unreviewed = await prisma.book.create({ data: { userId, title: "Unreviewed" } });

    const sql = await fs.readFile(
      path.join(__dirname, "../../prisma/migrations/20261012010000_review_search_text/migration.sql"),
      "utf8",
    );
    // The backfill only: the column is there already.
    await prisma.$executeRawUnsafe(sql.slice(sql.indexOf("DO $do$")));

    for (const [i, review] of reviews.entries()) {
      const row = await prisma.book.findUniqueOrThrow({ where: { id: created[i].id } });
      expect(row.reviewSearchText, review).toBe(foldForSearch(review));
    }
    const row = await prisma.book.findUniqueOrThrow({ where: { id: unreviewed.id } });
    expect(row.reviewSearchText).toBe("");
  });
});
