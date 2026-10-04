import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves } from "../src/engine.js";
import { fourPlayerGame, pawnId, setCurrentPlayer, setPawnMain, withActiveCard } from "./helpers.js";

describe("CARD_2", () => {
  it("grants the same player an extra turn after resolving", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_2");
    const { state: next } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 0), distance: 2 });
    expect(next.currentPlayerIndex).toBe(state.currentPlayerIndex); // still red's turn
    expect(next.activeCard).toBeNull(); // ready for a fresh draw
  });
});

describe("CARD_4 backward", () => {
  it("moves the pawn backward by exactly 4", () => {
    let state = setPawnMain(fourPlayerGame(), "blue", 0, 20);
    state = setCurrentPlayer(state, "blue");
    state = withActiveCard(state, "CARD_4");
    const { state: next } = applyMove(state, { kind: "backward", pawnId: pawnId("blue", 0), distance: 4 });
    expect(next.players.find((p) => p.seat === "blue")!.pawns[0]!.location).toEqual({ zone: "main", pos: 16 });
  });
});

describe("CARD_7 split", () => {
  it("offers a plain forward-7 move", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_7");
    const moves = getLegalMoves(state);
    expect(moves).toContainEqual({ kind: "forward", pawnId: pawnId("red", 0), distance: 7 });
  });

  it("enumerates every legal split combination summing to 7", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "red", 1, 20);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_7");
    const moves = getLegalMoves(state).filter((m) => m.kind === "split");
    // both pawns are free to move any d1+d2=7 combo without colliding with each other
    expect(moves.length).toBeGreaterThanOrEqual(6 * 2); // 6 distance splits x 2 pawn orderings
  });

  it("resolves the first leg before validating/applying the second (order-dependent square)", () => {
    // redA at 10 moving +2 -> 12 (vacates 10). redB at 5 moving +5 -> 10.
    // If leg2 were checked against the ORIGINAL board, pos 10 would still look
    // occupied by redA and the split would be wrongly rejected.
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "red", 1, 5);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_7");
    const move = {
      kind: "split" as const,
      firstPawnId: pawnId("red", 0),
      firstDistance: 2,
      secondPawnId: pawnId("red", 1),
      secondDistance: 5,
    };
    const moves = getLegalMoves(state);
    expect(moves).toContainEqual(move);
    const { state: next } = applyMove(state, move);
    const redPawns = next.players.find((p) => p.seat === "red")!.pawns;
    expect(redPawns[0]!.location).toEqual({ zone: "main", pos: 12 });
    expect(redPawns[1]!.location).toEqual({ zone: "main", pos: 10 });
  });

  it("rejects a split where the two distances do not sum to 7", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "red", 1, 20);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_7");
    const badMove = {
      kind: "split" as const,
      firstPawnId: pawnId("red", 0),
      firstDistance: 3,
      secondPawnId: pawnId("red", 1),
      secondDistance: 2, // sums to 5, not 7
    };
    expect(() => applyMove(state, badMove)).toThrow();
  });

  it("never offers a split that routes through a pawn still in Start", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    // pawn 1 stays in Start
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_7");
    const moves = getLegalMoves(state).filter((m) => m.kind === "split");
    expect(moves.some((m) => m.kind === "split" && (m.firstPawnId === pawnId("red", 1) || m.secondPawnId === pawnId("red", 1)))).toBe(false);
  });
});

describe("CARD_10", () => {
  it("offers forward 10 and backward 1", () => {
    let state = setPawnMain(fourPlayerGame(), "green", 0, 10);
    state = setCurrentPlayer(state, "green");
    state = withActiveCard(state, "CARD_10");
    const moves = getLegalMoves(state);
    expect(moves).toContainEqual({ kind: "forward", pawnId: pawnId("green", 0), distance: 10 });
    expect(moves).toContainEqual({ kind: "backward", pawnId: pawnId("green", 0), distance: 1 });
  });
});

describe("CARD_12", () => {
  it("moves a pawn forward 12", () => {
    let state = setPawnMain(fourPlayerGame(), "yellow", 0, 0);
    state = setCurrentPlayer(state, "yellow");
    state = withActiveCard(state, "CARD_12");
    const { state: next } = applyMove(state, { kind: "forward", pawnId: pawnId("yellow", 0), distance: 12 });
    expect(next.players.find((p) => p.seat === "yellow")!.pawns[0]!.location).toEqual({ zone: "main", pos: 12 });
  });
});
