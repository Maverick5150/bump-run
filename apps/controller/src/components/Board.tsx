import { useMemo } from "react";
import type { PublicGameState, SeatColor } from "@bump-run/shared-types";
import { BOOST_LANES, BoardGeometry, MAIN_TRACK_LENGTH, SAFE_ZONE_LENGTH, SEAT_ORDER } from "../lib/boardGeometry.js";
import { SEAT_INFO } from "../lib/seats.js";

const SIZE = 320;
const CENTER = { x: SIZE / 2, y: SIZE / 2 };
const TRACK_RADIUS = SIZE * 0.33;

interface DrawnPawn {
  id: string;
  seat: SeatColor;
  x: number;
  y: number;
  isCurrent: boolean;
}

export function Board(props: { publicState: PublicGameState }) {
  const { publicState } = props;
  const geometry = useMemo(() => new BoardGeometry(CENTER, TRACK_RADIUS), []);
  const currentSeat = publicState.players[publicState.currentPlayerIndex]?.seat;

  const pawns: DrawnPawn[] = [];
  for (const player of publicState.players) {
    let startIdx = 0;
    for (const pawn of player.pawns) {
      const loc = pawn.location;
      let pt;
      if (loc.zone === "start") pt = geometry.startClusterPoint(player.seat, startIdx++);
      else if (loc.zone === "main") pt = geometry.pointOnRing(loc.pos);
      else if (loc.zone === "safe") pt = geometry.safeCellPoint(player.seat, loc.index);
      else pt = geometry.homePoint(player.seat);
      pawns.push({ id: pawn.id, seat: player.seat, x: pt.x, y: pt.y, isCurrent: player.seat === currentSeat });
    }
  }

  const ticks = Array.from({ length: MAIN_TRACK_LENGTH }, (_, i) => geometry.pointOnRing(i));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 340, display: "block", margin: "0 auto" }}>
      <circle cx={CENTER.x} cy={CENTER.y} r={TRACK_RADIUS} fill="none" stroke="#2a2648" strokeWidth={SIZE * 0.028} />
      {ticks.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={SIZE * 0.006} fill="#3a3458" />
      ))}
      {SEAT_ORDER.map((seat) => {
        const hex = SEAT_INFO[seat].hex;
        const cells = Array.from({ length: SAFE_ZONE_LENGTH }, (_, i) => geometry.safeCellPoint(seat, i + 1));
        const home = geometry.homePoint(seat);
        return (
          <g key={seat}>
            {cells.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={SIZE * 0.012} fill={hex} opacity={0.35} />
            ))}
            <circle cx={home.x} cy={home.y} r={SIZE * 0.035} fill={hex} opacity={0.5} />
          </g>
        );
      })}
      {BOOST_LANES.map((lane) => {
        const hex = SEAT_INFO[lane.ownerColor].hex;
        const start = geometry.pointOnRing(lane.startPos);
        const end = geometry.pointOnRing(lane.endPos);
        return (
          <g key={lane.id}>
            <circle cx={start.x} cy={start.y} r={SIZE * 0.016} fill={hex} opacity={0.25} />
            <circle cx={end.x} cy={end.y} r={SIZE * 0.016} fill={hex} opacity={0.55} />
          </g>
        );
      })}
      {pawns.map((p) => {
        const hex = SEAT_INFO[p.seat].hex;
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`} style={{ transition: "transform 320ms ease" }}>
            {p.isCurrent && <circle r={SIZE * 0.03} fill={hex} opacity={0.35} />}
            <circle r={SIZE * 0.02} fill={hex} stroke="#fff" strokeOpacity={0.85} strokeWidth={SIZE * 0.0035} />
          </g>
        );
      })}
    </svg>
  );
}
