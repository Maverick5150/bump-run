import type { CardType } from "./gameTypes.js";

/** Original presentation text for each card -- shared by the controller UI and the TV UI. */
export const CARD_LABELS: Record<CardType, { label: string; blurb: string }> = {
  CARD_1: { label: "1", blurb: "Move 1 space, or launch a pawn from Start." },
  CARD_2: { label: "2", blurb: "Move 2 spaces, or launch from Start. Draw again!" },
  CARD_3: { label: "3", blurb: "Move 3 spaces." },
  CARD_4: { label: "4", blurb: "Move 4 spaces backward." },
  CARD_5: { label: "5", blurb: "Move 5 spaces." },
  CARD_7: { label: "7", blurb: "Move 7 spaces, or split between two pawns." },
  CARD_8: { label: "8", blurb: "Move 8 spaces." },
  CARD_10: { label: "10", blurb: "Move 10 spaces forward, or 1 space backward." },
  CARD_11: { label: "11", blurb: "Move 11 spaces, or swap with an opponent." },
  CARD_12: { label: "12", blurb: "Move 12 spaces." },
  BUMP: { label: "BUMP!", blurb: "Launch a pawn from Start directly onto an opponent." },
};
