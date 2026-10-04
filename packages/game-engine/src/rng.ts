/**
 * Small deterministic PRNG (mulberry32). The engine stores only the numeric
 * seed/state in GameState and threads it through pure functions, so the same
 * starting seed always reproduces the same shuffles and draws -- required
 * for repeatable tests and for never mutating state unexpectedly.
 */
export function nextRandom(state: number): { value: number; nextState: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState: (state + 0x6d2b79f5) | 0 };
}

export function seedFromString(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Fisher-Yates shuffle, pure: returns a new array plus the advanced rng state. */
export function shuffle<T>(items: T[], rngState: number): { result: T[]; nextState: number } {
  const arr = items.slice();
  let state = rngState;
  for (let i = arr.length - 1; i > 0; i--) {
    const { value, nextState } = nextRandom(state);
    state = nextState;
    const j = Math.floor(value * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return { result: arr, nextState: state };
}
