import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * searchBooks has to tell "no catalogue has this book" apart from "no
 * catalogue answered". The sources are stubbed; what's under test is how
 * their answers and failures are combined.
 */

const ol = vi.fn();
const gb = vi.fn();
const nb = vi.fn();
let gbEnabled = false;
vi.mock("@/lib/metadata/openlibrary", () => ({
  searchOpenLibrary: (q: string) => ol(q),
  getOpenLibraryDetails: vi.fn(),
}));
vi.mock("@/lib/metadata/googlebooks", () => ({
  searchGoogleBooks: (q: string) => gb(q),
  getGoogleBooksDetails: vi.fn(),
  googleBooksEnabled: () => gbEnabled,
}));
vi.mock("@/lib/metadata/nb", () => ({
  searchNb: (q: string) => nb(q),
  getNbCoverByIsbn: vi.fn(),
}));

const { CataloguesUnreachableError, searchBooks } = await import("@/lib/metadata");

const down = () => Promise.reject(new Error("down"));
const book = (title: string, isbn: string | null = null) => ({
  title,
  authors: [],
  isbn,
  coverUrl: null,
  description: null,
  pageCount: null,
  tags: [],
  source: "openlibrary",
});

beforeEach(() => {
  gbEnabled = false;
  ol.mockReset();
  nb.mockReset();
  // Disabled Google Books answers with nothing rather than failing.
  gb.mockReset().mockResolvedValue([]);
});

describe("searchBooks", () => {
  it("reports an outage when no catalogue answers", async () => {
    ol.mockImplementation(down);
    nb.mockImplementation(down);
    await expect(searchBooks("hobbit")).rejects.toBeInstanceOf(CataloguesUnreachableError);
  });

  it("counts Google Books only when it is configured", async () => {
    gbEnabled = true;
    ol.mockImplementation(down);
    nb.mockImplementation(down);
    gb.mockResolvedValue([book("The Hobbit")]);
    expect((await searchBooks("hobbit")).map((r) => r.title)).toEqual(["The Hobbit"]);

    gb.mockImplementation(down);
    await expect(searchBooks("hobbit")).rejects.toBeInstanceOf(CataloguesUnreachableError);
  });

  it("returns an empty list when the catalogues answered with nothing", async () => {
    ol.mockResolvedValue([]);
    nb.mockImplementation(down);
    expect(await searchBooks("zzzz")).toEqual([]);
  });

  it("keeps one source's rows when another is down, and dedupes editions", async () => {
    ol.mockResolvedValue([book("The Hobbit", "9780261103344")]);
    nb.mockResolvedValue([book("Hobbiten", "9788205530102"), book("The Hobbit (dup)", "0261103342")]);
    expect((await searchBooks("hobbit")).map((r) => r.title)).toEqual(["The Hobbit", "Hobbiten"]);
  });

  it("asks only the chosen catalogues, in the chosen order", async () => {
    ol.mockResolvedValue([book("Open Library row")]);
    nb.mockResolvedValue([book("nb.no row")]);
    expect((await searchBooks("x", ["nb", "openlibrary"])).map((r) => r.title)).toEqual([
      "nb.no row",
      "Open Library row",
    ]);

    ol.mockClear();
    expect((await searchBooks("x", ["nb"])).map((r) => r.title)).toEqual(["nb.no row"]);
    expect(ol).not.toHaveBeenCalled();
  });

  it("lets the first chosen catalogue win a duplicate edition", async () => {
    ol.mockResolvedValue([book("From Open Library", "9780261103344")]);
    nb.mockResolvedValue([book("From nb.no", "0261103342")]);
    expect((await searchBooks("x", ["nb", "openlibrary"])).map((r) => r.title)).toEqual([
      "From nb.no",
    ]);
  });

  it("falls back to the keyless catalogues when only Google is chosen but not set up", async () => {
    ol.mockResolvedValue([book("Open Library row")]);
    nb.mockResolvedValue([]);
    expect((await searchBooks("x", ["google"])).map((r) => r.title)).toEqual([
      "Open Library row",
    ]);
    expect(gb).not.toHaveBeenCalled();
  });
});
