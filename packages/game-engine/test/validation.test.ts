import { describe, expect, it } from "vitest";
import { applyDraw, applyMove, validateMove } from "../src/engine.js";
import { fourPlayerGame, pawnId, setCurrentPlayer, setPawnMain, withActiveCard } from "./helpers.js";

describe("server-facing validation guarantees", () => {
  it("rejects a second draw request before the active card is resolved", () => {
    let state = setCurrentPlayer(fourPlayerGame(), "red");
    state = applyDraw(state);
    expect(() => applyDraw(state)).toThrow();
  });

  it("rejects a move that is not in the current legal move set", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 0);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3");
    const bogus = { kind: "forward" as const, pawnId: pawnId("red", 0), distance: 99 };
    expect(validateMove(state, bogus).valid).toBe(false);
    expect(() => applyMove(state, bogus)).toThrow();
  });

  it("rejects any move before a card has been drawn", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 0);
    state = setCurrentPlayer(state, "red");
    const move = { kind: "forward" as const, pawnId: pawnId("red", 0), distance: 3 };
    expect(validateMove(state, move).valid).toBe(false);
  });

  it("never offers a move whose primary pawn belongs to someone other than the current player", () => {
    let state = setPawnMain(fourPlayerGame(), "blue", 0, 10);
    state = setCurrentPlayer(state, "red"); // it's red's turn, not blue's
    state = withActiveCard(state, "CARD_3");
    const bogus = { kind: "forward" as const, pawnId: pawnId("blue", 0), distance: 3 };
    expect(validateMove(state, bogus).valid).toBe(false);
  });
});
