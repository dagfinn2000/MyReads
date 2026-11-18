/**
 * The weather outside (Preferences > Appearance > Weather outside): rain or
 * snow falling over the scenes behind the pages and round the reading room
 * when it is raining or snowing where the reader is. Off unless turned on.
 *
 * The reader's browser asks Open-Meteo (open-meteo.com: free, no account or
 * key) for the weather at the place they set, rounded to about ten
 * kilometres, every twenty minutes while a page is open. The server never
 * asks for anything. When the weather can't be had (offline, the service
 * down or blocked) nothing falls and nothing says so: the scene simply
 * stays as it is (components/weather-outside.tsx).
 *
 * This file only decides, so it can be tested: what a weather code means,
 * how a place is stored, and what the service's answers hold.
 */

export const WEATHER_SETTINGS = ["off", "on"] as const;
export type WeatherSetting = (typeof WEATHER_SETTINGS)[number];

export type WeatherKind = "rain" | "snow";
/** How hard it is coming down. */
export type WeatherAmount = "light" | "moderate" | "heavy";
export type Weather = { kind: WeatherKind; amount: WeatherAmount };

/** A place the weather is asked for: a town looked up by name, or where the
 *  device said it was. Stored rounded (placeCoordinate). */
export type WeatherPlace = { name: string; lat: number; lon: number };

export const PLACE_NAME_MAX = 80;

/** Ask again after this long. The service updates every quarter of an hour. */
export const WEATHER_FRESH_MS = 20 * 60_000;
/** An answer older than this is no longer trusted: better nothing falling
 *  than rain that stopped hours ago. */
export const WEATHER_STALE_MS = 2 * 60 * 60_000;

/**
 * What a WMO weather code (as Open-Meteo gives it) means here: rain, snow
 * or neither, and how hard. Drizzle and freezing drizzle are light rain;
 * thunderstorms, with or without hail, are heavy rain. Snow grains are light
 * snow. Clear skies, cloud and fog are dry.
 */
export function weatherFromCode(code: number): Weather | null {
  switch (code) {
    case 51: // drizzle: light, moderate, dense
    case 53:
    case 55:
    case 56: // freezing drizzle
    case 57:
    case 61: // slight rain
    case 66: // light freezing rain
    case 80: // slight rain showers
      return { kind: "rain", amount: "light" };
    case 63: // moderate rain
    case 81: // moderate rain showers
      return { kind: "rain", amount: "moderate" };
    case 65: // heavy rain
    case 67: // heavy freezing rain
    case 82: // violent rain showers
    case 95: // thunderstorm
    case 96: // thunderstorm with hail
    case 99:
      return { kind: "rain", amount: "heavy" };
    case 71: // slight snow
    case 77: // snow grains
    case 85: // slight snow showers
      return { kind: "snow", amount: "light" };
    case 73: // moderate snow
      return { kind: "snow", amount: "moderate" };
    case 75: // heavy snow
    case 86: // heavy snow showers
      return { kind: "snow", amount: "heavy" };
    default:
      return null;
  }
}

/** A latitude or longitude to one decimal: about ten kilometres, close
 *  enough for the weather and no closer. */
export function placeCoordinate(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A stored place, or null if it isn't one. */
export function parseWeatherPlace(value: unknown): WeatherPlace | null {
  if (!value || typeof value !== "object") return null;
  const { name, lat, lon } = value as Record<string, unknown>;
  if (typeof name !== "string" || typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const trimmed = name.trim().slice(0, PLACE_NAME_MAX);
  if (!trimmed) return null;
  return { name: trimmed, lat: placeCoordinate(lat), lon: placeCoordinate(lon) };
}

/** The same place, for knowing whether a saved answer is for it. */
export function placeKey(place: Pick<WeatherPlace, "lat" | "lon">): string {
  return `${placeCoordinate(place.lat)},${placeCoordinate(place.lon)}`;
}

/** Where to ask for the weather at `place` now. */
export function forecastUrl(place: Pick<WeatherPlace, "lat" | "lon">): string {
  const lat = placeCoordinate(place.lat);
  const lon = placeCoordinate(place.lon);
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code`;
}

/** The weather code in a forecast answer, or null if it has none. */
export function codeFromForecast(json: unknown): number | null {
  const current = (json as { current?: { weather_code?: unknown } } | null)?.current;
  const code = current?.weather_code;
  return typeof code === "number" && Number.isInteger(code) ? code : null;
}

/** Where to look up towns called `query`. */
export function geocodeUrl(query: string): string {
  const name = encodeURIComponent(query.trim().slice(0, PLACE_NAME_MAX));
  return `https://geocoding-api.open-meteo.com/v1/search?name=${name}&count=6&language=en&format=json`;
}

/** The towns in a geocoding answer, named so two of the same name can be
 *  told apart ("Bergen, Vestland, Norway"). */
export function placesFromGeocode(json: unknown): WeatherPlace[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: WeatherPlace[] = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const { name, admin1, country, latitude, longitude } = r as Record<string, unknown>;
    if (typeof name !== "string") continue;
    const parts = [name, admin1, country].filter((p): p is string => typeof p === "string" && p.trim() !== "");
    // "Oslo, Oslo, Norway" says Oslo twice.
    const label = parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
    const place = parseWeatherPlace({ name: label, lat: latitude, lon: longitude });
    if (place && !out.some((p) => p.name === place.name)) out.push(place);
  }
  return out;
}

/** A place from where the device says it is. */
export function placeFromPosition(lat: number, lon: number): WeatherPlace | null {
  return parseWeatherPlace({ name: "Where you are", lat, lon });
}

const AMOUNT_WORDS: Record<WeatherKind, Record<WeatherAmount, string>> = {
  rain: { light: "Light rain", moderate: "Rain", heavy: "Heavy rain" },
  snow: { light: "Light snow", moderate: "Snow", heavy: "Heavy snow" },
};

/** "Light rain" or "Dry", for the Preferences card. */
export function describeWeather(weather: Weather | null): string {
  return weather ? AMOUNT_WORDS[weather.kind][weather.amount] : "Dry";
}
