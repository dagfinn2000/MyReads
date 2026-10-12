import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * searchBooks has to tell "no catalogue has this book" apart from "no
 * catalogue answered". The sources are stubbed; what's under test is how
 * their answers and failures are combined.
 */

const ol = vi.fn();
const gb = vi.fn();
const nb = vi.fn();
const olWork = vi.fn();
const olEdition = vi.fn();
const gbDetails = vi.fn();
let gbEnabled = false;
vi.mock("@/lib/metadata/openlibrary", () => ({
  searchOpenLibrary: (q: string) => ol(q),
  getOpenLibraryDetails: (id: string) => olWork(id),
  getOpenLibraryEdition: (isbn: string) => olEdition(isbn),
}));
vi.mock("@/lib/metadata/googlebooks", () => ({
  searchGoogleBooks: (q: string) => gb(q),
  getGoogleBooksDetails: (params: unknown) => gbDetails(params),
  googleBooksEnabled: () => gbEnabled,
}));
vi.mock("@/lib/metadata/nb", () => ({
  searchNb: (q: string) => nb(q),
  getNbCoverByIsbn: vi.fn(),
}));

const { CataloguesUnreachableError, getBookDetails, searchBooks } = await import("@/lib/metadata");

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

describe("getBookDetails", () => {
  const work = (tags: string[]) => ({ description: "A work", pageCount: null, tags, coverUrl: null });

  beforeEach(() => {
    olWork.mockReset().mockResolvedValue(work(["fantasy"]));
    olEdition.mockReset().mockResolvedValue(null);
    gbDetails.mockReset().mockResolvedValue(null);
  });

  it("takes the page count from Google, then from the Open Library edition", async () => {
    olEdition.mockResolvedValue({ pageCount: 310, workId: "OL1W" });
    expect((await getBookDetails({ isbn: "9780261103344" })).pageCount).toBe(310);

    gbEnabled = true;
    gbDetails.mockResolvedValue({ description: null, pageCount: 320, tags: [], coverUrl: null });
    expect((await getBookDetails({ isbn: "9780261103344" })).pageCount).toBe(320);
  });

  it("finds the work through the edition when no id was given, and fetches its subjects", async () => {
    olEdition.mockResolvedValue({ pageCount: null, workId: "OL27482W" });
    const details = await getBookDetails({ isbn: "9788205530102" });
    expect(olWork).toHaveBeenCalledWith("OL27482W");
    expect(details.openLibraryId).toBe("OL27482W");
    expect(details.tags).toEqual(["fantasy"]);
  });

  it("keeps the id it was given", async () => {
    olEdition.mockResolvedValue({ pageCount: null, workId: "OL999W" });
    const details = await getBookDetails({ openLibraryId: "OL1W", isbn: "9780261103344" });
    expect(olWork).toHaveBeenCalledTimes(1);
    expect(olWork).toHaveBeenCalledWith("OL1W");
    expect(details.openLibraryId).toBe("OL1W");
  });

  it("skips Open Library when it is switched off", async () => {
    const details = await getBookDetails({ openLibraryId: "OL1W", isbn: "9780261103344" }, ["nb"]);
    expect(olWork).not.toHaveBeenCalled();
    expect(olEdition).not.toHaveBeenCalled();
    expect(details.description).toBeNull();
  });

  it("falls back as before when Open Library has no edition for the ISBN", async () => {
    const details = await getBookDetails({ isbn: "9780000000002" });
    expect(olWork).not.toHaveBeenCalled();
    expect(details).toMatchObject({ pageCount: null, tags: [], openLibraryId: null });
  });
});
