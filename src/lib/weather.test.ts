import { describe, expect, it } from "vitest";
import {
  codeFromForecast,
  describeWeather,
  forecastUrl,
  geocodeUrl,
  parseWeatherPlace,
  placeFromPosition,
  placeKey,
  placesFromGeocode,
  weatherFromCode,
} from "@/lib/weather";

describe("weatherFromCode", () => {
  it("reads rain, snow and how hard", () => {
    expect(weatherFromCode(51)).toEqual({ kind: "rain", amount: "light" });
    expect(weatherFromCode(61)).toEqual({ kind: "rain", amount: "light" });
    expect(weatherFromCode(63)).toEqual({ kind: "rain", amount: "moderate" });
    expect(weatherFromCode(65)).toEqual({ kind: "rain", amount: "heavy" });
    expect(weatherFromCode(82)).toEqual({ kind: "rain", amount: "heavy" });
    expect(weatherFromCode(95)).toEqual({ kind: "rain", amount: "heavy" });
    expect(weatherFromCode(71)).toEqual({ kind: "snow", amount: "light" });
    expect(weatherFromCode(73)).toEqual({ kind: "snow", amount: "moderate" });
    expect(weatherFromCode(86)).toEqual({ kind: "snow", amount: "heavy" });
  });

  it("is dry under clear skies, cloud and fog", () => {
    for (const code of [0, 1, 2, 3, 45, 48, 999, -1]) expect(weatherFromCode(code)).toBeNull();
  });
});

describe("places", () => {
  it("keeps a place to one decimal", () => {
    expect(parseWeatherPlace({ name: " Bergen ", lat: 60.39299, lon: 5.32415 })).toEqual({
      name: "Bergen",
      lat: 60.4,
      lon: 5.3,
    });
    expect(placeFromPosition(59.91273, 10.74609)).toEqual({ name: "Where you are", lat: 59.9, lon: 10.7 });
  });

  it("turns away what isn't a place", () => {
    expect(parseWeatherPlace(null)).toBeNull();
    expect(parseWeatherPlace("Bergen")).toBeNull();
    expect(parseWeatherPlace({ name: "", lat: 1, lon: 1 })).toBeNull();
    expect(parseWeatherPlace({ name: "X", lat: 91, lon: 1 })).toBeNull();
    expect(parseWeatherPlace({ name: "X", lat: 1, lon: "2" })).toBeNull();
    expect(parseWeatherPlace({ name: "X", lat: Number.NaN, lon: 2 })).toBeNull();
  });

  it("asks for no more than the rounded place", () => {
    expect(forecastUrl({ lat: 60.39299, lon: 5.32415 })).toBe(
      "https://api.open-meteo.com/v1/forecast?latitude=60.4&longitude=5.3&current=weather_code",
    );
    expect(placeKey({ lat: 60.39299, lon: 5.32415 })).toBe("60.4,5.3");
    expect(geocodeUrl(" São Paulo ")).toContain("name=S%C3%A3o%20Paulo&");
  });
});

describe("answers", () => {
  it("reads the weather code", () => {
    expect(codeFromForecast({ current: { time: "2026-11-18T10:00", interval: 900, weather_code: 63 } })).toBe(63);
    expect(codeFromForecast({ current: {} })).toBeNull();
    expect(codeFromForecast({ error: true, reason: "Latitude must be in range" })).toBeNull();
    expect(codeFromForecast(null)).toBeNull();
  });

  it("names towns so ones of the same name can be told apart", () => {
    const json = {
      results: [
        { name: "Bergen", latitude: 60.39299, longitude: 5.32415, country: "Norway", admin1: "Vestland" },
        { name: "Bergen", latitude: 52.66, longitude: 4.7, country: "Netherlands", admin1: "North Holland" },
        { name: "Oslo", latitude: 59.91, longitude: 10.75, country: "Norway", admin1: "Oslo" },
        { name: "Nowhere" },
      ],
    };
    expect(placesFromGeocode(json)).toEqual([
      { name: "Bergen, Vestland, Norway", lat: 60.4, lon: 5.3 },
      { name: "Bergen, North Holland, Netherlands", lat: 52.7, lon: 4.7 },
      { name: "Oslo, Norway", lat: 59.9, lon: 10.8 },
    ]);
    expect(placesFromGeocode({ generationtime_ms: 0.2 })).toEqual([]);
  });

  it("says what the weather is", () => {
    expect(describeWeather(null)).toBe("Dry");
    expect(describeWeather({ kind: "snow", amount: "heavy" })).toBe("Heavy snow");
  });
});
