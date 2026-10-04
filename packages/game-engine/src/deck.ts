import type { CardType } from "@bump-run/shared-types";
import { DECK_COMPOSITION } from "./config.js";
import { shuffle } from "./rng.js";

export function buildOrderedDeck(): CardType[] {
  const cards: CardType[] = [];
  for (const [card, count] of Object.entries(DECK_COMPOSITION) as [CardType, number][]) {
    for (let i = 0; i < count; i++) cards.push(card);
  }
  return cards;
}

export function shuffledDeck(rngState: number): { deck: CardType[]; nextState: number } {
  const { result, nextState } = shuffle(buildOrderedDeck(), rngState);
  return { deck: result, nextState };
}

export interface DrawResult {
  card: CardType;
  deck: CardType[];
  discard: CardType[];
  nextRngState: number;
}

/**
 * Draws the top card. If the deck is empty, the discard pile (which does NOT
 * include the currently active/unresolved card -- callers must discard the
 * previous active card before calling drawCard for the next turn) is
 * reshuffled into a fresh deck first.
 */
export function drawCard(deck: CardType[], discard: CardType[], rngState: number): DrawResult {
  let workingDeck = deck;
  let workingDiscard = discard;
  let state = rngState;

  if (workingDeck.length === 0) {
    if (workingDiscard.length === 0) {
      throw new Error("Cannot draw: both deck and discard pile are empty");
    }
    const { result, nextState } = shuffle(workingDiscard, state);
    workingDeck = result;
    workingDiscard = [];
    state = nextState;
  }

  const newDeck = workingDeck.slice(0, -1);
  const card = workingDeck[workingDeck.length - 1]!;

  return { card, deck: newDeck, discard: workingDiscard, nextRngState: state };
}
