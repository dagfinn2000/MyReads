/**
 * Optional sounds (Preferences > Sound): which sound goes with what the
 * reader just did, and how loud. Off unless turned on. The sounds
 * themselves are made in the browser (lib/sound-synth.ts); this file only
 * decides, so it can be tested.
 */

export const SOUND_SETTINGS = ["off", "on"] as const;
export type SoundSetting = (typeof SOUND_SETTINGS)[number];

export const SOUND_VOLUMES = ["quiet", "medium", "loud"] as const;
export type SoundVolume = (typeof SOUND_VOLUMES)[number];

/** The loudest any sound gets at each volume, out of 1. Quiet is meant
 *  for a phone held in the hand. */
export const VOLUME_GAIN: Record<SoundVolume, number> = {
  quiet: 0.22,
  medium: 0.42,
  loud: 0.7,
};

export type SoundName = "rustle" | "chime" | "flourish" | "thunk" | "tick";

/** Things the reader does that can make a sound. */
export type SoundEvent = "logged" | "finished" | "goal" | "added" | "rated";

export const EVENT_SOUNDS: Record<SoundEvent, SoundName> = {
  /** Pages or minutes logged: a soft rustle of paper. */
  logged: "rustle",
  /** A book marked Read: a warm two-note chime. */
  finished: "chime",
  /** The daily goal reached while the page is open: a short flourish. */
  goal: "flourish",
  /** A book added to the library: a soft thunk, as on a shelf. */
  added: "thunk",
  /** A rating picked: a light tick. */
  rated: "tick",
};

/** What to play for `event`, or null with sounds off. */
export function soundFor(
  event: SoundEvent,
  prefs: { sounds: SoundSetting; soundVolume: SoundVolume },
): { name: SoundName; gain: number } | null {
  if (prefs.sounds !== "on") return null;
  return { name: EVENT_SOUNDS[event], gain: VOLUME_GAIN[prefs.soundVolume] };
}
