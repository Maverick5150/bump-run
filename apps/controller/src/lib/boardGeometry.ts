import type { SeatColor } from "@bump-run/shared-types";

/**
 * Original square-perimeter board: the 52 shared main-track spaces run
 * clockwise around a square (13 spaces per side, one side "owned" by each
 * seat -- their entry sits at that side's first space). Each seat's 5-space
 * safety lane cuts straight inward from the midpoint of their own side to a
 * small home pocket near the center. Not any commercial board's layout --
 * a square perimeter + inward safety lanes is a generic race-game shape
 * shared by many games in this genre, executed here with its own spacing,
 * proportions, and corner-pad start areas.
 */
export const MAIN_TRACK_LENGTH = 52;
export const SAFE_ZONE_LENGTH = 5;
export const SEAT_ORDER: SeatColor[] = ["red", "blue", "green", "yellow"];

export const ENTRY_OFFSET: Record<SeatColor, number> = { red: 0, blue: 13, green: 26, yellow: 39 };

const SIDE_LEN = MAIN_TRACK_LENGTH / 4; // 13 spaces per side

export interface BoostLane {
  id: string;
  ownerColor: SeatColor;
  startPos: number;
  endPos: number;
}

export const BOOST_LANES: BoostLane[] = SEAT_ORDER.map((color) => {
  const entry = ENTRY_OFFSET[color];
  return {
    id: `boost-${color}`,
    ownerColor: color,
    startPos: (entry + 6) % MAIN_TRACK_LENGTH,
    endPos: (entry + 9) % MAIN_TRACK_LENGTH,
  };
});

export interface Point {
  x: number;
  y: number;
}

/** Outward diagonal direction from each seat's entry corner, for placing their Start pad just outside the board. */
const SEAT_CORNER_OUT: Record<SeatColor, Point> = {
  red: { x: -1, y: -1 },
  blue: { x: 1, y: -1 },
  green: { x: 1, y: 1 },
  yellow: { x: -1, y: 1 },
};

function norm(p: Point): Point {
  const d = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / d, y: p.y / d };
}

export class BoardGeometry {
  private readonly corners: Point[]; // TL, TR, BR, BL, TL (closed loop)
  private readonly homeDist: number;

  constructor(
    private readonly center: Point,
    private readonly half: number,
  ) {
    const c = center;
    const h = half;
    const TL = { x: c.x - h, y: c.y - h };
    const TR = { x: c.x + h, y: c.y - h };
    const BR = { x: c.x + h, y: c.y + h };
    const BL = { x: c.x - h, y: c.y + h };
    this.corners = [TL, TR, BR, BL, TL];
    this.homeDist = h * 0.208;
  }

  /** A point on the main track ring (now a square perimeter) at global position `pos`. */
  pointOnRing(pos: number): Point {
    const side = Math.floor(pos / SIDE_LEN) % 4;
    const t = (pos % SIDE_LEN) / SIDE_LEN;
    const a = this.corners[side]!;
    const b = this.corners[side + 1]!;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /**
   * Where this seat's safety lane branches off the main ring -- the space
   * immediately BEFORE their own entry corner (global position entry-1),
   * matching the engine's STEPS_ENTRY_TO_SAFE_ENTRANCE: a pawn must travel
   * almost the entire 52-space lap, arriving via the previous seat's side,
   * before it's allowed to turn toward home. This sits right next to that
   * seat's own Start corner, exactly like Sorry!'s safety-zone entrance --
   * NOT at the midpoint of their own side, which is a different,
   * unconnected spot on the ring and made pawns visually jump to a
   * location the rules never actually send them to.
   */
  private safetyAnchor(seat: SeatColor): Point {
    const entry = ENTRY_OFFSET[seat];
    const prevPos = (entry - 1 + MAIN_TRACK_LENGTH) % MAIN_TRACK_LENGTH;
    return this.pointOnRing(prevPos);
  }

  safeCellPoint(seat: SeatColor, index: number): Point {
    const outer = this.safetyAnchor(seat);
    const dir = norm({ x: outer.x - this.center.x, y: outer.y - this.center.y });
    const outerDist = Math.hypot(outer.x - this.center.x, outer.y - this.center.y);
    const t = index / (SAFE_ZONE_LENGTH + 1);
    const dist = outerDist - (outerDist - this.homeDist) * t;
    return { x: this.center.x + dir.x * dist, y: this.center.y + dir.y * dist };
  }

  homePoint(seat: SeatColor): Point {
    const outer = this.safetyAnchor(seat);
    const dir = norm({ x: outer.x - this.center.x, y: outer.y - this.center.y });
    return { x: this.center.x + dir.x * this.homeDist, y: this.center.y + dir.y * this.homeDist };
  }

  cornerForSeat(seat: SeatColor): Point {
    return this.corners[ENTRY_OFFSET[seat] / SIDE_LEN]!;
  }

  /** Where to center a seat's Start pad -- just outside the board, diagonally off their entry corner. */
  startPadCenter(seat: SeatColor, padDistance: number): Point {
    const corner = this.cornerForSeat(seat);
    const out = norm(SEAT_CORNER_OUT[seat]);
    return { x: corner.x + out.x * padDistance, y: corner.y + out.y * padDistance };
  }

  get boardHalf(): number {
    return this.half;
  }
}
