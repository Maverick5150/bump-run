import type { GameState, MoveOption, SeatColor } from "@bump-run/shared-types";
import { applyMove, getCurrentPlayer } from "@bump-run/game-engine";

/**
 * Picks a move for an AI-controlled seat. Deliberately simple and fast
 * (no search/minimax) -- it scores each legal option by dry-running it
 * through the real `applyMove` (pure, doesn't mutate `state`) and favoring
 * whichever one bumps an opponent, gets a pawn home, triggers a boost, or
 * at least gets a pawn out of Start, with a little randomness so the bot
 * isn't perfectly predictable turn to turn.
 */
export function chooseBotMove(state: GameState, legal: MoveOption[]): MoveOption {
  const seat = getCurrentPlayer(state).seat;
  let best: MoveOption | null = null;
  let bestScore = -Infinity;

  for (const option of legal) {
    const score = scoreCandidate(state, seat, option);
    if (best === null || score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best ?? { kind: "pass" };
}

function scoreCandidate(before: GameState, seat: SeatColor, move: MoveOption): number {
  const { state: after, events } = applyMove(before, move);

  let score = Math.random() * 3; // small jitter so play isn't perfectly deterministic
  for (const event of events) {
    switch (event.type) {
      case "bumped":
        score += 60;
        break;
      case "pawnHome":
        score += 100;
        break;
      case "boostTriggered":
        score += 25;
        break;
      case "extraTurn":
        score += 15;
        break;
    }
  }

  const beforeOut = countOutOfStart(before, seat);
  const afterOut = countOutOfStart(after, seat);
  score += (afterOut - beforeOut) * 10; // reward getting a pawn moving

  return score;
}

function countOutOfStart(state: GameState, seat: SeatColor): number {
  const player = state.players.find((p) => p.seat === seat);
  if (!player) return 0;
  return player.pawns.filter((p) => p.location.zone !== "start").length;
}
