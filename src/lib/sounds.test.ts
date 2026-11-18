import { describe, expect, it, vi } from "vitest";
import { playSynth } from "@/lib/sound-synth";
import {
  EVENT_SOUNDS,
  MOST_TURNS,
  SOUND_VOLUMES,
  VOLUME_GAIN,
  pageTurns,
  soundFor,
  type SoundName,
} from "@/lib/sounds";

describe("soundFor", () => {
  it("plays nothing with sounds off", () => {
    expect(soundFor("finished", { sounds: "off", soundVolume: "loud" })).toBeNull();
  });

  it("names each event's sound, at the chosen volume", () => {
    expect(soundFor("logged", { sounds: "on", soundVolume: "quiet" })).toEqual({
      name: "rustle",
      gain: VOLUME_GAIN.quiet,
      turns: 1,
    });
    expect(soundFor("shelved", { sounds: "on", soundVolume: "medium" })?.name).toBe("thud");
    expect(soundFor("finished", { sounds: "on", soundVolume: "loud" })?.name).toBe("chime");
    expect(soundFor("goal", { sounds: "on", soundVolume: "medium" })?.name).toBe("flourish");
    expect(soundFor("added", { sounds: "on", soundVolume: "medium" })?.name).toBe("thunk");
    expect(soundFor("rated", { sounds: "on", soundVolume: "medium" })?.name).toBe("tick");
  });

  it("keeps quiet a sound turned off, and plays the rest", () => {
    const prefs = { sounds: "on" as const, soundVolume: "medium" as const, mutedSounds: ["shelved" as const] };
    expect(soundFor("shelved", prefs)).toBeNull();
    expect(soundFor("logged", prefs)?.name).toBe("rustle");
  });

  it("turns more pages the more were read, up to a riffle of five", () => {
    expect([null, -12, 0, 4, 9, 10, 24, 25, 49, 50, 99, 100, 640].map(pageTurns)).toEqual([
      1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
    expect(soundFor("logged", { sounds: "on", soundVolume: "loud" }, { pages: 60 })?.turns).toBe(4);
    expect(soundFor("finished", { sounds: "on", soundVolume: "loud" }, { pages: 60 })?.turns).toBeUndefined();
  });

  it("gets louder from quiet to loud, and never past full", () => {
    const gains = SOUND_VOLUMES.map((v) => VOLUME_GAIN[v]);
    expect(gains).toEqual([...gains].sort((a, b) => a - b));
    expect(Math.max(...gains)).toBeLessThanOrEqual(1);
  });
});

/** Just enough of an AudioContext to see what a sound schedules: when each
 *  source stops, and the loudest each gain node is asked to reach. */
function fakeContext() {
  const stops: number[] = [];
  const peaks: number[] = [];
  const param = (isGain = false) => {
    const values: number[] = [];
    const record = (v: number) => {
      values.push(v);
      if (isGain) peaks.push(v);
    };
    return {
      set value(v: number) {
        record(v);
      },
      get value() {
        return values.at(-1) ?? 0;
      },
      setValueAtTime: record,
      exponentialRampToValueAtTime: record,
      linearRampToValueAtTime: record,
    };
  };
  const node = () => ({ connect: (next: unknown) => next, disconnect: () => {} });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain: () => ({ ...node(), gain: param(true) }),
    createBiquadFilter: () => ({ ...node(), type: "", Q: param(), frequency: param() }),
    createOscillator: () => ({
      ...node(),
      type: "",
      frequency: param(),
      start: () => {},
      stop: (t: number) => void stops.push(t),
    }),
    createBufferSource: () => ({
      ...node(),
      buffer: null,
      start: () => {},
      stop: (t: number) => void stops.push(t),
    }),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, stops, peaks };
}

describe("playSynth", () => {
  vi.useFakeTimers();

  it.each(Object.values(EVENT_SOUNDS))("%s is over within a second", (name: SoundName) => {
    const { ctx, stops } = fakeContext();
    playSynth(ctx, name, VOLUME_GAIN.loud);
    expect(stops.length).toBeGreaterThan(0);
    expect(Math.max(...stops)).toBeLessThanOrEqual(1);
  });

  it("a riffle of the most pages is still over within a second", () => {
    const { ctx, stops } = fakeContext();
    playSynth(ctx, "rustle", VOLUME_GAIN.loud, MOST_TURNS);
    expect(stops.length).toBeGreaterThan(9);
    expect(Math.max(...stops)).toBeLessThanOrEqual(1);
  });

  it.each(Object.values(EVENT_SOUNDS))("%s stays soft", (name: SoundName) => {
    const { ctx, peaks } = fakeContext();
    playSynth(ctx, name, VOLUME_GAIN.loud);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(1);
  });
});
