import { skyAt } from "@/lib/sky";
import { THEMES } from "@/lib/themes";

/**
 * The light of the time of day on the app's scenes and the reading room
 * (components/daylight.tsx, globals.css "Time of day"): warm at dawn and
 * dusk, dim at night, nothing at all by day. It follows the sun where the
 * reader is, as the Sky background does (lib/sky.ts), so a winter
 * afternoon in Oslo is already dusk and a summer night there barely dims.
 */
export type DaylightPhase = "day" | "dawn" | "dusk" | "night";

export interface Daylight {
  phase: DaylightPhase;
  /** How much warm, low light there is, 0–1: most as the sun touches the
   *  horizon. */
  warm: number;
  /** How far into the night, 0 by day to 1 once it's fully dark. */
  night: number;
}

export function daylightAt(at: Date, timeZone: string): Daylight {
  const sky = skyAt(at, timeZone);
  // Half dimmed by the time the sun is a few degrees down, and fully dark
  // once the stars are all out.
  const night = Math.round(Math.max(sky.stars, (1 - sky.day) * 0.5) * 1000) / 1000;
  // The warm light gives way to the dark as night comes on.
  const warm = Math.round(sky.warm * (1 - night * 0.6) * 1000) / 1000;
  const phase: DaylightPhase =
    night >= 0.5 ? "night" : warm > 0.05 || night > 0.05 ? (sky.evening ? "dusk" : "dawn") : "day";
  return { phase, warm, night };
}

/** A Daylight as the custom properties globals.css reads. */
export function daylightStyle(light: Daylight): Record<string, string> {
  return { "--dl-warm": String(light.warm), "--dl-night": String(light.night) };
}

/** The backgrounds that are scenes the light falls on. Not Sky, which
 *  shows the time of day already, nor the textures. */
export const SCENE_BACKGROUNDS: ReadonlySet<string> = new Set(["stars", "aurora", "rain", "ripples", "snow"]);
/** The themes under Scenes in the palette menu. */
export const SCENE_THEMES: ReadonlySet<string> = new Set(
  THEMES.filter((t) => t.category === "scenes").map((t) => t.id),
);

/** Whether a page starts over a scene: a theme's own picture when it has
 *  one, else the background from Preferences. */
export function startsOverScene(background: string, theme: { id: string; ownBackground?: boolean } | null): boolean {
  return theme?.ownBackground ? SCENE_THEMES.has(theme.id) : SCENE_BACKGROUNDS.has(background);
}
