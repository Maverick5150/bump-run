import { useEffect, useMemo, useRef, useState } from "react";
import type { PawnLocation, PublicGameState, SeatColor } from "@bump-run/shared-types";
import { BOOST_LANES, BoardGeometry, MAIN_TRACK_LENGTH, SAFE_ZONE_LENGTH, SEAT_ORDER, type Point } from "../lib/boardGeometry.js";
import { SEAT_INFO } from "../lib/seats.js";

const SIZE = 320;
const CENTER: Point = { x: SIZE / 2, y: SIZE / 2 };
const BOARD_HALF = SIZE * 0.33;
const TRACK_BOX = SIZE * 0.042;
/** Scales the pawn artwork (square 600x600 source canvas) to a bold, clearly visible size on the board. */
const PAWN_SCALE = 1.3;

const PAWN_IMAGE: Record<SeatColor, string> = {
  red: "/art/pawns/pawn_red.png",
  blue: "/art/pawns/pawn_blue.png",
  green: "/art/pawns/pawn_green.png",
  yellow: "/art/pawns/pawn_yellow.png",
};
const BOARD_FRAME_IMAGE = "/art/board/board_frame.png";

/**
 * How far to rotate the whole board so the CURRENT seat's own corner (and
 * Start pad) always ends up pointing toward the bottom of the screen --
 * same idea as turning a physical board to face whoever's turn it is.
 * Each seat's corner sits 90 degrees from the next, so these are exactly
 * 90 degrees apart; the values are "how much extra clockwise rotation
 * brings that corner from its resting angle to the bottom."
 */
const ROTATION_FOR_SEAT: Record<SeatColor, number> = { red: 225, blue: 135, green: 45, yellow: 315 };

