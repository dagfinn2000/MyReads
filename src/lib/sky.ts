import { isValidTimeZone } from "@/lib/preferences";
import { zoneOffset } from "@/lib/dates";

/**
 * The Sky background (globals.css): a wash of colour behind the pages that
 * follows the time of day where the reader is. Dawn is rose, day is blue,
 * dusk is amber, and night is deep blue with stars.
 *
 * It works out how high the sun is from the clock, the date and roughly
 * where the reader's time zone is on the globe, so winter days are short
 * and summer evenings stay light. A zone in the table below uses its own
 * city's latitude and longitude; any other zone is placed at 45° in its
 * hemisphere, on the meridian its clock keeps. That is close enough for
 * colours. No location is ever asked for.
 */

/** [latitude, longitude] of the city each common zone is named after. */
const PLACES: Record<string, readonly [number, number]> = {
  "Europe/Oslo": [59.9, 10.7],
  "Europe/Stockholm": [59.3, 18.1],
  "Europe/Copenhagen": [55.7, 12.6],
  "Europe/Helsinki": [60.2, 24.9],
  "Atlantic/Reykjavik": [64.1, -21.9],
  "Europe/London": [51.5, -0.1],
  "Europe/Dublin": [53.3, -6.3],
  "Europe/Lisbon": [38.7, -9.1],
  "Europe/Madrid": [40.4, -3.7],
  "Europe/Paris": [48.9, 2.4],
  "Europe/Brussels": [50.8, 4.4],
  "Europe/Amsterdam": [52.4, 4.9],
  "Europe/Berlin": [52.5, 13.4],
  "Europe/Zurich": [47.4, 8.5],
  "Europe/Vienna": [48.2, 16.4],
  "Europe/Prague": [50.1, 14.4],
  "Europe/Warsaw": [52.2, 21.0],
  "Europe/Rome": [41.9, 12.5],
  "Europe/Athens": [38.0, 23.7],
  "Europe/Istanbul": [41.0, 29.0],
  "Europe/Kyiv": [50.5, 30.5],
  "Europe/Moscow": [55.8, 37.6],
  "America/St_Johns": [47.6, -52.7],
  "America/Halifax": [44.6, -63.6],
  "America/New_York": [40.7, -74.0],
  "America/Toronto": [43.7, -79.4],
  "America/Chicago": [41.9, -87.6],
  "America/Denver": [39.7, -105.0],
  "America/Phoenix": [33.4, -112.1],
  "America/Los_Angeles": [34.1, -118.2],
  "America/Vancouver": [49.3, -123.1],
  "America/Anchorage": [61.2, -149.9],
  "America/Mexico_City": [19.4, -99.1],
  "America/Bogota": [4.7, -74.1],
  "America/Sao_Paulo": [-23.5, -46.6],
  "America/Argentina/Buenos_Aires": [-34.6, -58.4],
  "America/Santiago": [-33.4, -70.7],
  "Pacific/Honolulu": [21.3, -157.9],
  "Asia/Tokyo": [35.7, 139.7],
  "Asia/Seoul": [37.6, 127.0],
  "Asia/Shanghai": [31.2, 121.5],
  "Asia/Hong_Kong": [22.3, 114.2],
  "Asia/Singapore": [1.3, 103.8],
  "Asia/Bangkok": [13.8, 100.5],
  "Asia/Jakarta": [-6.2, 106.8],
  "Asia/Manila": [14.6, 121.0],
  "Asia/Kolkata": [22.6, 88.4],
  "Asia/Dubai": [25.2, 55.3],
  "Asia/Jerusalem": [31.8, 35.2],
  "Africa/Cairo": [30.0, 31.2],
  "Africa/Lagos": [6.5, 3.4],
  "Africa/Nairobi": [-1.3, 36.8],
  "Africa/Johannesburg": [-26.2, 28.0],
  "Australia/Perth": [-31.95, 115.9],
  "Australia/Adelaide": [-34.9, 138.6],
  "Australia/Brisbane": [-27.5, 153.0],
  "Australia/Sydney": [-33.9, 151.2],
  "Australia/Melbourne": [-37.8, 145.0],
  "Pacific/Auckland": [-36.8, 174.8],
};

/** Zones south of the equator that the table doesn't name. */
const SOUTHERN = /^(Australia|Antarctica)\/|^America\/(Argentina|Montevideo|Asuncion|La_Paz|Lima)|^Africa\/(Maputo|Harare|Lusaka|Windhoek|Gaborone)|^Indian\/(Mauritius|Reunion|Antananarivo)|^Pacific\/(Fiji|Tongatapu|Chatham|Noumea)/;

const RAD = Math.PI / 180;

