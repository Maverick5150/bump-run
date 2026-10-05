import { useEffect, useMemo, useRef, useState } from "react";
import type { PawnLocation, PublicGameState, SeatColor } from "@bump-run/shared-types";
import { BOOST_LANES, BoardGeometry, ENTRY_OFFSET, MAIN_TRACK_LENGTH, SAFE_ZONE_LENGTH, SEAT_ORDER, type Point } from "../lib/boardGeometry.js";
import { SEAT_INFO } from "../lib/seats.js";

const SIZE = 320;
const CENTER: Point = { x: SIZE / 2, y: SIZE / 2 };
const TRACK_RADIUS = SIZE * 0.33;

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
  const push = TRACK_RADIUS * 0.35 * bow;
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

function arcPath(startPos: number, endPos: number, radius: number): string {
  const a0 = (startPos / MAIN_TRACK_LENGTH) * 2 * Math.PI - Math.PI / 2;
  const a1 = (endPos / MAIN_TRACK_LENGTH) * 2 * Math.PI - Math.PI / 2;
  const p0 = { x: CENTER.x + Math.cos(a0) * radius, y: CENTER.y + Math.sin(a0) * radius };
  const p1 = { x: CENTER.x + Math.cos(a1) * radius, y: CENTER.y + Math.sin(a1) * radius };
  let delta = endPos - startPos;
  if (delta < 0) delta += MAIN_TRACK_LENGTH;
  const largeArc = delta > MAIN_TRACK_LENGTH / 2 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

function angleForSeat(seat: SeatColor): number {
  return (ENTRY_OFFSET[seat] / MAIN_TRACK_LENGTH) * 2 * Math.PI - Math.PI / 2;
}

function padCenterForSeat(seat: SeatColor): Point {
  const angle = angleForSeat(seat);
  return { x: CENTER.x + Math.cos(angle) * TRACK_RADIUS * 1.26, y: CENTER.y + Math.sin(angle) * TRACK_RADIUS * 1.26 };
}

const START_SLOT_OFFSET = SIZE * 0.034;

/** Clean 2x2 grid of waiting slots inside a seat's start pad -- not a radial jitter, so pawns never overlap. */
function startSlotPoint(seat: SeatColor, index: number): Point {
  const pad = padCenterForSeat(seat);
  const dx = index % 2 === 0 ? -START_SLOT_OFFSET : START_SLOT_OFFSET;
  const dy = index < 2 ? -START_SLOT_OFFSET : START_SLOT_OFFSET;
  return { x: pad.x + dx, y: pad.y + dy };
}

/** A small chevron tangent to the ring at `pos`, pointing the direction of travel, marking a slide lane. */
function chevronAt(pos: number, radius: number, size: number): string {
  const a = (pos / MAIN_TRACK_LENGTH) * 2 * Math.PI - Math.PI / 2;
  const p = { x: CENTER.x + Math.cos(a) * radius, y: CENTER.y + Math.sin(a) * radius };
  const tangent = a + Math.PI / 2;
  const back = { x: p.x - Math.cos(tangent) * size, y: p.y - Math.sin(tangent) * size };
  const n1 = { x: p.x + Math.cos(a) * size * 0.5, y: p.y + Math.sin(a) * size * 0.5 };
  const n2 = { x: p.x - Math.cos(a) * size * 0.5, y: p.y - Math.sin(a) * size * 0.5 };
  return `M ${n1.x} ${n1.y} L ${back.x} ${back.y} L ${n2.x} ${n2.y}`;
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
  const geometry = useMemo(() => new BoardGeometry(CENTER, TRACK_RADIUS), []);
  const currentSeat = publicState.players[publicState.currentPlayerIndex]?.seat;

  const prevKeys = useRef<Map<string, string>>(new Map());
  const renderPos = useRef<Map<string, Point>>(new Map());
  const tweens = useRef<Map<string, Tween>>(new Map());
  const pops = useRef<Map<string, number>>(new Map());
  const rafId = useRef<number | null>(null);
  const [, bump] = useState(0);

  function targetFor(seat: SeatColor, loc: PawnLocation, idxInStart: number): Point {
    if (loc.zone === "start") return startSlotPoint(seat, idxInStart);
    if (loc.zone === "main") return geometry.pointOnRing(loc.pos);
    if (loc.zone === "safe") return geometry.safeCellPoint(seat, loc.index);
    return geometry.homePoint(seat);
  }

  useEffect(() => {
    const now = performance.now();
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
  const drawn = publicState.players.flatMap((player) =>
    player.pawns.map((pawn) => {
      const p = renderPos.current.get(pawn.id) ?? CENTER;
      const popStart = pops.current.get(pawn.id);
      const popScale = popStart !== undefined ? 1 + 0.35 * Math.sin(Math.min(1, (now - popStart) / 320) * Math.PI) : 1;
      return { id: pawn.id, seat: player.seat, x: p.x, y: p.y, scale: popScale, isCurrent: player.seat === currentSeat };
    }),
  );

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 340, display: "block", margin: "0 auto" }}>
      <defs>
        <radialGradient id="boardGlow" cx="50%" cy="46%" r="65%">
          <stop offset="0%" stopColor="#2c2750" />
          <stop offset="60%" stopColor="#1b1830" />
          <stop offset="100%" stopColor="#14121f" />
        </radialGradient>
        {SEAT_ORDER.map((seat) => (
          <radialGradient key={seat} id={`pawnGrad-${seat}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
            <stop offset="35%" stopColor={SEAT_INFO[seat].hex} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>

      <circle cx={CENTER.x} cy={CENTER.y} r={SIZE * 0.48} fill="url(#boardGlow)" />
      <circle cx={CENTER.x} cy={CENTER.y} r={TRACK_RADIUS} fill="none" stroke="#352f57" strokeWidth={SIZE * 0.034} />
      <circle cx={CENTER.x} cy={CENTER.y} r={TRACK_RADIUS} fill="none" stroke="#211d3c" strokeWidth={SIZE * 0.034} strokeDasharray={`0 ${(2 * Math.PI * TRACK_RADIUS) / MAIN_TRACK_LENGTH - 2} 2 0`} />
      {Array.from({ length: MAIN_TRACK_LENGTH }, (_, i) => geometry.pointOnRing(i)).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={SIZE * 0.0055} fill="#4a4472" />
      ))}

      {BOOST_LANES.map((lane) => {
        const hex = SEAT_INFO[lane.ownerColor].hex;
        let span = lane.endPos - lane.startPos;
        if (span < 0) span += MAIN_TRACK_LENGTH;
        const chevronPositions = [0.22, 0.5, 0.78].map((f) => (lane.startPos + span * f) % MAIN_TRACK_LENGTH);
        return (
          <g key={lane.id}>
            <path
              d={arcPath(lane.startPos, lane.endPos, TRACK_RADIUS)}
              fill="none"
              stroke={hex}
              strokeOpacity={0.4}
              strokeWidth={SIZE * 0.034}
              strokeLinecap="round"
            />
            {chevronPositions.map((pos, i) => (
              <path
                key={i}
                d={chevronAt(pos, TRACK_RADIUS, SIZE * 0.013)}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.6}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        );
      })}

      {/* Start pads: a visible platform + 4 clearly separated sockets outside the ring where each seat's pawns wait. */}
      {SEAT_ORDER.map((seat) => {
        const hex = SEAT_INFO[seat].hex;
        const padCenter = padCenterForSeat(seat);
        const padSize = SIZE * 0.17;
        const sockets = [0, 1, 2, 3].map((i) => startSlotPoint(seat, i));
        return (
          <g key={seat}>
            <rect
              x={padCenter.x - padSize / 2}
              y={padCenter.y - padSize / 2}
              width={padSize}
              height={padSize}
              rx={SIZE * 0.022}
              fill={hex}
              opacity={0.14}
              stroke={hex}
              strokeOpacity={0.55}
              strokeWidth={1.5}
            />
            {sockets.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={SIZE * 0.017} fill="#00000030" stroke={hex} strokeOpacity={0.6} strokeWidth={1.2} />
            ))}
          </g>
        );
      })}

      {/* Safety zones + Home. */}
      {SEAT_ORDER.map((seat) => {
        const hex = SEAT_INFO[seat].hex;
        const cells = Array.from({ length: SAFE_ZONE_LENGTH }, (_, i) => geometry.safeCellPoint(seat, i + 1));
        const home = geometry.homePoint(seat);
        return (
          <g key={seat}>
            {cells.map((p, i) => (
              <rect key={i} x={p.x - SIZE * 0.014} y={p.y - SIZE * 0.014} width={SIZE * 0.028} height={SIZE * 0.028} rx={SIZE * 0.006} fill={hex} opacity={0.4} />
            ))}
            <circle cx={home.x} cy={home.y} r={SIZE * 0.04} fill={hex} opacity={0.22} />
            <circle cx={home.x} cy={home.y} r={SIZE * 0.028} fill={hex} opacity={0.6} />
            <circle cx={home.x} cy={home.y} r={SIZE * 0.04} fill="none" stroke={hex} strokeWidth={1.5} opacity={0.9} />
          </g>
        );
      })}

      {drawn.map((p) => {
        const hex = SEAT_INFO[p.seat].hex;
        const glyph = SEAT_INFO[p.seat].glyph;
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y}) scale(${p.scale})`} style={{ transition: "opacity 200ms" }}>
            {p.isCurrent && <circle r={SIZE * 0.034} fill={hex} opacity={0.3} />}
            <circle r={SIZE * 0.026} fill={`url(#pawnGrad-${p.seat})`} />
            <ellipse cx={0} cy={SIZE * 0.004} rx={SIZE * 0.019} ry={SIZE * 0.008} fill="#000" opacity={0.3} />
            <circle r={SIZE * 0.019} fill={hex} stroke="#fff" strokeOpacity={0.9} strokeWidth={SIZE * 0.0035} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={SIZE * 0.017} fill="#00000080" style={{ pointerEvents: "none" }}>
              {glyph}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
