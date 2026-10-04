import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves } from "../src/engine.js";
import { fourPlayerGame, pawnId, setCurrentPlayer, setPawnMain, withActiveCard } from "./helpers.js";

describe("leaving Start", () => {
  it("allows a pawn to leave Start on CARD_1", () => {
    const state = withActiveCard(setCurrentPlayer(fourPlayerGame(), "red"), "CARD_1");
    const moves = getLegalMoves(state);
    expect(moves).toContainEqual({ kind: "enterFromStart", pawnId: pawnId("red", 0) });
  });

  it("allows a pawn to leave Start on CARD_2", () => {
    const state = withActiveCard(setCurrentPlayer(fourPlayerGame(), "red"), "CARD_2");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "enterFromStart")).toBe(true);
  });

  it("does not allow leaving Start on an unrelated card (CARD_3)", () => {
    const state = withActiveCard(setCurrentPlayer(fourPlayerGame(), "red"), "CARD_3");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "enterFromStart")).toBe(false);
  });

  it("blocks leaving Start when own pawn already occupies the entry square", () => {
    let state = fourPlayerGame();
    state = setPawnMain(state, "red", 1, 0); // red's own entry square (offset 0)
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_1");
    const moves = getLegalMoves(state);
    // pawn 0 (still in start) should have no enterFromStart option since entry is blocked by own pawn-1
    expect(moves.some((m) => m.kind === "enterFromStart" && m.pawnId === pawnId("red", 0))).toBe(false);
  });

  it("bumps an opponent occupying the entry square when leaving Start", () => {
    let state = fourPlayerGame();
    state = setPawnMain(state, "blue", 0, 0); // blue pawn sitting on red's entry square
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_1");
    const move = { kind: "enterFromStart" as const, pawnId: pawnId("red", 0) };
    const { state: next } = applyMove(state, move);
    const redPawn = next.players.find((p) => p.seat === "red")!.pawns[0]!;
    const bluePawn = next.players.find((p) => p.seat === "blue")!.pawns[0]!;
    expect(redPawn.location).toEqual({ zone: "main", pos: 0 });
    expect(bluePawn.location).toEqual({ zone: "start" });
  });
});