function rotatePoint(p: Point, angleDeg: number, center: Point): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** Shortest signed angular delta from `from` to `to`, in (-180, 180] -- so the board always spins the short way, never the long way around. */
function shortestDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function locationKey(loc: PawnLocation): string {
  if (loc.zone === "main") return `main:${loc.pos}`;
  if (loc.zone === "safe") return `safe:${loc.index}`;
  return loc.zone;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function bezierControl(p0: Point, p2: Point, bow: number): Point {
  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const dx = mx - CENTER.x;
  const dy = my - CENTER.y;
  const dist = Math.hypot(dx, dy) || 1;
  const push = BOARD_HALF * 0.3 * bow;
  return { x: mx + (dx / dist) * push, y: my + (dy / dist) * push };
}

function quadBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/** Picks motion character (speed + how far it bows off the direct line) per transition kind. */
function classify(prevZone: string | undefined, nextZone: string): { duration: number; bow: number } {
  if (nextZone === "start") return { duration: 320, bow: 1.35 }; // bumped back -- a bigger, faster flick
  if (nextZone === "home") return { duration: 340, bow: 0.5 };
  if (prevZone === "start" && nextZone === "main") return { duration: 260, bow: 0.4 }; // leaving Start
  return { duration: 380, bow: 0.9 }; // ordinary forward/backward/safe-lane advance
}

const START_SLOT_OFFSET = SIZE * 0.044;

/** Clean 2x2 grid of waiting slots inside a seat's start pad -- not a radial jitter, so pawns never overlap. */
function startSlotPoint(padCenter: Point, index: number): Point {
  const dx = index % 2 === 0 ? -START_SLOT_OFFSET : START_SLOT_OFFSET;
  const dy = index < 2 ? -START_SLOT_OFFSET : START_SLOT_OFFSET;
  return { x: padCenter.x + dx, y: padCenter.y + dy };
}

interface Tween {
  from: Point;
  to: Point;
  control: Point;
  startedAt: number;
  duration: number;
}

export function Board(props: { publicState: PublicGameState }) {
  const { publicState } = props;
  const geometry = useMemo(() => new BoardGeometry(CENTER, BOARD_HALF), []);
  const currentSeat = publicState.players[publicState.currentPlayerIndex]?.seat;
  const padCenters = useMemo(() => {
    const map = new Map<SeatColor, Point>();
    for (const seat of SEAT_ORDER) map.set(seat, geometry.startPadCenter(seat, SIZE * 0.1));
    return map;
  }, [geometry]);

  const prevKeys = useRef<Map<string, string>>(new Map());
  const renderPos = useRef<Map<string, Point>>(new Map());
  const tweens = useRef<Map<string, Tween>>(new Map());
  const pops = useRef<Map<string, number>>(new Map());
  const rafId = useRef<number | null>(null);
  const [, bump] = useState(0);

  const prevSeatRef = useRef<SeatColor | undefined>(undefined);
  const rotationRef = useRef<number>(currentSeat ? ROTATION_FOR_SEAT[currentSeat] : 0);
  const rotationTween = useRef<{ from: number; to: number; startedAt: number; duration: number } | null>(null);

  function targetFor(seat: SeatColor, loc: PawnLocation, idxInStart: number): Point {
    if (loc.zone === "start") return startSlotPoint(padCenters.get(seat)!, idxInStart);
    if (loc.zone === "main") return geometry.pointOnRing(loc.pos);
    if (loc.zone === "safe") return geometry.safeCellPoint(seat, loc.index);
    return geometry.homePoint(seat);
  }

  useEffect(() => {
    const now = performance.now();
    if (currentSeat && prevSeatRef.current !== currentSeat) {
      if (prevSeatRef.current === undefined) {
        rotationRef.current = ROTATION_FOR_SEAT[currentSeat];
      } else {
        const target = ROTATION_FOR_SEAT[currentSeat];
        const from = rotationRef.current;
        const to = from + shortestDelta(from, target);
        rotationTween.current = { from, to, startedAt: now, duration: 600 };
      }
      prevSeatRef.current = currentSeat;
    }
    for (const player of publicState.players) {
      let startIdx = 0;
      for (const pawn of player.pawns) {
        const idxInStart = pawn.location.zone === "start" ? startIdx++ : 0;
        const key = locationKey(pawn.location);
        const prevKey = prevKeys.current.get(pawn.id);
        const target = targetFor(player.seat, pawn.location, idxInStart);
        if (prevKey === undefined) {
          renderPos.current.set(pawn.id, target);
        } else if (prevKey !== key) {
          const from = renderPos.current.get(pawn.id) ?? target;
          const { duration, bow } = classify(prevKey.split(":")[0], pawn.location.zone);
          tweens.current.set(pawn.id, { from, to: target, control: bezierControl(from, target, bow), startedAt: now, duration });
          if (pawn.location.zone === "home") pops.current.set(pawn.id, now);
        }
        prevKeys.current.set(pawn.id, key);
      }
    }
    if (rafId.current === null) rafId.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-diffs when publicState changes
  }, [publicState]);

  function step() {
    const now = performance.now();
    let active = false;
    for (const [id, tw] of tweens.current) {
      const t = Math.min(1, (now - tw.startedAt) / tw.duration);
      renderPos.current.set(id, quadBezier(tw.from, tw.control, tw.to, ease(t)));
      if (t >= 1) tweens.current.delete(id);
      else active = true;
    }
    for (const [id, startedAt] of pops.current) {
      if (now - startedAt > 320) pops.current.delete(id);
      else active = true;
    }
    const rt = rotationTween.current;
    if (rt) {
      const t = Math.min(1, (now - rt.startedAt) / rt.duration);
      rotationRef.current = rt.from + (rt.to - rt.from) * ease(t);
      if (t >= 1) rotationTween.current = null;
      else active = true;
    }
    bump((n) => n + 1);
    rafId.current = active ? requestAnimationFrame(step) : null;
  }

  useEffect(
    () => () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    },
    [],
  );

  const now = performance.now();
  const boardRotation = rotationRef.current;
  const drawn = publicState.players.flatMap((player) =>
    player.pawns.map((pawn) => {
      const p = renderPos.current.get(pawn.id) ?? CENTER;
      // Pawns render outside the rotated board group (so the artwork/number
      // stay upright), so their on-screen position has to be rotated here
      // by hand to match wherever the board itself currently points.
      const rp = rotatePoint(p, boardRotation, CENTER);
      const popStart = pops.current.get(pawn.id);
      const popScale = popStart !== undefined ? 1 + 0.35 * Math.sin(Math.min(1, (now - popStart) / 320) * Math.PI) : 1;
      const number = Number(pawn.id.split("-")[1] ?? 0) + 1; // pawn.id is "<seat>-<0-based index>"
      return { id: pawn.id, seat: player.seat, number, x: rp.x, y: rp.y, scale: popScale, isCurrent: player.seat === currentSeat };
    }),
  );

  const boardLeft = CENTER.x - BOARD_HALF;
  const boardTop = CENTER.y - BOARD_HALF;
  const boardSide = BOARD_HALF * 2;
  const ticks = Array.from({ length: MAIN_TRACK_LENGTH }, (_, i) => geometry.pointOnRing(i));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 600, display: "block", margin: "0 auto" }}>
      <defs>
        <radialGradient id="boardGlow" cx="50%" cy="46%" r="68%">
          <stop offset="0%" stopColor="#2c2750" />
          <stop offset="60%" stopColor="#1b1830" />
          <stop offset="100%" stopColor="#14121f" />
        </radialGradient>
      </defs>

      <circle cx={CENTER.x} cy={CENTER.y} r={SIZE * 0.5} fill="url(#boardGlow)" />
      <g transform={`rotate(${boardRotation} ${CENTER.x} ${CENTER.y})`}>
      <rect
        x={boardLeft - TRACK_BOX * 0.65}
        y={boardTop - TRACK_BOX * 0.65}
        width={boardSide + TRACK_BOX * 1.3}
        height={boardSide + TRACK_BOX * 1.3}
        rx={SIZE * 0.03}
        fill="#1b1830"
        stroke="#352f57"
        strokeWidth={2}
      />
      {ticks.map((p, i) => (
        <rect
          key={i}
          x={p.x - TRACK_BOX / 2}
          y={p.y - TRACK_BOX / 2}
          width={TRACK_BOX}
          height={TRACK_BOX}
          rx={SIZE * 0.007}
          fill="#262240"
          stroke="#4a4472"
          strokeWidth={1.2}
        />
      ))}

      {BOOST_LANES.map((lane) => {
        const hex = SEAT_INFO[lane.ownerColor].hex;
        const p0 = geometry.pointOnRing(lane.startPos);
        const p1 = geometry.pointOnRing(lane.endPos);
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const nx = -uy;
        const ny = ux;
        const chevSize = SIZE * 0.012;
        return (
          <g key={lane.id}>
            <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={hex} strokeOpacity={0.4} strokeWidth={SIZE * 0.034} strokeLinecap="round" />
            <text
              x={p0.x + dx * 0.5}
              y={p0.y + dy * 0.5}
              transform={`rotate(${(Math.atan2(uy, ux) * 180) / Math.PI} ${p0.x + dx * 0.5} ${p0.y + dy * 0.5})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={SIZE * 0.016}
              fontWeight={800}
              letterSpacing={0.5}
              fill="#ffffff"
              opacity={0.75}
              style={{ pointerEvents: "none" }}
            >
              SLIDE
            </text>
            {[0.26, 0.74].map((f, i) => {
              const cx = p0.x + dx * f;
              const cy = p0.y + dy * f;
              // Vertex leads in the direction of travel (p0 -> p1); the two
              // wings trail behind it, so the chevron reads as ">" pointing
              // the way a pawn actually slides.
              const tip = { x: cx + ux * chevSize, y: cy + uy * chevSize };
              const w1 = { x: cx - ux * chevSize * 0.5 + nx * chevSize * 0.6, y: cy - uy * chevSize * 0.5 + ny * chevSize * 0.6 };
              const w2 = { x: cx - ux * chevSize * 0.5 - nx * chevSize * 0.6, y: cy - uy * chevSize * 0.5 - ny * chevSize * 0.6 };
              return (
                <path
                  key={i}
                  d={`M ${w1.x} ${w1.y} L ${tip.x} ${tip.y} L ${w2.x} ${w2.y}`}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.6}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </g>
        );
      })}

      {/* Start pads: a visible platform + 4 clearly separated sockets outside each seat's entry corner. */}
      {SEAT_ORDER.map((seat) => {
        const hex = SEAT_INFO[seat].hex;
        const padCenter = padCenters.get(seat)!;
        const padSize = SIZE * 0.2;
        const sockets = [0, 1, 2, 3].map((i) => startSlotPoint(padCenter, i));
        const corner = geometry.cornerForSeat(seat);
        const outDx = padCenter.x - corner.x;
        const outDy = padCenter.y - corner.y;
        const outLen = Math.hypot(outDx, outDy) || 1;
        const labelPos = { x: padCenter.x + (outDx / outLen) * padSize * 0.43, y: padCenter.y + (outDy / outLen) * padSize * 0.43 };
        return (
          <g key={seat}>
            <rect
              x={padCenter.x - padSize / 2}
              y={padCenter.y - padSize / 2}
              width={padSize}
              height={padSize}
              rx={SIZE * 0.026}
              fill={hex}
              opacity={0.16}
              stroke={hex}
              strokeOpacity={0.6}
              strokeWidth={1.5}
            />
            {sockets.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={SIZE * 0.034} fill="#00000030" stroke={hex} strokeOpacity={0.6} strokeWidth={1.2} />
            ))}
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={SIZE * 0.019}
              fontWeight={800}
              letterSpacing={0.4}
              fill={hex}
              style={{ pointerEvents: "none" }}
            >
              START
            </text>
          </g>
        );
      })}

      {/* Safety lanes + Home. */}
      {SEAT_ORDER.map((seat) => {
        const hex = SEAT_INFO[seat].hex;
        const cells = Array.from({ length: SAFE_ZONE_LENGTH }, (_, i) => geometry.safeCellPoint(seat, i + 1));
        const home = geometry.homePoint(seat);
        const dirX = home.x - CENTER.x;
        const dirY = home.y - CENTER.y;
        const dirLen = Math.hypot(dirX, dirY) || 1;
        // Perpendicular to the lane direction, so the label sits beside the
        // home pocket in open space instead of overlapping the thin lane.
        const perpX = -dirY / dirLen;
        const perpY = dirX / dirLen;
        const homeLabelPos = { x: home.x + perpX * SIZE * 0.046, y: home.y + perpY * SIZE * 0.046 };
        const labelAngle = (Math.atan2(dirY, dirX) * 180) / Math.PI + 90;
        return (
          <g key={seat}>
            {cells.map((p, i) => (
              <rect
                key={i}
                x={p.x - TRACK_BOX / 2}
                y={p.y - TRACK_BOX / 2}
                width={TRACK_BOX}
                height={TRACK_BOX}
                rx={SIZE * 0.007}
                fill={hex}
                opacity={0.4}
                stroke={hex}
                strokeOpacity={0.7}
                strokeWidth={1}
              />
            ))}
            <circle cx={home.x} cy={home.y} r={SIZE * 0.034} fill={hex} opacity={0.2} />
            <circle cx={home.x} cy={home.y} r={SIZE * 0.024} fill={hex} opacity={0.65} />
            <circle cx={home.x} cy={home.y} r={SIZE * 0.024} fill="none" stroke={hex} strokeWidth={1.4} opacity={0.9} />
            <text
              x={homeLabelPos.x}
              y={homeLabelPos.y}
              transform={`rotate(${labelAngle} ${homeLabelPos.x} ${homeLabelPos.y})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={SIZE * 0.0135}
              fontWeight={800}
              letterSpacing={0.3}
              fill={hex}
              style={{ pointerEvents: "none" }}
            >
              HOME
            </text>
          </g>
        );
      })}
      </g>

      {drawn.map((p) => {
        const hex = SEAT_INFO[p.seat].hex;
        const s = PAWN_SCALE;
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y}) scale(${p.scale})`} style={{ transition: "opacity 200ms" }}>
            {p.isCurrent && <circle r={SIZE * 0.05} fill={hex} opacity={0.3} />}
            <ellipse cx={0} cy={9 * s} rx={8 * s} ry={2.6 * s} fill="#000" opacity={0.38} />
            <image href={PAWN_IMAGE[p.seat]} x={-9 * s} y={-16 * s} width={18 * s} height={18 * s} style={{ pointerEvents: "none" }} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              x={0}
              y={-10.5 * s}
              fontSize={5.6 * s}
              fontWeight={800}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={0.5 * s}
              paintOrder="stroke"
              style={{ pointerEvents: "none" }}
            >
              {p.number}
            </text>
          </g>
        );
      })}

      <image
        href={BOARD_FRAME_IMAGE}
        x={boardLeft - TRACK_BOX * 0.65}
        y={boardTop - TRACK_BOX * 0.65}
        width={boardSide + TRACK_BOX * 1.3}
        height={boardSide + TRACK_BOX * 1.3}
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}
