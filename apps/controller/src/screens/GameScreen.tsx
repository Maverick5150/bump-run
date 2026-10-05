import { useMemo, useState, type CSSProperties } from "react";
import type { CardType, MoveOption, PublicGameState, SeatColor } from "@bump-run/shared-types";
import { CARD_LABELS } from "@bump-run/shared-types";
import { Board } from "../components/Board.js";
import { CARD_BACK_IMAGE, cardImageSrc } from "../lib/cardArt.js";
import { SEAT_INFO } from "../lib/seats.js";
import { getSettings } from "../lib/settings.js";
import { sounds } from "../lib/sound.js";

function seatFromPawnId(pawnId: string): SeatColor {
  return pawnId.split("-")[0] as SeatColor;
}

/** Fills a move-option button with its pawn's seat color -- text stays dark for contrast, same treatment as the seat-picker tiles in the lobby. */
function seatButtonStyle(seat: SeatColor): CSSProperties {
  const hex = SEAT_INFO[seat].hex;
  return { background: hex, borderColor: "rgba(255,255,255,0.4)", color: "#0b0a14" };
}

function vibrate(pattern: number | number[]) {
  if (!getSettings().vibrationEnabled) return;
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // unsupported -- ignore
    }
  }
}

function pawnShortLabel(pawnId: string): string {
  const [seat, index] = pawnId.split("-");
  return `${seat?.toUpperCase()} #${Number(index) + 1}`;
}

type Drill =
  | { step: "none" }
  | { step: "split-pawn" }
  | { step: "split-detail"; firstPawnId: string }
  | { step: "pair-own" } // for swap/bump
  | { step: "pair-opponent"; ownPawnId: string };

