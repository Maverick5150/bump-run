import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@bump-run/shared-types";

/**
 * The controller is normally served by the same origin as the realtime
 * server, so the default is same-origin. A `?server=http://host:port`
 * override lets a developer point the Vite dev server at a separately
 * running backend on the LAN.
 */
function resolveServerUrl(): string {
  const override = new URLSearchParams(window.location.search).get("server");
  if (override) return override;
  return window.location.origin;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function createConnection(): AppSocket {
  return io(resolveServerUrl(), {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
}

let socket: AppSocket | null = null;

/** The main connection: this phone's own seat at the table (player role). */
export function getSocket(): AppSocket {
  if (!socket) socket = createConnection();
  return socket;
}

let hostSocket: AppSocket | null = null;

/**
 * A second, independent connection used only for host-role actions
 * (room:create, game:start, game:playAgain) when this phone is running the
 * game itself with no separate TV -- the server's room model treats host
 * and player as different sockets (exactly how TV + phone normally work),
 * so self-hosting from one browser tab needs two sockets rather than one
 * socket trying to hold both roles.
 */
export function getHostSocket(): AppSocket {
  if (!hostSocket) hostSocket = createConnection();
  return hostSocket;
}
