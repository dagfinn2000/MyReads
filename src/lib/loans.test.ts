import { describe, expect, it } from "vitest";
import { outFor } from "@/lib/loans";

const at = (iso: string) => new Date(iso);

describe("outFor", () => {
  it("says 'lent today' before a full day has passed", () => {
    // The case that was wrong first time round: lent in the morning, read in
    // the evening. Rounding made that "1 days" — wrong count, wrong grammar.
    expect(outFor(at("2026-07-28T08:00:00Z"), at("2026-07-28T22:00:00Z"))).toBe("lent today");
    expect(outFor(at("2026-07-28T00:00:00Z"), at("2026-07-28T00:00:00Z"))).toBe("lent today");
  });

  it("uses the singular for exactly one day", () => {
    expect(outFor(at("2026-07-27T08:00:00Z"), at("2026-07-28T08:00:00Z"))).toBe("out for 1 day");
    expect(outFor(at("2026-07-27T08:00:00Z"), at("2026-07-28T23:00:00Z"))).toBe("out for 1 day");
  });

  it("counts whole days after that", () => {
    expect(outFor(at("2026-07-01T08:00:00Z"), at("2026-07-28T08:00:00Z"))).toBe("out for 27 days");
  });

  it("never reports negative time for a future-dated loan", () => {
    expect(outFor(at("2026-08-05T00:00:00Z"), at("2026-07-28T00:00:00Z"))).toBe("lent today");
  });
});
