import type { SeatColor } from "@bump-run/shared-types";

const PAWN_IMAGE: Record<SeatColor, string> = {
  red: "/art/pawns/pawn_red.png",
  blue: "/art/pawns/pawn_blue.png",
  green: "/art/pawns/pawn_green.png",
  yellow: "/art/pawns/pawn_yellow.png",
};

/** Standalone render of the same pawn artwork Board.tsx animates on the track -- used where a single large static pawn is needed (e.g. the win screen). */
export function PawnToken(props: { seat: SeatColor; size?: number }) {
  const size = props.size ?? 120;
  return (
    <img
      src={PAWN_IMAGE[props.seat]}
      alt=""
      width={size}
      height={size}
      style={{ display: "block", margin: "0 auto", filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.4))" }}
    />
  );
}
