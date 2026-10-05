import type { GameState, RoomSettings, SeatColor } from "@bump-run/shared-types";
import { nanoid } from "nanoid";
import { SERVER_CONFIG } from "../config.js";
import { generateUniqueRoomCode } from "./roomCodes.js";

export interface ServerPlayer {
  playerId: string;
  seat: SeatColor | null;
  nickname: string;
  ready: boolean;
  connected: boolean;
  socketId: string | null;
  reconnectToken: string;
  lastSeenAt: number;
  joinOrder: number;
}

export interface ServerRoom {
  roomId: string;
  roomCode: string;
  hostSocketId: string | null; // the TV's socket
  hostToken: string; // lets the TV reattach to this same room after a disconnect
  phase: "lobby" | "playing" | "gameOver";
  settings: RoomSettings;
  players: ServerPlayer[];
  game: GameState | null;
  /**
   * Bumped every time `game` is replaced with a freshly created game (see
   * RoomService.startGame). The async AI turn loop captures this value and
   * checks it on every wake-up so a stale loop from a previous game (e.g.
   * if the host mashes Play Again and restarts quickly) notices it's no
   * longer looking at the game it started with and stops, instead of
   * racing a newer loop on the same room.
   */
  gameGeneration: number;
  createdAt: number;
  lastActivityAt: number;
  nextJoinOrder: number;
}

/**
 * Storage abstraction for rooms. In-memory for V1 (documented, deliberate --
 * see docs/architecture.md). Swapping in Redis or another persistent store
 * later only requires a new class implementing this same interface.
 */
export interface IRoomStore {
  createRoom(): ServerRoom;
  getByCode(roomCode: string): ServerRoom | undefined;
  getById(roomId: string): ServerRoom | undefined;
  deleteRoom(roomId: string): void;
  touch(roomId: string): void;
  allRooms(): ServerRoom[];
  pruneExpired(): string[]; // returns ids of pruned rooms
}

export class InMemoryRoomStore implements IRoomStore {
  private roomsById = new Map<string, ServerRoom>();
  private roomIdByCode = new Map<string, string>();

  createRoom(): ServerRoom {
    const roomCode = generateUniqueRoomCode(new Set(this.roomIdByCode.keys()));
    const now = Date.now();
    const room: ServerRoom = {
      roomId: nanoid(12),
      roomCode,
      hostSocketId: null,
      hostToken: nanoid(32),
      phase: "lobby",
      settings: { maxPlayers: SERVER_CONFIG.MAX_PLAYERS, minPlayers: SERVER_CONFIG.MIN_PLAYERS },
      players: [],
      game: null,
      gameGeneration: 0,
      createdAt: now,
      lastActivityAt: now,
      nextJoinOrder: 0,
    };
    this.roomsById.set(room.roomId, room);
    this.roomIdByCode.set(room.roomCode, room.roomId);
    return room;
  }

  getByCode(roomCode: string): ServerRoom | undefined {
    const id = this.roomIdByCode.get(roomCode.toUpperCase());
    return id ? this.roomsById.get(id) : undefined;
  }

  getById(roomId: string): ServerRoom | undefined {
    return this.roomsById.get(roomId);
  }

  deleteRoom(roomId: string): void {
    const room = this.roomsById.get(roomId);
    if (!room) return;
    this.roomIdByCode.delete(room.roomCode);
    this.roomsById.delete(roomId);
  }

  touch(roomId: string): void {
    const room = this.roomsById.get(roomId);
    if (room) room.lastActivityAt = Date.now();
  }

  allRooms(): ServerRoom[] {
    return [...this.roomsById.values()];
  }

  pruneExpired(): string[] {
    const now = Date.now();
    const pruned: string[] = [];
    for (const room of this.roomsById.values()) {
      if (now - room.lastActivityAt > SERVER_CONFIG.ROOM_EXPIRATION_MS) {
        this.deleteRoom(room.roomId);
        pruned.push(room.roomId);
      }
    }
    return pruned;
  }
}
