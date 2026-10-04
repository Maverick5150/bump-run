import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves } from "../src/engine.js";
import {
  fourPlayerGame,
  pawnId,
  setCurrentPlayer,
  setPawnHome,
  setPawnMain,
  setPawnSafe,
  withActiveCard,
} from "./helpers.js";

describe("CARD_11 swap", () => {
  it("allows forward 11 as a plain alternative", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 0);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_11");
    expect(getLegalMoves(state)).toContainEqual({ kind: "forward", pawnId: pawnId("red", 0), distance: 11 });
  });

  it("legally swaps two eligible main-track pawns", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 5);
    state = setPawnMain(state, "blue", 0, 8);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_11");
    const move = { kind: "swap" as const, ownPawnId: pawnId("red", 0), opponentPawnId: pawnId("blue", 0) };
    expect(getLegalMoves(state)).toContainEqual(move);
    const { state: next } = applyMove(state, move);
    expect(next.players.find((p) => p.seat === "red")!.pawns[0]!.location).toEqual({ zone: "main", pos: 8 });
    expect(next.players.find((p) => p.seat === "blue")!.pawns[0]!.location).toEqual({ zone: "main", pos: 5 });
  });

  it("rejects swapping into/with a pawn in a protected safe lane", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 5);
    state = setPawnSafe(state, "blue", 0, 2);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_11");
    const moves = getLegalMoves(state).filter((m) => m.kind === "swap");
    expect(moves.length).toBe(0);
  });

  it("rejects swapping with a pawn in Home", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 5);
    state = setPawnHome(state, "blue", 0);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_11");
    const moves = getLegalMoves(state).filter((m) => m.kind === "swap");
    expect(moves.length).toBe(0);
  });

  it("rejects swapping with a pawn still in Start", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 5);
    // blue pawn 0 stays in Start by default
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_11");
    const moves = getLegalMoves(state).filter(
      (m) => m.kind === "swap" && m.opponentPawnId === pawnId("blue", 0),
    );
    expect(moves.length).toBe(0);
  });
});
