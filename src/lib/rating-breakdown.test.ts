import { describe, expect, it } from "vitest";
import {
  aspectRatingUpdate,
  aspectSummaries,
  hasAspectRatings,
  ratingDistribution,
  ratingLean,
  shortRating,
  type AspectBook,
} from "@/lib/rating-breakdown";

let n = 0;
function book(over: Partial<AspectBook> = {}): AspectBook {
  n++;
  return {
    id: `b${n}`,
    title: `Book ${n}`,
    rating: null,
    plotRating: null,
    charactersRating: null,
    writingRating: null,
    ...over,
  };
}

describe("aspectRatingUpdate", () => {
  it("writes only the aspects the form sent, 0 clearing one", () => {
    expect(aspectRatingUpdate({})).toEqual({});
    expect(aspectRatingUpdate({ plotRating: 7, writingRating: 0 })).toEqual({
      plotRating: 7,
      writingRating: null,
    });
  });
});

describe("hasAspectRatings", () => {
  it("is true once any of the three is rated", () => {
    expect(hasAspectRatings(book())).toBe(false);
    expect(hasAspectRatings(book({ charactersRating: 4 }))).toBe(true);
  });
});

describe("aspectSummaries", () => {
  it("averages each aspect over the books rated for it", () => {
    const [plot, characters, writing] = aspectSummaries([
      book({ plotRating: 8, writingRating: 10 }),
      book({ plotRating: 5 }),
      book({ charactersRating: 6 }),
    ]);
    expect(plot).toMatchObject({ key: "plotRating", label: "Plot", average: 6.5, count: 2 });
    expect(characters).toMatchObject({ average: 6, count: 1 });
    expect(writing).toMatchObject({ average: 10, count: 1 });
  });

  it("has nothing for an aspect no book is rated for", () => {
    const [plot] = aspectSummaries([book({ rating: 8 })]);
    expect(plot).toMatchObject({ average: null, count: 0, best: null });
  });

  it("picks the best book, a tie going to the higher overall rating, then the later finish", () => {
    const a = book({ title: "A", plotRating: 9, rating: 6 });
    const b = book({ title: "B", plotRating: 9, rating: 8 });
    const c = book({ title: "C", plotRating: 7, rating: 10 });
    expect(aspectSummaries([a, b, c])[0].best).toBe(b);

    const early = book({ title: "Early", plotRating: 9, rating: 8, dateFinished: new Date("2026-01-01") });
    const late = book({ title: "Late", plotRating: 9, rating: 8, dateFinished: new Date("2026-05-01") });
    expect(aspectSummaries([early, late])[0].best).toBe(late);
    expect(aspectSummaries([late, early])[0].best).toBe(late);
  });

  it("ignores values off the scale", () => {
    const [plot] = aspectSummaries([book({ plotRating: 0 }), book({ plotRating: 12 }), book({ plotRating: 6 })]);
    expect(plot).toMatchObject({ average: 6, count: 1 });
  });
});

describe("ratingLean", () => {
  /** Overall ratings that follow the writing; plot and characters wander. */
  const following = [
    [4, 9, 6, 4],
    [6, 5, 7, 6],
    [8, 7, 5, 8],
    [10, 6, 8, 9],
    [2, 8, 4, 3],
    [7, 4, 9, 7],
  ].map(([rating, plotRating, charactersRating, writingRating]) =>
    book({ rating, plotRating, charactersRating, writingRating }),
  );

  it("names the aspect the overall rating goes along with most", () => {
    expect(ratingLean(following)).toEqual({ key: "writingRating", phrase: "the writing", books: 6 });
  });

  it("names none with too few books rated for both", () => {
    expect(ratingLean(following.slice(0, 4))).toBeNull();
  });

  it("names none when two aspects follow it about as closely", () => {
    const both = following.map((b) => ({ ...b, plotRating: b.writingRating }));
    expect(ratingLean(both)).toBeNull();
  });

  it("names none when nothing follows it", () => {
    const flat = following.map((b) => ({ ...b, writingRating: 6, plotRating: 6, charactersRating: 6 }));
    expect(ratingLean(flat)).toBeNull();
  });
});

describe("ratingDistribution", () => {
  it("counts half stars on ten steps", () => {
    const buckets = ratingDistribution([1, 7, 8, 8, 10], "half");
    expect(buckets.map((b) => b.label)).toEqual(["½", "1", "1½", "2", "2½", "3", "3½", "4", "4½", "5"]);
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 0, 0, 0, 0, 1, 2, 0, 1]);
  });

  it("puts a half star up to the next whole one on whole stars", () => {
    const buckets = ratingDistribution([1, 7, 8, 8, 10], "whole");
    expect(buckets.map((b) => [b.value, b.label, b.count])).toEqual([
      [2, "1", 1],
      [4, "2", 0],
      [6, "3", 0],
      [8, "4", 3],
      [10, "5", 1],
    ]);
  });

  it("counts 1 to 10 out of ten, and skips values off the scale", () => {
    const buckets = ratingDistribution([3, 3, 10, 0, 11], "ten");
    expect(buckets.map((b) => b.label)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(buckets.map((b) => b.count)).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0, 1]);
  });
});

describe("shortRating", () => {
  it("writes a rating in the fewest characters", () => {
    expect([1, 7, 8].map((v) => shortRating(v, "half"))).toEqual(["½", "3½", "4"]);
    expect(shortRating(8, "ten")).toBe("8/10");
  });
});
