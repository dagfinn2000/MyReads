import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, ReadingStatus } from "@prisma/client";
import { importLibrary } from "@/lib/import";

/**
 * Restore is the one path that can quietly mangle a library: it decides which
 * books are duplicates, materializes read history, and rebuilds relations.
 * It had no tests at all. These run against a real Postgres because the
 * failures worth catching — unique constraints, cascades, nested creates —
 * are exactly the ones a hand-written fake would reproduce faithfully and
 * wrongly.
 */
const prisma = new PrismaClient();

let userId: string;

/** A minimal valid export payload; `books` are merged over the defaults. */
function payload(books: unknown[], extra: Record<string, unknown> = {}) {
  return { format: "myreads-export", version: 1, books, ...extra };
}

function book(over: Record<string, unknown> = {}) {
  return {
    title: "The Final Empire",
    authors: ["Brandon Sanderson"],
    isbn: "9780765311788",
    pageCount: 541,
    tags: ["fantasy"],
    format: "PHYSICAL",
    ownership: "OWNED",
    status: "READ",
    rating: 9,
    timesRead: 1,
    shelves: [],
    quotes: [],
    reads: [],
    progress: [],
    ...over,
  };
}

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { username: `imp-${Date.now()}-${Math.random()}`, passwordHash: "x" },
  });
  userId = user.id;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("importLibrary", () => {
  it("rejects anything that isn't a MyReads export", async () => {
    for (const bad of [{}, { format: "other", version: 1, books: [] }, null, 42]) {
      const res = await importLibrary(userId, bad);
      expect(res).toHaveProperty("error");
    }
  });

  it("restores a book with its quotes, reads and progress", async () => {
    const res = await importLibrary(
      userId,
      payload([
        book({
          quotes: [{ text: "Life before death.", page: 42, note: "oath" }],
          reads: [{ dateFinished: "2019-05-01T00:00:00.000Z", rating: 8, note: "Read aloud" }],
          lengthMinutes: 1475,
          progress: [{ page: 100, date: "2026-01-02T10:00:00.000Z" }],
          timesRead: 2,
        }),
      ]),
    );

    expect(res).toMatchObject({
      booksCreated: 1,
      booksSkipped: 0,
      booksInvalid: 0,
      quotesRestored: 1,
      readsRestored: 1,
      progressRestored: 1,
    });

    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { quotes: true, reads: true, progress: true },
    });
    expect(saved.title).toBe("The Final Empire");
    expect(saved.quotes[0].text).toBe("Life before death.");
    expect(saved.reads[0].rating).toBe(8);
    expect(saved.reads[0].note).toBe("Read aloud");
    expect(saved.lengthMinutes).toBe(1475);
    expect(saved.progress[0].page).toBe(100);
    // Derived, not trusted from the file: one archived pass + the current one.
    expect(saved.timesRead).toBe(2);
  });

  it("splits a tag with a comma in it, which the tag filter couldn't hold", async () => {
    await importLibrary(userId, payload([book({ tags: ["Science, Fiction", "fantasy", "fantasy,"] })]));
    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect([...saved.tags].sort()).toEqual(["fantasy", "fiction", "science"]);
  });

  it("skips a book already present by ISBN, and does not duplicate it", async () => {
    await importLibrary(userId, payload([book()]));
    const second = await importLibrary(userId, payload([book({ title: "Different title" })]));

    expect(second).toMatchObject({ booksCreated: 0, booksSkipped: 1 });
    expect(await prisma.book.count({ where: { userId } })).toBe(1);
  });

  it("skips a book already present by title + first author when ISBNs differ", async () => {
    await importLibrary(userId, payload([book({ isbn: null })]));
    const second = await importLibrary(userId, payload([book({ isbn: null })]));

    expect(second).toMatchObject({ booksCreated: 0, booksSkipped: 1 });
    expect(await prisma.book.count({ where: { userId } })).toBe(1);
  });

  it("skips the second copy when one payload contains a book twice", async () => {
    // The dedup sets are updated as the payload is walked; this is the case
    // that breaks if that pass is ever parallelised.
    const res = await importLibrary(userId, payload([book(), book()]));
    expect(res).toMatchObject({ booksCreated: 1, booksSkipped: 1 });
    expect(await prisma.book.count({ where: { userId } })).toBe(1);
  });

  it("keeps two editions of one book from the same file", async () => {
    const res = await importLibrary(
      userId,
      payload([
        book(),
        book({ isbn: "9780765350381", format: "EBOOK" }),
        book({ isbn: null, format: "AUDIOBOOK" }),
        book({ isbn: null, format: "AUDIOBOOK" }),
      ]),
    );
    expect(res).toMatchObject({ booksCreated: 3, booksSkipped: 1 });
    expect(await prisma.book.count({ where: { userId } })).toBe(3);

    // And a second restore of that file still adds nothing.
    const again = await importLibrary(userId, payload([book(), book({ isbn: "9780765350381", format: "EBOOK" })]));
    expect(again).toMatchObject({ booksCreated: 0, booksSkipped: 2 });
  });

  it("is safe to re-run: a second restore of the same file adds nothing", async () => {
    const file = payload([book(), book({ title: "Mistborn 2", isbn: "9780765316882" })]);
    const first = await importLibrary(userId, file);
    const second = await importLibrary(userId, file);

    expect(first).toMatchObject({ booksCreated: 2 });
    expect(second).toMatchObject({ booksCreated: 0, booksSkipped: 2 });
    expect(await prisma.book.count({ where: { userId } })).toBe(2);
  });

  it("counts invalid books without aborting the rest of the restore", async () => {
    const res = await importLibrary(
      userId,
      payload([book(), { title: "" }, book({ title: "Elantris", isbn: "9780765350374" })]),
    );
    expect(res).toMatchObject({ booksCreated: 2, booksInvalid: 1 });
  });

  it("creates shelves referenced only by books, and links them", async () => {
    const res = await importLibrary(
      userId,
      payload([book({ shelves: ["Sanderson", "Favourites"] })], {
        shelves: [{ name: "Sanderson" }],
      }),
    );
    expect(res).toMatchObject({ booksCreated: 1 });

    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { shelves: true },
    });
    expect(saved.shelves.map((s) => s.name).sort()).toEqual(["Favourites", "Sanderson"]);
  });

  it("reuses an existing shelf rather than duplicating it", async () => {
    await prisma.shelf.create({ data: { userId, name: "Sanderson" } });
    await importLibrary(userId, payload([book({ shelves: ["Sanderson"] })]));

    expect(await prisma.shelf.count({ where: { userId, name: "Sanderson" } })).toBe(1);
  });

  it("matches an existing shelf whatever the case, as the shelf form does", async () => {
    const mine = await prisma.shelf.create({ data: { userId, name: "Favourites" } });
    const res = await importLibrary(
      userId,
      payload([book({ shelves: ["favourites", "FAVOURITES"] })], {
        shelves: [{ name: "favourites" }],
      }),
    );
    expect(res).toMatchObject({ booksCreated: 1, shelvesCreated: 0 });

    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { shelves: true },
    });
    expect(saved.shelves.map((s) => s.id)).toEqual([mine.id]);
  });

  it("takes shelf names the way the shelf form does, one at a time", async () => {
    // Trimmed, and a name past 50 characters dropped on its own: it used to
    // be created as it was, while the book lost every one of its shelves.
    const res = await importLibrary(
      userId,
      payload([book({ shelves: ["  Padded  ", "x".repeat(5000), "Kept", 7] })], {
        shelves: [{ name: "y".repeat(51) }, { name: " Listed " }, null],
      }),
    );
    expect(res).toMatchObject({ booksCreated: 1, shelvesCreated: 3 });

    const shelves = await prisma.shelf.findMany({ where: { userId }, orderBy: { name: "asc" } });
    expect(shelves.map((s) => s.name)).toEqual(["Kept", "Listed", "Padded"]);
    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { shelves: true },
    });
    expect(saved.shelves.map((s) => s.name).sort()).toEqual(["Kept", "Padded"]);
  });

  it("materializes history from timesRead when the export predates `reads`", async () => {
    // Old exports carry only a count. Three reads = the current pass plus two
    // archived ones, so timesRead stays consistent with the rows created.
    await importLibrary(userId, payload([book({ timesRead: 3, reads: [] })]));

    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { reads: true },
    });
    expect(saved.reads).toHaveLength(2);
    expect(saved.timesRead).toBe(3);
  });

  it("upserts reading goals", async () => {
    await prisma.readingGoal.create({ data: { userId, year: 2026, target: 12 } });
    await importLibrary(userId, payload([], { readingGoals: [{ year: 2026, target: 24 }] }));

    const goal = await prisma.readingGoal.findFirstOrThrow({ where: { userId, year: 2026 } });
    expect(goal.target).toBe(24);
  });

  it("clears a local cover path whose file cannot be restored", async () => {
    await importLibrary(userId, payload([book({ coverUrl: "/api/covers/gone-12345678.jpg" })]));

    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.coverUrl).toBeNull();
  });

  it("keeps a remote cover URL as-is", async () => {
    const url = "https://covers.openlibrary.org/b/id/240727-L.jpg";
    await importLibrary(userId, payload([book({ coverUrl: url })]));

    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.coverUrl).toBe(url);
  });

  it("writes a cover bundled with the backup and points the book at it", async () => {
    // Unique per run: a fixed name would be left behind in COVERS_DIR, and
    // resolveCoverUrl treats an already-present file as "nothing to restore",
    // so the assertion below would pass once and fail on every re-run against
    // the same directory.
    const name = `restored-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}.png`;
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const res = await importLibrary(
      userId,
      payload([book({ coverUrl: `/api/covers/${name}` })]),
      async (f) => (f === name ? png : null),
    );

    expect(res).toMatchObject({ coversRestored: 1 });
    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.coverUrl).toBe(`/api/covers/${name}`);
  });

  it("refuses a cover filename that isn't one the cache would produce", async () => {
    // A hand-edited backup must not be able to plant arbitrary files.
    let requested: string | null = null;
    await importLibrary(
      userId,
      payload([book({ coverUrl: "/api/covers/../../evil.sh" })]),
      async (f) => {
        requested = f;
        return new Uint8Array([1]);
      },
    );

    expect(requested).toBeNull();
    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.coverUrl).toBeNull();
  });

  it("refuses a bundled cover whose bytes are not an image", async () => {
    // Same check as /api/covers/upload: an HTML page renamed to .jpg in a
    // hand-made backup must not land in the cache.
    const name = `fake-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}.jpg`;
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const res = await importLibrary(
      userId,
      payload([book({ coverUrl: `/api/covers/${name}` })]),
      async (f) => (f === name ? html : null),
    );

    expect(res).toMatchObject({ coversRestored: 0 });
    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.coverUrl).toBeNull();
  });

  it("drops a cover URL the book form would refuse, but keeps the book", async () => {
    await importLibrary(
      userId,
      payload([
        book({ title: "A", isbn: null, coverUrl: "javascript:alert(1)" }),
        book({ title: "B", isbn: null, coverUrl: "//evil.example/x.jpg" }),
      ]),
    );

    const saved = await prisma.book.findMany({ where: { userId }, orderBy: { title: "asc" } });
    expect(saved.map((b) => [b.title, b.coverUrl])).toEqual([
      ["A", null],
      ["B", null],
    ]);
  });

  it("preserves the original date added, so library ordering survives", async () => {
    const when = "2020-03-04T05:06:07.000Z";
    await importLibrary(userId, payload([book({ createdAt: when })]));

    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.createdAt.toISOString()).toBe(when);
  });

  it("builds searchText so restored books are findable", async () => {
    await importLibrary(userId, payload([book({ seriesName: "Mistborn" })]));

    const found = await prisma.book.findFirst({
      where: { userId, searchText: { contains: "sanderson" } },
    });
    expect(found).not.toBeNull();
  });

  it("restores into the right account and cascades away with it", async () => {
    const other = await prisma.user.create({
      data: { username: `other-${Date.now()}`, passwordHash: "x" },
    });
    await importLibrary(userId, payload([book()]));

    expect(await prisma.book.count({ where: { userId: other.id } })).toBe(0);

    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.book.count({ where: { userId } })).toBe(0);
    // Recreate so afterEach's delete stays harmless.
    const revived = await prisma.user.create({
      data: { username: `imp-revived-${Date.now()}`, passwordHash: "x" },
    });
    userId = revived.id;
    await prisma.user.delete({ where: { id: other.id } });
  });

  it("normalizes ISBNs so a hyphenated duplicate is still a duplicate", async () => {
    await importLibrary(userId, payload([book({ isbn: "9780765311788" })]));
    const second = await importLibrary(
      userId,
      payload([book({ title: "Other", authors: ["X"], isbn: "978-0-7653-1178-8" })]),
    );

    expect(second).toMatchObject({ booksCreated: 0, booksSkipped: 1 });
  });

  describe("when a restore fails partway through", () => {
    /** Fails the Nth book create, delegating the rest to the real client. */
    async function failOnNthCreate(n: number) {
      const { prisma: lib } = await import("@/lib/prisma");
      const real = lib.book.create.bind(lib.book);
      let calls = 0;
      return vi
        .spyOn(lib.book, "create")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation((async (args: any) => {
          if (++calls === n) throw new Error("connection lost");
          return real(args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any);
    }

    afterEach(() => vi.restoreAllMocks());

    it("reports the restore as incomplete instead of claiming success", async () => {
      await failOnNthCreate(3);

      const res = await importLibrary(
        userId,
        payload([
          book({ title: "One", isbn: "1111111111111" }),
          book({ title: "Two", isbn: "2222222222222" }),
          book({ title: "Three", isbn: "3333333333333" }),
          book({ title: "Four", isbn: "4444444444444" }),
        ]),
      );

      expect(res).not.toHaveProperty("error");
      const summary = res as Extract<typeof res, { booksCreated: number }>;

      // The whole point: the caller must be able to tell this apart from a
      // clean run, rather than seeing a smaller number and assuming that was
      // simply all there was.
      expect(summary.incomplete).toBeDefined();
      expect(summary.incomplete?.reason).toContain("connection lost");
      expect(summary.booksCreated).toBeLessThan(4);
    });

    it("reports a count that matches what actually reached the database", async () => {
      // The number the user is told to trust when deciding whether to re-run.
      // It is read after the failure, so every sibling write must have
      // settled by then — otherwise it silently undercounts.
      await failOnNthCreate(3);

      const res = await importLibrary(
        userId,
        payload(
          Array.from({ length: 8 }, (_, i) =>
            book({ title: `Book ${i}`, isbn: `${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}` }),
          ),
        ),
      );
      const summary = res as Extract<typeof res, { booksCreated: number }>;

      const actuallyStored = await prisma.book.count({ where: { userId } });
      expect(summary.booksCreated).toBe(actuallyStored);
    });

    it("is resumable: re-running finishes the job and skips what landed", async () => {
      const file = payload([
        book({ title: "One", isbn: "1111111111111" }),
        book({ title: "Two", isbn: "2222222222222" }),
        book({ title: "Three", isbn: "3333333333333" }),
        book({ title: "Four", isbn: "4444444444444" }),
      ]);

      const spy = await failOnNthCreate(3);
      const first = (await importLibrary(userId, file)) as Extract<
        Awaited<ReturnType<typeof importLibrary>>,
        { booksCreated: number }
      >;
      expect(first.incomplete).toBeDefined();
      spy.mockRestore();

      // Same file again, nothing failing this time.
      const second = (await importLibrary(userId, file)) as Extract<
        Awaited<ReturnType<typeof importLibrary>>,
        { booksCreated: number }
      >;
      expect(second.incomplete).toBeUndefined();
      expect(second.booksSkipped).toBe(first.booksCreated);

      // Every book present exactly once — the advice to re-run must not
      // produce duplicates.
      expect(await prisma.book.count({ where: { userId } })).toBe(4);
      const titles = (await prisma.book.findMany({ where: { userId } })).map((b) => b.title);
      expect([...titles].sort()).toEqual(["Four", "One", "Three", "Two"]);
    });

    it("leaves a clean run with no incomplete marker", async () => {
      const res = await importLibrary(userId, payload([book()]));
      const summary = res as Extract<typeof res, { booksCreated: number }>;
      expect(summary.incomplete).toBeUndefined();
      expect(summary.booksCreated).toBe(1);
    });
  });

  it("restores a status other than READ without inventing history", async () => {
    await importLibrary(
      userId,
      payload([book({ status: "READING", currentPage: 120, timesRead: 0, rating: null })]),
    );

    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { reads: true },
    });
    expect(saved.status).toBe(ReadingStatus.READING);
    expect(saved.currentPage).toBe(120);
    expect(saved.timesRead).toBe(0);
    expect(saved.reads).toHaveLength(0);
  });
});

