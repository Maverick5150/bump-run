import { GAME_RULES } from "@bump-run/game-engine";

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const SERVER_CONFIG = {
  PORT: intFromEnv("PORT", 3000),
  HOST: process.env.HOST ?? "0.0.0.0",
  /**
   * Base URL players' phones and the TV use to reach this server, e.g.
   * "http://192.168.1.50:3000" for LAN dev or "https://bumprun.example.com"
   * once deployed. Never hardcode localhost for a production build.
   */
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? `http://localhost:${intFromEnv("PORT", 3000)}`,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  ROOM_EXPIRATION_MS: GAME_RULES.ROOM_EXPIRATION_MS,
  PLAYER_RECONNECT_TIMEOUT_MS: GAME_RULES.PLAYER_RECONNECT_TIMEOUT_MS,
  MAX_PLAYERS: GAME_RULES.MAX_PLAYERS,
  MIN_PLAYERS: GAME_RULES.MIN_PLAYERS,
} as const;

export const isProduction = SERVER_CONFIG.NODE_ENV === "production";
