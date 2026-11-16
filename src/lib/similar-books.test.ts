import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@/lib/enums";
import {
  SIMILAR_LIMIT,
  similarBooks,
  similarReasonText,
  type SimilarCandidate,
  type SimilarSource,
} from "@/lib/similar-books";

let n = 0;
function cand(over: Partial<SimilarCandidate> = {}): SimilarCandidate {
  n++;
  return {
    id: `c${n}`,
    title: `Book ${n}`,
    coverUrl: null,
    authors: [],
    tags: [],
    moods: [],
    seriesName: null,
    pageCount: null,
    status: ReadingStatus.READ,
    rating: null,
    ...over,
  };
}

const source: SimilarSource = {
  id: "src",
  authors: ["Ursula K. Le Guin"],
  tags: ["fantasy", "magic schools", "fiction"],
  moods: ["adventurous", "thoughtful"],
  seriesName: "Earthsea",
  pageCount: 200,
};

/** A library where most books are fiction, some fantasy, one about magic
 *  schools. */
function library(extra: SimilarCandidate[] = []) {
  const filler = Array.from({ length: 30 }, () => cand({ tags: ["fiction"] }));
  return [...filler, ...extra];
}

describe("similarBooks", () => {
  it("weighs a rare shared tag above a common one", () => {
    const school = cand({ title: "Schooled", tags: ["magic schools"] });
    const fantasy = cand({ title: "Some Fantasy", tags: ["fantasy"] });
    const fantasy2 = cand({ tags: ["fantasy"] });
    const fantasy3 = cand({ tags: ["fantasy"] });
    const got = similarBooks(source, library([fantasy, school, fantasy2, fantasy3]), 40);
    expect(got[0].book.title).toBe("Schooled");
    expect(got.map((g) => g.book.id)).toContain(fantasy.id);
  });

  it("leaves out a tag everyone has on its own, the book itself, its series and books put down", () => {
    const self = cand({ id: "src", tags: ["magic schools"] });
    const sameSeries = cand({ tags: ["magic schools"], seriesName: " earthsea " });
    const dropped = cand({ tags: ["magic schools"], status: ReadingStatus.DNF });
    const got = similarBooks(source, library([self, sameSeries, dropped]), 33);
    expect(got).toEqual([]);
  });

  it("counts the same author, and puts books still to read first", () => {
    const read = cand({ title: "Read one", authors: ["Ursula K. Le Guin "], tags: ["fantasy"] });
    const toRead = cand({
      title: "To read",
      authors: ["Ursula K. Le Guin"],
      tags: ["fantasy"],
      status: ReadingStatus.WANT_TO_READ,
    });
    const got = similarBooks(source, library([read, toRead]), 32);
    expect(got.map((g) => g.book.title)).toEqual(["To read", "Read one"]);
    expect(got[0].reason).toEqual({ author: true, tags: ["fantasy"], moods: [] });
  });

  it("names the rarest tags first, and shows no more than the limit", () => {
    const many = Array.from({ length: 12 }, () => cand({ tags: ["fiction", "fantasy", "magic schools"] }));
    const moreFantasy = Array.from({ length: 3 }, () => cand({ tags: ["fantasy"] }));
    const got = similarBooks(source, library([...many, ...moreFantasy]), 45);
    expect(got).toHaveLength(SIMILAR_LIMIT);
    expect(got[0].reason.tags).toEqual(["magic schools", "fantasy", "fiction"]);
  });

  it("shows one book of another series", () => {
    const lotr = ["The Two Towers", "The Return of the King", "The Fellowship"].map((title) =>
      cand({ title, tags: ["fantasy"], seriesName: "The Lord of the Rings" }),
    );
    const got = similarBooks(source, library([...lotr, cand({ title: "Lone", tags: ["fantasy"] })]), 35);
    expect(got.map((g) => g.book.title)).toEqual(["Lone", "The Fellowship"]);
  });

  it("finds nothing for a book with nothing to go by", () => {
    const bare: SimilarSource = { ...source, authors: [], tags: [], moods: [] };
    expect(similarBooks(bare, library([cand({ tags: ["fantasy"] })]), 31)).toEqual([]);
  });
});

describe("similarReasonText", () => {
  const moodName = (k: string) => ({ cosy: "Cosy", tense: "Tense" })[k] ?? null;
  it("names the author first, then tags, and a mood if there's room", () => {
    expect(similarReasonText({ author: true, tags: ["fantasy", "epic"], moods: ["cosy"] }, moodName)).toBe(
      "Same author · fantasy",
    );
    expect(similarReasonText({ author: false, tags: ["fantasy", "epic"], moods: ["cosy"] }, moodName)).toBe(
      "fantasy · epic",
    );
    expect(similarReasonText({ author: false, tags: ["fantasy"], moods: ["gone", "tense"] }, moodName)).toBe(
      "fantasy · tense",
    );
    expect(similarReasonText({ author: false, tags: [], moods: ["cosy"] }, moodName)).toBe("cosy");
  });
});
