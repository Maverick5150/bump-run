import type { SeatColor } from "@bump-run/shared-types";

/**
 * Mirrors apps/tv/.../board/BoardGeometry.kt and BoardConfig.kt exactly, so
 * the phone's own board view matches the TV's board shape. Original
 * circular layout (not any commercial board): 52 shared main-track spaces
 * on a ring, each seat's 5-space safety lane running radially inward to a
 * small home pocket near the center.
 */
export const MAIN_TRACK_LENGTH = 52;
export const SAFE_ZONE_LENGTH = 5;
export const SEAT_ORDER: SeatColor[] = ["red", "blue", "green", "yellow"];

export const ENTRY_OFFSET: Record<SeatColor, number> = { red: 0, blue: 13, green: 26, yellow: 39 };

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

export class BoardGeometry {
  private readonly safeSpan: number;
  private readonly homeRadius: number;

  constructor(
    private readonly center: Point,
    private readonly trackRadius: number,
  ) {
    this.safeSpan = trackRadius * 0.6;
    this.homeRadius = trackRadius * 0.32;
  }

  private angleForMainPos(pos: number): number {
    const fraction = pos / MAIN_TRACK_LENGTH;
    return fraction * 2 * Math.PI - Math.PI / 2;
  }

  private angleForSeat(seat: SeatColor): number {
    return this.angleForMainPos(ENTRY_OFFSET[seat]);
  }

  pointOnRing(pos: number): Point {
    const a = this.angleForMainPos(pos);
    return { x: this.center.x + Math.cos(a) * this.trackRadius, y: this.center.y + Math.sin(a) * this.trackRadius };
  }

  private pointOnSpoke(seat: SeatColor, radius: number): Point {
    const a = this.angleForSeat(seat);
    return { x: this.center.x + Math.cos(a) * radius, y: this.center.y + Math.sin(a) * radius };
  }

  safeCellPoint(seat: SeatColor, index: number): Point {
    const t = index / (SAFE_ZONE_LENGTH + 1);
    const radius = this.trackRadius - this.safeSpan * t;
    return this.pointOnSpoke(seat, radius);
  }

  homePoint(seat: SeatColor): Point {
    const a = this.angleForSeat(seat);
    return { x: this.center.x + Math.cos(a) * this.homeRadius, y: this.center.y + Math.sin(a) * this.homeRadius };
  }

  startClusterPoint(seat: SeatColor, pawnIndex: number): Point {
    const a = this.angleForSeat(seat);
    const base = {
      x: this.center.x + Math.cos(a) * this.trackRadius * 1.22,
      y: this.center.y + Math.sin(a) * this.trackRadius * 1.22,
    };
    const jitterRadius = this.trackRadius * 0.08;
    const jitterAngle = a + (pawnIndex - 1.5) * 0.5;
    return {
      x: base.x + Math.cos(jitterAngle) * jitterRadius,
      y: base.y + Math.sin(jitterAngle) * jitterRadius,
    };
  }
}
