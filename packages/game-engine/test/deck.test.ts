import { describe, expect, it } from "vitest";
import { buildOrderedDeck, drawCard, shuffledDeck } from "../src/deck.js";
import { DECK_COMPOSITION } from "../src/config.js";
import { seedFromString } from "../src/rng.js";

describe("deck composition", () => {
  it("contains exactly the configured count of every card type, no missing or extra cards", () => {
    const deck = buildOrderedDeck();
    const total = Object.values(DECK_COMPOSITION).reduce((a, b) => a + b, 0);
    expect(deck.length).toBe(total);
    for (const [card, count] of Object.entries(DECK_COMPOSITION)) {
      expect(deck.filter((c) => c === card).length).toBe(count);
    }
  });
});

describe("seeded shuffling is deterministic", () => {
  it("produces the identical shuffle order for the same seed", () => {
    const seed = seedFromString("repeatable-seed");
    const a = shuffledDeck(seed);
    const b = shuffledDeck(seed);
    expect(a.deck).toEqual(b.deck);
  });

  it("produces different orders for different seeds (overwhelmingly likely)", () => {
    const a = shuffledDeck(seedFromString("seed-a"));
    const b = shuffledDeck(seedFromString("seed-b"));
    expect(a.deck).not.toEqual(b.deck);
  });
});

describe("drawing and reshuffling", () => {
  it("draws the top card and shrinks the deck by one", () => {
    const { deck } = shuffledDeck(seedFromString("x"));
    const result = drawCard(deck, [], 1);
    expect(result.deck.length).toBe(deck.length - 1);
    expect(result.card).toBe(deck[deck.length - 1]);
  });

  it("reshuffles the discard pile into a fresh deck once the draw pile is empty", () => {
    const discard = buildOrderedDeck();
    const result = drawCard([], discard, seedFromString("reshuffle"));
    expect(result.deck.length).toBe(discard.length - 1);
    expect(result.discard.length).toBe(0);
  });

  it("throws if both the deck and discard pile are empty", () => {
    expect(() => drawCard([], [], 1)).toThrow();
  });

  it("never reshuffles a card that is still the active (unresolved) card", () => {
    // Simulate: deck has one card left, discard has the rest. The caller is
    // responsible for only pushing a card into discard once it is fully
    // resolved, so at the moment of drawing, the "active" card of the
    // previous turn must already be in discard, never still floating loose.
    const full = buildOrderedDeck();
    const deck = [full[0]!];
    const discard = full.slice(1);
    const result = drawCard(deck, discard, seedFromString("y"));
    expect(result.card).toBe(full[0]);
    expect(result.deck.length + result.discard.length).toBe(full.length - 1);
  });
});
