import { describe, expect, it } from "vitest";
import { pageTurnDirection } from "@/lib/page-turn";

const BAR = ["/books", "/reading", "/books/new", "/books/check", "/quotes", "/stats", "/room"];

describe("pageTurnDirection", () => {
  it("turns on to a link further along the bar", () => {
    expect(pageTurnDirection(BAR, "/books", "/stats")).toBe("on");
    expect(pageTurnDirection(BAR, "/reading", "/books/new")).toBe("on");
  });

  it("turns back to one before", () => {
    expect(pageTurnDirection(BAR, "/stats", "/books")).toBe("back");
    expect(pageTurnDirection(BAR, "/books/check", "/books/new")).toBe("back");
  });

  it("counts a page inside a section as that section", () => {
    expect(pageTurnDirection(BAR, "/books/abc123", "/reading")).toBe("on");
    expect(pageTurnDirection(BAR, "/quotes/q1", "/books")).toBe("back");
  });

  it("doesn't turn within the section already open", () => {
    expect(pageTurnDirection(BAR, "/books", "/books")).toBeNull();
    expect(pageTurnDirection(BAR, "/books/abc123", "/books")).toBeNull();
    expect(pageTurnDirection(BAR, "/stats/2025", "/stats")).toBeNull();
  });

  it("turns on from a page that isn't on the bar, or to one", () => {
    expect(pageTurnDirection(BAR, "/account", "/books")).toBe("on");
    expect(pageTurnDirection(BAR, "/stats", "/series")).toBe("on");
  });
});
