import type { SoundName } from "@/lib/sounds";

/**
 * The app's sounds, made with the Web Audio API as they're needed: no
 * audio files, nothing downloaded. Each is short (under a second) and
 * soft: filtered noise for paper, sine and triangle tones with gentle
 * decays for the rest.
 */

/** A gain that rises over `attack` seconds to `peak` and dies away over
 *  `decay`. Exponential ramps can't reach 0, hence the tiny floor. */
function envelope(gain: AudioParam, at: number, peak: number, attack: number, decay: number) {
  gain.setValueAtTime(0.0001, at);
  gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function noise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A burst of noise through a filter. */
function grain(
  ctx: BaseAudioContext,
  out: AudioNode,
  at: number,
  { type, from, to, q, peak, decay }: {
    type: BiquadFilterType;
    from: number;
    to: number;
    q: number;
    peak: number;
    decay: number;
  },
) {
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx, decay + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + decay);
  const gain = ctx.createGain();
  envelope(gain.gain, at, peak, 0.01, decay);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
  source.stop(at + decay + 0.05);
}

/** A tone with a few soft overtones, like a small bell or a struck glass. */
function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  at: number,
  { freq, peak, decay, type = "sine", partials = [] }: {
    freq: number;
    peak: number;
    decay: number;
    type?: OscillatorType;
    /** [multiple of freq, loudness relative to the tone] */
    partials?: [number, number][];
  },
) {
  for (const [multiple, level] of [[1, 1] as [number, number], ...partials]) {
    const osc = ctx.createOscillator();
    osc.type = multiple === 1 ? type : "sine";
    osc.frequency.value = freq * multiple;
    const gain = ctx.createGain();
    // Overtones fade faster than the note, as they do on a real bell.
    envelope(gain.gain, at, peak * level, 0.006, multiple === 1 ? decay : decay * 0.6);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

const SOUNDS: Record<SoundName, (ctx: BaseAudioContext, out: AudioNode, at: number) => void> = {
  // A page turned: two quick brushes of paper, the second higher and
  // lighter, each sweeping down.
  rustle(ctx, out, at) {
    grain(ctx, out, at, { type: "bandpass", from: 3200, to: 1800, q: 0.8, peak: 0.55, decay: 0.16 });
    grain(ctx, out, at + 0.075, { type: "bandpass", from: 5200, to: 2600, q: 0.9, peak: 0.32, decay: 0.2 });
  },

  // E5 then B5, a rising fifth, warm rather than bright.
  chime(ctx, out, at) {
    const warm = ctx.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 4200;
    warm.connect(out);
    const partials: [number, number][] = [
      [2, 0.22],
      [3, 0.06],
    ];
    tone(ctx, warm, at, { freq: 659.25, peak: 0.42, decay: 0.75, partials });
    tone(ctx, warm, at + 0.13, { freq: 987.77, peak: 0.36, decay: 0.8, partials });
  },

  // C major, up and over: C5 E5 G5 C6, with a faint shimmer on the last.
  flourish(ctx, out, at) {
    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 5200;
    soft.connect(out);
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const last = i === 3;
      tone(ctx, soft, at + i * 0.07, {
        freq,
        type: "triangle",
        peak: last ? 0.34 : 0.26,
        decay: last ? 0.7 : 0.32,
        partials: last ? [[2, 0.12]] : [],
      });
    });
  },

  // A book set down: a low tone that drops, and the muffled tap of it
  // landing.
  thunk(ctx, out, at) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(62, at + 0.12);
    const gain = ctx.createGain();
    envelope(gain.gain, at, 0.7, 0.004, 0.17);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + 0.25);
    grain(ctx, out, at, { type: "lowpass", from: 900, to: 400, q: 0.7, peak: 0.35, decay: 0.06 });
  },

  // A light tap, like a pencil mark.
  tick(ctx, out, at) {
    tone(ctx, out, at, { freq: 1850, peak: 0.28, decay: 0.045 });
    grain(ctx, out, at, { type: "highpass", from: 3500, to: 3000, q: 0.7, peak: 0.12, decay: 0.02 });
  },
};

/** Plays `name` on `ctx` at `gain` (0 to 1), starting now. */
export function playSynth(ctx: BaseAudioContext, name: SoundName, gain: number): void {
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(ctx.destination);
  SOUNDS[name](ctx, out, ctx.currentTime + 0.01);
  // Every sound has finished well within this.
  setTimeout(() => out.disconnect(), 1500);
}
