import type { SeatColor } from "@bump-run/shared-types";
import { SEAT_INFO } from "../lib/seats.js";

/** Standalone render of the same meeple silhouette Board.tsx animates on the track -- used where a single large static pawn is needed (e.g. the win screen). */
export function PawnToken(props: { seat: SeatColor; size?: number }) {
  const size = props.size ?? 120;
  const hex = SEAT_INFO[props.seat].hex;
  const gradId = `winPawnGrad-${props.seat}`;
  return (
    <svg viewBox="-12 -17 24 29" width={size} height={(size * 29) / 24} style={{ display: "block", margin: "0 auto" }}>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="35%" stopColor={hex} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={9} rx={9} ry={3} fill="#000" opacity={0.38} />
      <path
        d="M -6 1 C -8 4 -8 7 -8 8 L 8 8 C 8 7 8 4 6 1 C 7 -3 4 -6 0 -6 C -4 -6 -7 -3 -6 1 Z"
        fill={hex}
        stroke="#ffffff"
        strokeOpacity={0.55}
        strokeWidth={0.6}
      />
      <circle cx={0} cy={-9} r={5.2} fill={hex} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={0.6} />
      <circle cx={0} cy={-9} r={5.2} fill={`url(#${gradId})`} />
      <ellipse cx={-1.7} cy={-10.6} rx={1.9} ry={1.3} fill="#ffffff" opacity={0.55} />
    </svg>
  );
}
