/** Persisted user preferences -- sound/vibration toggles, read by the sound engine and the haptics helper. */
export interface Settings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const KEY = "bump-run:settings";
const DEFAULTS: Settings = { soundEnabled: true, vibrationEnabled: true };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current: Settings = read();
const listeners = new Set<(s: Settings) => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage unavailable (private browsing, etc) -- setting still applies for this session
  }
  listeners.forEach((fn) => fn(current));
}

export function subscribeSettings(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