export function GameScreen(props: {
  publicState: PublicGameState;
  playerId: string | null;
  legalMoves: MoveOption[];
  lastCardDrawn: string | null;
  onDraw: () => void;
  onChooseMove: (move: MoveOption) => void;
}) {
  const { publicState, playerId, legalMoves } = props;
  const [drill, setDrill] = useState<Drill>({ step: "none" });
  const board = <Board publicState={publicState} />;

  const current = publicState.players[publicState.currentPlayerIndex];
  const isMyTurn = current?.playerId === playerId;
  const activeCard = publicState.activeCard as CardType | null;

  const splitOptions = useMemo(() => legalMoves.filter((m) => m.kind === "split"), [legalMoves]);
  const swapOptions = useMemo(() => legalMoves.filter((m) => m.kind === "swap"), [legalMoves]);
  const bumpOptions = useMemo(() => legalMoves.filter((m) => m.kind === "bump"), [legalMoves]);
  const simpleOptions = useMemo(
    () => legalMoves.filter((m) => m.kind === "forward" || m.kind === "backward" || m.kind === "enterFromStart"),
    [legalMoves],
  );
  const passOnly = legalMoves.length === 1 && legalMoves[0]!.kind === "pass";

  function choose(move: MoveOption) {
    // The actual move must always fire, no matter what -- sound/vibration
    // are cosmetic and must never be able to block it, so they run after.
    setDrill({ step: "none" });
    props.onChooseMove(move);
    vibrate(20);
    sounds.moveTick();
  }

  if (!isMyTurn) {
    const seatInfo = current?.seat ? SEAT_INFO[current.seat] : null;
    return (
      <div className="screen game-screen">
        <HeaderBar publicState={publicState} />
        {board}
        <div className="status-banner">
          {seatInfo ? (
            <>
              <span style={{ color: seatInfo.hex }}>{seatInfo.glyph}</span> {current?.nickname ?? "Someone"}'s turn
            </>
          ) : (
            "Waiting…"
          )}
        </div>
        <div className="card-blurb">Hang tight -- you'll get a big DRAW button on your turn.</div>
      </div>
    );
  }

  if (!activeCard) {
    return (
      <div className="screen game-screen">
        <HeaderBar publicState={publicState} />
        {board}
        <div className="status-banner active">Your turn!</div>
        <div className="draw-row">
          <img className="card-back-peek" src={CARD_BACK_IMAGE} alt="" />
          <button
            className="btn-draw"
            onClick={() => {
              vibrate(30);
              props.onDraw();
            }}
          >
            DRAW
          </button>
        </div>
      </div>
    );
  }

  const info = CARD_LABELS[activeCard];

  if (passOnly) {
    return (
      <div className="screen game-screen">
        <HeaderBar publicState={publicState} />
        {board}
        <div className="card-display"><img src={cardImageSrc(activeCard)} alt={info.label} /></div>
        <div className="card-blurb">No legal moves with this card. Pass and continue.</div>
        <button className="btn-primary" onClick={() => choose({ kind: "pass" })}>
          Pass
        </button>
      </div>
    );
  }

  // --- split wizard ---
  if (drill.step === "split-pawn" || (splitOptions.length > 0 && drill.step === "none" && simpleOptions.length === 0 && swapOptions.length === 0 && bumpOptions.length === 0)) {
    const pawns = [...new Set(splitOptions.map((m) => (m.kind === "split" ? m.firstPawnId : "")))];
    return (
      <div className="screen game-screen">
        <HeaderBar publicState={publicState} />
        {board}
        <div className="card-display"><img src={cardImageSrc(activeCard)} alt={info.label} /></div>
        <div className="card-blurb">
          {info.blurb}
          <br />
          Split move: choose the first pawn to move.
        </div>
        <div className="move-list">
          {pawns.map((pawnId) => (
            <button key={pawnId} className="move-option" style={seatButtonStyle(seatFromPawnId(pawnId))} onClick={() => setDrill({ step: "split-detail", firstPawnId: pawnId })}>
              <span className="pawn-chip">{pawnShortLabel(pawnId)}</span>
              <span>Choose →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (drill.step === "split-detail") {
    const combos = splitOptions.filter((m) => m.kind === "split" && m.firstPawnId === drill.firstPawnId);
    return (
      <div className="screen game-screen">
        <HeaderBar publicState={publicState} />
        {board}
        <div className="card-display"><img src={cardImageSrc(activeCard)} alt={info.label} /></div>
        <div className="card-blurb">Choose how far {pawnShortLabel(drill.firstPawnId)} moves.</div>
        <div className="move-list">
          {combos.map((m, i) =>
            m.kind === "split" ? (
              <button key={i} className="move-option" style={seatButtonStyle(seatFromPawnId(drill.firstPawnId))} onClick={() => choose(m)}>
                <span className="pawn-chip">{m.firstDistance} spaces</span>
                <span>
                  then {pawnShortLabel(m.secondPawnId)} +{m.secondDistance}
                </span>
              </button>
            ) : null,
          )}
        </div>
        <button className="link-button" onClick={() => setDrill({ step: "none" })}>
          ← Back
        </button>
      </div>
    );
  }

  // --- swap / bump wizard ---
  const pairOptions = activeCard === "BUMP" ? bumpOptions : swapOptions;
  if (pairOptions.length > 0 && (drill.step === "pair-own" || drill.step === "pair-opponent" || (drill.step === "none" && simpleOptions.length === 0))) {
    if (drill.step === "pair-opponent") {
      const choices = pairOptions.filter((m) => "ownPawnId" in m && m.ownPawnId === drill.ownPawnId);
      return (
        <div className="screen game-screen">
          <HeaderBar publicState={publicState} />
          {board}
          <div className="card-display"><img src={cardImageSrc(activeCard)} alt={info.label} /></div>
          <div className="card-blurb">
            {info.blurb}
            <br />
            Choose the opponent pawn.
          </div>
          <div className="move-list">
            {choices.map((m, i) =>
              "opponentPawnId" in m ? (
                <button key={i} className="move-option" style={seatButtonStyle(seatFromPawnId(m.opponentPawnId))} onClick={() => choose(m)}>
                  <span className="pawn-chip">{pawnShortLabel(m.opponentPawnId)}</span>
                  <span>{activeCard === "BUMP" ? "Bump!" : "Swap"}</span>
                </button>
              ) : null,
            )}
          </div>
          <button className="link-button" onClick={() => setDrill({ step: "none" })}>
            ← Back
          </button>
        </div>
      );
    }
    const ownPawns = [...new Set(pairOptions.map((m) => ("ownPawnId" in m ? m.ownPawnId : "")))];
    return (
      <div className="screen game-screen">
        <HeaderBar publicState={publicState} />
        {board}
        <div className="card-display"><img src={cardImageSrc(activeCard)} alt={info.label} /></div>
        <div className="card-blurb">
          {info.blurb}
          <br />
          {activeCard === "BUMP" ? "Choose your pawn in Start." : "Choose your pawn."}
        </div>
        <div className="move-list">
          {ownPawns.map((pawnId) => (
            <button key={pawnId} className="move-option" style={seatButtonStyle(seatFromPawnId(pawnId))} onClick={() => setDrill({ step: "pair-opponent", ownPawnId: pawnId })}>
              <span className="pawn-chip">{pawnShortLabel(pawnId)}</span>
              <span>Choose →</span>
            </button>
          ))}
        </div>
        {simpleOptions.length > 0 && (
          <button className="link-button" onClick={() => setDrill({ step: "none" })}>
            Use plain move instead
          </button>
        )}
      </div>
    );
  }

  // --- plain forward/backward/enterFromStart list (default view) ---
  return (
    <div className="screen game-screen">
      <HeaderBar publicState={publicState} />
      {board}
      <div className="card-display"><img src={cardImageSrc(activeCard)} alt={info.label} /></div>
      <div className="card-blurb">{info.blurb}</div>
      <div className="move-list">
        {simpleOptions.map((m, i) => (
          <button key={i} className="move-option" style={seatButtonStyle(seatFromPawnId(m.pawnId))} onClick={() => choose(m)}>
            <span className="pawn-chip">{pawnShortLabel(m.pawnId)}</span>
            <span>
              {m.kind === "enterFromStart" && "Leave Start"}
              {m.kind === "forward" && `Forward ${m.distance}`}
              {m.kind === "backward" && `Backward ${m.distance}`}
            </span>
          </button>
        ))}
        {splitOptions.length > 0 && (
          <button className="move-option" style={current ? seatButtonStyle(current.seat) : undefined} onClick={() => setDrill({ step: "split-pawn" })}>
            <span className="pawn-chip">Split move</span>
            <span>Choose →</span>
          </button>
        )}
        {pairOptions.length > 0 && (
          <button className="move-option" style={current ? seatButtonStyle(current.seat) : undefined} onClick={() => setDrill({ step: "pair-own" })}>
            <span className="pawn-chip">{activeCard === "BUMP" ? "BUMP!" : "Swap"}</span>
            <span>Choose →</span>
          </button>
        )}
      </div>
    </div>
  );
}

function HeaderBar(props: { publicState: PublicGameState }) {
  const { publicState } = props;
  return (
    <div className="status-banner" style={{ fontSize: "0.8rem", opacity: 0.7 }}>
      Turn {publicState.turnCount + 1}
    </div>
  );
}
