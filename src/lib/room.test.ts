import { describe, expect, it } from "vitest";
import { BookOwnership } from "@prisma/client";
import {
  CASE_WIDTH,
  MILESTONES,
  PAD,
  PIECE_WIDTH,
  SHELF_WIDTH,
  caseCount,
  dressShelf,
  isOnShelf,
  planHouse,
  shelve,
  spineFor,
  type HousePlan,
  type PieceKind,
} from "@/lib/room";

const kinds = (plan: HousePlan) => plan.floors.map((floor) => floor.map((p) => p.kind));
const all = (plan: HousePlan): PieceKind[] => kinds(plan).flat();

describe("spineFor", () => {
  it("makes thicker books wider", () => {
    expect(spineFor({ title: "A", pageCount: 120 }).width).toBe(3);
    expect(spineFor({ title: "A", pageCount: 300 }).width).toBe(4);
    expect(spineFor({ title: "A", pageCount: 550 }).width).toBe(5);
    expect(spineFor({ title: "A", pageCount: 1200 }).width).toBe(6);
    expect(spineFor({ title: "A", pageCount: null }).width).toBe(4);
  });

  it("gives a title the same height and pattern every time", () => {
    expect(spineFor({ title: "Sult", pageCount: 200 })).toEqual(
      spineFor({ title: " sult ", pageCount: 300 }),
    );
    for (let i = 0; i < 100; i++) {
      const spine = spineFor({ title: `Book ${i}`, pageCount: 300 });
      expect(spine.height).toBeGreaterThanOrEqual(14);
      expect(spine.height).toBeLessThanOrEqual(18);
      expect([0, 1, 2, 3, 4]).toContain(spine.pattern);
    }
  });
});

describe("isOnShelf", () => {
  it("counts owned and borrowed books that are at home", () => {
    expect(isOnShelf({ ownership: BookOwnership.OWNED, lentTo: null })).toBe(true);
    expect(isOnShelf({ ownership: BookOwnership.BORROWED, lentTo: null })).toBe(true);
  });

  it("leaves out books wished for, given away or lent out", () => {
    expect(isOnShelf({ ownership: BookOwnership.WISHLIST, lentTo: null })).toBe(false);
    expect(isOnShelf({ ownership: BookOwnership.GIVEN_AWAY, lentTo: null })).toBe(false);
    expect(isOnShelf({ ownership: BookOwnership.OWNED, lentTo: "Kari" })).toBe(false);
  });
});

describe("shelve", () => {
  it("fills a shelf before starting the next, in order", () => {
    const widths = Array.from({ length: 25 }, () => 4);
    const shelves = shelve(widths);
    expect(shelves.map((s) => s.length)).toEqual([10, 10, 5]);
    expect(shelves.flat()).toEqual(widths.map((_, i) => i));
  });

  it("never overfills a shelf", () => {
    const widths = Array.from({ length: 200 }, (_, i) => 3 + (i % 4));
    for (const shelf of shelve(widths)) {
      expect(shelf.reduce((sum, i) => sum + widths[i], 0)).toBeLessThanOrEqual(SHELF_WIDTH);
    }
  });

  it("has one empty shelf for no books", () => {
    expect(shelve([])).toEqual([[]]);
    expect(caseCount(1)).toBe(1);
    expect(caseCount(5)).toBe(1);
    expect(caseCount(6)).toBe(2);
  });
});

