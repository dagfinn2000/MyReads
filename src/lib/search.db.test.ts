import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildBookWhere, parseFilters } from "@/lib/library-filters";
import { buildSearchText } from "@/lib/utils";

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