/** Roughly where on the globe a time zone is: [latitude, longitude]. */
export function placeOf(timeZone: string, at: Date): readonly [number, number] {
  const known = PLACES[timeZone];
  if (known) return known;
  // The meridian of the zone's standard time: the smaller of its winter
  // and summer offsets, since daylight saving only ever adds an hour.
  const year = at.getUTCFullYear();
  const jan = zoneOffset(Date.UTC(year, 0, 1), timeZone);
  const jul = zoneOffset(Date.UTC(year, 6, 1), timeZone);
  const lon = (Math.min(jan, jul) / 3_600_000) * 15;
  return [SOUTHERN.test(timeZone) ? -45 : 45, lon];
}

export interface Sun {
  /** Degrees above the horizon; negative below it. */
  elevation: number;
  /** Degrees from solar noon: negative in the morning. */
  hourAngle: number;
  /** The hour angle of sunset (and, negated, sunrise): 0 when the sun
   *  never rises, 180 when it never sets. */
  setAngle: number;
}

/** Where the sun is at `at`, seen from latitude `lat` and longitude `lon`.
 *  The usual textbook approximation; good to a degree or so. */
export function sunAt(at: Date, lat: number, lon: number): Sun {
  const start = Date.UTC(at.getUTCFullYear(), 0, 1);
  const day = (at.getTime() - start) / 86_400_000;
  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
  const utcHours = at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600;
  let hourAngle = 15 * (utcHours + lon / 15 - 12);
  hourAngle = ((((hourAngle + 180) % 360) + 360) % 360) - 180;

  const phi = lat * RAD;
  const delta = declination * RAD;
  const sinEl =
    Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle * RAD);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) / RAD;

  // -0.83°: the sun's disc and the air's bending put sunrise a little early.
  const cosSet =
    (Math.sin(-0.83 * RAD) - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));
  const setAngle = cosSet <= -1 ? 180 : cosSet >= 1 ? 0 : Math.acos(cosSet) / RAD;
  return { elevation, hourAngle, setAngle };
}

/** 0 below `from`, 1 above `to`, eased between. */
function smooth(from: number, to: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** What the Sky background shows at one moment, as numbers globals.css
 *  turns into colours. */
export interface SkyState {
  /** 0 at night to 1 in full day. */
  day: number;
  /** How much of dawn or dusk's warm colour is in the sky, 0–1. */
  warm: number;
  /** 0 in the morning, 1 in the evening: rose at dawn, amber at dusk. */
  evening: number;
  /** How bright the stars are, 0–1. */
  stars: number;
  /** Where the sun's light comes from, in percent of the window. */
  sunX: number;
  sunY: number;
  /** Where the moonlight comes from at night. */
  moonX: number;
  moonY: number;
}

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;

export function skyAt(at: Date, timeZone: string): SkyState {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const [lat, lon] = placeOf(zone, at);
  const { elevation: el, hourAngle: h, setAngle } = sunAt(at, lat, lon);

  // Day reaches full strength a little after sunrise; the stars come out
  // once the sun is well down (nautical twilight).
  const day = smooth(-6, 8, el);
  const warm = Math.max(0, 1 - Math.abs(el - 1) / 8);
  const stars = 1 - smooth(-11, -4, el);

  // The sun rises at the left edge and sets at the right, highest at noon.
  // Its height on screen follows its real height, so a winter sun stays
  // low all day.
  const arc = Math.max(setAngle, 1);
  const sunX = 50 + 44 * Math.max(-1.2, Math.min(1.2, h / arc));
  const sunY = 78 - 66 * Math.max(-0.2, Math.min(1, el / 60));

  // The moon keeps to the other side of the sky.
  const night = Math.max(180 - setAngle, 1);
  const mh = h > 0 ? h - 180 : h + 180;
  const moonX = 50 + 40 * Math.max(-1, Math.min(1, mh / night));
  const moonY = 22 + 30 * Math.abs(mh / night);

  return {
    day: round(day),
    warm: round(warm),
    evening: h > 0 ? 1 : 0,
    stars: round(stars),
    sunX: round(sunX, 1),
    sunY: round(sunY, 1),
    moonX: round(moonX, 1),
    moonY: round(Math.min(60, moonY), 1),
  };
}

/** A SkyState as the custom properties globals.css reads. */
export function skyStyle(s: SkyState): Record<string, string> {
  return {
    "--sky-day": String(s.day),
    "--sky-warm": String(s.warm),
    "--sky-evening": String(s.evening),
    "--sky-stars": String(s.stars),
    "--sky-sun-x": `${s.sunX}%`,
    "--sky-sun-y": `${s.sunY}%`,
    "--sky-moon-x": `${s.moonX}%`,
    "--sky-moon-y": `${s.moonY}%`,
  };
}
