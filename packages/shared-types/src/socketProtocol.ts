/**
 * Typed realtime protocol between clients (TV + controller) and the server.
 * See docs/protocol.md for the full specification and rationale.
 */
import type { GamePhase, MoveOption, PublicGameState, RoomSummary, SeatColor } from "./gameTypes.js";

// ---------- Client -> Server ----------

export interface RoomCreatePayload {
  /**
   * If the TV previously created a room and lost its connection, it can pass
   * back the roomId + hostToken it was given to reattach as host to that
   * SAME room (and its in-progress game) instead of creating a brand new
   * empty one. Omit both to always create a fresh room.
   */
  rejoinRoomId?: string;
  rejoinHostToken?: string;
}

export interface RoomJoinPayload {
  roomCode: string;
  nickname: string;
}

export interface RoomReconnectPayload {
  roomCode: string;
  reconnectToken: string;
}

export interface PlayerSetNamePayload {
  nickname: string;
}

export interface PlayerSelectColorPayload {
  seat: SeatColor;
}

export interface PlayerReadyPayload {
  ready: boolean;
}

export interface GameStartPayload {}

export interface TurnDrawPayload {}

/**
 * All turn decisions -- plain move, split, swap, and BUMP! -- travel through
 * this single event as a discriminated MoveOption (see gameTypes.ts). The
 * phone UI still walks the player through each decision step by step; it
 * just submits the fully-formed choice once the player has made it.
 */
export interface TurnChooseMovePayload {
  move: MoveOption;
}

export interface GamePlayAgainPayload {}

export interface ClientToServerEvents {
  "room:create": (
    payload: RoomCreatePayload,
    cb: (res: ServerAck<{ roomCode: string; roomId: string; hostToken: string }>) => void,
  ) => void;
  "room:join": (payload: RoomJoinPayload, cb: (res: ServerAck<{ playerId: string; reconnectToken: string }>) => void) => void;
  "room:reconnect": (payload: RoomReconnectPayload, cb: (res: ServerAck<{ playerId: string }>) => void) => void;
  "player:setName": (payload: PlayerSetNamePayload) => void;
  "player:selectColor": (payload: PlayerSelectColorPayload) => void;
  "player:ready": (payload: PlayerReadyPayload) => void;
  "game:start": (payload: GameStartPayload) => void;
  "turn:draw": (payload: TurnDrawPayload) => void;
  "turn:chooseMove": (payload: TurnChooseMovePayload) => void;
  "game:playAgain": (payload: GamePlayAgainPayload) => void;
}

export interface ServerAck<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

// ---------- Server -> Client ----------

export interface RoomStatePayload {
  room: RoomSummary;
  players: {
    playerId: string;
    seat: SeatColor | null;
    nickname: string;
    ready: boolean;
    connected: boolean;
  }[];
}

export interface RoomErrorPayload {
  code: string;
  message: string;
}

export interface GamePublicStatePayload {
  state: PublicGameState;
}

export interface GamePrivateStatePayload {
  legalMoves: MoveOption[];
}

export interface TurnStartedPayload {
  seat: SeatColor;
  playerId: string;
}

export interface TurnCardDrawnPayload {
  seat: SeatColor;
  card: string;
}

export interface ServerToClientEvents {
  "room:created": (payload: { roomCode: string; roomId: string }) => void;
  "room:state": (payload: RoomStatePayload) => void;
  "room:error": (payload: RoomErrorPayload) => void;
  "player:joined": (payload: { playerId: string; nickname: string }) => void;
  "player:left": (payload: { playerId: string }) => void;
  "player:reconnected": (payload: { playerId: string }) => void;
  "game:started": (payload: GamePublicStatePayload) => void;
  "game:publicState": (payload: GamePublicStatePayload) => void;
  "game:privateState": (payload: GamePrivateStatePayload) => void;
  "turn:started": (payload: TurnStartedPayload) => void;
  "turn:cardDrawn": (payload: TurnCardDrawnPayload) => void;
  "move:resolved": (payload: GamePublicStatePayload) => void;
  "player:bumped": (payload: { seat: SeatColor; pawnId: string }) => void;
  "boost:triggered": (payload: { laneId: string }) => void;
  "game:won": (payload: { seat: SeatColor }) => void;
}

export type { GamePhase };
