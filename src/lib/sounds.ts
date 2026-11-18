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

export type SoundName = "rustle" | "chime" | "flourish" | "thunk" | "tick" | "thud";

/** Things the reader does that can make a sound. */
export const SOUND_EVENTS = ["logged", "shelved", "finished", "goal", "added", "rated"] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

export const EVENT_SOUNDS: Record<SoundEvent, SoundName> = {
  /** Pages or minutes logged: a page turning, or a riffle of a few pages
   *  for a long sitting (pageTurns). */
  logged: "rustle",
  /** A book put on one of the reader's shelves, or closed back into its
   *  place in the library or the reading room: it slides in and lands with
   *  a soft wooden thud. */
  shelved: "thud",
  /** A book marked Read: a warm two-note chime. */
  finished: "chime",
  /** The daily goal reached while the page is open: a short flourish. */
  goal: "flourish",
  /** A book added to the library: a soft thunk, as on a shelf. */
  added: "thunk",
  /** A rating picked: a light tick. */
  rated: "tick",
};

/** The most pages a riffle turns. */
export const MOST_TURNS = 5;

/**
 * How many pages turn for `pages` logged: one for a few, more for a long
 * sitting, up to a riffle of five for a hundred or more. A log that goes
 * back (a correction) or where the start isn't known turns one.
 */
export function pageTurns(pages: number | null | undefined): number {
  if (pages == null || !Number.isFinite(pages) || pages < 10) return 1;
  if (pages < 25) return 2;
  if (pages < 50) return 3;
  if (pages < 100) return 4;
  return MOST_TURNS;
}

/** What goes with an event besides its name: for a log, how many pages
 *  went by. */
export type SoundDetail = { pages?: number | null };

export type Sound = { name: SoundName; gain: number; turns?: number };

/** What to play for `event`, or null with sounds off or that sound turned
 *  off (Preferences > Sound). */
export function soundFor(
  event: SoundEvent,
  prefs: { sounds: SoundSetting; soundVolume: SoundVolume; mutedSounds?: readonly SoundEvent[] },
  detail?: SoundDetail,
): Sound | null {
  if (prefs.sounds !== "on" || prefs.mutedSounds?.includes(event)) return null;
  const sound: Sound = { name: EVENT_SOUNDS[event], gain: VOLUME_GAIN[prefs.soundVolume] };
  if (event === "logged") sound.turns = pageTurns(detail?.pages);
  return sound;
}
