import { describe, expect, it } from "vitest";
import { applyMove } from "../src/engine.js";
import { fourPlayerGame, pawnId, setCurrentPlayer, setPawnMain, withActiveCard } from "./helpers.js";

// red's boost lane: owner "red", startPos=6, endPos=9 (see src/config.ts BOOST_LANES)

describe("BOOST lanes", () => {
  it("triggers when an opposing pawn lands exactly on the lane's start", () => {
    let state = setPawnMain(fourPlayerGame(), "blue", 0, 3);
    state = setCurrentPlayer(state, "blue");
    state = withActiveCard(state, "CARD_3"); // 3 -> lands on 6
    const { state: next, events } = applyMove(state, { kind: "forward", pawnId: pawnId("blue", 0), distance: 3 });
    const bluePawn = next.players.find((p) => p.seat === "blue")!.pawns[0]!;
    expect(bluePawn.location).toEqual({ zone: "main", pos: 9 });
    expect(events.some((e) => e.type === "boostTriggered")).toBe(true);
  });

  it("does not trigger when a pawn merely passes over the lane's start square", () => {
    let state = setPawnMain(fourPlayerGame(), "blue", 0, 4);
    state = setCurrentPlayer(state, "blue");
    state = withActiveCard(state, "CARD_5"); // 5 -> lands on 9, passing through 6,7,8
    const { state: next, events } = applyMove(state, { kind: "forward", pawnId: pawnId("blue", 0), distance: 5 });
    const bluePawn = next.players.find((p) => p.seat === "blue")!.pawns[0]!;
    expect(bluePawn.location).toEqual({ zone: "main", pos: 9 });
    expect(events.some((e) => e.type === "boostTriggered")).toBe(false);
  });

  it("does not trigger for the lane's own owning color", () => {
    let state = setPawnMain(fourPlayerGame(), "red", 1, 3);
    state = setCurrentPlayer(state, "red");
    state = withActiveCard(state, "CARD_3"); // red landing on red's own boost start
    const { state: next, events } = applyMove(state, { kind: "forward", pawnId: pawnId("red", 1), distance: 3 });
    const redPawn = next.players.find((p) => p.seat === "red")!.pawns[1]!;
    expect(redPawn.location).toEqual({ zone: "main", pos: 6 });
    expect(events.some((e) => e.type === "boostTriggered")).toBe(false);
  });

  it("bumps any pawns resting on the lane's intermediate squares back to their own Start", () => {
    let state = setPawnMain(fourPlayerGame(), "blue", 0, 3);
    state = setPawnMain(state, "green", 0, 7);
    state = setPawnMain(state, "yellow", 0, 8);
    state = setCurrentPlayer(state, "blue");
    state = withActiveCard(state, "CARD_3");
    const { state: next } = applyMove(state, { kind: "forward", pawnId: pawnId("blue", 0), distance: 3 });
    expect(next.players.find((p) => p.seat === "green")!.pawns[0]!.location).toEqual({ zone: "start" });
    expect(next.players.find((p) => p.seat === "yellow")!.pawns[0]!.location).toEqual({ zone: "start" });
    expect(next.players.find((p) => p.seat === "blue")!.pawns[0]!.location).toEqual({ zone: "main", pos: 9 });
  });
});
