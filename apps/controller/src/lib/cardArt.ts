import type { CardType } from "@bump-run/shared-types";

const CARD_IMAGE: Record<CardType, string> = {
  CARD_1: "/art/cards/card_1.png",
  CARD_2: "/art/cards/card_2.png",
  CARD_3: "/art/cards/card_3.png",
  CARD_4: "/art/cards/card_4.png",
  CARD_5: "/art/cards/card_5.png",
  CARD_7: "/art/cards/card_7.png",
  CARD_8: "/art/cards/card_8.png",
  CARD_10: "/art/cards/card_10.png",
  CARD_11: "/art/cards/card_11.png",
  CARD_12: "/art/cards/card_12.png",
  BUMP: "/art/cards/card_bump.png",
};

export function cardImageSrc(type: CardType): string {
  return CARD_IMAGE[type];
}

export const CARD_BACK_IMAGE = "/art/cards/card_back.png";
