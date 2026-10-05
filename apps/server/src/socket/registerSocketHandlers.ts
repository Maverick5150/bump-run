import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerAck, ServerToClientEvents } from "@bump-run/shared-types";
import { logger } from "../logger.js";
import type { IRoomStore } from "../rooms/RoomStore.js";
import { RateLimiter } from "./rateLimit.js";
import { RoomApiError, RoomService } from "./RoomService.js";
import {
  gameStartSchema,
  playerReadySchema,
  playerSelectColorSchema,
  playerSetNameSchema,
  roomJoinSchema,
  roomReconnectSchema,
  turnChooseMoveSchema,
} from "./schemas.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const EVENTS_PER_WINDOW = 20;
const WINDOW_MS = 1000;

export function registerSocketHandlers(io: IOServer, store: IRoomStore): RoomService {
  const service = new RoomService(io, store);
  const limiter = new RateLimiter(EVENTS_PER_WINDOW, WINDOW_MS);

  io.on("connection", (socket: IOSocket) => {
    logger.debug({ socketId: socket.id }, "socket connected");

    function guarded<Args extends unknown[]>(handler: (...args: Args) => void) {
      return (...args: Args) => {
        if (!limiter.allow(socket.id)) {
          socket.emit("room:error", { code: "RATE_LIMITED", message: "Slow down a little!" });
          return;
        }
        try {
          handler(...args);
        } catch (err) {
          if (err instanceof RoomApiError) {
            socket.emit("room:error", { code: err.code, message: err.message });
          } else {
            logger.error({ err, socketId: socket.id }, "unexpected socket handler error");
            socket.emit("room:error", { code: "INTERNAL_ERROR", message: "Something went wrong." });
          }
        }
      };
    }

    socket.on(
      "room:create",
      guarded(
        (
          payload: { rejoinRoomId?: string; rejoinHostToken?: string } | undefined,
          cb: (res: ServerAck<{ roomCode: string; roomId: string; hostToken: string }>) => void,
        ) => {
          const result = service.createRoom(socket, {
            roomId: payload?.rejoinRoomId,
            hostToken: payload?.rejoinHostToken,
          });
          cb({ ok: true, data: result });
        },
      ),
    );

    socket.on(
      "room:join",
      guarded((payload: unknown, cb: (res: ServerAck<{ playerId: string; reconnectToken: string }>) => void) => {
        const parsed = roomJoinSchema.parse(payload);
        try {
          const result = service.joinRoom(socket, parsed.roomCode, parsed.nickname);
          cb({ ok: true, data: result });
        } catch (err) {
          if (err instanceof RoomApiError) {
            cb({ ok: false, error: err.message });
          } else {
            throw err;
          }
        }
      }),
    );

    socket.on(
      "room:reconnect",
      guarded((payload: unknown, cb: (res: ServerAck<{ playerId: string }>) => void) => {
        const parsed = roomReconnectSchema.parse(payload);
        try {
          const result = service.reconnectPlayer(socket, parsed.roomCode, parsed.reconnectToken);
          cb({ ok: true, data: result });
        } catch (err) {
          if (err instanceof RoomApiError) {
            cb({ ok: false, error: err.message });
          } else {
            throw err;
          }
        }
      }),
    );

    socket.on(
      "player:setName",
      guarded((payload: unknown) => {
        const parsed = playerSetNameSchema.parse(payload);
        service.setName(socket, parsed.nickname);
      }),
    );

    socket.on(
      "player:selectColor",
      guarded((payload: unknown) => {
        const parsed = playerSelectColorSchema.parse(payload);
        service.selectColor(socket, parsed.seat);
      }),
    );

    socket.on(
      "player:ready",
      guarded((payload: unknown) => {
        const parsed = playerReadySchema.parse(payload);
        service.setReady(socket, parsed.ready);
      }),
    );

    socket.on(
      "game:start",
      guarded((payload: unknown) => {
        const parsed = gameStartSchema.parse(payload ?? {});
        service.startGame(socket, parsed.botSeats ?? []);
      }),
    );

    socket.on(
      "turn:draw",
      guarded(() => {
        service.drawCard(socket);
      }),
    );

    socket.on(
      "turn:chooseMove",
      guarded((payload: unknown) => {
        const parsed = turnChooseMoveSchema.parse(payload);
        service.chooseMove(socket, parsed.move);
      }),
    );

    socket.on(
      "game:playAgain",
      guarded(() => {
        service.playAgain(socket);
      }),
    );

    socket.on("disconnect", () => {
      limiter.clear(socket.id);
      service.handleDisconnect(socket);
      logger.debug({ socketId: socket.id }, "socket disconnected");
    });
  });

  return service;
}
