import type { BoostLaneConfig, CardType, SeatColor } from "@bump-run/shared-types";
import { SEAT_COLORS } from "@bump-run/shared-types";

/**
 * All tunable game rules live here so behavior can be adjusted without
 * hunting through UI or network code.
 */
export const GAME_RULES = {
  PAWNS_PER_PLAYER: 4,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  MAIN_TRACK_LENGTH: 52,
  SAFE_ZONE_LENGTH: 5,
  /** Distance (in track steps) from each seat's entry square to its own safe-zone entrance. */
  STEPS_ENTRY_TO_SAFE_ENTRANCE: 51,
  /** card 2 grants the same player another turn after it resolves */
  CARD_2_GRANTS_EXTRA_TURN: true,
  /** two pawns owned by the same player may never share a board position */
  ALLOW_OWN_PAWN_STACKING: false,
  /** length of a BUMP! style "sent back" -- always all the way to Start */
  ROOM_EXPIRATION_MS: 1000 * 60 * 60 * 2, // 2 hours of total inactivity
  PLAYER_RECONNECT_TIMEOUT_MS: 1000 * 60 * 5, // 5 minutes grace period
} as const;

/** Evenly spaced entry points around the shared main track, one per seat. */
export const ENTRY_OFFSET: Record<SeatColor, number> = {
  red: 0,
  blue: 13,
  green: 26,
  yellow: 39,
};

/**
 * BOOST LANES: original "fast travel" sequences on the main track. Each lane
 * "belongs" to one color. Any OTHER color landing exactly on startPos is
 * immediately carried to endPos; any pawns resting on the spaces strictly
 * between startPos and endPos are sent back to their own Start. A lane never
 * triggers for pawns of its own owning color.
 */
export const BOOST_LANES: BoostLaneConfig[] = SEAT_COLORS.map((color) => ({
  id: `boost-${color}`,
  ownerColor: color,
  startPos: (ENTRY_OFFSET[color] + 6) % GAME_RULES.MAIN_TRACK_LENGTH,
  endPos: (ENTRY_OFFSET[color] + 9) % GAME_RULES.MAIN_TRACK_LENGTH,
}));

/** Default balanced deck composition. Adjust counts here only. */
export const DECK_COMPOSITION: Record<CardType, number> = {
  CARD_1: 5,
  CARD_2: 4,
  CARD_3: 4,
  CARD_4: 4,
  CARD_5: 4,
  CARD_7: 4,
  CARD_8: 4,
  CARD_10: 4,
  CARD_11: 4,
  CARD_12: 4,
  BUMP: 3,
};

// CARD_LABELS (original card presentation text) lives in @bump-run/shared-types/cardPresentation
// so the controller and TV apps can use it without depending on the whole engine.
export { CARD_LABELS } from "@bump-run/shared-types";
