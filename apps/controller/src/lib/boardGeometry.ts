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

/**
 * Direction (unit vector) from board center toward each seat's OWN side --
 * their safety lane runs along this line, from that side's midpoint
 * (outer) in to a home pocket near center (inner). Red owns the top side
 * (small y), so "toward red's side" from center is upward (0,-1); blue
 * owns the right side, "toward blue's side" is rightward (1,0); etc.
 */
const SEAT_DIR: Record<SeatColor, Point> = {
  red: { x: 0, y: -1 },
  blue: { x: 1, y: 0 },
  green: { x: 0, y: 1 },
  yellow: { x: -1, y: 0 },
};

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
  private readonly safeOuterDist: number;
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
    this.safeOuterDist = h; // every side's midpoint is exactly `half` from center on a square
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

  safeCellPoint(seat: SeatColor, index: number): Point {
    const dir = SEAT_DIR[seat];
    const t = index / (SAFE_ZONE_LENGTH + 1);
    const dist = this.safeOuterDist - (this.safeOuterDist - this.homeDist) * t;
    return { x: this.center.x + dir.x * dist, y: this.center.y + dir.y * dist };
  }

  homePoint(seat: SeatColor): Point {
    const dir = SEAT_DIR[seat];
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