describe("planHouse", () => {
  it("starts as a cottage with the hearth and one bookcase", () => {
    const plan = planHouse(1, 0, 400);
    expect(kinds(plan)).toEqual([["hearth", "case"]]);
    expect(plan.inner).toBeLessThan(400);
    expect(plan.cat).toBe(false);
  });

  it("grows wider, then taller, as bookcases are added", () => {
    const wide = planHouse(4, 160, 400);
    expect(wide.floors).toHaveLength(1);
    const tall = planHouse(20, 900, 400);
    expect(tall.floors.length).toBeGreaterThan(1);
    // The hearth stays on the ground floor, the last one listed.
    expect(tall.floors[tall.floors.length - 1][0].kind).toBe("hearth");
    expect(all(tall).filter((k) => k === "case")).toHaveLength(20);
  });

  it("numbers the bookcases in reading order, top floor first", () => {
    const plan = planHouse(12, 500, 300);
    const order = plan.floors.flat().flatMap((p) => (p.caseIndex === undefined ? [] : [p.caseIndex]));
    expect(order).toEqual(order.map((_, i) => i));
  });

  it("keeps every floor inside the house and pieces from overlapping", () => {
    for (const [cases, books, max] of [
      [1, 5, 140],
      [3, 60, 200],
      [17, 700, 335],
      [40, 1800, 335],
    ] as const) {
      const plan = planHouse(cases, books, max);
      expect(plan.inner).toBeLessThanOrEqual(Math.max(max, PIECE_WIDTH.hearth + 2 * PAD));
      for (const floor of plan.floors) {
        let end = 0;
        for (const piece of floor) {
          expect(piece.x).toBeGreaterThanOrEqual(end);
          end = piece.x + PIECE_WIDTH[piece.kind];
        }
        expect(end).toBeLessThanOrEqual(plan.inner);
      }
    }
  });

  it("stands bookcases side by side", () => {
    const plan = planHouse(4, 40, 400);
    const cases = plan.floors[0].filter((p) => p.kind === "case");
    cases.slice(1).forEach((c, i) => expect(c.x).toBe(cases[i].x + CASE_WIDTH));
  });

  it("puts a house too narrow for the hearth and a bookcase on two floors", () => {
    const plan = planHouse(1, 3, 130);
    expect(kinds(plan)).toEqual([["case"], ["hearth"]]);
  });

  it("brings in furniture as the library grows", () => {
    expect(all(planHouse(1, MILESTONES.plant - 1, 400))).not.toContain("plant");
    expect(all(planHouse(1, MILESTONES.plant, 400))).toContain("plant");
    expect(planHouse(1, MILESTONES.cat - 1, 400).cat).toBe(false);
    expect(planHouse(1, MILESTONES.cat, 400).cat).toBe(true);
    expect(all(planHouse(3, MILESTONES.ladder, 400))).toContain("ladder");
    const manor = all(planHouse(20, MILESTONES.gramophone, 335));
    for (const kind of ["clock", "seat", "study", "gramophone", "ladder"] as const) {
      expect(manor).toContain(kind);
    }
  });

  it("leans the ladder on the end of a row of bookcases", () => {
    const plan = planHouse(3, MILESTONES.ladder, 400);
    const floor = kinds(plan)[0];
    const at = floor.indexOf("ladder");
    expect(floor.slice(at - 2, at)).toEqual(["case", "case"]);
  });
});

describe("dressShelf", () => {
  it("leaves a full shelf alone", () => {
    expect(dressShelf(3, SHELF_WIDTH)).toEqual({ bookend: false, ornaments: [] });
    expect(dressShelf(3, SHELF_WIDTH - 2)).toEqual({ bookend: false, ornaments: [] });
  });

  it("props up a part-filled shelf with a bookend", () => {
    expect(dressShelf(3, 30).bookend).toBe(true);
    expect(dressShelf(3, 0).bookend).toBe(false);
  });

  it("puts ornaments on bare space, inside the shelf and clear of the books", () => {
    for (let n = 0; n < 50; n++) {
      for (const used of [0, 12, 25]) {
        const { ornaments } = dressShelf(n, used);
        expect(ornaments.length).toBeGreaterThan(0);
        for (const o of ornaments) {
          expect(o.x).toBeGreaterThanOrEqual(used);
          expect(o.x).toBeLessThan(SHELF_WIDTH);
        }
      }
    }
    expect(dressShelf(7, 0)).toEqual(dressShelf(7, 0));
  });
});
