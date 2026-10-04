import { describe, expect, it } from "vitest";
import type { GameState } from "@bump-run/shared-types";
import { applyDraw, applyMove, getLegalMoves, hasWinner } from "../src/engine.js";
import { nextRandom, seedFromString } from "../src/rng.js";
import { fourPlayerGame } from "./helpers.js";

const MAX_TURNS = 20_000;

function assertInvariants(state: GameState): void {
  // No two pawns belonging to the SAME player ever share a main or safe space.
  for (const player of state.players) {
    const occupied = new Map<string, string>();
    for (const pawn of player.pawns) {
      if (pawn.location.zone === "start" || pawn.location.zone === "home") continue;
      const key = pawn.location.zone === "main" ? `main-${pawn.location.pos}` : `safe-${pawn.location.index}`;
      const existing = occupied.get(key);
      if (existing) {
        throw new Error(`${player.seat} pawns ${existing} and ${pawn.id} both occupy ${key}`);
      }
      occupied.set(key, pawn.id);
    }
  }

  // No two pawns from DIFFERENT players ever share a main-track square.
  const globalOccupants = new Map<number, string>();
  for (const player of state.players) {
    for (const pawn of player.pawns) {
      if (pawn.location.zone !== "main") continue;
      const existing = globalOccupants.get(pawn.location.pos);
      if (existing) {
        throw new Error(`main-${pawn.location.pos} is occupied by both ${existing} and ${pawn.id}`);
      }
      globalOccupants.set(pawn.location.pos, pawn.id);
    }
  }

  // Every card that has ever existed is accounted for across deck+discard+active+"in play"=none (cards aren't held).
  // (Cards are ephemeral -- drawn, resolved, discarded -- so deck+discard length only ever shrinks by reshuffling, never cards.)
}

function pickRandom<T>(items: T[], state: number): { item: T; nextState: number } {
  const { value, nextState } = nextRandom(state);
  const idx = Math.floor(value * items.length);
  return { item: items[Math.min(idx, items.length - 1)]!, nextState };
}

function playRandomGameToCompletion(gameSeed: string, moveSeed: string): { winner: string | null; turns: number } {
  let state = fourPlayerGame(gameSeed);
  let moveRng = seedFromString(moveSeed);
  let turns = 0;

  while (!hasWinner(state) && turns < MAX_TURNS) {
    state = applyDraw(state);
    assertInvariants(state);

    const legal = getLegalMoves(state);
    expect(legal.length).toBeGreaterThan(0); // pass is always offered as a fallback

    const picked = pickRandom(legal, moveRng);
    moveRng = picked.nextState;

    const { state: next } = applyMove(state, picked.item);
    state = next;
    assertInvariants(state);
    turns++;
  }

  return { winner: hasWinner(state), turns };
}

describe("end-to-end random simulation", () => {
  const seeds = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"];

  for (const seed of seeds) {
    it(`reaches a winner without deadlocking or violating invariants (seed=${seed})`, () => {
      const { winner, turns } = playRandomGameToCompletion(seed, `${seed}-moves`);
      expect(winner).not.toBeNull();
      expect(turns).toBeLessThan(MAX_TURNS);
    });
  }
});
