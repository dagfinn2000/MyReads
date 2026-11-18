import { describe, expect, it } from "vitest";
import { daylightAt, daylightStyle } from "@/lib/daylight";

describe("daylightAt", () => {
  it("leaves the middle of the day alone", () => {
    const noon = daylightAt(new Date("2026-06-21T11:15:00Z"), "Europe/Oslo");
    expect(noon).toEqual({ phase: "day", warm: 0, night: 0 });
  });

  it("is warm at sunset, dusk in the evening and dawn in the morning", () => {
    // Sunset in London on the spring equinox is about 18:10; the light is
    // warmest a little before.
    const evening = daylightAt(new Date("2026-03-20T17:55:00Z"), "Europe/London");
    expect(evening.phase).toBe("dusk");
    expect(evening.warm).toBeGreaterThan(0.5);
    const morning = daylightAt(new Date("2026-03-20T06:10:00Z"), "Europe/London");
    expect(morning.phase).toBe("dawn");
    expect(morning.warm).toBeGreaterThan(0.5);
  });

  it("is full night at midnight, with no warmth left", () => {
    const midnight = daylightAt(new Date("2026-12-21T23:00:00Z"), "Europe/Oslo");
    expect(midnight).toEqual({ phase: "night", warm: 0, night: 1 });
  });

  it("follows the season: a winter afternoon in Oslo is already dusk", () => {
    // 15:30 in Oslo, a little after the sun has gone down.
    expect(daylightAt(new Date("2026-12-21T14:30:00Z"), "Europe/Oslo").phase).toBe("dusk");
    expect(daylightAt(new Date("2026-06-21T14:30:00Z"), "Europe/Oslo").phase).toBe("day");
  });

  it("takes an unknown zone as UTC rather than failing", () => {
    expect(daylightAt(new Date("2026-06-21T12:00:00Z"), "Not/AZone").phase).toBe("day");
  });
});

describe("daylightStyle", () => {
  it("gives the two amounts as custom properties", () => {
    expect(daylightStyle({ phase: "dusk", warm: 0.4, night: 0.2 })).toEqual({
      "--dl-warm": "0.4",
      "--dl-night": "0.2",
    });
  });
});
