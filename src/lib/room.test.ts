import { describe, expect, it } from "vitest";
import { BookOwnership } from "@prisma/client";
import {
  CASE_WIDTH,
  EXTRAS,
  MILESTONES,
  NO_ARRANGEMENT,
  ROOMS,
  ROOM_PIECES,
  PAD,
  PIECE_WIDTH,
  SHELF_WIDTH,
  addExtra,
  addRoom,
  bringOut,
  caseCount,
  dressShelf,
  isOnShelf,
  moveTo,
  nudge,
  placementsOf,
  planHouse,
  putAway,
  removeExtra,
  removeRoom,
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

describe("arranging the furniture", () => {
  const BOOKS = MILESTONES.gramophone;

  it("puts a plan back exactly as it was from its own placements", () => {
    for (const width of [200, 335, 600]) {
      const plan = planHouse(14, BOOKS, width);
      const again = planHouse(14, BOOKS, width, { places: placementsOf(plan), away: [] });
      expect(kinds(again)).toEqual(kinds(plan));
    }
  });

  it("moves a piece along its floor, and keeps it there", () => {
    const plan = planHouse(3, MILESTONES.clock, 600);
    expect(kinds(plan)[0][0]).toBe("hearth");
    const places = moveTo(plan, "hearth", 0, 99)!;
    const moved = planHouse(3, MILESTONES.clock, 600, { places, away: [] });
    const ground = kinds(moved)[0];
    expect(ground[ground.length - 1]).toBe("hearth");
    expect(ground.filter((k) => k === "case")).toHaveLength(3);
  });

  it("moves the hearth upstairs, and the cases make room", () => {
    const plan = planHouse(10, BOOKS, 335);
    const top = plan.floors.length - 1;
    const places = moveTo(plan, "hearth", top, 0)!;
    const moved = planHouse(10, BOOKS, 335, { places, away: [] });
    expect(kinds(moved)[0][0]).toBe("hearth");
    expect(moved.floors).toHaveLength(plan.floors.length);
    expect(all(moved).filter((k) => k === "case")).toHaveLength(10);
    expect(all(moved).filter((k) => k === "hearth")).toHaveLength(1);
    // Nothing that was in the house has been squeezed out.
    expect([...all(moved)].sort()).toEqual([...all(plan)].sort());
  });

  it("lets a moved piece go where it would have gone when it doesn't fit", () => {
    // Put the study on the ground floor of a wide house, then look at it on
    // a phone, where the ground floor has no room for it beside the hearth.
    const wide = planHouse(6, BOOKS, 700);
    const places = moveTo(wide, "study", 0, 1)!;
    const narrow = planHouse(6, BOOKS, 170, { places, away: [] });
    expect(all(narrow)).toContain("study");
    for (const floor of narrow.floors) {
      const end = floor[floor.length - 1];
      expect(end.x + PIECE_WIDTH[end.kind]).toBeLessThanOrEqual(narrow.inner);
    }
  });

  it("never adds a floor just for furniture", () => {
    const plan = planHouse(2, MILESTONES.clock, 600);
    const places = [{ kind: "clock" as const, floor: 4, slot: 0 }];
    const moved = planHouse(2, MILESTONES.clock, 600, { places, away: [] });
    expect(moved.floors).toHaveLength(plan.floors.length);
    expect(all(moved)).toContain("clock");
  });

  it("ignores places for furniture the library hasn't earned", () => {
    const plan = planHouse(1, 0, 400, { places: [{ kind: "clock", floor: 0, slot: 0 }], away: [] });
    expect(all(plan)).not.toContain("clock");
  });

  it("puts furniture away, but never the hearth", () => {
    const away = planHouse(3, BOOKS, 600, { places: [], away: ["plant", "ladder", "clock"] });
    expect(all(away)).not.toContain("plant");
    expect(all(away)).not.toContain("ladder");
    expect(all(away)).not.toContain("clock");
    expect(all(away)).toContain("hearth");
  });

  it("nudges a piece one step, and stops at the ends", () => {
    const plan = planHouse(3, MILESTONES.plant, 600);
    const plant = placementsOf(plan).find((p) => p.kind === "plant")!;
    expect(nudge(plan, "plant", "left")).toEqual({ floor: 0, slot: plant.slot - 1 });
    expect(nudge(plan, "plant", "right")).toBeNull();
    expect(nudge(plan, "hearth", "left")).toBeNull();
    expect(nudge(plan, "plant", "up")).toBeNull();
    expect(nudge(plan, "plant", "down")).toBeNull();
  });

  it("keeps the rest in place when a moved piece is put away, and brings it back", () => {
    const places = [
      { kind: "plant" as const, floor: 0, slot: 0 },
      { kind: "hearth" as const, floor: 0, slot: 1 },
      { kind: "clock" as const, floor: 1, slot: 2 },
    ];
    const away = putAway({ places, away: [] }, "plant");
    expect(away.away).toEqual(["plant"]);
    expect(away.places).toEqual([
      { kind: "hearth", floor: 0, slot: 0 },
      { kind: "clock", floor: 1, slot: 2 },
    ]);
    const plan = planHouse(3, BOOKS, 600, away);
    expect(kinds(plan)[plan.floors.length - 1][0]).toBe("hearth");
    expect(bringOut(away, "plant")).toEqual({ places: away.places, away: [] });
  });

  it("nudges a piece to about the same place on the floor above", () => {
    const plan = planHouse(10, MILESTONES.plant, 335);
    expect(plan.floors.length).toBeGreaterThan(1);
    // The hearth's middle is over the gap after the first bookcase above.
    expect(nudge(plan, "hearth", "up")).toEqual({ floor: 1, slot: 1 });
  });
});

describe("rooms", () => {
  const BOOKS = MILESTONES.gramophone;
  const withRooms = (...rooms: (typeof ROOMS)[number][]) => ({ places: [], away: [], rooms });

  it("adds each room as a floor over the library, with its furniture, in the order added", () => {
    const library = planHouse(3, 40, 600);
    const plan = planHouse(3, 40, 600, withRooms("kitchen", "music"));
    expect(plan.floors).toHaveLength(library.floors.length + 2);
    expect(plan.rooms).toEqual(["music", "kitchen", ...library.rooms]);
    expect(kinds(plan)[0]).toEqual([...ROOM_PIECES.music]);
    expect(kinds(plan)[1]).toEqual([...ROOM_PIECES.kitchen]);
    expect(kinds(plan).slice(2)).toEqual(kinds(library));
  });

  it("keeps a house arranged on a wide screen inside a narrow one", () => {
    const wide = planHouse(5, BOOKS, 600, withRooms("kitchen", "music"));
    const places = placementsOf(wide);
    for (const max of [112, 141, 155, 170, 200, 260]) {
      const plan = planHouse(5, BOOKS, max, { places, away: [], rooms: ["kitchen", "music"] });
      expect(plan.inner).toBeLessThanOrEqual(max);
      expect(all(plan).filter((k) => k === "hearth")).toHaveLength(1);
      expect(all(plan).filter((k) => k === "case")).toHaveLength(5);
    }
  });

  it("fits every room's furniture into a house on a phone", () => {
    for (const room of ROOMS) {
      const plan = planHouse(1, 0, 141, withRooms(room));
      expect(kinds(plan)[0]).toEqual([...ROOM_PIECES[room]]);
      for (const floor of plan.floors.filter((f) => f.length)) {
        const end = floor[floor.length - 1];
        expect(end.x + PIECE_WIDTH[end.kind]).toBeLessThanOrEqual(plan.inner);
      }
    }
  });

  it("finds room elsewhere for a room's furniture when the house is too narrow for it all", () => {
    const plan = planHouse(1, 0, 90, withRooms("games"));
    expect(all(plan).filter((k) => (ROOM_PIECES.games as readonly string[]).includes(k)).length).toBeGreaterThan(0);
    for (const floor of plan.floors) {
      let end = 0;
      for (const piece of floor) {
        expect(piece.x).toBeGreaterThanOrEqual(end);
        end = piece.x + PIECE_WIDTH[piece.kind];
      }
      expect(end).toBeLessThanOrEqual(Math.max(plan.inner, PIECE_WIDTH.hearth + 2 * PAD));
    }
  });

  it("keeps a piece moved into a room there when the library grows a floor underneath", () => {
    const before = planHouse(4, BOOKS, 335, withRooms("bedroom"));
    const places = moveTo(before, "plant", before.floors.length - 1, 1)!;
    expect(places.find((p) => p.kind === "plant")).toMatchObject({ room: "bedroom", slot: 1 });
    const after = planHouse(12, BOOKS, 335, { places, away: [], rooms: ["bedroom"] });
    expect(after.floors.length).toBeGreaterThan(before.floors.length);
    expect(kinds(after)[0][1]).toBe("plant");
    expect(after.rooms[0]).toBe("bedroom");
  });

  it("puts a plan with rooms back exactly as it was from its own placements", () => {
    for (const width of [200, 335, 600]) {
      const plan = planHouse(8, BOOKS, width, withRooms("studio", "games", "conservatory"));
      const again = planHouse(8, BOOKS, width, {
        places: placementsOf(plan),
        away: [],
        rooms: ["studio", "games", "conservatory"],
      });
      expect(kinds(again)).toEqual(kinds(plan));
    }
  });

  it("moves room furniture to the library and library furniture into a room", () => {
    const plan = planHouse(3, BOOKS, 600, withRooms("music"));
    const ground = plan.floors.length - 1;
    const places = moveTo(plan, "piano", 0, 0)!;
    const moved = planHouse(3, BOOKS, 600, { places, away: [], rooms: ["music"] });
    expect(kinds(moved)[ground][0]).toBe("piano");
    expect(kinds(moved)[0]).not.toContain("piano");
  });

  it("puts a room's furniture away one piece at a time", () => {
    const plan = planHouse(1, 0, 600, { places: [], away: ["harp"], rooms: ["music"] });
    expect(kinds(plan)[0]).toEqual(["piano", "cello"]);
  });

  it("takes a room off with its furniture, wherever it was moved", () => {
    let a = addRoom(addRoom(NO_ARRANGEMENT, "kitchen"), "music");
    const plan = planHouse(3, BOOKS, 600, a);
    a = { ...a, places: moveTo(plan, "table", 0, 0)!, away: ["harp"] };
    a = removeRoom(a, "kitchen");
    expect(a.rooms).toEqual(["music"]);
    const after = planHouse(3, BOOKS, 600, a);
    for (const piece of ROOM_PIECES.kitchen) expect(all(after)).not.toContain(piece);
    expect(all(after)).toContain("piano");
    // The music room keeps what was put away.
    expect(a.away).toEqual(["harp"]);
    // Adding a room again puts it on top.
    expect(addRoom(a, "kitchen").rooms).toEqual(["music", "kitchen"]);
  });

  it("only has room furniture for the rooms added", () => {
    const plan = planHouse(3, BOOKS, 600, { places: [{ kind: "piano", floor: 0, slot: 0 }], away: [] });
    expect(all(plan)).not.toContain("piano");
  });
});

describe("furniture from the catalogue", () => {
  const widest = (plan: HousePlan) =>
    Math.max(...plan.floors.map((floor) => Math.max(...floor.map((p) => p.x + PIECE_WIDTH[p.kind]))));

  it("is only in the house once added, and goes wherever there is room", () => {
    expect(all(planHouse(2, 0, 600)).filter((k) => (EXTRAS as readonly string[]).includes(k))).toEqual([]);
    const a = addExtra(addExtra(NO_ARRANGEMENT, "sofa"), "dog");
    const plan = planHouse(2, 0, 600, a);
    expect(all(plan)).toEqual(expect.arrayContaining(["sofa", "dog"]));
    expect(plan.floors).toHaveLength(planHouse(2, 0, 600).floors.length);
  });

  it("adds no floor of its own, but finds space in a spare room", () => {
    const every = { places: [], away: [], extras: [...EXTRAS] };
    const narrow = planHouse(1, 0, 141, every);
    expect(narrow.floors).toHaveLength(planHouse(1, 0, 141).floors.length);
    expect(widest(narrow)).toBeLessThanOrEqual(narrow.inner);
    const placed = all(narrow).filter((k) => (EXTRAS as readonly string[]).includes(k)).length;
    expect(placed).toBeLessThan(EXTRAS.length);

    const spare = planHouse(1, 0, 141, { ...every, rooms: ["spare"] });
    expect(spare.rooms[0]).toBe("spare");
    expect(all(spare).filter((k) => (EXTRAS as readonly string[]).includes(k)).length).toBeGreaterThan(placed);
    expect(widest(spare)).toBeLessThanOrEqual(141);
  });

  it("stays where it was moved in the spare room as the library grows", () => {
    const a = { places: [], away: [], rooms: ["spare" as const], extras: ["armour" as const, "chest" as const] };
    const plan = planHouse(1, 0, 600, a);
    const places = moveTo(plan, "armour", plan.floors.length - 1, 0)!;
    expect(places.find((p) => p.kind === "armour")?.room).toBe("spare");
    const grown = planHouse(6, 0, 300, { ...a, places });
    expect(grown.rooms[0]).toBe("spare");
    expect(kinds(grown)[0][0]).toBe("armour");
  });

  it("comes out again with its place, leaving the rest where they stood", () => {
    const a = { places: [], away: [], extras: ["sofa" as const, "dog" as const, "chest" as const] };
    const plan = planHouse(2, 0, 600, a);
    const places = placementsOf(plan);
    const out = removeExtra({ ...a, places }, "sofa");
    expect(out.extras).toEqual(["dog", "chest"]);
    expect(out.places.some((p) => p.kind === "sofa")).toBe(false);
    const after = planHouse(2, 0, 600, out);
    expect(all(after)).not.toContain("sofa");
    expect(kinds(after).map((f) => f.filter((k) => k !== "sofa"))).toEqual(
      kinds(plan).map((f) => f.filter((k) => k !== "sofa")),
    );
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
