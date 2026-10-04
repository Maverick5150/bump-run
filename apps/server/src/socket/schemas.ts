import { z } from "zod";

export const seatColorSchema = z.enum(["red", "blue", "green", "yellow"]);

export const roomJoinSchema = z.object({
  roomCode: z.string().min(4).max(8),
  nickname: z.string().min(1).max(32),
});

export const roomReconnectSchema = z.object({
  roomCode: z.string().min(4).max(8),
  reconnectToken: z.string().min(10).max(128),
});

export const playerSetNameSchema = z.object({
  nickname: z.string().min(1).max(32),
});

export const playerSelectColorSchema = z.object({
  seat: seatColorSchema,
});

export const playerReadySchema = z.object({
  ready: z.boolean(),
});

const moveOptionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enterFromStart"), pawnId: z.string() }),
  z.object({ kind: z.literal("forward"), pawnId: z.string(), distance: z.number().int().positive() }),
  z.object({ kind: z.literal("backward"), pawnId: z.string(), distance: z.number().int().positive() }),
  z.object({
    kind: z.literal("split"),
    firstPawnId: z.string(),
    firstDistance: z.number().int().positive(),
    secondPawnId: z.string(),
    secondDistance: z.number().int().positive(),
  }),
  z.object({ kind: z.literal("swap"), ownPawnId: z.string(), opponentPawnId: z.string() }),
  z.object({ kind: z.literal("bump"), ownPawnId: z.string(), opponentPawnId: z.string() }),
  z.object({ kind: z.literal("pass") }),
]);

export const turnChooseMoveSchema = z.object({
  move: moveOptionSchema,
});

// eslint-disable-next-line no-control-regex -- intentionally stripping control characters
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

/**
 * Strips markup and control characters and collapses whitespace. Returns
 * null if nothing usable remains (caller should reject the request).
 */
export function sanitizeNickname(raw: string): string | null {
  const noTags = raw.replace(/<[^>]*>/g, "");
  const noControl = noTags.replace(CONTROL_CHARS, "");
  const collapsed = noControl.replace(/\s+/g, " ").trim();
  const clipped = collapsed.slice(0, 16);
  return clipped.length >= 1 ? clipped : null;
}