describe("ownership and lending", () => {
  it("reads the legacy `owned` boolean from an older backup", async () => {
    // Exports predating the ownership states carry only this boolean, where
    // true meant "on my shelf" and false meant "on the wishlist".
    await importLibrary(
      userId,
      payload([
        { ...book({ isbn: "1000000000001" }), ownership: undefined, owned: true },
        { ...book({ title: "Wanted", isbn: "1000000000002" }), ownership: undefined, owned: false },
      ]),
    );

    const rows = await prisma.book.findMany({ where: { userId }, orderBy: { title: "asc" } });
    expect(rows.map((b) => [b.title, b.ownership])).toEqual([
      ["The Final Empire", "OWNED"],
      ["Wanted", "WISHLIST"],
    ]);
  });

  it("prefers `ownership` when a backup carries both", async () => {
    // Current exports write both for backwards compatibility; the richer
    // field wins, so a borrowed book does not degrade to a wishlist entry.
    await importLibrary(
      userId,
      payload([{ ...book(), owned: false, ownership: "BORROWED" }]),
    );

    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.ownership).toBe("BORROWED");
  });

  it("defaults to OWNED when a backup says nothing about ownership", async () => {
    await importLibrary(userId, payload([{ ...book(), ownership: undefined }]));
    const saved = await prisma.book.findFirstOrThrow({ where: { userId } });
    expect(saved.ownership).toBe("OWNED");
  });

  it("restores lending records, open and returned", async () => {
    const res = await importLibrary(
      userId,
      payload([
        book({
          loans: [
            { borrower: "Kari", lentAt: "2026-01-05T00:00:00.000Z", returnedAt: "2026-02-01T00:00:00.000Z" },
            { borrower: "Ola", lentAt: "2026-03-01T00:00:00.000Z", returnedAt: null, note: "book club" },
          ],
        }),
      ]),
    );
    expect(res).toMatchObject({ loansRestored: 2 });

    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { loans: { orderBy: { lentAt: "asc" } } },
    });
    expect(saved.loans).toHaveLength(2);
    expect(saved.loans[0].returnedAt).not.toBeNull();
    // The still-open loan is what makes the book "lent out".
    expect(saved.loans[1].borrower).toBe("Ola");
    expect(saved.loans[1].returnedAt).toBeNull();
    expect(saved.loans[1].note).toBe("book club");
  });

  it("gives an undated loan a date rather than dropping it", async () => {
    await importLibrary(
      userId,
      payload([book({ loans: [{ borrower: "Someone" }] })]),
    );
    const saved = await prisma.book.findFirstOrThrow({
      where: { userId },
      include: { loans: true },
    });
    expect(saved.loans).toHaveLength(1);
    expect(saved.loans[0].lentAt).toBeInstanceOf(Date);
  });

  it("drops a loan with no borrower instead of failing the book", async () => {
    const res = await importLibrary(
      userId,
      payload([book({ loans: [{ borrower: "" }] })]),
    );
    // The book still lands; only the unusable loan is discarded.
    expect(res).toMatchObject({ booksCreated: 1, loansRestored: 0 });
  });
});

