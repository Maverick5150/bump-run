const KEY = "bumprun.session.v1";

export interface StoredSession {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  nickname: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // localStorage unavailable (private browsing, etc.) -- reconnect just won't be possible
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
