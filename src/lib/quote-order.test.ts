import { describe, expect, it } from "vitest";
import {
  QUOTES_MAX,
  QUOTES_PAGE_SIZE,
  comparePageOrder,
  groupQuotes,
  newSeed,
  orderQuotes,
  parseQuotesParams,
  quotesHref,
  seededShuffle,
  sliceQuoteGroups,
  type OrderableQuote,
} from "@/lib/quote-order";

const PREFS = { quotesOrder: "newest", quotesGroupByBook: false } as const;
const OPTS = { seed: 42, sort: {} };

let n = 0;
function quote(
  over: Partial<OrderableQuote> & { bookId?: string; title?: string; authors?: string[] } = {},
): OrderableQuote {
  n++;
  const { title, authors, ...rest } = over;
  return {
    id: `q${String(n).padStart(3, "0")}`,
    bookId: "b1",
    page: null,
    createdAt: new Date(Date.UTC(2026, 0, n)),
    book: { title: title ?? "Book", authors: authors ?? ["Some Author"] },
    ...rest,
  };
}

/** n quotes with distinct ids, in id order. */
function many(count: number): OrderableQuote[] {
  return Array.from({ length: count }, () => quote());
}

describe("seededShuffle", () => {
  const items = Array.from({ length: 20 }, (_, i) => `id-${i}`);
  const key = (s: string) => s;

  it("gives the same order for the same seed", () => {
    expect(seededShuffle(items, 7, key)).toEqual(seededShuffle(items, 7, key));
  });

  it("gives a different order for a different seed", () => {
    expect(seededShuffle(items, 7, key)).not.toEqual(seededShuffle(items, 8, key));
  });

  it("returns a permutation and leaves the input alone", () => {
    const copy = [...items];
    const out = seededShuffle(items, 99, key);
    expect(items).toEqual(copy);
    expect([...out].sort()).toEqual([...items].sort());
    expect(out).not.toEqual(items);
  });

  it("does not depend on the input order", () => {
    expect(seededShuffle([...items].reverse(), 5, key)).toEqual(seededShuffle(items, 5, key));
  });

  it("keeps the others in place when one item goes", () => {
    const before = seededShuffle(items, 3, key);
    const after = seededShuffle(
      items.filter((i) => i !== before[4]),
      3,
      key,
    );
    expect(after).toEqual(before.filter((i) => i !== before[4]));
  });
});

describe("newSeed", () => {
  it("stays within 1..2147483647", () => {
    for (let i = 0; i < 200; i++) {
      const s = newSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(2147483647);
    }
  });
});

describe("comparePageOrder", () => {
  it("puts paged quotes first, by page", () => {
    const a = quote({ page: 50 });
    const b = quote({ page: null });
    const c = quote({ page: 3 });
    expect([a, b, c].sort(comparePageOrder)).toEqual([c, a, b]);
  });

  it("breaks ties by date added, then id", () => {
    const t = new Date("2026-05-01T10:00:00Z");
    const early = quote({ page: 10, createdAt: new Date("2026-04-01T10:00:00Z") });
    const x = quote({ id: "x", page: 10, createdAt: t });
    const w = quote({ id: "w", page: 10, createdAt: t });
    expect([x, early, w].sort(comparePageOrder)).toEqual([early, w, x]);
  });
});

