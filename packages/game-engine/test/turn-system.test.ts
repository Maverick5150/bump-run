import { describe, expect, it } from "vitest";
import { applyDraw, applyMove, getLegalMoves, hasWinner } from "../src/engine.js";
import { fourPlayerGame, pawnId, setCurrentPlayer, setPawnHome, setPawnMain, withActiveCard } from "./helpers.js";

describe("turn order", () => {
  it("advances to the next player in seat order after a normal move", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 0);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3");
    const { state: next } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 0), distance: 3 });
    expect(next.players[next.currentPlayerIndex]!.seat).toBe("blue");
  });

  it("wraps back to the first player after the last player's turn", () => {
    let state = setPawnMain(fourPlayerGame(), "yellow", 0, 0);
    state = setCurrentPlayer(state, "yellow");
    state = withActiveCard(state, "CARD_3");
    const { state: next } = applyMove(state, { kind: "forward", pawnId: pawnId("yellow", 0), distance: 3 });
    expect(next.players[next.currentPlayerIndex]!.seat).toBe("red");
  });

  it("CARD_2 keeps the turn with the same player instead of advancing", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 0);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_2");
    const { state: next } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 0), distance: 2 });
    expect(next.players[next.currentPlayerIndex]!.seat).toBe("red");
  });

  it("automatically offers pass and advances the turn when there is no legal move", () => {
    // every red pawn in Start, and CARD_3 cannot launch from Start -> no legal move
    let state = setCurrentPlayer(fourPlayerGame(), "red");
    state = withActiveCard(state, "CARD_3");
    const moves = getLegalMoves(state);
    expect(moves).toEqual([{ kind: "pass" }]);
    const { state: next } = applyMove(state, { kind: "pass" });
    expect(next.players[next.currentPlayerIndex]!.seat).toBe("blue");
  });

  it("legal moves never require moving an opponent's pawn as the mover", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "blue", 0, 15);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3");
    const moves = getLegalMoves(state);
    for (const move of moves) {
      if (move.kind === "forward" || move.kind === "backward" || move.kind === "enterFromStart") {
        expect(move.pawnId.startsWith("red-")).toBe(true);
      }
      if (move.kind === "split") {
        expect(move.firstPawnId.startsWith("red-")).toBe(true);
        expect(move.secondPawnId.startsWith("red-")).toBe(true);
      }
      if (move.kind === "swap" || move.kind === "bump") {
        expect(move.ownPawnId.startsWith("red-")).toBe(true);
      }
    }
  });

  it("ends the game and stops turn advancement once a player gets all 4 pawns Home", () => {
    let state = fourPlayerGame();
    state = setPawnHome(state, "red", 0);
    state = setPawnHome(state, "red", 1);
    state = setPawnHome(state, "red", 2);
    // put the last pawn in the safe lane one step from Home for a clean finishing move
    state = structuredClone(state);
    const redIdx = state.players.findIndex((p) => p.seat === "red");
    state.players[redIdx]!.pawns[3]!.location = { zone: "safe", index: 5 };
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_1");
    expect(hasWinner(state)).toBeNull();
    const { state: next, events } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 3), distance: 1 });
    expect(hasWinner(next)).toBe("red");
    expect(next.phase).toBe("gameOver");
    expect(events.some((e) => e.type === "gameWon")).toBe(true);
    // currentPlayerIndex should NOT have advanced past red once the game is over
    expect(next.players[next.currentPlayerIndex]!.seat).toBe("red");
  });

  it("rejects drawing a new card while one is already active", () => {
    let state = setCurrentPlayer(fourPlayerGame(), "red");
    state = withActiveCard(state, "CARD_3");
    expect(() => applyDraw(state)).toThrow();
  });
});
