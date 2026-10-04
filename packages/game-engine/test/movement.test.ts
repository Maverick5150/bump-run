import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves } from "../src/engine.js";
import { fourPlayerGame, pawnId, setCurrentPlayer, setPawnMain, setPawnSafe, withActiveCard } from "./helpers.js";

describe("normal forward movement", () => {
  it("moves a pawn forward the correct number of spaces", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3");
    const { state: next } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 0), distance: 3 });
    expect(next.players[0]!.pawns[0]!.location).toEqual({ zone: "main", pos: 13 });
  });

  it("blocks a forward move that would land on the mover's own pawn", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "red", 1, 13);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "forward" && m.pawnId === pawnId("red", 0))).toBe(false);
  });

  it("bumps an opponent pawn landed on during forward movement", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "blue", 0, 13);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3");
    const { state: next, events } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 0), distance: 3 });
    const bluePawn = next.players.find((p) => p.seat === "blue")!.pawns[0]!;
    expect(bluePawn.location).toEqual({ zone: "start" });
    expect(events.some((e) => e.type === "bumped")).toBe(true);
  });
});

describe("backward movement", () => {
  it("moves a pawn backward the correct number of spaces", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_4");
    const { state: next } = applyMove(state, { kind: "backward", pawnId: pawnId("red", 0), distance: 4 });
    expect(next.players[0]!.pawns[0]!.location).toEqual({ zone: "main", pos: 6 });
  });

  it("wraps around the shared main track when moving backward past position 0", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 2);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_4");
    const { state: next } = applyMove(state, { kind: "backward", pawnId: pawnId("red", 0), distance: 4 });
    expect(next.players[0]!.pawns[0]!.location).toEqual({ zone: "main", pos: 50 });
  });

  it("bumps an opponent pawn landed on during backward movement", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "green", 0, 6);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_4");
    const { state: next } = applyMove(state, { kind: "backward", pawnId: pawnId("red", 0), distance: 4 });
    const greenPawn = next.players.find((p) => p.seat === "green")!.pawns[0]!;
    expect(greenPawn.location).toEqual({ zone: "start" });
  });

  it("blocks backward movement onto the mover's own pawn", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 0, 10);
    state = setPawnMain(state, "red", 1, 6);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_4");
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "backward" && m.pawnId === pawnId("red", 0))).toBe(false);
  });

  it("blocks backward movement WITHIN the safe zone onto the mover's own pawn", () => {
    let state = setPawnSafe(fourPlayerGame(), "red", 0, 5);
    state = setPawnSafe(state, "red", 1, 1);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_4"); // safe-5 backward 4 -> safe-1, which pawn1 already occupies
    const moves = getLegalMoves(state);
    expect(moves.some((m) => m.kind === "backward" && m.pawnId === pawnId("red", 0))).toBe(false);
  });
});