describe("orderQuotes", () => {
  it("newest and oldest go by date added, with the id breaking ties", () => {
    const t = new Date("2026-05-01T10:00:00Z");
    const a = quote({ createdAt: new Date("2026-01-01T00:00:00Z") });
    const b = quote({ id: "b", createdAt: t });
    const c = quote({ id: "c", createdAt: t });
    expect(orderQuotes([a, b, c], "newest", OPTS)).toEqual([c, b, a]);
    expect(orderQuotes([c, b, a], "oldest", OPTS)).toEqual([a, b, c]);
  });

  it("by book files titles with the reader's rules, page order within", () => {
    const hobbit2 = quote({ bookId: "h", title: "The Hobbit", page: 200 });
    const hobbit1 = quote({ bookId: "h", title: "The Hobbit", page: 12 });
    const ostrich = quote({ bookId: "o", title: "Østersjøen" });
    const zebra = quote({ bookId: "z", title: "Zebra" });
    const ice = quote({ bookId: "i", title: "Ice" });
    const all = [zebra, hobbit2, ostrich, ice, hobbit1];

    // Plain English sorting: "The Hobbit" under T, Ø with O.
    expect(orderQuotes(all, "book", OPTS).map((q) => q.bookId)).toEqual([
      "i", "o", "h", "h", "z",
    ]);
    // Articles ignored and the Norwegian alphabet: H, then Ø after Z.
    expect(
      orderQuotes(all, "book", { seed: 1, sort: { ignoreArticles: true, alphabet: "nb" } }),
    ).toEqual([hobbit1, hobbit2, ice, zebra, ostrich]);
  });

  it("by book sorts same-titled books by author", () => {
    const b = quote({ bookId: "b", title: "Poems", authors: ["Emily Dickinson"] });
    const a = quote({ bookId: "a", title: "Poems", authors: ["Robert Frost"] });
    expect(orderQuotes([a, b], "book", OPTS)).toEqual([b, a]);
  });

  it("shuffle does not depend on the input order", () => {
    const qs = many(25);
    const shuffled = orderQuotes(qs, "shuffle", OPTS);
    expect(orderQuotes([...qs].reverse(), "shuffle", OPTS)).toEqual(shuffled);
    expect(shuffled).not.toEqual(qs);
    expect(orderQuotes(qs, "shuffle", { ...OPTS, seed: 43 })).not.toEqual(shuffled);
  });
});

describe("groupQuotes", () => {
  const a1 = quote({ bookId: "a", title: "Alpha", page: 30, createdAt: new Date("2026-03-01T00:00:00Z") });
  const a2 = quote({ bookId: "a", title: "Alpha", page: 5, createdAt: new Date("2026-06-01T00:00:00Z") });
  const b1 = quote({ bookId: "b", title: "Beta", createdAt: new Date("2026-01-01T00:00:00Z") });
  const b2 = quote({ bookId: "b", title: "Beta", page: 9, createdAt: new Date("2026-04-01T00:00:00Z") });
  const c1 = quote({ bookId: "c", title: "Gamma", createdAt: new Date("2026-02-01T00:00:00Z") });
  const all = [b2, c1, a1, b1, a2];

  it("keeps each book's quotes in page order", () => {
    const groups = groupQuotes(all, "newest", OPTS);
    expect(groups.find((g) => g.bookId === "a")!.quotes).toEqual([a2, a1]);
    expect(groups.find((g) => g.bookId === "b")!.quotes).toEqual([b2, b1]);
  });

  it("newest puts the book with the newest quote first", () => {
    expect(groupQuotes(all, "newest", OPTS).map((g) => g.bookId)).toEqual(["a", "b", "c"]);
  });

  it("oldest puts the book with the oldest quote first", () => {
    expect(groupQuotes(all, "oldest", OPTS).map((g) => g.bookId)).toEqual(["b", "c", "a"]);
  });

  it("by book goes by title", () => {
    expect(groupQuotes(all, "book", OPTS).map((g) => g.bookId)).toEqual(["a", "b", "c"]);
  });

  it("shuffle is stable for a seed, whatever the input order", () => {
    const books = Array.from({ length: 12 }, (_, i) => quote({ bookId: `book-${i}` }));
    const order = groupQuotes(books, "shuffle", OPTS).map((g) => g.bookId);
    expect(groupQuotes([...books].reverse(), "shuffle", OPTS).map((g) => g.bookId)).toEqual(order);
    expect(order).not.toEqual(books.map((q) => q.bookId));
  });
});

describe("sliceQuoteGroups", () => {
  const groups = [
    { bookId: "a", quotes: [1, 2, 3] },
    { bookId: "b", quotes: [4, 5, 6, 7] },
    { bookId: "c", quotes: [8] },
  ];

  it("fills groups in order, cuts the last one, and keeps real totals", () => {
    expect(sliceQuoteGroups(groups, 5)).toEqual([
      { bookId: "a", quotes: [1, 2, 3], total: 3 },
      { bookId: "b", quotes: [4, 5], total: 4 },
    ]);
  });

  it("stops exactly at the budget", () => {
    expect(sliceQuoteGroups(groups, 3).map((g) => g.bookId)).toEqual(["a"]);
    expect(sliceQuoteGroups(groups, 100)).toHaveLength(3);
  });
});

