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

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(resolveServerUrl(), {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}
