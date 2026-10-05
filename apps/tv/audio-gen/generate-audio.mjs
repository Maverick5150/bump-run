// Generates every audio asset shipped in apps/tv/app/src/main/res/raw/.
//
// Everything here is synthesized from scratch (sine/square/triangle/saw
// oscillators + noise + ADSR envelopes, mixed in a plain Float32 buffer) --
// no samples, no copyrighted material, nothing downloaded. Re-run this
// script any time the sound design should change:
//
//   node apps/tv/audio-gen/generate-audio.mjs
//
// It overwrites the .wav files in app/src/main/res/raw/ in place.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "app", "src", "main", "res", "raw");

const SR = 44100;

// ---------------------------------------------------------------- utils --

function samples(seconds) {
  return Math.round(seconds * SR);
}

/** A simple seeded PRNG so noise bursts are reproducible across re-runs. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

function sine(freq, t, phase = 0) {
  return Math.sin(2 * Math.PI * freq * t + phase);
}
function triangle(freq, t) {
  const x = (freq * t) % 1;
  return 4 * Math.abs(x - 0.5) - 1;
}
function square(freq, t, duty = 0.5) {
  const x = (freq * t) % 1;
  return x < duty ? 1 : -1;
}
function saw(freq, t) {
  const x = (freq * t) % 1;
  return 2 * x - 1;
}

/** Linear-segment ADSR, returns 0..1. durations in seconds. */
function adsr(t, dur, a, d, sLevel, r) {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - sLevel) * ((t - a) / d);
  const sustainEnd = dur - r;
  if (t < sustainEnd) return sLevel;
  if (t < dur) return sLevel * (1 - (t - sustainEnd) / r);
  return 0;
}

/** One-pole lowpass, in place, for softening noise bursts into "thuds". */
function lowpass(buf, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SR;
  const alpha = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    prev = prev + alpha * (buf[i] - prev);
    buf[i] = prev;
  }
}

function echo(buf, delaySec, decay, repeats = 3) {
  const delaySamples = Math.round(delaySec * SR);
  const out = Float32Array.from(buf);
  for (let r = 1; r <= repeats; r++) {
    const offset = delaySamples * r;
    const g = Math.pow(decay, r);
    for (let i = 0; i + offset < out.length; i++) {
      out[i + offset] += buf[i] * g;
    }
  }
  return out;
}

function normalize(buf, peak = 0.85) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

function addAt(dest, src, startSample) {
  for (let i = 0; i < src.length; i++) {
    const j = startSample + i;
    if (j >= 0 && j < dest.length) dest[j] += src[i];
  }
}

function writeWav(filename, floatBuf) {
  const n = floatBuf.length;
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, floatBuf[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  const outPath = path.join(OUT_DIR, filename);
  writeFileSync(outPath, buf);
  console.log(`wrote ${filename}  (${(buf.length / 1024).toFixed(1)} KB)`);
}

// --------------------------------------------------------- note helpers --

const NOTE = (name) => {
  // e.g. "C4" -> Hz. A4 = 440.
  const m = /^([A-G])(#?)(-?\d+)$/.exec(name);
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0);
  const octave = parseInt(m[3], 10);
  const n = semis + (octave - 4) * 12;
  return 440 * Math.pow(2, n / 12);
};

// ----------------------------------------------------------------- sfx --

function genSelect() {
  const dur = 0.09;
  const buf = new Float32Array(samples(dur));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const freq = 740 + 300 * (t / dur); // quick upward chirp
    const env = adsr(t, dur, 0.004, 0.03, 0.5, 0.05);
    buf[i] = 0.6 * sine(freq, t) * env + 0.25 * triangle(freq * 2, t) * env;
  }
  writeWav("sfx_select.wav", normalize(buf, 0.7));
}

function genCardDraw() {
  const dur = 0.32;
  const buf = new Float32Array(samples(dur));
  const rng = makeRng(7);
  const noise = new Float32Array(buf.length);
  for (let i = 0; i < noise.length; i++) noise[i] = rng();
  lowpass(noise, 3500);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const env = adsr(t, dur, 0.01, 0.1, 0.3, 0.2);
    const sweep = 500 + 2200 * Math.min(1, t / 0.15);
    const shimmer = 0.4 * sine(sweep, t) + 0.25 * sine(sweep * 1.5, t);
    buf[i] = env * (shimmer + 0.5 * noise[i] * adsr(t, dur, 0.002, 0.05, 0, 0.1));
  }
  writeWav("sfx_card.wav", normalize(buf, 0.75));
}

function genMoveTick() {
  const dur = 0.07;
  const buf = new Float32Array(samples(dur));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const env = adsr(t, dur, 0.002, 0.04, 0.2, 0.03);
    buf[i] = 0.7 * triangle(520, t) * env;
  }
  writeWav("sfx_move.wav", normalize(buf, 0.6));
}

function genBump() {
  const dur = 0.35;
  const buf = new Float32Array(samples(dur));
  const rng = makeRng(99);
  const noise = new Float32Array(buf.length);
  for (let i = 0; i < noise.length; i++) noise[i] = rng();
  lowpass(noise, 900);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const pitch = 180 * Math.pow(0.35, t / dur); // drop from 180Hz downward
    const thumpEnv = adsr(t, dur, 0.002, 0.18, 0.1, 0.16);
    const noiseEnv = adsr(t, dur, 0.001, 0.08, 0, 0.05);
    buf[i] = 0.8 * sine(pitch, t) * thumpEnv + 0.5 * noise[i] * noiseEnv;
  }
  writeWav("sfx_bump.wav", normalize(buf, 0.9));
}

