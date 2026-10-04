import type { SeatColor } from "@bump-run/shared-types";

/** Visual identity per seat -- color PLUS a distinct shape/symbol so the UI never relies on color alone. */
export const SEAT_INFO: Record<SeatColor, { hex: string; label: string; glyph: string }> = {
  red: { hex: "#ff5a3c", label: "Red", glyph: "▲" },
  blue: { hex: "#3ba7ff", label: "Blue", glyph: "●" },
  green: { hex: "#36d17a", label: "Green", glyph: "■" },
  yellow: { hex: "#ffd23f", label: "Yellow", glyph: "◆" },
};

export const ALL_SEATS: SeatColor[] = ["red", "blue", "green", "yellow"];
