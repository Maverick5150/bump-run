/**
 * Every game event gets its own synthesized sound -- oscillators + noise
 * bursts shaped with gain envelopes, generated on the fly with the Web
 * Audio API. No audio files: zero asset payload, instant playback, and
 * entirely original (nothing sampled or borrowed).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  sweepTo?: number;
}

function tone(freq: number, startTime: number, duration: number, opts: ToneOpts = {}): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, startTime);
  if (opts.sweepTo) osc.frequency.linearRampToValueAtTime(opts.sweepTo, startTime + duration);
  const peak = opts.gain ?? 0.3;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + Math.min(0.012, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.03);
}

interface NoiseOpts {
  gain?: number;
  lowpass?: number;
}

function noiseBurst(startTime: number, duration: number, opts: NoiseOpts = {}): void {
  const ac = getCtx();
  const size = Math.max(1, Math.ceil(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, size, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  const peak = opts.gain ?? 0.2;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  let node: AudioNode = src;
  if (opts.lowpass) {
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = opts.lowpass;
    src.connect(filter);
    node = filter;
  }
  node.connect(gain).connect(ac.destination);
  src.start(startTime);
  src.stop(startTime + duration + 0.03);
}

const rawSounds = {
  /** Menu navigation / generic UI tap. */
  select(): void {
    const t = getCtx().currentTime;
    tone(740, t, 0.08, { type: "sine", gain: 0.22, sweepTo: 1020 });
  },
  /** A card is drawn and revealed. */
  cardDraw(): void {
    const t = getCtx().currentTime;
    tone(500, t, 0.18, { type: "sine", gain: 0.18, sweepTo: 1400 });
    tone(750, t, 0.18, { type: "sine", gain: 0.1, sweepTo: 2100 });
    noiseBurst(t, 0.14, { gain: 0.09, lowpass: 3500 });
  },
  /** A pawn takes a single step (used sparingly -- the main "it moved" cue is visual). */
  moveTick(): void {
    const t = getCtx().currentTime;
    tone(520, t, 0.05, { type: "triangle", gain: 0.16 });
  },
  /** An opponent (or your own pawn) gets bumped back to Start. */
  bump(): void {
    const t = getCtx().currentTime;
    tone(190, t, 0.22, { type: "sine", gain: 0.32, sweepTo: 55 });
    noiseBurst(t, 0.1, { gain: 0.22, lowpass: 900 });
  },
  /** A boost lane fires. */
  boost(): void {
    const t = getCtx().currentTime;
    tone(260, t, 0.3, { type: "sawtooth", gain: 0.14, sweepTo: 1100 });
    tone(520, t, 0.3, { type: "sine", gain: 0.1, sweepTo: 2200 });
  },
  /** A pawn reaches Home. */
  home(): void {
    const t = getCtx().currentTime;
    tone(523.25, t, 0.4, { type: "sine", gain: 0.2 });
    tone(659.25, t + 0.02, 0.4, { type: "sine", gain: 0.16 });
    tone(783.99, t + 0.04, 0.42, { type: "sine", gain: 0.14 });
  },
  /** Control returns to the human after automated bot turns. */
  yourTurn(): void {
    const t = getCtx().currentTime;
    tone(660, t, 0.12, { type: "sine", gain: 0.2 });
    tone(880, t + 0.13, 0.16, { type: "sine", gain: 0.2 });
  },
  /** Game over -- this player's seat won. */
  win(): void {
    const t = getCtx().currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((f, i) => tone(f, t + i * 0.13, 0.45, { type: "square", gain: 0.14 }));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, t + 0.9, 1.3, { type: "triangle", gain: 0.1 }));
  },
};

/**
 * Sound is pure garnish -- it must never be able to break gameplay. Every
 * exported sound function is wrapped so a failure (blocked AudioContext,
 * browser quirk, anything) is swallowed silently instead of throwing back
 * into whatever click handler called it.
 */
function safe(fn: () => void): () => void {
  return () => {
    try {
      fn();
    } catch {
      // sound failed -- ignore, the game must go on
    }
  };
}

export const sounds: typeof rawSounds = Object.fromEntries(
  Object.entries(rawSounds).map(([key, fn]) => [key, safe(fn)]),
) as typeof rawSounds;
