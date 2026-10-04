import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves } from "../src/engine.js";
import { fourPlayerGame, pawnId, setCurrentPlayer, setPawnMain, setPawnSafe, withActiveCard } from "./helpers.js";

describe("protected final lane", () => {
  it("requires exact movement to reach Home -- overshoot is illegal", () => {
    let state = setPawnSafe(fourPlayerGame(), "red", 0, 5); // one space from Home
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3"); // would overshoot Home by 2
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "forward" && m.pawnId === pawnId("red", 0))).toBe(false);
  });

  it("allows the exact move that lands a pawn on Home", () => {
    let state = setPawnSafe(fourPlayerGame(), "red", 0, 5);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_1");
    const move = { kind: "forward" as const, pawnId: pawnId("red", 0), distance: 1 };
    expect(getLegalMoves(state)).toContainEqual(move);
    const { state: next, events } = applyMove(state, move);
    expect(next.players.find((p) => p.seat === "red")!.pawns[0]!.location).toEqual({ zone: "home" });
    expect(events.some((e) => e.type === "pawnHome")).toBe(true);
  });

  it("never produces a bump event when a pawn moves into its own safe lane", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 50); // local 50
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3"); // local 50 + 3 = 53 = safe-02
    const { state: next, events } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 0), distance: 3 });
    expect(next.players.find((p) => p.seat === "red")!.pawns[0]!.location).toEqual({ zone: "safe", index: 2 });
    expect(events.some((e) => e.type === "bumped")).toBe(false);
  });

  it("blocks entering the safe lane onto a square the player's own other pawn already occupies", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 50); // local 50, +2 -> safe-01
    state = setPawnSafe(state, "red", 1, 1); // pawn1 already on safe-01
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_2");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "forward" && m.pawnId === pawnId("red", 0))).toBe(false);
  });

  it("opponents can never swap into, or be bumped into, a protected safe lane", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 5);
    state = setPawnSafe(state, "blue", 0, 2);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_11");
    const swaps = getLegalMoves(state).filter((m) => m.kind === "swap");
    expect(swaps.length).toBe(0);
  });
});
