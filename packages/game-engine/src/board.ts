import type { PawnLocation, SeatColor } from "@bump-run/shared-types";
import { GAME_RULES } from "./config.js";

const { MAIN_TRACK_LENGTH, SAFE_ZONE_LENGTH, STEPS_ENTRY_TO_SAFE_ENTRANCE } = GAME_RULES;

/** Local coordinate marking Home -- one past the last safe-zone space. */
export const HOME_LOCAL = STEPS_ENTRY_TO_SAFE_ENTRANCE + SAFE_ZONE_LENGTH + 1; // 51 + 5 + 1 = 57

/**
 * Every pawn's journey -- from leaving Start to reaching Home -- is a single
 * monotonic line, private to that pawn's seat:
 *
 *   local 0            = the pawn's own entry square (just left Start)
 *   local 1..50        = further squares around the shared main track
 *   local 51           = the square immediately before this seat's safe-zone
 *   local 52..56       = this seat's 5 safe-zone spaces (index 1..5)
 *   local 57 (HOME)    = Home
 *
 * Converting to/from this local line is what makes forward movement,
 * safe-zone diversion, and exact-Home checks simple arithmetic instead of
 * scattered special cases. Backward movement on the shared ring (while still
 * on the main track) is handled separately in global coordinates, because a
 * pawn moving backward should freely cross anyone's entry square and keep
 * going around the physical ring rather than being bounded by its own local
 * coordinate's zero point.
 */
export function entryGlobalPos(seat: SeatColor, entryOffset: Record<SeatColor, number>): number {
  return entryOffset[seat] % MAIN_TRACK_LENGTH;
}

export function globalToLocal(globalPos: number, seat: SeatColor, entryOffset: Record<SeatColor, number>): number {
  const entry = entryGlobalPos(seat, entryOffset);
  return ((globalPos - entry) % MAIN_TRACK_LENGTH + MAIN_TRACK_LENGTH) % MAIN_TRACK_LENGTH;
}

export function localToGlobal(local: number, seat: SeatColor, entryOffset: Record<SeatColor, number>): number {
  if (local < 0 || local > STEPS_ENTRY_TO_SAFE_ENTRANCE) {
    throw new Error(`local coordinate ${local} is not on the main track`);
  }
  const entry = entryGlobalPos(seat, entryOffset);
  return (entry + local) % MAIN_TRACK_LENGTH;
}

/** Convert a pawn's current location into its seat-local line coordinate, or null if in Start. */
export function locationToLocal(
  location: PawnLocation,
  seat: SeatColor,
  entryOffset: Record<SeatColor, number>,
): number | null {
  switch (location.zone) {
    case "start":
      return null;
    case "main":
      return globalToLocal(location.pos, seat, entryOffset);
    case "safe":
      return STEPS_ENTRY_TO_SAFE_ENTRANCE + location.index;
    case "home":
      return HOME_LOCAL;
  }
}

/** Convert a seat-local line coordinate back into a concrete board location. */
export function localToLocation(
  local: number,
  seat: SeatColor,
  entryOffset: Record<SeatColor, number>,
): PawnLocation {
  if (local === HOME_LOCAL) return { zone: "home" };
  if (local > STEPS_ENTRY_TO_SAFE_ENTRANCE) {
    const index = local - STEPS_ENTRY_TO_SAFE_ENTRANCE;
    return { zone: "safe", index };
  }
  return { zone: "main", pos: localToGlobal(local, seat, entryOffset) };
}

export function logicalSpaceId(location: PawnLocation, seat: SeatColor): string {
  switch (location.zone) {
    case "start":
      return `${seat}-start`;
    case "home":
      return `${seat}-home`;
    case "safe":
      return `${seat}-safe-${String(location.index).padStart(2, "0")}`;
    case "main":
      return `main-${String(location.pos).padStart(2, "0")}`;
  }
}

export function sameLocation(a: PawnLocation, b: PawnLocation): boolean {
  if (a.zone !== b.zone) return false;
  if (a.zone === "main" && b.zone === "main") return a.pos === b.pos;
  if (a.zone === "safe" && b.zone === "safe") return a.index === b.index;
  return true; // start==start, home==home
}
