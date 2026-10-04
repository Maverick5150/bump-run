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

describe("BUMP! special card", () => {
  it("requires a pawn in Start to use", () => {
    let state = fourPlayerGame();
    // move all of red's pawns out of Start
    state = setPawnMain(state, "red", 0, 1);
    state = setPawnMain(state, "red", 1, 2);
    state = setPawnMain(state, "red", 2, 3);
    state = setPawnMain(state, "red", 3, 4);
    state = setPawnMain(state, "blue", 0, 20);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "BUMP");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "bump")).toBe(false);
    expect(moves).toContainEqual({ kind: "pass" });
  });

  it("requires an eligible opponent target on the main track", () => {
    // all opponents in Start/Home/Safe -> no eligible target
    let state = fourPlayerGame();
    state = setPawnHome(state, "blue", 0);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "BUMP");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "bump")).toBe(false);
  });

  it("sends the opponent back to Start and the mover occupies the target position", () => {
    let state = setPawnMain(fourPlayerGame(), "blue", 0, 20);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "BUMP");
    const move = { kind: "bump" as const, ownPawnId: pawnId("red", 0), opponentPawnId: pawnId("blue", 0) };
    expect(getLegalMoves(state)).toContainEqual(move);
    const { state: next } = applyMove(state, move);
    const redPawn = next.players.find((p) => p.seat === "red")!.pawns[0]!;
    const bluePawn = next.players.find((p) => p.seat === "blue")!.pawns[0]!;
    expect(redPawn.location).toEqual({ zone: "main", pos: 20 });
    expect(bluePawn.location).toEqual({ zone: "start" });
  });

  it("rejects protected targets: pawn in opponent's safe zone", () => {
    let state = setPawnSafe(fourPlayerGame(), "blue", 0, 2);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "BUMP");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "bump")).toBe(false);
  });

  it("rejects protected targets: pawn already Home", () => {
    let state = setPawnHome(fourPlayerGame(), "blue", 0);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "BUMP");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "bump")).toBe(false);
  });
});