describe("parseQuotesParams", () => {
  it("falls back to the saved order and grouping", () => {
    expect(parseQuotesParams({}, PREFS)).toEqual({
      q: "",
      order: "newest",
      group: false,
      seed: null,
      tag: "",
      shelfId: "",
      limit: QUOTES_PAGE_SIZE,
    });
    const saved = { quotesOrder: "book", quotesGroupByBook: true } as const;
    expect(parseQuotesParams({ order: "random", group: "maybe" }, saved)).toMatchObject({
      order: "book",
      group: true,
    });
  });

  it("lets the URL win", () => {
    expect(parseQuotesParams({ order: "oldest", group: "book" }, PREFS)).toMatchObject({
      order: "oldest",
      group: true,
    });
    const saved = { quotesOrder: "shuffle", quotesGroupByBook: true } as const;
    expect(parseQuotesParams({ order: "newest", group: "none" }, saved)).toMatchObject({
      order: "newest",
      group: false,
    });
  });

  it("only takes a seed in range", () => {
    const seed = (s: string) => parseQuotesParams({ seed: s }, PREFS).seed;
    expect(seed("1")).toBe(1);
    expect(seed("2147483647")).toBe(2147483647);
    expect(seed("0")).toBeNull();
    expect(seed("abc")).toBeNull();
    expect(seed("-5")).toBeNull();
    expect(seed("2147483648")).toBeNull();
    expect(seed("12345678901")).toBeNull();
  });

  it("clamps the limit", () => {
    const limit = (l: string) => parseQuotesParams({ limit: l }, PREFS).limit;
    expect(limit("50")).toBe(QUOTES_PAGE_SIZE);
    expect(limit("400")).toBe(400);
    expect(limit("99999")).toBe(QUOTES_MAX);
    expect(limit("lots")).toBe(QUOTES_PAGE_SIZE);
  });

  it("drops null bytes, trims, and refuses odd values", () => {
    const p = parseQuotesParams(
      { q: " hope\0 ", tag: "\0fantasy ", shelfId: "abc;drop" },
      PREFS,
    );
    expect(p.q).toBe("hope");
    expect(p.tag).toBe("fantasy");
    expect(p.shelfId).toBe("");
    expect(parseQuotesParams({ tag: "x".repeat(201) }, PREFS).tag).toBe("");
    expect(parseQuotesParams({ shelfId: "clx9abc123" }, PREFS).shelfId).toBe("clx9abc123");
  });

  it("ignores repeated params", () => {
    expect(parseQuotesParams({ order: ["oldest", "book"] }, PREFS).order).toBe("newest");
  });
});

describe("quotesHref", () => {
  const roundTrip = (href: string) =>
    parseQuotesParams(Object.fromEntries(new URLSearchParams(href.slice(href.indexOf("?") + 1))), PREFS);

  it("always writes order and group", () => {
    expect(quotesHref({ order: "newest", group: false })).toBe("/quotes?order=newest&group=none");
    expect(quotesHref({ order: "book", group: true })).toBe("/quotes?order=book&group=book");
  });

  it("writes the seed only for a shuffle", () => {
    expect(quotesHref({ order: "newest", group: false, seed: 5 })).not.toContain("seed");
    expect(quotesHref({ order: "shuffle", group: false, seed: 5 })).toContain("seed=5");
  });

  it("writes the limit only above one page", () => {
    expect(quotesHref({ order: "newest", group: false, limit: 200 })).not.toContain("limit");
    expect(quotesHref({ order: "newest", group: false, limit: 400 })).toContain("limit=400");
  });

  it("keeps one From filter, the shelf winning", () => {
    const href = quotesHref({ order: "newest", group: false, tag: "fantasy", shelfId: "s1" });
    expect(href).toContain("shelfId=s1");
    expect(href).not.toContain("tag=");
  });

  it("round-trips through parseQuotesParams", () => {
    const p = {
      q: "a & b?",
      order: "shuffle",
      group: true,
      seed: 123456,
      tag: "sci-fi & more",
      shelfId: "",
      limit: 600,
    } as const;
    expect(roundTrip(quotesHref(p))).toEqual(p);
  });
});
