import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The scan flow's ISBN lookup fans out to the same external catalogues as
 * /api/metadata/search, so it must spend from the same per-user budget. The
 * database and the catalogues are stubbed: what's under test is only when
 * the route reaches for them.
 */

let userId = "";
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: userId } }) }));

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { book: { findFirst: (...args: unknown[]) => findFirst(...args) } },
}));

vi.mock("@/lib/current-user", async () => {
  const { DEFAULT_PREFERENCES } = await import("@/lib/preferences");
  return { getPreferences: async () => DEFAULT_PREFERENCES };
});

const searchBooks = vi.fn();
vi.mock("@/lib/metadata", () => ({
  searchBooks: (...args: unknown[]) => searchBooks(...args),
}));

const { GET } = await import("@/app/api/library/check/route");

const check = (query: string) => GET(new Request(`http://localhost/api/library/check?${query}`));

beforeEach(() => {
  // A fresh user per test, so each starts with a full budget.
  userId = `user-${Math.random()}`;
  findFirst.mockReset().mockResolvedValue(null);
  searchBooks.mockReset().mockResolvedValue([]);
});

/** Spends the whole budget on ISBN lookups. */
async function exhaustBudget() {
  for (let i = 0; i < 90; i++) {
    expect((await check("isbn=9780765311788")).status).toBe(200);
  }
}

describe("GET /api/library/check", () => {
  it("stops looking ISBNs up once the user's lookup budget is spent", async () => {
    await exhaustBudget();
    expect(searchBooks).toHaveBeenCalledTimes(90);

    const res = await check("isbn=9780765311788");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(searchBooks).toHaveBeenCalledTimes(90);
  });

  it("still answers checks that need no lookup when the budget is spent", async () => {
    await exhaustBudget();

    // The add flow passes the title, so only the database is asked.
    expect((await check("isbn=9780765311788&title=Mistborn&author=Sanderson")).status).toBe(200);

    // An ISBN already in the library is answered before any lookup.
    findFirst.mockResolvedValueOnce({ id: "b1", title: "Mistborn" });
    const res = await check("isbn=9780765311788");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ match: "isbn" });
  });
});

describe("GET /api/library/check input and outages", () => {
  it("refuses something that isn't an ISBN in the scan flow", async () => {
    const res = await check("isbn=not-an-isbn");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That doesn't look like an ISBN" });
    expect(searchBooks).not.toHaveBeenCalled();
  });

  it("says so when the catalogues couldn't be asked", async () => {
    searchBooks.mockRejectedValueOnce(new Error("Couldn't reach the book catalogues"));
    const res = await check("isbn=9780765311788");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ match: null, lookedUp: null, lookupFailed: true });
  });
});
