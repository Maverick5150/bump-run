import type { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import type {
  ClientToServerEvents,
  MoveOption,
  RoomSummary,
  ServerToClientEvents,
  SeatColor,
} from "@bump-run/shared-types";
import { SEAT_COLORS } from "@bump-run/shared-types";
import {
  applyDraw,
  applyMove,
  createGame,
  getCurrentPlayer,
  getLegalMoves,
  serializePublicState,
  validateMove,
} from "@bump-run/game-engine";
import { SERVER_CONFIG } from "../config.js";
import { logger } from "../logger.js";
import type { IRoomStore, ServerPlayer, ServerRoom } from "../rooms/RoomStore.js";
import { chooseBotMove } from "./bot.js";
import { sanitizeNickname } from "./schemas.js";

const BOT_TURN_DELAY_MS = 900;
const BOT_MOVE_DELAY_MS = 700;
const BOT_NICKNAMES: Record<SeatColor, string> = {
  red: "AI Red",
  blue: "AI Blue",
  green: "AI Green",
  yellow: "AI Yellow",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketContext {
  roomId: string;
  role: "host" | "player";
  playerId?: string;
}

export class RoomApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export class RoomService {
  private contexts = new Map<string, SocketContext>();

  constructor(
    private io: IOServer,
    private store: IRoomStore,
  ) {}

  // ---------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------

  handleDisconnect(socket: IOSocket): void {
    const ctx = this.contexts.get(socket.id);
    if (!ctx) return;
    this.contexts.delete(socket.id);
    const room = this.store.getById(ctx.roomId);
    if (!room) return;

    if (ctx.role === "host") {
      // Only clear the host slot if THIS socket is still the one on record --
      // a newer reconnect may have already replaced it.
      if (room.hostSocketId === socket.id) {
        room.hostSocketId = null;
        logger.info({ roomCode: room.roomCode }, "TV host disconnected");
      }
    } else if (ctx.playerId) {
      const player = room.players.find((p) => p.playerId === ctx.playerId);
      if (player && player.socketId === socket.id) {
        player.connected = false;
        player.socketId = null;
        logger.info({ roomCode: room.roomCode, playerId: player.playerId }, "player disconnected");
        this.io.to(room.roomId).emit("player:left", { playerId: player.playerId });
      }
    }
    this.store.touch(room.roomId);
    this.broadcastRoomState(room);
  }

  // ---------------------------------------------------------------------
  // Room lifecycle
  // ---------------------------------------------------------------------

  createRoom(
    socket: IOSocket,
    rejoin?: { roomId?: string; hostToken?: string },
  ): { roomCode: string; roomId: string; hostToken: string } {
    if (rejoin?.roomId && rejoin.hostToken) {
      const existing = this.store.getById(rejoin.roomId);
      if (existing && existing.hostToken === rejoin.hostToken) {
        existing.hostSocketId = socket.id;
        this.contexts.set(socket.id, { roomId: existing.roomId, role: "host" });
        socket.join(existing.roomId);
        this.store.touch(existing.roomId);
        logger.info({ roomCode: existing.roomCode }, "TV host reattached to existing room");
        this.broadcastRoomState(existing);
        if (existing.game) {
          socket.emit("game:publicState", { state: serializePublicState(existing.game) });
        }
        return { roomCode: existing.roomCode, roomId: existing.roomId, hostToken: existing.hostToken };
      }
      // fall through to creating a fresh room if the rejoin target is gone/invalid
    }

    const room = this.store.createRoom();
    room.hostSocketId = socket.id;
    this.contexts.set(socket.id, { roomId: room.roomId, role: "host" });
    socket.join(room.roomId);
    logger.info({ roomCode: room.roomCode }, "room created");
    return { roomCode: room.roomCode, roomId: room.roomId, hostToken: room.hostToken };
  }

  joinRoom(socket: IOSocket, roomCode: string, rawNickname: string): { playerId: string; reconnectToken: string } {
    const room = this.store.getByCode(roomCode);
    if (!room) throw new RoomApiError("ROOM_NOT_FOUND", "That room no longer exists.");
    if (room.phase !== "lobby") {
      throw new RoomApiError("ROOM_IN_PROGRESS", "This game has already started.");
    }
    if (room.players.length >= room.settings.maxPlayers) {
      throw new RoomApiError("ROOM_FULL", "This game already has four players.");
    }
    const nickname = sanitizeNickname(rawNickname);
    if (!nickname) throw new RoomApiError("INVALID_NICKNAME", "Please enter a nickname.");

    const player: ServerPlayer = {
      playerId: nanoid(16),
      seat: null,
      nickname,
      ready: false,
      connected: true,
      socketId: socket.id,
      reconnectToken: nanoid(32),
      lastSeenAt: Date.now(),
      joinOrder: room.nextJoinOrder++,
    };
    room.players.push(player);
    this.contexts.set(socket.id, { roomId: room.roomId, role: "player", playerId: player.playerId });
    socket.join(room.roomId);
    this.store.touch(room.roomId);

    logger.info({ roomCode: room.roomCode, playerId: player.playerId }, "player joined");
    this.io.to(room.roomId).emit("player:joined", { playerId: player.playerId, nickname: player.nickname });
    this.broadcastRoomState(room);

    return { playerId: player.playerId, reconnectToken: player.reconnectToken };
  }

  reconnectPlayer(socket: IOSocket, roomCode: string, reconnectToken: string): { playerId: string } {
    const room = this.store.getByCode(roomCode);
    if (!room) throw new RoomApiError("ROOM_NOT_FOUND", "That room no longer exists.");
    const player = room.players.find((p) => p.reconnectToken === reconnectToken);
    if (!player) throw new RoomApiError("INVALID_TOKEN", "Could not restore your seat in this room.");

    player.connected = true;
    player.socketId = socket.id;
    player.lastSeenAt = Date.now();
    this.contexts.set(socket.id, { roomId: room.roomId, role: "player", playerId: player.playerId });
    socket.join(room.roomId);
    this.store.touch(room.roomId);

    logger.info({ roomCode: room.roomCode, playerId: player.playerId }, "player reconnected");
    this.io.to(room.roomId).emit("player:reconnected", { playerId: player.playerId });
    this.broadcastRoomState(room);
    if (room.game) {
      socket.emit("game:publicState", { state: serializePublicState(room.game) });
      this.sendPrivateStateIfCurrentPlayer(room, player.playerId);
    }

    return { playerId: player.playerId };
  }

  // ---------------------------------------------------------------------
  // Lobby actions
  // ---------------------------------------------------------------------

  setName(socket: IOSocket, rawNickname: string): void {
    const { room, player } = this.requirePlayer(socket);
    const nickname = sanitizeNickname(rawNickname);
    if (!nickname) throw new RoomApiError("INVALID_NICKNAME", "Please enter a nickname.");
    player.nickname = nickname;
    this.store.touch(room.roomId);
    this.broadcastRoomState(room);
  }

  selectColor(socket: IOSocket, seat: SeatColor): void {
    const { room, player } = this.requirePlayer(socket);
    if (room.phase !== "lobby") throw new RoomApiError("ROOM_IN_PROGRESS", "The game has already started.");
    const taken = room.players.some((p) => p.seat === seat && p.playerId !== player.playerId);
    if (taken) throw new RoomApiError("COLOR_TAKEN", "That color is already taken.");
    player.seat = seat;
    this.store.touch(room.roomId);
    this.broadcastRoomState(room);
  }

  setReady(socket: IOSocket, ready: boolean): void {
    const { room, player } = this.requirePlayer(socket);
    if (ready && !player.seat) throw new RoomApiError("NO_COLOR", "Choose a color first.");
    player.ready = ready;
    this.store.touch(room.roomId);
    this.broadcastRoomState(room);
  }

  startGame(socket: IOSocket, requestedBotSeats: SeatColor[] = []): void {
    const ctx = this.contexts.get(socket.id);
    if (!ctx || ctx.role !== "host") throw new RoomApiError("NOT_HOST", "Only the TV can start the game.");
    const room = this.store.getById(ctx.roomId);
    if (!room) throw new RoomApiError("ROOM_NOT_FOUND", "That room no longer exists.");

    const readyPlayers = room.players.filter((p) => p.ready && p.seat);
    const humanSeats = new Set(readyPlayers.map((p) => p.seat));
    // Defensive: never let a bot claim a seat a human already occupies, even
    // if the TV's request was built from a slightly stale snapshot.
    const botSeats = [...new Set(requestedBotSeats)].filter((seat) => !humanSeats.has(seat));

    if (readyPlayers.length + botSeats.length < room.settings.minPlayers) {
      throw new RoomApiError("NOT_ENOUGH_PLAYERS", `Need at least ${room.settings.minPlayers} players (human or AI).`);
    }
    if (readyPlayers.length === 0) {
      throw new RoomApiError("NOT_ENOUGH_PLAYERS", "At least one human player is needed to start.");
    }

    type Spec = { playerId: string; seat: SeatColor; nickname: string; isBot: boolean };
    const orderedBySeat: Spec[] = SEAT_COLORS.map((seat): Spec | null => {
      const human = readyPlayers.find((p) => p.seat === seat);
      if (human) return { playerId: human.playerId, seat, nickname: human.nickname, isBot: false };
      if (botSeats.includes(seat)) return { playerId: `bot-${seat}`, seat, nickname: BOT_NICKNAMES[seat], isBot: true };
      return null;
    }).filter((spec): spec is Spec => spec !== null);

    room.game = createGame(orderedBySeat);
    room.gameGeneration += 1;
    room.phase = "playing";
    this.store.touch(room.roomId);

    logger.info(
      { roomCode: room.roomCode, players: orderedBySeat.length, bots: botSeats.length },
      "game started",
    );
    this.io.to(room.roomId).emit("game:started", { state: serializePublicState(room.game) });
    this.broadcastRoomState(room);
    this.sendPrivateStateToCurrentPlayer(room);
    void this.maybeRunBotTurns(room, room.gameGeneration);
  }

  // ---------------------------------------------------------------------
  // Turn actions
  // ---------------------------------------------------------------------

  drawCard(socket: IOSocket): void {
    const { room, player } = this.requireActiveTurnPlayer(socket);
    if (!room.game) throw new RoomApiError("NO_GAME", "No game in progress.");
    if (room.game.activeCard) {
      throw new RoomApiError("CARD_ALREADY_ACTIVE", "Resolve the current card before drawing again.");
    }
    room.game = applyDraw(room.game);
    this.store.touch(room.roomId);
    this.io
      .to(room.roomId)
      .emit("turn:cardDrawn", { seat: player.seat!, card: room.game.activeCard ?? "" });
    this.io.to(room.roomId).emit("game:publicState", { state: serializePublicState(room.game) });
    this.sendPrivateStateToCurrentPlayer(room);
  }

  chooseMove(socket: IOSocket, move: MoveOption): void {
    const { room } = this.requireActiveTurnPlayer(socket);
    if (!room.game) throw new RoomApiError("NO_GAME", "No game in progress.");

    const validation = validateMove(room.game, move);
    if (!validation.valid) {
      throw new RoomApiError("ILLEGAL_MOVE", validation.reason ?? "That move is not legal right now.");
    }

    const { state } = applyMove(room.game, move);
    room.game = state;
    this.store.touch(room.roomId);

    this.io.to(room.roomId).emit("move:resolved", { state: serializePublicState(room.game) });
    for (const event of state.lastEvents) {
      if (event.type === "bumped") this.io.to(room.roomId).emit("player:bumped", event.payload as never);
      if (event.type === "boostTriggered") this.io.to(room.roomId).emit("boost:triggered", event.payload as never);
    }
    if (state.winnerSeat) {
      logger.info({ roomCode: room.roomCode, winner: state.winnerSeat }, "game won");
      room.phase = "gameOver";
      this.io.to(room.roomId).emit("game:won", { seat: state.winnerSeat });
    } else {
      const nowCurrent = getCurrentPlayer(room.game);
      this.io.to(room.roomId).emit("turn:started", { seat: nowCurrent.seat, playerId: nowCurrent.playerId });
      this.sendPrivateStateToCurrentPlayer(room);
      void this.maybeRunBotTurns(room, room.gameGeneration);
    }
  }

  // ---------------------------------------------------------------------
  // AI turns
  // ---------------------------------------------------------------------

  /**
   * Runs consecutive AI turns (draw + choose a move) for as long as the
   * current player is bot-controlled, pausing briefly between steps so the
   * game doesn't just instantly resolve in front of everyone. Stops as soon
   * as a human's turn comes up or the game ends. Bots never hold a socket,
   * so this is the only path that ever advances their turns.
   */
  private async maybeRunBotTurns(room: ServerRoom, generation: number): Promise<void> {
    while (room.game && room.phase === "playing" && room.gameGeneration === generation) {
      const current = getCurrentPlayer(room.game);
      if (!current.isBot) return;

      await delay(BOT_TURN_DELAY_MS);
      // The room could have moved on (expired/reset/a newer game started)
      // while we waited -- bail rather than act on a game we no longer own.
      if (!room.game || room.phase !== "playing" || room.gameGeneration !== generation) return;

      room.game = applyDraw(room.game);
      this.store.touch(room.roomId);
      this.io.to(room.roomId).emit("turn:cardDrawn", { seat: current.seat, card: room.game.activeCard ?? "" });
      this.io.to(room.roomId).emit("game:publicState", { state: serializePublicState(room.game) });

      await delay(BOT_MOVE_DELAY_MS);
      if (!room.game || room.phase !== "playing" || room.gameGeneration !== generation) return;

      const legal = getLegalMoves(room.game);
      const move = chooseBotMove(room.game, legal);
      const { state } = applyMove(room.game, move);
      room.game = state;
      this.store.touch(room.roomId);

      this.io.to(room.roomId).emit("move:resolved", { state: serializePublicState(room.game) });
      for (const event of state.lastEvents) {
        if (event.type === "bumped") this.io.to(room.roomId).emit("player:bumped", event.payload as never);
        if (event.type === "boostTriggered") this.io.to(room.roomId).emit("boost:triggered", event.payload as never);
      }

      if (state.winnerSeat) {
        logger.info({ roomCode: room.roomCode, winner: state.winnerSeat }, "game won (by AI)");
        room.phase = "gameOver";
        this.io.to(room.roomId).emit("game:won", { seat: state.winnerSeat });
        return;
      }

      const next = getCurrentPlayer(room.game);
      this.io.to(room.roomId).emit("turn:started", { seat: next.seat, playerId: next.playerId });
      if (!next.isBot) {
        this.sendPrivateStateToCurrentPlayer(room);
      }
      // loop continues: if `next` is also a bot (or CARD_2 granted this same
      // bot another turn), we keep going without waiting on any client.
    }
  }

  playAgain(socket: IOSocket): void {
    const ctx = this.contexts.get(socket.id);
    if (!ctx || ctx.role !== "host") throw new RoomApiError("NOT_HOST", "Only the TV can start a new game.");
    const room = this.store.getById(ctx.roomId);
    if (!room) throw new RoomApiError("ROOM_NOT_FOUND", "That room no longer exists.");

    for (const player of room.players) {
      player.ready = false;
    }
    room.game = null;
    room.phase = "lobby";
    this.store.touch(room.roomId);
    this.broadcastRoomState(room);
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private requirePlayer(socket: IOSocket): { room: ServerRoom; player: ServerPlayer } {
    const ctx = this.contexts.get(socket.id);
    if (!ctx || ctx.role !== "player" || !ctx.playerId) {
      throw new RoomApiError("NOT_IN_ROOM", "You are not currently in a room.");
    }
    const room = this.store.getById(ctx.roomId);
    if (!room) throw new RoomApiError("ROOM_NOT_FOUND", "That room no longer exists.");
    const player = room.players.find((p) => p.playerId === ctx.playerId);
    if (!player) throw new RoomApiError("NOT_IN_ROOM", "You are not currently in a room.");
    return { room, player };
  }

  /** Same as requirePlayer, but also asserts it is this player's turn and a game is active. */
  private requireActiveTurnPlayer(socket: IOSocket): { room: ServerRoom; player: ServerPlayer } {
    const { room, player } = this.requirePlayer(socket);
    if (!room.game) throw new RoomApiError("NO_GAME", "No game in progress.");
    const current = getCurrentPlayer(room.game);
    if (current.playerId !== player.playerId) {
      throw new RoomApiError("NOT_YOUR_TURN", "It is not your turn.");
    }
    return { room, player };
  }

  private sendPrivateStateToCurrentPlayer(room: ServerRoom): void {
    if (!room.game) return;
    const current = getCurrentPlayer(room.game);
    this.sendPrivateStateIfCurrentPlayer(room, current.playerId);
  }

  private sendPrivateStateIfCurrentPlayer(room: ServerRoom, playerId: string): void {
    if (!room.game) return;
    const current = getCurrentPlayer(room.game);
    if (current.playerId !== playerId) return;
    const target = room.players.find((p) => p.playerId === playerId);
    if (!target?.socketId) return;
    const legalMoves = room.game.activeCard ? getLegalMoves(room.game) : [];
    this.io.to(target.socketId).emit("game:privateState", { legalMoves });
  }

  private broadcastRoomState(room: ServerRoom): void {
    const summary: RoomSummary = {
      roomCode: room.roomCode,
      roomId: room.roomId,
      phase: room.phase,
      createdAt: room.createdAt,
      lastActivityAt: room.lastActivityAt,
      settings: room.settings,
    };
    this.io.to(room.roomId).emit("room:state", {
      room: summary,
      players: room.players.map((p) => ({
        playerId: p.playerId,
        seat: p.seat,
        nickname: p.nickname,
        ready: p.ready,
        connected: p.connected,
      })),
    });
  }
}

export function roomJoinUrl(roomCode: string): string {
  return `${SERVER_CONFIG.PUBLIC_BASE_URL}/join/${roomCode}`;
}
