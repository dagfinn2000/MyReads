import { describe, expect, it } from "vitest";
import { placeOf, skyAt, skyStyle, sunAt } from "@/lib/sky";

describe("sunAt", () => {
  it("puts the midsummer noon sun high over Oslo, and well down at midwinter midnight", () => {
    // 13:15 summer time and 00:00 winter time in Oslo.
    expect(sunAt(new Date("2026-06-21T11:15:00Z"), 59.9, 10.7).elevation).toBeGreaterThan(50);
    expect(sunAt(new Date("2026-12-21T23:00:00Z"), 59.9, 10.7).elevation).toBeLessThan(-45);
  });

  it("knows the far north has short winter days and a sun that never sets in summer", () => {
    const winter = sunAt(new Date("2026-12-21T11:00:00Z"), 59.9, 10.7);
    // About six hours of daylight: three each side of noon.
    expect(winter.setAngle).toBeGreaterThan(40);
    expect(winter.setAngle).toBeLessThan(50);
    expect(sunAt(new Date("2026-06-21T11:00:00Z"), 70, 20).setAngle).toBe(180);
  });

  it("has the hour angle negative in the morning", () => {
    expect(sunAt(new Date("2026-03-20T07:00:00Z"), 51.5, 0).hourAngle).toBeLessThan(0);
    expect(sunAt(new Date("2026-03-20T17:00:00Z"), 51.5, 0).hourAngle).toBeGreaterThan(0);
  });
});

describe("placeOf", () => {
  it("uses a known zone's own city", () => {
    expect(placeOf("Europe/Oslo", new Date())).toEqual([59.9, 10.7]);
  });

  it("puts any other zone at 45° on its standard meridian", () => {
    // Winnipeg keeps UTC−6 in winter, so 90° west.
    expect(placeOf("America/Winnipeg", new Date("2026-01-10T00:00:00Z"))).toEqual([45, -90]);
    expect(placeOf("Australia/Hobart", new Date("2026-01-10T00:00:00Z"))[0]).toBe(-45);
  });
});

describe("skyAt", () => {
  it("is full day at noon and full night at midnight", () => {
    const noon = skyAt(new Date("2026-06-21T11:15:00Z"), "Europe/Oslo");
    expect(noon.day).toBe(1);
    expect(noon.stars).toBe(0);
    const midnight = skyAt(new Date("2026-12-21T23:00:00Z"), "Europe/Oslo");
    expect(midnight.day).toBe(0);
    expect(midnight.stars).toBe(1);
  });

  it("keeps Oslo's midsummer night light enough to hide the stars", () => {
    const night = skyAt(new Date("2026-06-20T22:30:00Z"), "Europe/Oslo");
    expect(night.stars).toBeLessThan(0.5);
    expect(night.warm).toBeGreaterThan(0);
  });

  it("warms the sky at dusk, and marks it as evening", () => {
    // 15:30 in Oslo in December, just after sunset.
    const dusk = skyAt(new Date("2026-12-21T14:30:00Z"), "Europe/Oslo");
    expect(dusk.warm).toBeGreaterThan(0.5);
    expect(dusk.evening).toBe(1);
    const dawn = skyAt(new Date("2026-03-20T06:15:00Z"), "Europe/London");
    expect(dawn.warm).toBeGreaterThan(0);
    expect(dawn.evening).toBe(0);
  });

  it("follows the southern summer", () => {
    // Midday in Sydney in December.
    expect(skyAt(new Date("2026-12-21T02:00:00Z"), "Australia/Sydney").day).toBe(1);
  });

  it("moves the sun from left to right through the day", () => {
    const morning = skyAt(new Date("2026-06-21T05:00:00Z"), "Europe/Oslo");
    const evening = skyAt(new Date("2026-06-21T17:00:00Z"), "Europe/Oslo");
    expect(morning.sunX).toBeLessThan(40);
    expect(evening.sunX).toBeGreaterThan(60);
  });

  it("falls back to UTC for a zone it doesn't know", () => {
    const at = new Date("2026-06-21T12:00:00Z");
    expect(skyAt(at, "Not/AZone")).toEqual(skyAt(at, "UTC"));
    expect(skyAt(at, "")).toEqual(skyAt(at, "UTC"));
  });
});

describe("skyStyle", () => {
  it("writes the numbers as custom properties", () => {
    const style = skyStyle(skyAt(new Date("2026-06-21T11:15:00Z"), "Europe/Oslo"));
    expect(style["--sky-day"]).toBe("1");
    expect(style["--sky-sun-x"]).toMatch(/^\d+(\.\d)?%$/);
  });
});
