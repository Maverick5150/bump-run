import { useEffect, useMemo, useRef, useState } from "react";
import type { PawnLocation, PublicGameState, SeatColor } from "@bump-run/shared-types";
import { BOOST_LANES, BoardGeometry, MAIN_TRACK_LENGTH, SAFE_ZONE_LENGTH, SEAT_ORDER, type Point } from "../lib/boardGeometry.js";
import { SEAT_INFO } from "../lib/seats.js";

const SIZE = 320;
const CENTER: Point = { x: SIZE / 2, y: SIZE / 2 };
const BOARD_HALF = SIZE * 0.33;
const TRACK_BOX = SIZE * 0.042;

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

const START_SLOT_OFFSET = SIZE * 0.038;

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

  function targetFor(seat: SeatColor, loc: PawnLocation, idxInStart: number): Point {
    if (loc.zone === "start") return startSlotPoint(padCenters.get(seat)!, idxInStart);
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

  const boardLeft = CENTER.x - BOARD_HALF;
  const boardTop = CENTER.y - BOARD_HALF;
  const boardSide = BOARD_HALF * 2;
  const ticks = Array.from({ length: MAIN_TRACK_LENGTH }, (_, i) => geometry.pointOnRing(i));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 440, display: "block", margin: "0 auto" }}>
      <defs>
        <radialGradient id="boardGlow" cx="50%" cy="46%" r="68%">
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

      <circle cx={CENTER.x} cy={CENTER.y} r={SIZE * 0.5} fill="url(#boardGlow)" />
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
            {[0.26, 0.5, 0.74].map((f, i) => {
              const cx = p0.x + dx * f;
              const cy = p0.y + dy * f;
              const back = { x: cx - ux * chevSize, y: cy - uy * chevSize };
              const n1 = { x: cx + nx * chevSize * 0.6, y: cy + ny * chevSize * 0.6 };
              const n2 = { x: cx - nx * chevSize * 0.6, y: cy - ny * chevSize * 0.6 };
              return (
                <path
                  key={i}
                  d={`M ${n1.x} ${n1.y} L ${back.x} ${back.y} L ${n2.x} ${n2.y}`}
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
              <circle key={i} cx={p.x} cy={p.y} r={SIZE * 0.027} fill="#00000030" stroke={hex} strokeOpacity={0.6} strokeWidth={1.2} />
            ))}
          </g>
        );
      })}

      {/* Safety lanes + Home. */}
      {SEAT_ORDER.map((seat) => {
        const hex = SEAT_INFO[seat].hex;
        const cells = Array.from({ length: SAFE_ZONE_LENGTH }, (_, i) => geometry.safeCellPoint(seat, i + 1));
        const home = geometry.homePoint(seat);
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
          </g>
        );
      })}

      {drawn.map((p) => {
        const hex = SEAT_INFO[p.seat].hex;
        const glyph = SEAT_INFO[p.seat].glyph;
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y}) scale(${p.scale})`} style={{ transition: "opacity 200ms" }}>
            {p.isCurrent && <circle r={SIZE * 0.044} fill={hex} opacity={0.32} />}
            <circle r={SIZE * 0.034} fill={`url(#pawnGrad-${p.seat})`} />
            <ellipse cx={0} cy={SIZE * 0.006} rx={SIZE * 0.026} ry={SIZE * 0.011} fill="#000" opacity={0.32} />
            <circle r={SIZE * 0.026} fill={hex} stroke="#fff" strokeOpacity={0.92} strokeWidth={SIZE * 0.0042} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={SIZE * 0.024} fill="#00000085" style={{ pointerEvents: "none" }}>
              {glyph}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