function genBoost() {
  const dur = 0.4;
  const buf = new Float32Array(samples(dur));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const env = adsr(t, dur, 0.01, 0.1, 0.4, 0.22);
    const freq = 260 + 900 * Math.min(1, t / 0.3);
    buf[i] = env * (0.5 * saw(freq, t) * 0.5 + 0.4 * sine(freq * 2, t));
  }
  const withEcho = echo(buf, 0.09, 0.3, 2);
  writeWav("sfx_boost.wav", normalize(withEcho, 0.75));
}

function genPawnHome() {
  const dur = 0.5;
  const buf = new Float32Array(samples(dur));
  const notes = [NOTE("C5"), NOTE("E5"), NOTE("G5")];
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const env = adsr(t, dur, 0.005, 0.12, 0.3, 0.3);
    let v = 0;
    for (const f of notes) v += sine(f, t) / notes.length;
    buf[i] = v * env;
  }
  writeWav("sfx_home.wav", normalize(buf, 0.75));
}

function genWinFanfare() {
  const dur = 2.6;
  const buf = new Float32Array(samples(dur));
  const arp = [
    ["C5", 0.0], ["E5", 0.14], ["G5", 0.28], ["C6", 0.42],
    ["E6", 0.56], ["G6", 0.7],
  ];
  for (const [note, start] of arp) {
    const f = NOTE(note);
    const noteDur = 0.5;
    const n = samples(noteDur);
    const tmp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = adsr(t, noteDur, 0.004, 0.08, 0.5, 0.35);
      tmp[i] = env * (0.55 * square(f, t, 0.5) * 0.5 + 0.5 * sine(f, t));
    }
    addAt(buf, tmp, samples(start));
  }
  // Final sustained chord stab.
  const chordStart = samples(0.95);
  const chordDur = 1.5;
  const chordNotes = [NOTE("C5"), NOTE("E5"), NOTE("G5"), NOTE("C6")];
  const chord = new Float32Array(samples(chordDur));
  for (let i = 0; i < chord.length; i++) {
    const t = i / SR;
    const env = adsr(t, chordDur, 0.01, 0.2, 0.55, 0.9);
    let v = 0;
    for (const f of chordNotes) v += triangle(f, t) / chordNotes.length;
    chord[i] = v * env;
  }
  addAt(buf, chord, chordStart);
  const withEcho = echo(buf, 0.16, 0.22, 2);
  writeWav("sfx_win.wav", normalize(withEcho, 0.85));
}

// ----------------------------------------------------- background music --

function genMusicLoop() {
  const bpm = 128;
  const secPerBeat = 60 / bpm;
  const secPerStep = secPerBeat / 4; // 16th notes
  const stepsPerBar = 16;
  const bars = 8;
  const totalSteps = stepsPerBar * bars;
  const totalSamples = samples(secPerStep * totalSteps);
  const buf = new Float32Array(totalSamples);

  // I - V - vi - IV, two bars each, classic upbeat progression.
  const chords = [
    { root: "C3", tones: ["C4", "E4", "G4", "C5"] },
    { root: "G2", tones: ["G3", "B3", "D4", "G4"] },
    { root: "A2", tones: ["A3", "C4", "E4", "A4"] },
    { root: "F2", tones: ["F3", "A3", "C4", "F4"] },
  ];

  const rng = makeRng(2024);
  const arpPattern = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 2];

  for (let step = 0; step < totalSteps; step++) {
    const bar = Math.floor(step / stepsPerBar);
    const chord = chords[Math.floor(bar / 2) % chords.length];
    const stepInBar = step % stepsPerBar;
    const stepStartSample = Math.round(step * secPerStep * SR);

    // Bass pulse on beats 1 and 3 of every bar (steps 0 and 8).
    if (stepInBar === 0 || stepInBar === 8) {
      const f = NOTE(chord.root);
      const dur = secPerStep * 3.5;
      const n = samples(dur);
      const tmp = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const env = adsr(t, dur, 0.004, 0.1, 0.45, dur - 0.2);
        tmp[i] = 0.5 * sine(f, t) * env + 0.15 * triangle(f, t) * env;
      }
      addAt(buf, tmp, stepStartSample);
    }

    // Plucky arpeggio lead, one note per step.
    {
      const toneIdx = arpPattern[stepInBar];
      const f = NOTE(chord.tones[toneIdx]);
      const dur = secPerStep * 0.9;
      const n = samples(dur);
      const tmp = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const env = adsr(t, dur, 0.002, 0.07, 0.05, 0.05);
        tmp[i] = 0.26 * triangle(f, t) * env + 0.1 * square(f, t, 0.3) * env;
      }
      addAt(buf, tmp, stepStartSample);
    }

    // Light noise hat on the off-beat 8th notes for rhythmic texture.
    if (stepInBar % 2 === 1) {
      const dur = secPerStep * 0.5;
      const n = samples(dur);
      const tmp = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const env = adsr(t, dur, 0.001, 0.03, 0, 0.02);
        tmp[i] = rng() * env * 0.06;
      }
      lowpass(tmp, 6000);
      addAt(buf, tmp, stepStartSample);
    }
  }

  writeWav("music_loop.wav", normalize(buf, 0.8));
}

// ------------------------------------------------------------------ run --

genSelect();
genCardDraw();
genMoveTick();
genBump();
genBoost();
genPawnHome();
genWinFanfare();
genMusicLoop();
