import { describe, expect, it } from "vitest";
import { SPINE_DESIGNS, drawnSpineHex, spineAuthor, spineInk, spineShape } from "@/lib/book-spine";

describe("spineShape", () => {
  it("makes thicker books wider, within bounds", () => {
    const thin = spineShape({ title: "All Systems Red", pageCount: 152 });
    const thick = spineShape({ title: "War and Peace", pageCount: 1225 });
    expect(thin.width).toBeLessThan(thick.width);
    expect(thin.width).toBeGreaterThanOrEqual(1.35);
    expect(thick.width).toBeLessThanOrEqual(3.4);
    expect(spineShape({ title: "Huge", pageCount: 9000 }).width).toBe(3.4);
    expect(spineShape({ title: "Tiny", pageCount: 12 }).width).toBe(1.35);
  });

  it("gives a book with no page count an ordinary width", () => {
    expect(spineShape({ title: "Untold", pageCount: null }).width).toBe(1.9);
    expect(spineShape({ title: "Untold", pageCount: 0 }).width).toBe(1.9);
  });

  it("lets only thick books take two lines", () => {
    expect(spineShape({ title: "Dune", pageCount: 412 }).twoLines).toBe(false);
    expect(spineShape({ title: "Middlemarch", pageCount: 880 }).twoLines).toBe(true);
  });

  it("is the same on every visit, and varies between titles", () => {
    const a = spineShape({ title: "Piranesi", pageCount: 272 });
    expect(spineShape({ title: "  piranesi ", pageCount: 272 })).toEqual(a);
    const titles = Array.from({ length: 60 }, (_, i) => `Book ${i}`);
    const shapes = titles.map((title) => spineShape({ title, pageCount: 300 }));
    expect(new Set(shapes.map((s) => s.design)).size).toBe(SPINE_DESIGNS.length);
    for (const s of shapes) {
      expect(s.height).toBeGreaterThanOrEqual(0.84);
      expect(s.height).toBeLessThanOrEqual(1);
    }
    expect(new Set(shapes.map((s) => s.height)).size).toBeGreaterThan(8);
  });
});

describe("spineInk", () => {
  it("letters dark spines in pale ink and pale spines in dark", () => {
    expect(spineInk("#1d3557")).toBe("light");
    expect(spineInk("#9d0208")).toBe("light");
    expect(spineInk("#f4a261")).toBe("dark");
    expect(spineInk("#fefae0")).toBe("dark");
  });

  it("takes anything it can't read as dark", () => {
    expect(spineInk("hsl(10 40% 30%)")).toBe("light");
    expect(spineInk("")).toBe("light");
  });

  it("gives every drawn spine pale ink", () => {
    for (const title of ["Dune", "Emma", "Orlando", "Beloved", "Hunger", "Mort"]) {
      const hex = drawnSpineHex(title);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(spineInk(hex)).toBe("light");
    }
  });
});

describe("spineAuthor", () => {
  it("is the surname as written, particles included", () => {
    expect(spineAuthor("Frank Herbert")).toBe("Herbert");
    expect(spineAuthor("Ursula K. Le Guin")).toBe("Le Guin");
    expect(spineAuthor("Ludwig van Beethoven")).toBe("van Beethoven");
    expect(spineAuthor("Martin Luther King Jr.")).toBe("King");
    expect(spineAuthor("Homer")).toBe("Homer");
    expect(spineAuthor("  ")).toBe("");
  });
});
