import type { SeatColor } from "@bump-run/shared-types";
import { SEAT_INFO } from "../lib/seats.js";

export function WinScreen(props: { winnerSeat: SeatColor | null; myNickname: string }) {
  const info = props.winnerSeat ? SEAT_INFO[props.winnerSeat] : null;
  return (
    <div className="screen">
      <div className="logo">
        BUMP<span className="accent"> RUN</span>
      </div>
      <div className="winner-title" style={{ color: info?.hex }}>
        {info ? `${info.label} WINS!` : "Game Over"}
      </div>
      <div className="card-blurb">Waiting for the TV host to start a new game or return to the menu.</div>
    </div>
  );
}
