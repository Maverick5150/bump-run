import type { CardType, GameState, SeatColor } from "@bump-run/shared-types";
import { createGame } from "../src/engine.js";
import type { NewPlayerSpec } from "../src/engine.js";

export function fourPlayerGame(seed = "test-seed"): GameState {
  const specs: NewPlayerSpec[] = [
    { playerId: "p-red", seat: "red", nickname: "Red" },
    { playerId: "p-blue", seat: "blue", nickname: "Blue" },
    { playerId: "p-green", seat: "green", nickname: "Green" },
    { playerId: "p-yellow", seat: "yellow", nickname: "Yellow" },
  ];
  return createGame(specs, seed);
}

export function twoPlayerGame(seed = "test-seed-2p"): GameState {
  const specs: NewPlayerSpec[] = [
    { playerId: "p-red", seat: "red", nickname: "Red" },
    { playerId: "p-blue", seat: "blue", nickname: "Blue" },
  ];
  return createGame(specs, seed);
}

/** Force the current player's active card directly, bypassing the deck, for focused rule tests. */
export function withActiveCard(state: GameState, card: CardType): GameState {
  return { ...structuredClone(state), activeCard: card };
}

export function setPawnMain(state: GameState, seat: SeatColor, pawnIndex: number, pos: number): GameState {
  const next = structuredClone(state);
  const player = next.players.find((p) => p.seat === seat)!;
  player.pawns[pawnIndex]!.location = { zone: "main", pos };
  return next;
}

export function setPawnSafe(state: GameState, seat: SeatColor, pawnIndex: number, index: number): GameState {
  const next = structuredClone(state);
  const player = next.players.find((p) => p.seat === seat)!;
  player.pawns[pawnIndex]!.location = { zone: "safe", index };
  return next;
}

export function setPawnHome(state: GameState, seat: SeatColor, pawnIndex: number): GameState {
  const next = structuredClone(state);
  const player = next.players.find((p) => p.seat === seat)!;
  player.pawns[pawnIndex]!.location = { zone: "home" };
  return next;
}

export function setCurrentPlayer(state: GameState, seat: SeatColor): GameState {
  const next = structuredClone(state);
  const idx = next.players.findIndex((p) => p.seat === seat);
  next.currentPlayerIndex = idx;
  return next;
}

export function pawnId(seat: SeatColor, index: number): string {
  return `${seat}-${index}`;
}
