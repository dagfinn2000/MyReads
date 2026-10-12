import { describe, expect, it } from "vitest";
import { canonicalViewQuery, canonicalViewQueryFromString } from "@/lib/saved-views";

describe("canonicalViewQuery", () => {
  it("keeps filters in a fixed order with the view last", () => {
    expect(
      canonicalViewQuery({ sort: "title", tag: "fantasy", shelf: "READ", dir: "asc" }),
    ).toBe("shelf=READ&tag=fantasy&group=none&sort=title&dir=asc");
  });

  it("leaves out defaults and parameters the library doesn't know", () => {
    expect(canonicalViewQuery({ shelf: "all", owned: "all", limit: "500", x: "1" })).toBe(
      "group=none&sort=createdAt&dir=desc",
    );
  });

  it("gives the same string for the same view however it was written", () => {
    expect(canonicalViewQueryFromString("dir=asc&sort=title&q=+dune+&group=none")).toBe(
      canonicalViewQuery({ q: "dune", sort: "title", dir: "asc" }),
    );
  });

  it("puts the newer filters in their place, before the view", () => {
    expect(
      canonicalViewQuery({
        missing: "cover",
        finished: "2024",
        notTag: "horror",
        tagMatch: "all",
        tag: "fantasy,classic",
        author: "Ursula K. Le Guin",
        minRating: "unrated",
        q: "sea",
        sort: "rating",
        dir: "desc",
      }),
    ).toBe(
      "q=sea&author=Ursula+K.+Le+Guin&tag=classic%2Cfantasy&tagMatch=all&notTag=horror" +
        "&minRating=unrated&finished=2024&missing=cover&group=none&sort=rating&dir=desc",
    );
  });

  it("treats the same tags in any order as one view", () => {
    expect(canonicalViewQuery({ tag: "b,a", notTag: "d,c" })).toBe(
      canonicalViewQuery({ tag: "a,b", notTag: "c,d" }),
    );
  });

  it("leaves out tag matching unless it's 'all' with tags to match", () => {
    expect(canonicalViewQuery({ tagMatch: "all" })).toBe("group=none&sort=createdAt&dir=desc");
    expect(canonicalViewQuery({ tag: "a", tagMatch: "any" })).toBe(
      "tag=a&group=none&sort=createdAt&dir=desc",
    );
  });

  it("opens a sort without a direction its natural way round, like the library", () => {
    expect(canonicalViewQuery({ sort: "title" })).toBe("group=none&sort=title&dir=asc");
    expect(canonicalViewQuery({ sort: "pageCount" })).toBe("group=none&sort=pageCount&dir=desc");
    expect(canonicalViewQuery({ sort: "constructor" })).toBe("group=none&sort=createdAt&dir=desc");
  });
});
