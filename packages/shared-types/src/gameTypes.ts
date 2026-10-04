/** Core domain types shared by the game engine, server, controller, and TV app. */

export type SeatColor = "red" | "blue" | "green" | "yellow";

export const SEAT_COLORS: readonly SeatColor[] = ["red", "blue", "green", "yellow"];

export type CardType =
  | "CARD_1"
  | "CARD_2"
  | "CARD_3"
  | "CARD_4"
  | "CARD_5"
  | "CARD_7"
  | "CARD_8"
  | "CARD_10"
  | "CARD_11"
  | "CARD_12"
  | "BUMP";

export type GamePhase = "lobby" | "playing" | "gameOver";

/** Where a single pawn currently sits. */
export type PawnLocation =
  | { zone: "start" }
  | { zone: "main"; pos: number }
  | { zone: "safe"; index: number } // 1-based, 1..SAFE_ZONE_LENGTH
  | { zone: "home" };

export interface PawnState {
  id: string; // e.g. "red-0"
  ownerSeat: SeatColor;
  location: PawnLocation;
}

export interface PlayerStats {
  pawnsBumpedByMe: number;
  timesBumped: number;
  boostLanesTriggered: number;
  cardsDrawn: number;
}

export interface PlayerState {
  playerId: string; // stable persistent id (survives reconnects)
  seat: SeatColor;
  nickname: string;
  ready: boolean;
  connected: boolean;
  isHostCandidate: boolean;
  pawns: PawnState[];
  stats: PlayerStats;
}

/** A single legal action the current player may take, generated server-side. */
export type MoveOption =
  | { kind: "enterFromStart"; pawnId: string }
  | { kind: "forward"; pawnId: string; distance: number }
  | { kind: "backward"; pawnId: string; distance: number }
  | {
      kind: "split";
      // first leg must be fully specified; second leg distance is implied (total - firstDistance)
      firstPawnId: string;
      firstDistance: number;
      secondPawnId: string;
      secondDistance: number;
    }
  | { kind: "swap"; ownPawnId: string; opponentPawnId: string }
  | { kind: "bump"; ownPawnId: string; opponentPawnId: string }
  | { kind: "pass" };

export interface BoostLaneConfig {
  id: string;
  ownerColor: SeatColor; // the color this lane "belongs" to; triggers for every OTHER color
  startPos: number; // global main-track index
  endPos: number; // global main-track index
}

export interface GameEvent {
  type:
    | "cardDrawn"
    | "moveResolved"
    | "bumped"
    | "boostTriggered"
    | "swapped"
    | "pawnHome"
    | "extraTurn"
    | "noLegalMoves"
    | "gameWon";
  payload: Record<string, unknown>;
}

export interface GameState {
  revision: number;
  phase: GamePhase;
  players: PlayerState[]; // ordered by turn order (seat order among joined players)
  currentPlayerIndex: number;
  deck: CardType[]; // face-down draw pile (pop from end to draw)
  discard: CardType[];
  activeCard: CardType | null;
  rngState: number; // seeded PRNG state, advances deterministically
  winnerSeat: SeatColor | null;
  turnCount: number;
  lastEvents: GameEvent[]; // events produced by the most recent applyMove, for animation
  startedAt: number;
  finishedAt: number | null;
}

/**
 * Public state is safe to broadcast to every client, including the TV.
 * Deck order and the raw RNG state are deliberately omitted -- either would
 * let a client predict future draws.
 */
export type PublicGameState = Omit<GameState, "deck" | "rngState"> & {
  deckCount: number;
};

/** Private, per-player additions -- never broadcast to other players. */
export interface PrivatePlayerState {
  playerId: string;
  reconnectToken: string;
  legalMoves: MoveOption[];
}

export interface RoomSettings {
  maxPlayers: number;
  minPlayers: number;
}

export type RoomPhase = "lobby" | "playing" | "gameOver";

export interface RoomSummary {
  roomCode: string;
  roomId: string;
  phase: RoomPhase;
  createdAt: number;
  lastActivityAt: number;
  settings: RoomSettings;
}
