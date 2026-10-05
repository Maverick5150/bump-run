import { CARD_LABELS } from "@bump-run/shared-types";
import type { CardType } from "@bump-run/shared-types";
import { CardArt } from "../components/CardArt.js";

const CARD_ORDER: CardType[] = ["CARD_1", "CARD_2", "CARD_3", "CARD_4", "CARD_5", "CARD_7", "CARD_8", "CARD_10", "CARD_11", "CARD_12", "BUMP"];

export function HowToPlayScreen(props: { onClose: () => void }) {
  return (
    <div className="screen how-to-play">
      <div className="logo" style={{ fontSize: "1.6rem" }}>
        How to Play
      </div>

      <div className="rules-section">
        <div className="rules-heading">The basics</div>
        <p>
          Everyone races 4 pawns clockwise around the board. On your turn, draw a card and move the pawn the number of
          spaces printed on it. Land exactly on an opponent's pawn to bump them back to their Start. Get all 4 of
          your pawns all the way around and into your home lane to win.
        </p>
      </div>

      <div className="rules-section">
        <div className="rules-heading">Safety zones</div>
        <p>
          The 5 colored spaces leading into your home are your safety lane -- only your own pawns can be there, and
          opponents can never land on or bump you inside it.
        </p>
      </div>

      <div className="rules-section">
        <div className="rules-heading">Boost lanes</div>
        <p>Landing exactly on the start of a colored boost lane instantly slides that pawn to the far end of it.</p>
      </div>

      <div className="rules-section">
        <div className="rules-heading">The cards</div>
        <div className="card-ref-list">
          {CARD_ORDER.map((type) => (
            <div className="card-ref-row" key={type}>
              <div className="card-ref-icon">
                <CardArt type={type} />
              </div>
              <div className="card-ref-text">
                <div className="card-ref-label">{CARD_LABELS[type].label}</div>
                <div className="card-ref-blurb">{CARD_LABELS[type].blurb}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-secondary" onClick={props.onClose}>
        Back
      </button>
    </div>
  );
}