describe("book-page settings", () => {
  it("restores them cleaned the way a save is", async () => {
    await importLibrary(
      userId,
      payload([], {
        settings: {
          theme: null,
          defaultViewName: null,
          preferences: {
            bookPageCards: ["reading", "bogus", "reading"],
            hiddenBookPageCards: ["lending"],
            findLinks: [
              { name: "Old", url: "http://lib.example/?q={isbn}" },
              { name: "Library", url: "https://lib.example/?q={isbn}" },
            ],
          },
        },
      }),
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.preferences).toEqual({
      bookPageCards: ["reading", "shelves", "history", "lending", "quotes"],
      hiddenBookPageCards: ["lending"],
      findLinks: [{ name: "Library", url: "https://lib.example/?q={isbn}" }],
    });
  });
});

describe("saved views kept to one shelf", () => {
  const query = (shelfId: string) => `shelfId=${shelfId}&group=none&sort=title&dir=asc`;
  const restoredShelfId = async () =>
    new URLSearchParams(
      (await prisma.savedView.findFirstOrThrow({ where: { userId } })).query,
    ).get("shelfId");

  it("finds the shelf by name", async () => {
    const shelf = await prisma.shelf.create({ data: { userId, name: "Cosy" } });
    await importLibrary(
      userId,
      payload([], {
        savedViews: [{ name: "Cosy reads", query: query("old-id"), shelfName: "Cosy" }],
      }),
    );
    expect(await restoredShelfId()).toBe(shelf.id);
  });

  it("drops the shelf when no shelf here has that name", async () => {
    await importLibrary(
      userId,
      payload([], {
        savedViews: [{ name: "Cosy reads", query: query("old-id"), shelfName: "Cosy" }],
      }),
    );
    expect(await restoredShelfId()).toBeNull();
    expect(await prisma.savedView.count({ where: { userId } })).toBe(1);
  });

  it("keeps an older backup's id only when it is one of this account's shelves", async () => {
    const shelf = await prisma.shelf.create({ data: { userId, name: "Cosy" } });
    await importLibrary(
      userId,
      payload([], {
        savedViews: [
          { name: "Here", query: query(shelf.id) },
          { name: "Elsewhere", query: query("old-id") },
        ],
      }),
    );
    const views = await prisma.savedView.findMany({ where: { userId } });
    const shelfOf = (name: string) =>
      new URLSearchParams(views.find((v) => v.name === name)!.query).get("shelfId");
    expect(shelfOf("Here")).toBe(shelf.id);
    expect(shelfOf("Elsewhere")).toBeNull();
  });
});
