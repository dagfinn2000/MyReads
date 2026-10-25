"use client";

import { useCallback, useEffect, useEffectEvent } from "react";
import { usePathname } from "next/navigation";
import { playSynth } from "@/lib/sound-synth";
import { VOLUME_GAIN, soundFor, type SoundEvent, type SoundName, type SoundVolume } from "@/lib/sounds";
import { usePreferences } from "@/components/preferences-provider";

/**
 * The one AudioContext, made on the reader's first tap or key press after
 * sounds are on (SoundUnlock), since browsers only let sound start from
 * something the person did. With sounds off there is none, and nothing
 * waits for a tap.
 */
let context: AudioContext | null = null;

/** The context, made or woken up. Only ever called from a tap or a key
 *  press, or after one has made it. Null where Web Audio is missing. */
function wake(): AudioContext | null {
  try {
    if (!context) {
      if (typeof AudioContext === "undefined") return null;
      context = new AudioContext();
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

function play(name: SoundName, gain: number) {
  const ctx = context;
  if (!ctx) return;
  try {
    playSynth(ctx, name, gain);
  } catch {
    // A browser without some part of Web Audio: no sound, nothing else.
  }
}

/**
 * Plays the sound for something the reader just did, if sounds are on.
 * Call it only for the reader's own actions in this tab, never on a page
 * opening or a refresh.
 */
export function useSound(): (event: SoundEvent) => void {
  const { sounds, soundVolume } = usePreferences();
  return useCallback(
    (event: SoundEvent) => {
      const sound = soundFor(event, { sounds, soundVolume });
      if (sound) play(sound.name, sound.gain);
    },
    [sounds, soundVolume],
  );
}

/**
 * A sound waiting on a save that may go on to another page (adding a book
 * opens it): the server's redirect means the save never answers the form,
 * so SoundUnlock plays it when the page changes. Dropped if it waits too
 * long.
 */
let waiting: { event: SoundEvent; since: number } | null = null;
const WAIT_MS = 15_000;

/**
 * The sound for a form's save: `start` as it's sent, `done` when it
 * answers. Plays once the save is known to have worked, whether it
 * answers or moves to another page.
 */
export function useSaveSound(event: SoundEvent | undefined) {
  const sound = useSound();
  return {
    start() {
      if (event) waiting = { event, since: Date.now() };
    },
    done(worked: boolean) {
      if (!event || waiting?.event !== event) return;
      waiting = null;
      if (worked) sound(event);
    },
  };
}

/** The sample in Preferences, at the volume being tried. It plays from
 *  its own button press, so it works with sounds still off. */
export function playSample(volume: SoundVolume) {
  wake();
  play("chime", VOLUME_GAIN[volume]);
}

/**
 * With sounds on, makes the AudioContext on the first tap or key press, and
 * wakes it on later ones if the browser put it to sleep (phones do, after a
 * call), so a sound that follows a save a moment later, once the server
 * answers, can still play. Also plays a save's sound on the page it went
 * on to. Renders nothing.
 */
export function SoundUnlock() {
  const { sounds } = usePreferences();
  const pathname = usePathname();
  const sound = useSound();

  // A save that went on to another page (useSaveSound) worked.
  const arrived = useEffectEvent(() => {
    if (!waiting) return;
    const { event, since } = waiting;
    waiting = null;
    if (Date.now() - since < WAIT_MS) sound(event);
  });
  useEffect(() => arrived(), [pathname]);

  useEffect(() => {
    if (sounds !== "on") return;
    const unlock = () => void wake();
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [sounds]);
  return null;
}
