import { describe, expect, it } from "vitest";
import { parseStopReason, stopSummary, type StoppedBook } from "@/lib/stop-reasons";

let n = 0;
function stopped(over: Partial<StoppedBook> = {}): StoppedBook {
  n++;
  return {
    id: `s${n}`,
    title: `Stopped ${n}`,
    authors: [],
    coverUrl: null,
    stopReason: null,
    pageCount: null,
    currentPage: null,
    tags: [],
    ...over,
  };
}

describe("parseStopReason", () => {
  it("knows the reasons, and nothing else", () => {
    expect(parseStopReason("slow")).toBe("slow");
    expect(parseStopReason("bored")).toBeNull();
    expect(parseStopReason(3)).toBeNull();
    expect(parseStopReason(null)).toBeNull();
  });
});

describe("stopSummary", () => {
  it("counts the reasons, most often first, with none given last", () => {
    const s = stopSummary([
      stopped({ stopReason: "slow" }),
      stopped({ stopReason: "slow" }),
      stopped({ stopReason: "not-now" }),
      stopped(),
      stopped(),
      stopped(),
      stopped({ stopReason: "gone" }),
    ]);
    expect(s.total).toBe(7);
    expect(s.reasons).toEqual([
      { reason: "slow", count: 2 },
      { reason: "not-now", count: 1 },
      { reason: null, count: 4 },
    ]);
  });

  it("says how far in books were put down, and how many early", () => {
    const s = stopSummary([
      stopped({ pageCount: 400, currentPage: 40 }),
      stopped({ pageCount: 200, currentPage: 100 }),
      stopped({ pageCount: 300, currentPage: null }),
      stopped({ pageCount: 100, currentPage: 150 }),
    ]);
    expect(s.averageShare).toBeCloseTo((0.1 + 0.5 + 1) / 3);
    expect(s.early).toBe(1);
    expect(stopSummary([stopped()]).averageShare).toBeNull();
  });

  it("names tags that come up more than once, and books for another go", () => {
    const later = stopped({ stopReason: "not-now", tags: ["horror"] });
    const s = stopSummary([
      stopped({ tags: ["horror", "long", "horror"] }),
      later,
      stopped({ tags: ["romance"] }),
    ]);
    expect(s.tags).toEqual([{ tag: "horror", count: 2 }]);
    expect(s.anotherGo).toEqual([later]);
  });
});
